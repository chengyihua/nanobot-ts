import { WechatyBuilder, ScanStatus } from 'wechaty';
// @ts-expect-error qrcode-terminal lacks types
import qrcodeTerminal from 'qrcode-terminal';
import { v4 as uuidv4 } from 'uuid';
import { Config } from '../core/config.js';
import { bus } from '../core/bus.js';

export class WeChatiPadChannel {
  private client: any;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  public async start() {
    const wechatConfig = this.config.channels?.wechat_ipad;
    if (!wechatConfig || !wechatConfig.enabled) return;

    console.log('🚀 Starting WeChat iPad Channel...');

    // Default to 'wechaty-puppet-padlocal' if not specified, as requested by user (iPad protocol)
    // Note: Users must install the puppet package manually: npm install wechaty-puppet-padlocal
    const puppet = wechatConfig.puppet || 'wechaty-puppet-padlocal';
    
    const puppetOptions: any = {
      puppet,
    };
    
    if (wechatConfig.token) {
      puppetOptions.puppetOptions = { token: wechatConfig.token };
    }

    try {
      this.client = WechatyBuilder.build(puppetOptions);
    } catch (e: any) {
      console.error(`❌ Failed to build Wechaty with puppet ${puppet}. Make sure the puppet package is installed.`);
      console.error(`Try: npm install ${puppet}`);
      return;
    }

    this.client.on('scan', (qrcode: string, status: ScanStatus) => {
      if (status === ScanStatus.Waiting || status === ScanStatus.Timeout) {
        console.log(`\nScan QR Code to login to WeChat (iPad Protocol): ${status}\n`);
        qrcodeTerminal.generate(qrcode, { small: true });
        const qrcodeImageUrl = [
          'https://wechaty.js.org/qrcode/',
          encodeURIComponent(qrcode),
        ].join('');
        console.log(`Or visit: ${qrcodeImageUrl}`);
      } else {
        console.log(`WeChat Scan status: ${status}`);
      }
    });

    this.client.on('login', (user: any) => {
      console.log(`✅ WeChat logged in as ${user.name()}`);
    });

    this.client.on('message', async (message: any) => {
      // Avoid self-messages
      if (message.self()) return;

      const contact = message.talker();
      const room = message.room();
      const text = message.text();
      const type = message.type();

      // Only handle text messages for now (type 7 is Text in some puppets, but using enum is safer)
      // Wechaty MessageType.Text is usually 7
      if (message.type() !== this.client.Message.Type.Text) {
          return;
      }

      // Check allow_from whitelist
      if (wechatConfig.allow_from && wechatConfig.allow_from.length > 0) {
        const name = contact.name();
        const id = contact.id;
        let allowed = false;
        
        // Check sender name/id
        if (wechatConfig.allow_from.includes(name) || wechatConfig.allow_from.includes(id)) {
            allowed = true;
        }
        
        // Check room topic if in room
        if (!allowed && room) {
            const topic = await room.topic();
            if (wechatConfig.allow_from.includes(topic)) {
                allowed = true;
            }
        }

        if (!allowed) return;
      }

      const senderName = contact.name();
      const roomTopic = room ? await room.topic() : '';
      
      console.log(`📩 WeChat Message: [${roomTopic || senderName}] ${text}`);

      // Normalize message to Nanobot format
      const payload = {
        id: uuidv4(),
        source: 'wechat_ipad',
        target: 'agent',
        content: text,
        type: 'text' as const,
        timestamp: Date.now(),
        metadata: {
          channel: 'wechat_ipad',
          sender: {
            id: contact.id,
            name: senderName,
            alias: await contact.alias() || '',
          },
          room: room ? {
            id: room.id,
            topic: roomTopic,
          } : undefined,
          original_type: type,
        }
      };

      bus.publish(payload);
    });

    this.client.on('logout', (user: any) => {
      console.log(`WeChat logged out: ${user}`);
    });

    this.client.on('error', (e: any) => {
      console.error('WeChat Client Error:', e);
    });

    try {
      await this.client.start();
    } catch (e) {
      console.error('❌ Failed to start WeChat client. Ensure the puppet is configured correctly and installed.');
      console.error(e);
    }

    // Listen for outgoing messages from Agent
    bus.onMessage(async (message) => {
      if (message.target === 'wechat_ipad' && message.content) {
         // Determine recipient
         // We expect metadata to contain the original sender info for replies
         const toUser = message.metadata?.sender?.id;
         const toRoom = message.metadata?.room?.id;

         try {
           if (toRoom) {
               const room = await this.client.Room.find({ id: toRoom });
               if (room) {
                   await room.say(message.content);
                   console.log(`📤 Sent WeChat to room ${toRoom}: ${message.content}`);
               }
           } else if (toUser) {
               const contact = await this.client.Contact.find({ id: toUser });
               if (contact) {
                   await contact.say(message.content);
                   console.log(`📤 Sent WeChat to user ${toUser}: ${message.content}`);
               }
           } else {
             console.warn('⚠️ Cannot send WeChat message: No recipient (room/user ID) found in metadata.');
           }
         } catch (err) {
            console.error('Failed to send WeChat message:', err);
         }
      }
    });
  }
}
