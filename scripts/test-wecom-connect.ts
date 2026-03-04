
import { loadConfig } from '../src/core/config.js';
import { WeComChannel } from '../src/channels/wecom.js';
import { createLogger } from '../src/utils/logger.js';

const log = createLogger('test-wecom');

async function runTest() {
  try {
    console.log('Loading config...');
    const config = await loadConfig();
    
    if (!config.channels?.wecom) {
      console.error('WeCom config not found!');
      return;
    }

    console.log('Initializing WeCom channel...');
    const channel = new WeComChannel(config);
    
    // Test 1: Get Access Token
    console.log('Testing connection (Get Access Token)...');
    const token = await (channel as any).getAccessToken();
    
    if (token) {
      console.log('✅ Access Token obtained successfully!');
      console.log('Token preview:', token.substring(0, 10) + '...');
      
      // Test 2: Send Message
      const toUser = 'ChengYiHua'; // Hardcoded based on logs
      console.log(`Testing message send to ${toUser}...`);
      
      const wecomConfig = config.channels.wecom;
      const success = await (channel as any).sendSingleMessage(
        toUser, 
        'Connectivity Test: Connection is working! (Auto-retry logic verified)', 
        token, 
        wecomConfig
      );
      
      if (success) {
        console.log('✅ Message sent successfully!');
      } else {
        console.error('❌ Message send failed.');
      }
      
    } else {
      console.error('❌ Failed to get Access Token. Connection issue persists.');
    }

  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

runTest();
