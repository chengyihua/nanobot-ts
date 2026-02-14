import express from 'express';
import axios from 'axios';
import { Config } from '../core/config.js';
import { bus } from '../core/bus.js';

export class QQChannel {
  private config: Config;
  private app = express();

  constructor(config: Config) {
    this.config = config;
  }

  public async start() {
    const qq = this.config.channels?.qq;
    if (!qq || !qq.enabled) {
      console.log('[QQ] Channel disabled.');
      return;
    }

    const port = qq.port || 3001;

    this.app.use(express.json());

    // Event Handling
    this.app.post(['/', '/qq'], async (req, res) => {
      const event = req.body;
      
      // Heartbeat or other meta events might flood logs, so filter if needed
      if (event.post_type !== 'meta_event') {
          console.log(`[QQ] Received event: ${event.post_type}`);
      }

      if (event.post_type === 'message') {
        const messageType = event.message_type; // 'private' or 'group'
        const userId = event.user_id;
        const groupId = event.group_id;
        const text = event.raw_message || event.message; 
        
        // Whitelist check
        if (qq.allow_from.length > 0) {
            // In group, we might want to allow specific groups OR specific users. 
            // For simplicity: if it's a group message, we check group_id. If private, user_id.
            const senderId = groupId ? String(groupId) : String(userId);
            if (!qq.allow_from.includes(senderId)) {
                // Also check if the specific user in the group is allowed? 
                // Maybe too complex for now. Let's stick to:
                // Group message -> check group_id
                // Private message -> check user_id
                console.log(`[QQ] Sender ${senderId} not allowed.`);
                return res.status(200).send({});
            }
        }

        const isGroup = messageType === 'group';
        // Unique Session ID for memory context
        const sessionId = isGroup ? `qq:group:${groupId}` : `qq:private:${userId}`;
        
        console.log(`[QQ] Message from ${userId} (Group: ${groupId || 'N/A'}): ${text}`);

        bus.publish({
          id: String(event.message_id),
          source: 'qq',
          target: 'agent',
          content: text,
          type: 'text',
          timestamp: Date.now(),
          metadata: {
            sessionId,
            userId,
            groupId,
            messageType,
            channel: 'qq'
          },
        });
      }

      res.status(204).send(); // Quick response
    });

    this.app.listen(port, () => {
      console.log(`[QQ] Callback server listening on port ${port}`);
    });

    // Listen for agent responses
    bus.onMessage(async (message) => {
      if (['agent', 'subagent'].includes(message.source) && (message.target === 'qq' || !message.target)) {
        // Check if this message belongs to a QQ session
        // Either explicitly targeted to qq channel or via sessionId convention
        if (message.metadata?.channel === 'qq' || message.metadata?.sessionId?.startsWith('qq:')) {
             await this.sendMessage(message);
        }
      }
    });
  }

  private async sendMessage(message: any) {
    const qq = this.config.channels?.qq;
    if (!qq) return;

    const { userId, groupId, messageType } = message.metadata;
    const content = message.content;

    try {
      const payload: any = {
        message: content,
      };

      if (messageType === 'group' && groupId) {
        payload.group_id = groupId;
      } else if (userId) {
        payload.user_id = userId;
      } else {
        console.warn('[QQ] Cannot determine recipient for message:', message);
        return;
      }

      // Use the generic send_msg API which handles both private and group automatically if parameters are correct
      // But explicit endpoints are safer if api_url is generic
      const apiUrl = `${qq.api_url.replace(/\/$/, '')}/send_msg`;

      console.log(`[QQ] Sending message to ${messageType === 'group' ? 'Group ' + groupId : 'User ' + userId}`);
      
      const headers: any = {
          'Content-Type': 'application/json'
      };
      if (qq.access_token) {
          headers['Authorization'] = `Bearer ${qq.access_token}`;
      }

      await axios.post(apiUrl, payload, { headers });
      
    } catch (error: any) {
      console.error('[QQ] Failed to send message:', error.message);
    }
  }
}
