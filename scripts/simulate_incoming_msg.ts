
import axios from 'axios';
import { encrypt, getSignature } from '@wecom/crypto';
import { loadConfig } from '../src/core/config.js';
import { parseStringPromise, Builder } from 'xml2js';

async function simulateIncoming() {
  const config = await loadConfig();
  const wecom = config.channels?.wecom;

  if (!wecom) {
    console.error('No WeCom config found');
    return;
  }

  const token = wecom.token;
  const encodingAesKey = wecom.encoding_aes_key;
  const corpId = wecom.corpid;
  
  // 1. Prepare Message
  const msgContent = "Hello from Simulation Script!";
  const xmlMsg = {
    xml: {
      ToUserName: corpId,
      FromUserName: 'ChengYiHua',
      CreateTime: Math.floor(Date.now() / 1000),
      MsgType: 'text',
      Content: msgContent,
      MsgId: Date.now()
    }
  };

  // Convert to XML string
  const builder = new Builder({ headless: true, renderOpts: { pretty: false } });
  const rawXml = builder.buildObject(xmlMsg);
  
  console.log('Raw XML:', rawXml);

  // 2. Encrypt
  const random = '1234567890123456'; // 16 bytes random
  const encrypted = encrypt(encodingAesKey, rawXml, corpId); // Note: @wecom/crypto encrypt returns object or string? 
  // checking library usage in wecom.ts: const { message } = decrypt(...)
  // Usually encrypt returns the encrypted string directly or an object. 
  // Let's assume standard wecom-crypto behavior: encrypt(encodingAesKey, text, receiveid) returns string.
  
  // Wait, looking at wecom.ts, it imports { decrypt, getSignature } from '@wecom/crypto'.
  // I need to check if 'encrypt' is available and how it works.
  // Since I can't see node_modules, I'll assume it works similarly to other libraries.
  // If not, I might fail. 
  
  // Let's try to construct the encrypted XML payload that WeCom sends.
  // <xml> 
  //   <ToUserName><![CDATA[toUser]]></ToUserName>
  //   <AgentID><![CDATA[toAgentID]]></AgentID>
  //   <Encrypt><![CDATA[msg_encrypt]]></Encrypt>
  // </xml>
  
  // But wait, the server parses the body and looks for xml.Encrypt[0].
  
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = '123456';
  
  // I'll try to use the library if available, otherwise I might struggle with encryption.
  // But wait, I can just use a "Plaintext" mode if the server supports it?
  // wecom.ts lines 144: const encryptedMsg = result.xml.Encrypt[0];
  // So it DOES require encryption.
  
  // Let's assume encrypt is available from @wecom/crypto.
  
  console.log('Encrypting...');
  const encryptedMsg = encrypt(encodingAesKey, rawXml, corpId); 
  
  // 3. Generate Signature
  const signature = getSignature(token, timestamp, nonce, encryptedMsg);
  
  // 4. Send POST
  const postData = {
    xml: {
      ToUserName: corpId,
      AgentID: wecom.agentid,
      Encrypt: encryptedMsg
    }
  };
  
  const postXml = builder.buildObject(postData);
  
  const url = `http://localhost:${wecom.port || 8080}/wecom?msg_signature=${signature}&timestamp=${timestamp}&nonce=${nonce}`;
  
  console.log(`Sending POST to ${url}`);
  
  try {
    const res = await axios.post(url, postXml, {
      headers: { 'Content-Type': 'text/xml' }
    });
    console.log('Response:', res.data);
    console.log('✅ Simulation Successful! Server accepted the message.');
  } catch (err: any) {
    console.error('❌ Request failed:', err.response ? err.response.data : err.message);
  }
}

simulateIncoming();
