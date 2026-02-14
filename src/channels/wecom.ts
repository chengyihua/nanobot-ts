import express from 'express';
import { parseStringPromise } from 'xml2js';
import { decrypt, getSignature } from '@wecom/crypto';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

import { Config, getWorkspacePath } from '../core/config.js';
import { bus } from '../core/bus.js';
import { TranscriptionService } from '../core/transcription.js';

export class WeComChannel {
  private config: Config;
  private app = express();
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(config: Config) {
    this.config = config;
  }

  public async start(app?: express.Application) {
    const wecom = this.config.channels?.wecom;
    if (!wecom || !wecom.enabled) {
      console.log('[WeCom] Channel disabled.');
      return;
    }
    
    if (wecom.proxy) {
        console.log(`[WeCom] Using proxy: ${wecom.proxy}`);
    }

    const server = app || this.app;
    const port = wecom.port || process.env.WECOM_PORT || 3000;

    // In-memory rate limit state (per-process)
    const rateHits = new Map<string, { count: number; ts: number }>();
    const RATE_WINDOW_MS = 60_000;
    const RATE_LIMIT = 120;

    // Middleware to handle raw body for decryption (apply to shared app or local app)
    // Safe to add globally as it only matches XML content types
    server.use(express.text({ type: ['*/xml', 'text/xml', 'application/xml'], limit: '200kb' }));

    // Lightweight logging + timeout + rate limit + optional IP allowlist
    server.use((req, res, next) => {
        console.log(`[WeCom] ${req.method} ${req.url}`);
        req.setTimeout(10_000);

        const ip = (req.ip || '').replace('::ffff:', '') || 'unknown';
        const now = Date.now();
        const rec = rateHits.get(ip) || { count: 0, ts: now };
        if (now - rec.ts > RATE_WINDOW_MS) {
            rec.count = 0;
            rec.ts = now;
        }
        rec.count += 1;
        rateHits.set(ip, rec);
        if (rec.count > RATE_LIMIT) {
            return res.status(429).send('Too Many Requests');
        }

        const allowIps = wecom.allow_ips || [];
        if (allowIps.length > 0 && !isIpAllowed(ip, allowIps)) {
            console.warn(`[WeCom] Rejected request from disallowed IP: ${ip}`);
            return res.status(403).send('Forbidden');
        }

        next();
    });

    // URL Verification (GET)
    server.get(['/', '/wecom'], (req, res) => {
      console.log(`[WeCom] Received GET request for verification on path: ${req.path}`);
      const { msg_signature, timestamp, nonce, echostr } = req.query;
      
      if (!msg_signature || !timestamp || !nonce || !echostr) {
        console.warn('[WeCom] Missing parameters in GET request:', req.query);
        return res.status(400).send('Missing parameters');
      }

      try {
        const signature = getSignature(wecom.token, timestamp as string, nonce as string, echostr as string);
        if (signature !== msg_signature) {
          console.warn('[WeCom] Invalid signature in GET request');
          return res.status(401).send('Invalid signature');
        }

        const { message } = decrypt(wecom.encoding_aes_key, echostr as string);
        console.log('[WeCom] Verification success, decrypted echostr:', message);
        res.send(message);
      } catch (error) {
        console.error('[WeCom] Verification error:', error);
        res.status(500).send('Internal Server Error');
      }
    });

    // Message Receiving (POST)
    server.post(['/', '/wecom'], async (req, res) => {
      console.log(`[WeCom] Received POST request (message) on path: ${req.path}`);
      const { msg_signature, timestamp, nonce } = req.query;
      const xmlData = req.body;

      if (!xmlData) {
        console.warn('[WeCom] Empty body in POST request');
        return res.status(400).send('Empty body');
      }

      try {
        const result = await parseStringPromise(xmlData);
        if (!result.xml || !result.xml.Encrypt) {
          console.warn('[WeCom] Invalid XML structure:', xmlData);
          return res.status(400).send('Invalid XML');
        }
        const encryptedMsg = result.xml.Encrypt[0];
        
        const signature = getSignature(wecom.token, timestamp as string, nonce as string, encryptedMsg);
        if (signature !== msg_signature) {
          console.warn('[WeCom] Invalid signature in POST request');
          return res.status(401).send('Invalid signature');
        }

        const { message } = decrypt(wecom.encoding_aes_key, encryptedMsg);
        const msgResult = await parseStringPromise(message);
        const msg = msgResult.xml;

        const fromUser = msg.FromUserName[0];
        const toUser = msg.ToUserName?.[0];
        if (wecom.corpid && toUser && String(toUser) !== wecom.corpid) {
          console.warn(`[WeCom] CorpId mismatch: expected ${wecom.corpid}, got ${toUser}`);
          return res.status(403).send('Forbidden');
        }
        const msgType = msg.MsgType[0];
        let content = msg.Content?.[0] || '';
        let localPath: string | undefined;

        // 处理不同类型的消息
        if (msgType === 'image') {
          const mediaId = msg.MediaId[0];
          const picUrl = msg.PicUrl[0];
          localPath = await this.downloadMedia(mediaId, 'image', `${mediaId}.jpg`);
          content = `[图片消息] 已下载到: ${localPath}`;
          console.log(`[WeCom] Received image from ${fromUser}: ${picUrl} -> ${localPath}`);
          
          bus.publish({
            id: msg.MsgId[0],
            source: 'wecom',
            content: content,
            type: 'text',
            timestamp: Date.now(),
            metadata: {
              sessionId: `wecom:${fromUser}`,
              fromUser,
              msgType,
              mediaId,
              localPath, // 关键：传递本地路径给 Agent
            },
          });
          return res.send('success');
        } else if (msgType === 'voice') {
          const mediaId = msg.MediaId[0];
          localPath = await this.downloadMedia(mediaId, 'voice', `${mediaId}.amr`);
          console.log(`[WeCom] Received voice from ${fromUser}: ${localPath}`);
          
          // 尝试语音转文字
          try {
            const transcriptionService = new TranscriptionService(this.config);
            const text = await transcriptionService.transcribe(localPath);
            if (text) {
              content = text;
              console.log(`[WeCom] Transcribed voice to: "${text}"`);
            } else {
              content = `[语音消息] 无法识别或未配置转译服务。文件已保存到: ${localPath}`;
            }
          } catch (err) {
            console.error('[WeCom] Transcription error:', err);
            content = `[语音消息] 转译出错。文件已保存到: ${localPath}`;
          }
        } else if (msgType === 'file') {
          const mediaId = msg.MediaId[0];
          const fileName = msg.Title?.[0] || '未知文件';
          const fileSize = msg.FileLen?.[0] || '未知大小';
          localPath = await this.downloadMedia(mediaId, 'file', fileName);
          content = `[文件消息] 名称: ${fileName}, 大小: ${fileSize} bytes, 已下载到: ${localPath}`;
          console.log(`[WeCom] Received file from ${fromUser}: ${fileName} -> ${localPath}`);
        }

        console.log(`[WeCom] Decrypted message: type=${msgType}, from=${fromUser}, content="${content}"`);

        if (wecom.allow_from.length > 0 && !wecom.allow_from.includes(fromUser)) {
          console.log(`[WeCom] User ${fromUser} not allowed.`);
          return res.send('success');
        }

        // 发布消息到总线（支持 text, image, file, voice）
        if (['text', 'image', 'file', 'voice'].includes(msgType)) {
          bus.publish({
            id: msg.MsgId[0],
            source: 'wecom',
            target: 'agent', // 明确指定目标为 agent
            content: content,
            type: 'text', // 目前统一转为文本告知 Agent，后续可扩展多模态
            timestamp: Date.now(),
            metadata: {
              sessionId: `wecom:${fromUser}`,
              fromUser,
              msgType,
              mediaId: msg.MediaId?.[0],
              localPath,
            },
          });
        }

        res.send('success');
      } catch (error) {
        console.error('[WeCom] Message processing error:', error);
        res.status(500).send('Internal Server Error');
      }
    });

    if (!app) {
        this.app.listen(port, () => {
        console.log(`[WeCom] Callback server listening on port ${port}`);
        });
    } else {
        console.log(`✅ WeCom channel attached to Gateway path: /, /wecom`);
    }

    // Listen for agent responses
    bus.onMessage(async (message) => {
      if (['agent', 'subagent'].includes(message.source) && (message.target === 'wecom' || !message.target)) {
        console.log(`[WeCom] Received message from ${message.source} (Target: ${message.target || 'any'})`);
        
        const toUser = message.metadata?.fromUser || message.metadata?.to || message.metadata?.originChatId;
        if (!toUser) {
          console.warn('[WeCom] No recipient found in message metadata:', message.metadata);
          return;
        }

        let content = message.content;
        console.log(`[WeCom] Processing content for user ${toUser}: ${content.substring(0, 50)}...`);

        // 优化正则表达式：支持行首空格，增加 m 标志支持多行匹配
        const fileRegex = /^\s*(?:SEND_FILE|SEND_IMAGE|SEND_VOICE):\s*([^\n\r]+)/gim;
        
        // 提取指令并发送媒体文件
        let match;
        while ((match = fileRegex.exec(content)) !== null) {
          const fullMatch = match[0].trim();
          const directive = fullMatch.split(':')[0].toUpperCase().trim();
          let filePath = match[1].trim().replace(/["']$/g, '').replace(/^["']/g, '').trim();
          
          let type: 'file' | 'image' | 'voice' = 'file';
          if (directive === 'SEND_IMAGE') type = 'image';
          else if (directive === 'SEND_VOICE') {
            type = 'voice';
            // 如果是语音消息且文件不是 .amr，尝试寻找同名的 .amr
            if (!filePath.toLowerCase().endsWith('.amr')) {
              const amrPath = filePath.replace(/\.[^.]+$/, '.amr');
              if (fs.existsSync(amrPath)) {
                filePath = amrPath;
              }
            }
          }

          console.log(`[WeCom] Found directive: ${directive} for file: ${filePath}`);
          await this.sendMedia(toUser, filePath, type);
        }

        // 移除所有指令行后发送纯文本
        // 采用分行处理的方式，确保不会误删同一行中指令之外的文本
        const lines = content.split(/\r?\n/);
        const filteredLines = lines.filter(line => {
          const isDirective = /^\s*(?:SEND_FILE|SEND_IMAGE|SEND_VOICE):\s*/i.test(line);
          return !isDirective;
        });
        
        const textOnly = filteredLines.join('\n').trim();
        if (textOnly) {
          await this.sendMessage(toUser, textOnly);
        }
      }
    });
  }

  private async getAccessToken(): Promise<string | null> {
    const wecom = this.config.channels?.wecom;
    if (!wecom) return null;

    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    console.log('[WeCom] Fetching fresh access token...');
    try {
      const config: any = {
        params: {
          corpid: wecom.corpid,
          corpsecret: wecom.corpsecret,
        },
      };

      if (wecom.proxy) {
        const agent = wecom.proxy.startsWith('socks') 
            ? new SocksProxyAgent(wecom.proxy) 
            : new HttpsProxyAgent(wecom.proxy);
        config.httpsAgent = agent;
        config.proxy = false; 
      }

      const response = await axios.get('https://qyapi.weixin.qq.com/cgi-bin/gettoken', config);

      if (response.data.errcode === 0) {
        console.log('[WeCom] Access token fetched successfully');
        this.accessToken = response.data.access_token;
        this.tokenExpiresAt = Date.now() + (response.data.expires_in - 300) * 1000;
        return this.accessToken;
      } else {
        console.error('[WeCom] Error getting access token:', response.data.errcode, response.data.errmsg);
        return null;
      }
    } catch (error: any) {
      console.error('[WeCom] Request error getting access token:', error.message);
      return null;
    }
  }

  private async downloadMedia(mediaId: string, _type: 'image' | 'file' | 'voice', fileName: string): Promise<string> {
    const token = await this.getAccessToken();
    if (!token) return '下载失败 (无Token)';

    try {
      const wecom = this.config.channels?.wecom;
      const config: any = {
        params: {
          access_token: token,
          media_id: mediaId,
        },
        responseType: 'arraybuffer',
      };

      if (wecom?.proxy) {
        const agent = wecom.proxy.startsWith('socks') 
            ? new SocksProxyAgent(wecom.proxy) 
            : new HttpsProxyAgent(wecom.proxy);
        config.httpsAgent = agent;
        config.proxy = false; 
      }

      const response = await axios.get(`https://qyapi.weixin.qq.com/cgi-bin/media/get`, config);

      const workspacePath = getWorkspacePath(this.config);
      const uploadsDir = path.join(workspacePath, 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const safeFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const timestamp = Date.now();
      const localFileName = `${timestamp}_${safeFileName}`;
      const localPath = path.join(uploadsDir, localFileName);

      fs.writeFileSync(localPath, Buffer.from(response.data));
      
      // 返回相对于工作区的路径，方便 Agent 引用
      return path.join('uploads', localFileName);
    } catch (error: any) {
      console.error('[WeCom] Error downloading media:', error.message);
      return `下载失败 (${error.message})`;
    }
  }

  private async sendMessage(toUser: string, content: string): Promise<boolean> {
    if (!content || !content.trim()) return false;
    const token = await this.getAccessToken();
    const wecom = this.config.channels?.wecom;
    if (!token || !wecom) return false;

    // 企业微信消息长度限制为 2048 字节。
    // 中文 UTF-8 占 3 字节，安全起见按 600 字符分段
    const MAX_LEN = 600;
    if (content.length > MAX_LEN) {
      const chunks = this.splitContent(content, MAX_LEN);
      let allSuccess = true;
      for (const chunk of chunks) {
        const success = await this.sendSingleMessage(toUser, chunk, token, wecom);
        if (!success) allSuccess = false;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      return allSuccess;
    }

    return await this.sendSingleMessage(toUser, content, token, wecom);
  }

  /**
   * 将内容按最大长度拆分，尽量保持行完整
   */
  private splitContent(content: string, maxLen: number): string[] {
    const chunks: string[] = [];
    let currentPos = 0;
    while (currentPos < content.length) {
      let endPos = currentPos + maxLen;
      if (endPos >= content.length) {
        chunks.push(content.substring(currentPos));
        break;
      }

      // 尝试在换行符处拆分，保持 Markdown 格式相对完整
      const lastNewline = content.lastIndexOf('\n', endPos);
      if (lastNewline > currentPos + (maxLen / 2)) {
        endPos = lastNewline + 1;
      }

      chunks.push(content.substring(currentPos, endPos));
      currentPos = endPos;
    }
    return chunks;
  }

  private async sendSingleMessage(toUser: string, content: string, token: string, wecom: any): Promise<boolean> {
    try {
      // 探测是否包含 Markdown 特征（标题、粗体、列表、引用、代码块）
      const hasMarkdown = /#\s|\*\*|>\s|^- |^\d+\. |```/.test(content);
      const msgtype = hasMarkdown ? 'markdown' : 'text';

      const payload: any = {
        touser: toUser,
        msgtype: msgtype,
        agentid: Number(wecom.agentid),
        safe: 0,
      };

      if (msgtype === 'markdown') {
        // 企业微信 Markdown 仅支持部分语法，这里做简单的格式兼容处理
        // 比如：将三个或更多连续换行减少为两个，避免在某些客户端显示过于空旷
        const formattedContent = content.replace(/\n{3,}/g, '\n\n');
        payload.markdown = { content: formattedContent };
      } else {
        payload.text = { content };
      }

      const config: any = {};
      if (wecom.proxy) {
        const agent = wecom.proxy.startsWith('socks') 
            ? new SocksProxyAgent(wecom.proxy) 
            : new HttpsProxyAgent(wecom.proxy);
        config.httpsAgent = agent;
        config.proxy = false; 
      }

      const response = await axios.post(`https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`, payload, config);
      
      if (response.data.errcode !== 0) {
        console.error(`[WeCom] Send error (${msgtype}):`, response.data.errcode, response.data.errmsg);
        // 如果 Markdown 发送失败（可能是因为包含了不支持的语法），尝试降级为纯文本发送
        if (msgtype === 'markdown') {
          console.log('[WeCom] Retrying with plain text fallback...');
          return await this.sendSingleMessageWithPayload(toUser, content, token, wecom, 'text');
        }
      }
      
      return response.data.errcode === 0;
    } catch (error: any) {
      console.error('[WeCom] Send message error:', error.message);
      return false;
    }
  }

  private async sendSingleMessageWithPayload(toUser: string, content: string, token: string, wecom: any, msgtype: 'text' | 'markdown'): Promise<boolean> {
    try {
      const payload: any = {
        touser: toUser,
        msgtype: msgtype,
        agentid: Number(wecom.agentid),
        [msgtype]: { content },
        safe: 0,
      };

      const config: any = {};
      if (wecom.proxy) {
        const agent = wecom.proxy.startsWith('socks') 
            ? new SocksProxyAgent(wecom.proxy) 
            : new HttpsProxyAgent(wecom.proxy);
        config.httpsAgent = agent;
        config.proxy = false; 
      }

      const response = await axios.post(`https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`, payload, config);
      return response.data.errcode === 0;
    } catch (error: any) {
      console.error(`[WeCom] Fallback send error (${msgtype}):`, error.message);
      return false;
    }
  }

  private async uploadMedia(filePath: string, type: 'file' | 'image' | 'voice' = 'file'): Promise<string | null> {
    const token = await this.getAccessToken();
    if (!token) return null;

    try {
      const workspacePath = getWorkspacePath(this.config);
      // 这里的 filePath 可能已经是绝对路径，也可能是相对于工作区的路径
      let absolutePath = filePath;
      if (!path.isAbsolute(filePath)) {
        // 尝试从工作区根目录查找
        const potentialPath1 = path.join(workspacePath, filePath);
        // 尝试从 uploads 目录查找（如果 Agent 只提供了文件名）
        const potentialPath2 = path.join(workspacePath, 'uploads', filePath);

        if (fs.existsSync(potentialPath1)) {
          absolutePath = potentialPath1;
        } else if (fs.existsSync(potentialPath2)) {
          absolutePath = potentialPath2;
        } else {
          // 保持原逻辑作为保底
          absolutePath = potentialPath1;
        }
      }

      console.log(`[WeCom] Attempting to upload ${type}: ${absolutePath}`);

      if (!fs.existsSync(absolutePath)) {
        console.warn(`[WeCom] File not found: ${absolutePath}`);
        return null;
      }

      const form = new FormData();
      form.append('media', fs.createReadStream(absolutePath));

      const response = await axios.post(`https://qyapi.weixin.qq.com/cgi-bin/media/upload?access_token=${token}&type=${type}`, form, {
        headers: form.getHeaders(),
      });

      if (response.data.errcode !== 0) {
        console.error(`[WeCom] Upload error response:`, response.data);
        return null;
      }

      console.log(`[WeCom] Upload success, media_id: ${response.data.media_id}`);
      return response.data.media_id;
    } catch (error: any) {
      console.error('[WeCom] Upload exception:', error.message);
      return null;
    }
  }

  private async sendMedia(toUser: string, filePath: string, type: 'image' | 'file' | 'voice' = 'file'): Promise<boolean> {
    const token = await this.getAccessToken();
    const wecom = this.config.channels?.wecom;
    if (!token || !wecom) return false;

    // 校验文件格式与发送类型的匹配度
    let actualType = type;
    if (type === 'voice' && !filePath.toLowerCase().endsWith('.amr')) {
      console.warn(`[WeCom] File ${filePath} is not AMR, downgrading upload type to 'file' to avoid 301017.`);
      actualType = 'file';
    }

    // 1. 尝试按请求类型（或降级后的类型）上传和发送
    const mediaId = await this.uploadMedia(filePath, actualType);
    if (mediaId) {
      try {
        const response = await axios.post(`https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`, {
          touser: toUser,
          msgtype: actualType,
          agentid: Number(wecom.agentid),
          [actualType]: { media_id: mediaId },
          safe: 0,
        });
        
        if (response.data.errcode === 0) return true;
        
        console.warn(`[WeCom] Send as ${actualType} failed (code ${response.data.errcode}), will retry as 'file' if applicable.`);
      } catch (error: any) {
        console.error(`[WeCom] Send as ${actualType} error:`, error.message);
      }
    }

    // 2. 兜底逻辑：如果不是文件类型且发送失败了，自动转为 'file' 类型重试
    if (actualType !== 'file') {
      console.log(`[WeCom] Retrying to send ${filePath} as 'file' type...`);
      const fileMediaId = await this.uploadMedia(filePath, 'file');
      if (fileMediaId) {
        try {
          const response = await axios.post(`https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`, {
            touser: toUser,
            msgtype: 'file',
            agentid: Number(wecom.agentid),
            file: { media_id: fileMediaId },
            safe: 0,
          });
          return response.data.errcode === 0;
        } catch (error: any) {
          console.error(`[WeCom] Send as file fallback error:`, error.message);
        }
      }
    }

    return false;
  }
}

function isIpAllowed(ip: string, allowList: string[]): boolean {
  if (!ip) return false;
  for (const entry of allowList) {
    if (!entry) continue;
    if (ip === entry) return true;
    const normalized = entry.endsWith('*') ? entry.slice(0, -1) : entry;
    if (normalized && ip.startsWith(normalized)) return true;
  }
  return false;
}
