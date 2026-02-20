import axios from 'axios';
import { encrypt, getSignature } from '@wecom/crypto';
import fs from 'fs';
import path from 'path';

// Load config
const configPath = path.join(process.cwd(), '.nanobot', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const wecom = config.channels.wecom;

if (!wecom || !wecom.enabled) {
  console.error('WeCom channel not enabled in config');
  process.exit(1);
}

const { token, encoding_aes_key: encodingAESKey, corpid } = wecom;

// Construct a test message
const fromUser = 'ChengYihua';
// Force subagent usage
const content = '请务必使用 spawnSubagent 工具启动一个后台子代理，任务是列出当前目录的文件。不要直接运行命令。';
const timestamp = Math.floor(Date.now() / 1000).toString();
const nonce = Math.random().toString(36).substring(2, 10);

const rawXml = `<xml>
  <ToUserName><![CDATA[${corpid}]]></ToUserName>
  <FromUserName><![CDATA[${fromUser}]]></FromUserName>
  <CreateTime>${timestamp}</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[${content}]]></Content>
  <MsgId>${Date.now()}</MsgId>
  <AgentID>${wecom.agentid}</AgentID>
</xml>`;

console.log('Raw XML:', rawXml);

// Encrypt
const encrypted = encrypt(encodingAESKey, rawXml, corpid);
const signature = getSignature(token, timestamp, nonce, encrypted);

const bodyXml = `<xml>
  <ToUserName><![CDATA[${corpid}]]></ToUserName>
  <AgentID><![CDATA[${wecom.agentid}]]></AgentID>
  <Encrypt><![CDATA[${encrypted}]]></Encrypt>
</xml>`;

const url = `http://localhost:8080/wecom?msg_signature=${signature}&timestamp=${timestamp}&nonce=${nonce}`;

console.log('Sending request to:', url);

axios.post(url, bodyXml, {
  headers: { 'Content-Type': 'application/xml' }
})
.then(res => {
  console.log('Response status:', res.status);
  console.log('Response data:', res.data);
})
.catch(err => {
  console.error('Error:', err.message);
  if (err.response) {
    console.error('Response status:', err.response.status);
    console.error('Response data:', err.response.data);
  }
});
