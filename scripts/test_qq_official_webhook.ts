
import axios from 'axios';
import { QQOfficialChannel } from '../src/channels/qq-official.js';
import { bus } from '../src/core/bus.js';
import { ConfigSchema } from '../src/core/config.js';
import crypto from 'crypto';

async function testQQOfficialWebhook() {
  console.log('🧪 Starting QQ Official Webhook Test...');

  const PORT = 3002;
  const SECRET = 'test_secret_123456789012345678901234567890'; // Must be long enough or repeated

  const config = ConfigSchema.parse({
    channels: {
      qq_official: {
        enabled: true,
        appid: '10000',
        token: 'test_token',
        secret: SECRET,
        sandbox: true,
        webhook: {
          enabled: true,
          port: PORT,
          path: '/qq-webhook'
        }
      }
    }
  });

  const channel = new QQOfficialChannel(config);
  
  // Mock client to avoid network errors during start
  (channel as any).client = {
      messageApi: { postMessage: async () => {} },
      directMessageApi: { postDirectMessage: async () => {} },
      groupApi: { postGroupMessage: async () => {} },
      c2cApi: { postC2CMessage: async () => {} }
  };

  // Override start to skip createOpenAPI if needed, but the real start() calls it.
  // We hope createOpenAPI doesn't crash with dummy creds if we don't make calls.
  // Actually, createOpenAPI might valid config. Let's see.
  // If it fails, we might need to mock createOpenAPI via module mocking, 
  // but since we are in a script, it's harder.
  // Let's try running it. If it fails, we'll deal with it.
  
  try {
    await channel.start();
  } catch (e) {
    console.log('⚠️ Channel start warned (expected if API fails):', e);
  }

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 1000));

  // --- Helper to Generate Keys (Mirroring Bot Logic) ---
  function getKeys(secret: string) {
    let seed = secret;
    while (seed.length < 32) seed += secret;
    const seedBuffer = Buffer.from(seed, 'utf-8').subarray(0, 32);
    const prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
    const derBuffer = Buffer.concat([prefix, seedBuffer]);
    const privateKey = crypto.createPrivateKey({ key: derBuffer, format: 'der', type: 'pkcs8' });
    const publicKey = crypto.createPublicKey(privateKey);
    return { privateKey, publicKey };
  }

  const { privateKey, publicKey } = getKeys(SECRET);

  // --- Test 1: Validation (Op 13) ---
  console.log('\n🔹 Test 1: Validation (Op 13)');
  const plainToken = 'random_token_' + Date.now();
  const eventTs = Math.floor(Date.now() / 1000).toString();
  
  try {
    const res = await axios.post(`http://localhost:${PORT}/qq-webhook`, {
      op: 13,
      d: {
        plain_token: plainToken,
        event_ts: eventTs
      }
    });

    console.log('Response:', res.data);
    
    // Verify returned signature
    const returnedSig = res.data.signature;
    const dataToVerify = eventTs + plainToken;
    const isVerified = crypto.verify(
      null, 
      Buffer.from(dataToVerify), 
      publicKey, 
      Buffer.from(returnedSig, 'hex')
    );

    if (res.data.plain_token === plainToken && isVerified) {
      console.log('✅ Validation Successful');
    } else {
      console.error('❌ Validation Failed: Signature mismatch or token mismatch');
    }

  } catch (err: any) {
    console.error('❌ Validation Request Failed:', err.message);
  }

  // --- Test 2: Event Dispatch (Op 0) ---
  console.log('\n🔹 Test 2: Event Dispatch (Op 0)');
  
  // Listen to bus
  const messageReceivedPromise = new Promise<void>((resolve) => {
    bus.onMessage((msg) => {
        if (msg.source === 'qq_official') {
            console.log('✅ Bus received message:', msg.content);
            resolve();
        }
    });
  });

  const payload = {
    op: 0,
    t: 'GUILD_MESSAGES',
    id: 'evt_123',
    d: {
      id: 'msg_123',
      channel_id: 'chn_123',
      guild_id: 'guild_123',
      content: 'Hello Webhook',
      timestamp: new Date().toISOString(),
      author: {
        id: 'user_123',
        username: 'TestUser',
        bot: false
      }
    }
  };

  const rawBody = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  // Sign: timestamp + rawBody
  const dataToSign = Buffer.concat([Buffer.from(timestamp), Buffer.from(rawBody)]);
  const signature = crypto.sign(null, dataToSign, privateKey).toString('hex');

  try {
    const res = await axios.post(`http://localhost:${PORT}/qq-webhook`, payload, {
      headers: {
        'x-signature-ed25519': signature,
        'x-signature-timestamp': timestamp
      }
    });
    console.log('Response:', res.data);
  } catch (err: any) {
    console.error('❌ Dispatch Request Failed:', err.message);
  }

  await messageReceivedPromise;
  console.log('🏁 Test Finished');
  process.exit(0);
}

testQQOfficialWebhook();
