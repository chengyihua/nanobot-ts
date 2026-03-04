
import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import dotenv from 'dotenv';

dotenv.config();

async function testWeCom() {
  const corpid = process.env.NANOBOT__CHANNELS__WECOM__CORPID;
  const corpsecret = process.env.NANOBOT__CHANNELS__WECOM__CORPSECRET;
  const proxyUrl = process.env.NANOBOT__CHANNELS__WECOM__PROXY;

  console.log('Testing WeCom connection...');
  console.log(`Proxy: ${proxyUrl}`);
  console.log(`CorpID: ${corpid}`);
  
  const agent = new SocksProxyAgent(proxyUrl!);
  
  try {
    const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${corpid}&corpsecret=${corpsecret}`;
    console.log('Fetching token from:', url);
    const response = await axios.get(url, { httpsAgent: agent, proxy: false });
    
    if (response.data.errcode === 0) {
      const token = response.data.access_token;
      console.log('✅ Token fetch SUCCESS!');
      console.log('Token (preview):', token.substring(0, 10) + '...');

      // Try sending a message
      console.log('\nAttempting to send test message...');
      const agentid = process.env.NANOBOT__CHANNELS__WECOM__AGENTID;
      // Try to send to the user who might be running this (ChenYiHua based on email?)
      // Or use '@all' if allowed (usually not for text)
      // Let's try a dummy user or prompt
      const toUser = process.argv[2] || 'ChenYiHua'; 
      console.log(`Target user: ${toUser}`);

      const sendUrl = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`;
      const payload = {
        touser: toUser,
        msgtype: 'text',
        agentid: agentid,
        text: {
          content: 'Test message from Nanobot diagnostic script.'
        },
        safe: 0
      };

      try {
        const sendResponse = await axios.post(sendUrl, payload, { httpsAgent: agent, proxy: false });
        console.log('Send response:', sendResponse.data);
        if (sendResponse.data.errcode === 0) {
          console.log('✅ Message send SUCCESS!');
        } else {
          console.log('❌ Message send FAILED:', sendResponse.data.errmsg);
        }
      } catch (sendErr: any) {
        console.error('❌ Send request failed:', sendErr.message);
      }

    } else {
      console.error('❌ Token fetch error:', response.data);
    }
  } catch (error: any) {
    console.error('❌ Request FAILED:', error.message);
    if (error.response) {
        console.error('Response data:', error.response.data);
    }
  }
}

testWeCom();
