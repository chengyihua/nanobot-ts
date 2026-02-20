import { createOpenAPI, createWebsocket, AvailableIntentsEventsEnum } from 'qq-guild-bot';
import express from 'express';
import crypto from 'crypto';
import { Config } from '../core/config.js';
import { bus } from '../core/bus.js';

export class QQOfficialChannel {
  private config: Config;
  private client: any;
  private ws: any;
  private app: express.Express | null = null;
  private privateKey: crypto.KeyObject | null = null;
  private publicKey: crypto.KeyObject | null = null;

  constructor(config: Config) {
    this.config = config;
  }

  public async start(app?: express.Express) {
    const qqConfig = this.config.channels?.qq_official;
    if (!qqConfig || !qqConfig.enabled) {
      console.log('[QQ Official] Channel disabled.');
      return;
    }

    const botConfig = {
      appID: qqConfig.appid,
      token: qqConfig.token,
      intents: this.mapIntents(qqConfig.intents),
      sandbox: qqConfig.sandbox,
    };

    // Initialize API Client (needed for sending messages in both modes)
    this.client = createOpenAPI(botConfig);

    // Listen for agent responses
    bus.onMessage(async (message) => {
      if (['agent', 'subagent'].includes(message.source) && (message.target === 'qq_official' || !message.target)) {
        if (message.metadata?.channel === 'qq_official') {
          await this.sendMessage(message);
        }
      }
    });

    // Check if Webhook is enabled
    if (qqConfig.webhook?.enabled) {
      await this.startWebhook(qqConfig, app);
    } else {
      await this.startWebSocket(botConfig);
    }
  }

  private async startWebSocket(botConfig: any) {
    try {
      // Create WebSocket client for events
      this.ws = createWebsocket(botConfig);

      console.log('[QQ Official] Connecting to QQ Guild/Group via WebSocket...');

      // Listen for messages
      this.ws.on('GUILD_MESSAGES', (data: any) => this.handleGuildMessage(data));
      this.ws.on('DIRECT_MESSAGE', (data: any) => this.handleDirectMessage(data));
      this.ws.on('GROUP_AT_MESSAGE_CREATE', (data: any) => this.handleGroupAtMessage(data));
      this.ws.on('C2C_MESSAGE_CREATE', (data: any) => this.handleC2CMessage(data));

      console.log('✅ QQ Official channel started (WebSocket)');
    } catch (error) {
      console.error('[QQ Official] Failed to start WebSocket:', error);
    }
  }

  private async startWebhook(qqConfig: any, app?: express.Express) {
    const { port, path } = qqConfig.webhook;
    console.log(`[QQ Official] Registering Webhook at path: "${path}"`);
    
    // Prepare Keys
    this.prepareKeys(qqConfig.secret);

    // Use shared app or create new one
    this.app = app || express();
    
    // If using own app, add middleware
    if (!app) {
      this.app.use(express.json({
        verify: (req: any, res, buf) => {
          req.rawBody = buf;
        }
      }));
    }

    this.app.post(path, async (req: any, res) => {
      // Safety check for body
      if (!req.body) {
        console.warn('[QQ Official] Webhook received empty body');
        return res.status(400).send('Empty Body');
      }

      const op = req.body.op;
      
      // 1. Validation Request (Op 13)
      if (op === 13) {
        return this.handleValidation(req, res);
      }

      // 2. Event Dispatch (Op 0)
      if (op === 0) {
        return this.handleDispatch(req, res);
      }

      // Other Ops (Heartbeat etc. usually not sent via Webhook)
      res.status(200).send({ message: 'ignored' });
    });

    // Only listen if we created the app (standalone mode)
    if (!app) {
      this.app.listen(port, () => {
        console.log(`✅ QQ Official channel started (Webhook) on port ${port}, path: ${path}`);
      });
    } else {
      console.log(`✅ QQ Official channel attached to Gateway (Webhook) path: ${path}`);
    }
  }

  private prepareKeys(secret: string) {
    try {
      // 1. Repeat secret to ensure enough length (>= 32 bytes)
      let seed = secret;
      while (seed.length < 32) {
        seed += secret;
      }
      const seedBuffer = Buffer.from(seed, 'utf-8').subarray(0, 32);

      // 2. Construct Ed25519 Private Key in DER format (PKCS#8)
      // Prefix: 302e020100300506032b657004220420
      const prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
      const derBuffer = Buffer.concat([prefix, seedBuffer]);

      this.privateKey = crypto.createPrivateKey({
        key: derBuffer,
        format: 'der',
        type: 'pkcs8'
      });

      this.publicKey = crypto.createPublicKey(this.privateKey);
      
      console.log('[QQ Official] Keys generated successfully from secret.');
    } catch (error) {
      console.error('[QQ Official] Failed to generate keys:', error);
    }
  }

  private handleValidation(req: any, res: any) {
    const { plain_token, event_ts } = req.body.d;
    
    if (!this.privateKey) {
      return res.status(500).send('Keys not initialized');
    }

    try {
      // Sign: event_ts + plain_token
      const dataToSign = event_ts + plain_token;
      const signatureBuffer = crypto.sign(null, Buffer.from(dataToSign), this.privateKey);
      const signature = signatureBuffer.toString('hex');

      res.status(200).json({
        plain_token: plain_token,
        signature: signature
      });
      console.log('[QQ Official] Webhook Validation Successful');
    } catch (error) {
      console.error('[QQ Official] Validation failed:', error);
      res.status(500).send('Validation failed');
    }
  }

  private async handleDispatch(req: any, res: any) {
    // Verify Signature
    const signature = req.headers['x-signature-ed25519'];
    const timestamp = req.headers['x-signature-timestamp'];
    
    if (!signature || !timestamp) {
      console.warn('[QQ Official] Missing signature headers');
      return res.status(401).send('Missing signature');
    }

    if (!this.publicKey) {
      return res.status(500).send('Keys not initialized');
    }

    try {
      // Verify: timestamp + rawBody
      // Note: req.rawBody must be available
      const dataToVerify = Buffer.concat([
        Buffer.from(timestamp as string),
        req.rawBody
      ]);

      const isVerified = crypto.verify(
        null, 
        dataToVerify, 
        this.publicKey, 
        Buffer.from(signature as string, 'hex')
      );

      if (!isVerified) {
        console.warn('[QQ Official] Invalid signature');
        return res.status(401).send('Invalid signature');
      }
    } catch (error) {
      console.error('[QQ Official] Signature verification error:', error);
      return res.status(401).send('Verification error');
    }

    // Process Event
    const eventType = req.body.t;
    // const eventId = req.body.id; // currently unused, reserved for future correlation
    const data = req.body.d;

    // Acknowledge immediately
    res.status(200).send({ message: 'received' });

    console.log(`[QQ Official] Received Event: ${eventType}`); // Debug log

    // Map Webhook Payload to SDK Handler input
    // SDK handlers usually expect { msg: ... } or just the data object depending on how we called them.
    // In startWebSocket: this.ws.on('GUILD_MESSAGES', (data) => this.handleGuildMessage(data));
    // The 'data' passed by SDK is usually the inner object or wrapped.
    // Official docs say 'd' contains the message structure directly for message events.
    // Let's assume SDK handlers expect { msg: data } based on previous code: const msg = data.msg;
    // So we wrap it.
    
    const wrappedData = { msg: data };

    try {
      switch (eventType) {
        case 'AT_MESSAGE_CREATE':
        case 'MESSAGE_CREATE':
        case 'GUILD_MESSAGES': // Fallback just in case
          await this.handleGuildMessage(wrappedData);
          break;
        case 'DIRECT_MESSAGE_CREATE':
        case 'DIRECT_MESSAGE': // Fallback
          await this.handleDirectMessage(wrappedData);
          break;
        case 'GROUP_AT_MESSAGE_CREATE':
          await this.handleGroupAtMessage(wrappedData);
          break;
        case 'C2C_MESSAGE_CREATE':
          await this.handleC2CMessage(wrappedData);
          break;
        default:
          console.log(`[QQ Official] Unhandled event type: ${eventType}`);
          break;
      }
    } catch (err) {
      console.error(`[QQ Official] Error handling event ${eventType}:`, err);
    }
  }

  private mapIntents(intents: string[]): AvailableIntentsEventsEnum[] {
    // Map string intents to SDK Enum
    return intents.map(intent => intent as AvailableIntentsEventsEnum);
  }

  private async handleGuildMessage(data: any) {
    const msg = data.msg;
    const content = msg.content;
    const author = msg.author;
    
    // Ignore self messages usually handled by SDK but good to check
    if (author.bot) return;

    console.log(`[QQ Official] Guild Message from ${author.username}: ${content}`);

    bus.publish({
      id: msg.id,
      source: 'qq_official',
      target: 'agent',
      content: content,
      type: 'text',
      timestamp: Date.parse(msg.timestamp),
      metadata: {
        channel: 'qq_official',
        sessionId: `qq_official:guild:${msg.guild_id}:${msg.channel_id}`,
        guildId: msg.guild_id,
        channelId: msg.channel_id,
        messageId: msg.id,
        authorId: author.id,
        msgType: 'guild'
      },
    });
  }

  private async handleDirectMessage(data: any) {
    const msg = data.msg;
    const content = msg.content;
    const author = msg.author;

    console.log(`[QQ Official] DM from ${author.username}: ${content}`);

    bus.publish({
      id: msg.id,
      source: 'qq_official',
      target: 'agent',
      content: content,
      type: 'text',
      timestamp: Date.parse(msg.timestamp),
      metadata: {
        channel: 'qq_official',
        sessionId: `qq_official:dm:${msg.guild_id}:${author.id}`, // DMs are associated with a guild usually
        guildId: msg.guild_id,
        channelId: msg.channel_id, // DM channel ID
        messageId: msg.id,
        authorId: author.id,
        msgType: 'dm'
      },
    });
  }

  private async handleGroupAtMessage(data: any) {
    const msg = data.msg;
    const content = msg.content.trim(); // Usually contains @Bot
    const author = msg.author;

    console.log(`[QQ Official] Group @ Message from ${author.id}: ${content}`);

    bus.publish({
      id: msg.id,
      source: 'qq_official',
      target: 'agent',
      content: content,
      type: 'text',
      timestamp: Date.parse(msg.timestamp),
      metadata: {
        channel: 'qq_official',
        sessionId: `qq_official:group:${msg.group_openid}`,
        groupId: msg.group_openid,
        messageId: msg.id,
        authorId: author.id, // member_openid
        msgType: 'group'
      },
    });
  }

  private async handleC2CMessage(data: any) {
    const msg = data.msg;
    
    if (!msg) {
        console.warn('[QQ Official] C2C Message payload empty');
        return;
    }

    console.log('[QQ Official] C2C Payload:', JSON.stringify(msg));

    const content = msg.content;
    const author = msg.author;
    const userId = author?.user_openid || author?.id || 'unknown';

    console.log(`[QQ Official] C2C Message from ${userId}: ${content}`);

    bus.publish({
      id: msg.id,
      source: 'qq_official',
      target: 'agent',
      content: content,
      type: 'text',
      timestamp: Date.parse(msg.timestamp),
      metadata: {
        channel: 'qq_official',
        sessionId: `qq_official:c2c:${userId}`,
        messageId: msg.id,
        authorId: userId,
        msgType: 'c2c'
      },
    });
  }

  private async sendMessage(message: any) {
    const meta = message.metadata;
    const content = message.content;
    
    try {
      if (meta.msgType === 'guild') {
        await this.client.messageApi.postMessage(meta.channelId, {
          content: content,
          msg_id: meta.messageId // Reply to the message
        });
      } else if (meta.msgType === 'dm') {
         await this.client.directMessageApi.postDirectMessage(meta.guildId, {
          content: content,
          msg_id: meta.messageId
        });
      } else if (meta.msgType === 'group') {
         await this.client.groupApi.postGroupMessage(meta.groupId, {
            content: content,
            msg_id: meta.messageId,
            msg_seq: 1 // Required for group messages
         });
      } else if (meta.msgType === 'c2c') {
          await this.client.c2cApi.postC2CMessage(meta.authorId, {
              content: content,
              msg_id: meta.messageId,
              msg_seq: 1
          });
      }
      
      console.log(`[QQ Official] Sent reply to ${meta.msgType}`);
    } catch (error) {
      console.error('[QQ Official] Failed to send message:', error);
    }
  }
}
