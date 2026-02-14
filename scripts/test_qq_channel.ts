import axios from 'axios';
import { QQChannel } from '../src/channels/qq.js';
import { bus } from '../src/core/bus.js';
import { ConfigSchema } from '../src/core/config.js';

async function testQQ() {
  console.log('🧪 Starting QQ Channel Test...');

  const config = ConfigSchema.parse({
    channels: {
      qq: {
        enabled: true,
        port: 3001,
        api_url: 'http://localhost:5700', // Mock OneBot
        allow_from: [],
      }
    }
  });

  const channel = new QQChannel(config);
  await channel.start();

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Listen to bus
  bus.onMessage(async (msg) => {
    if (msg.source === 'qq') {
      console.log('✅ Bus received QQ message:', msg.content);
      console.log('   Metadata:', msg.metadata);

      // Simulate Agent Reply
      setTimeout(() => {
        console.log('🤖 Simulating Agent Reply...');
        bus.publish({
          id: 'reply-1',
          source: 'agent',
          target: 'qq',
          content: 'Hello QQ User!',
          type: 'text',
          timestamp: Date.now(),
          metadata: msg.metadata // Echo metadata
        });
      }, 500);
    }
  });

  // Simulate OneBot Event
  try {
    console.log('📨 Sending simulated OneBot event...');
    await axios.post('http://localhost:3001', {
      post_type: 'message',
      message_type: 'private',
      user_id: 123456,
      message: 'Hello Bot',
      message_id: 1001,
      raw_message: 'Hello Bot'
    });
    console.log('✅ Event sent successfully');
  } catch (err) {
    console.error('❌ Failed to send event:', err);
  }

  // Keep alive for a bit to see reply logs
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('🏁 Test finished (Check logs for send message attempt)');
  process.exit(0);
}

testQQ();
