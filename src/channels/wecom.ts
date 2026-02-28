import express from 'express';
import { parseStringPromise } from 'xml2js';
import { decrypt, getSignature } from '@wecom/crypto';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';

import { Config, getWorkspacePath, PROJECT_ROOT } from '../core/config.js';
import { bus } from '../core/bus.js';
import { TranscriptionService } from '../core/transcription.js';
import { createLogger } from '../utils/logger.js';

export class WeComChannel {
  private config: Config;
  private app = express();
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private log = createLogger('wecom');

  constructor(config: Config) {
    this.config = config;
  }

  private getProxyAgent(): any {
    const proxyUrl = this.config.channels?.wecom?.proxy || 
                     process.env.HTTPS_PROXY || 
                     process.env.https_proxy || 
                     process.env.ALL_PROXY || 
                     process.env.all_proxy;
                     
    if (!proxyUrl) return undefined;
    
    return proxyUrl.startsWith('socks') 
      ? new SocksProxyAgent(proxyUrl) 
      : new HttpsProxyAgent(proxyUrl);
  }

  public async start(app?: express.Application) {
    const wecom = this.config.channels?.wecom;
    if (!wecom || !wecom.enabled) {
      this.log.info('Channel disabled.');
      return;
    }
    
    const proxyAgent = this.getProxyAgent();
    if (proxyAgent) {
        const proxyUrl = this.config.channels?.wecom?.proxy || process.env.HTTPS_PROXY || 'env-defined';
        this.log.info({ proxy: proxyUrl }, 'Using proxy');
    }

    const server = app || this.app;
    const port = wecom.port || process.env.WECOM_PORT || 3000;

    // In-memory rate limit state (per-process)
    const rateHits = new Map<string, { count: number; ts: number }>();
    const RATE_WINDOW_MS = 60_000;
    const RATE_LIMIT = 120;

    // Message Deduplication Cache (MsgId -> Timestamp)
    const processedMsgIds = new Map<string, number>();
    const DEDUP_WINDOW_MS = 300_000; // 5 minutes

    // Middleware to handle raw body for decryption (apply to shared app or local app)
    // Safe to add globally as it only matches XML content types
    server.use(express.text({ type: ['*/xml', 'text/xml', 'application/xml'], limit: '200kb' }));

    // Lightweight logging + timeout + rate limit + optional IP allowlist
    server.use((req, res, next) => {
        this.log.debug({ method: req.method, url: req.url, ip: req.ip }, 'incoming request');
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

        /*
        const allowIps = wecom.allow_ips || [];
        console.log('WECOM: IP check', { ip, allowIps });
        if (allowIps.length > 0 && !isIpAllowed(ip, allowIps)) {
            console.log('WECOM: IP rejected');
            this.log.warn({ ip }, 'Rejected request from disallowed IP');
            return res.status(403).send('Forbidden');
        }
        */

        next();
    });

    // URL Verification (GET)
    server.get(['/', '/wecom'], (req, res) => {
      this.log.debug({ path: req.path }, 'GET verification');
      const { msg_signature, timestamp, nonce, echostr } = req.query;
      
      if (!msg_signature || !timestamp || !nonce || !echostr) {
        this.log.warn({ query: req.query }, 'Missing parameters in GET request');
        return res.status(400).send('Missing parameters');
      }

      try {
        const signature = getSignature(wecom.token, timestamp as string, nonce as string, echostr as string);
        if (signature !== msg_signature) {
          this.log.warn('Invalid signature in GET request');
          return res.status(401).send('Invalid signature');
        }

        const { message } = decrypt(wecom.encoding_aes_key, echostr as string);
        this.log.info('Verification success');
        res.send(message);
      } catch (error) {
        this.log.error({ err: error }, 'Verification error');
        res.status(500).send('Internal Server Error');
      }
    });

    // Message Receiving (POST)
    server.post(['/', '/wecom'], async (req, res) => {
      this.log.debug({ path: req.path, ip: req.ip }, 'POST message');
      const { msg_signature, timestamp, nonce } = req.query;
      const xmlData = req.body;

      if (!xmlData) {
        this.log.warn('Empty body in POST request');
        return res.status(400).send('Empty body');
      }

      try {
        const result = await parseStringPromise(xmlData);
        if (!result.xml || !result.xml.Encrypt) {
          this.log.warn({ xmlPreview: String(xmlData).slice(0, 200) }, 'Invalid XML structure');
          return res.status(400).send('Invalid XML');
        }
        const encryptedMsg = result.xml.Encrypt[0];
        
        const signature = getSignature(wecom.token, timestamp as string, nonce as string, encryptedMsg);
        if (signature !== msg_signature) {
          this.log.warn('Invalid signature in POST request');
          return res.status(401).send('Invalid signature');
        }

        const { message } = decrypt(wecom.encoding_aes_key, encryptedMsg);
        const msgResult = await parseStringPromise(message);
        const msg = msgResult.xml;
        const msgId = msg.MsgId?.[0];

        // Deduplication Check
        if (msgId) {
          const lastSeen = processedMsgIds.get(msgId);
          const now = Date.now();
          if (lastSeen && now - lastSeen < DEDUP_WINDOW_MS) {
            this.log.info({ msgId }, 'Duplicate message received (retry), ignoring');
            return res.send('success');
          }
          processedMsgIds.set(msgId, now);

          // Cleanup old entries
          if (processedMsgIds.size > 1000) {
            for (const [key, ts] of processedMsgIds.entries()) {
              if (now - ts > DEDUP_WINDOW_MS) {
                processedMsgIds.delete(key);
              }
            }
          }
        }

        const fromUser = msg.FromUserName[0];
        const toUser = msg.ToUserName?.[0];
        
        if (wecom.corpid && toUser && String(toUser) !== wecom.corpid) {
          this.log.warn({ expected: wecom.corpid, got: toUser }, 'CorpId mismatch');
          return res.status(403).send('Forbidden');
        }
        const msgType = msg.MsgType[0];
        let content = msg.Content?.[0] || '';
        let localPath: string | undefined;

        // 处理不同类型的消息
        if (msgType === 'image') {
          const mediaId = msg.MediaId[0];
          localPath = await this.downloadMedia(mediaId, 'image', `${mediaId}.jpg`);
          content = `[图片消息] 已下载到: ${localPath}`;
          this.log.info({ fromUser, mediaId, localPath }, 'Received image');
          
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
          this.log.info({ fromUser, mediaId, localPath }, 'Received voice');
          
          // 尝试语音转文字
          try {
            const transcriptionService = new TranscriptionService(this.config);
            const text = await transcriptionService.transcribe(localPath);
            if (text) {
              content = text;
            this.log.info({ fromUser, transcript: text?.slice(0, 120) }, 'Voice transcribed');
          } else {
            content = `[语音消息] 无法识别或未配置转译服务。文件已保存到: ${localPath}`;
          }
        } catch (err) {
          this.log.error({ err }, 'Transcription error');
          content = `[语音消息] 转译出错。文件已保存到: ${localPath}`;
        }
        } else if (msgType === 'file') {
          const mediaId = msg.MediaId[0];
          const fileName = msg.Title?.[0] || '未知文件';
          const fileSize = msg.FileLen?.[0] || '未知大小';
          localPath = await this.downloadMedia(mediaId, 'file', fileName);
          content = `[文件消息] 名称: ${fileName}, 大小: ${fileSize} bytes, 已下载到: ${localPath}`;
          this.log.info({ fromUser, fileName, localPath }, 'Received file');
        }

        this.log.debug({ msgType, fromUser, contentPreview: content.slice(0, 120) }, 'Decrypted message');

        if (wecom.allow_from.length > 0 && !wecom.allow_from.includes(fromUser)) {
          this.log.warn({ fromUser }, 'User not allowed');
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
        this.log.error({ err: error }, 'Message processing error');
        res.status(500).send('Internal Server Error');
      }
    });

    if (!app) {
        this.app.listen(port, () => {
        this.log.info({ port }, 'Callback server listening');
        });
    } else {
        this.log.info('WeCom channel attached to Gateway path: /, /wecom');
    }

    // Listen for agent responses
    bus.onMessage(async (message) => {
      // Detailed logging for ALL messages on bus to debug flow
      if (message.target === 'wecom') {
          this.log.info({ source: message.source, target: message.target, id: message.id }, 'Bus message received for WeCom');
      }

      if (['agent', 'subagent', 'cron'].includes(message.source) && (message.target === 'wecom' || !message.target)) {
        // Ignore streaming chunks for WeCom
        if (message.metadata?.stream) {
          return;
        }

        this.log.info({ source: message.source, target: message.target, metadata: message.metadata }, 'Agent reply processing');
        
        const toUser = message.metadata?.fromUser || message.metadata?.to || message.metadata?.originChatId;
        
        if (!toUser) {
          this.log.error({ metadata: message.metadata }, 'No recipient found in message metadata (toUser is empty)');
          return;
        }

        const content = message.content;
        this.log.info({ toUser, contentPreview: content.substring(0, 50) }, 'Sending reply to user');

        // ... (rest of logic)

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

          this.log.debug({ directive, filePath }, 'Found SEND_FILE directive');
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

  private async requestWithRetry(method: 'get' | 'post', url: string, data?: any, config: any = {}): Promise<any> {
    const agent = this.getProxyAgent();
    const useProxy = !!agent;
    
    // First attempt with proxy (if configured)
    if (useProxy) {
      config.httpsAgent = agent;
      config.proxy = false;
    }

    try {
      if (method === 'get') {
        return await axios.get(url, config);
      } else {
        return await axios.post(url, data, config);
      }
    } catch (error: any) {
      // Check if it's a proxy error
      const isProxyError = useProxy && (
        error.message?.includes('Proxy connection timed out') ||
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('socket hang up') || 
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT'
      );

      if (isProxyError) {
        this.log.warn({ err: error.message }, 'Proxy failed, retrying without proxy...');
        console.warn('[WeCom] Proxy failed, retrying direct connection...');
        
        const noProxyConfig = { ...config };
        delete noProxyConfig.httpsAgent;
        noProxyConfig.proxy = false; 

        // Important: For FormData, we must refresh the stream because the first stream was consumed
        if (data instanceof FormData) {
          this.log.debug('Refilling FormData stream for retry...');
          // We can't easily "refill" a consumed stream in the generic function without knowing the file path.
          // So we throw a specific error to let the caller handle the retry with a fresh stream.
          throw new Error('PROXY_RETRY_NEEDED_FOR_STREAM');
        }
        
        if (method === 'get') {
          return await axios.get(url, noProxyConfig);
        } else {
          return await axios.post(url, data, noProxyConfig);
        }
      }
      
      throw error;
    }
  }

  private async getAccessToken(): Promise<string | null> {
    const wecom = this.config.channels?.wecom;
    if (!wecom) return null;

    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    console.log('[WeCom] Fetching new access token...');
    this.log.debug('Fetching fresh access token...');
    try {
      const config: any = {
        params: {
          corpid: wecom.corpid,
          corpsecret: wecom.corpsecret,
        },
      };

      const response = await this.requestWithRetry('get', 'https://qyapi.weixin.qq.com/cgi-bin/gettoken', undefined, config);

      if (response.data.errcode === 0) {
        console.log('[WeCom] Access token fetched successfully');
        this.log.info('Access token fetched successfully');
        this.accessToken = response.data.access_token;
        this.tokenExpiresAt = Date.now() + (response.data.expires_in - 300) * 1000;
        return this.accessToken;
      } else {
        console.error('[WeCom] Error getting access token:', response.data);
        this.log.error({ errcode: response.data.errcode, errmsg: response.data.errmsg }, 'Error getting access token');
        return null;
      }
    } catch (error: any) {
      console.error('[WeCom] Request error getting access token:', error.message);
      this.log.error({ err: error }, 'Request error getting access token');
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

      const response = await this.requestWithRetry('get', `https://qyapi.weixin.qq.com/cgi-bin/media/get`, undefined, config);

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
      this.log.error({ err: error }, 'Error downloading media');
      return `下载失败 (${error.message})`;
    }
  }

  private async sendMessage(toUser: string, content: string): Promise<boolean> {
    if (!content || !content.trim()) return false;
    const token = await this.getAccessToken();
    const wecom = this.config.channels?.wecom;
    
    if (!token) {
        return false;
    }
    if (!wecom) {
        return false;
    }

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
      const response = await this.requestWithRetry('post', `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`, payload, config);
      
      if (response.data.errcode !== 0) {
        this.log.error({ errcode: response.data.errcode, errmsg: response.data.errmsg, toUser }, 'WeCom Send Error');
        console.error('[WeCom] Send error:', response.data);
        if (response.data.errcode === 60020) {
            const ipMatch = response.data.errmsg.match(/from ip: ([\d.]+)/);
            const ip = ipMatch ? ipMatch[1] : 'YOUR_IP';
            this.log.error(`
================================================================================
[WECOM ERROR] IP Not Allowed (60020)
Your current IP address (${ip}) is not in the WeCom allowlist.
Please add it to the 'Enterprise Trusted IP' list in WeCom Admin Panel.
Link: https://work.weixin.qq.com/wework_admin/frame#apps
================================================================================
`);
            return false; // Don't retry for IP errors
        }

        this.log.error({ errcode: response.data.errcode, errmsg: response.data.errmsg, msgtype }, 'Send error');
        // 如果 Markdown 发送失败（可能是因为包含了不支持的语法），尝试降级为纯文本发送
        if (msgtype === 'markdown') {
          this.log.warn({ msgtype }, 'Retrying with plain text fallback');
          return await this.sendSingleMessageWithPayload(toUser, content, token, wecom, 'text');
        }
      } else {
        this.log.info({ toUser, msgtype }, 'WeCom Send Success');
      }
      
      return response.data.errcode === 0;
    } catch (error: any) {
      this.log.error({ err: error, toUser }, 'WeCom Request Error');
      console.error('[WeCom] Request error:', error.message);
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
      const response = await this.requestWithRetry('post', `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`, payload, config);
      return response.data.errcode === 0;
    } catch (error: any) {
      this.log.error({ err: error, msgtype }, 'Fallback send error');
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
        // 尝试从项目根目录查找（兼容非工作区文件）
        const potentialPath3 = path.join(PROJECT_ROOT, filePath);

        if (fs.existsSync(potentialPath1)) {
          absolutePath = potentialPath1;
        } else if (fs.existsSync(potentialPath2)) {
          absolutePath = potentialPath2;
        } else if (fs.existsSync(potentialPath3)) {
          absolutePath = potentialPath3;
        } else {
          // 保持原逻辑作为保底
          absolutePath = potentialPath1;
        }
      }

      this.log.debug({ type, absolutePath }, 'Attempting to upload media');

      if (!fs.existsSync(absolutePath)) {
        this.log.warn({ absolutePath }, 'File not found for upload');
        return null;
      }

      let form = new FormData();
      form.append('media', fs.createReadStream(absolutePath));

      const wecom = this.config.channels?.wecom;
      let config: any = {
        headers: form.getHeaders(),
      };

      let response;
      try {
        response = await this.requestWithRetry('post', `https://qyapi.weixin.qq.com/cgi-bin/media/upload?access_token=${token}&type=${type}`, form, config);
      } catch (err: any) {
        // Special handling for stream retry - catch specific error message
        if (err.message === 'PROXY_RETRY_NEEDED_FOR_STREAM') {
           this.log.info('Re-creating file stream for direct connection retry...');
           // Re-create the form and stream
           form = new FormData();
           form.append('media', fs.createReadStream(absolutePath));
           config = {
             headers: form.getHeaders(),
             proxy: false // Force direct connection
           };
           // Retry directly
           response = await axios.post(`https://qyapi.weixin.qq.com/cgi-bin/media/upload?access_token=${token}&type=${type}`, form, config);
        } else {
           throw err;
        }
      }

      if (response.data.errcode !== 0) {
        if (response.data.errcode === 60020) {
            const ipMatch = response.data.errmsg.match(/from ip: ([\d.]+)/);
            const ip = ipMatch ? ipMatch[1] : 'YOUR_IP';
            this.log.error(`
================================================================================
[WECOM ERROR] IP Not Allowed (60020)
Your current IP address (${ip}) is not in the WeCom allowlist.
Please add it to the 'Enterprise Trusted IP' list in WeCom Admin Panel.
Link: https://work.weixin.qq.com/wework_admin/frame#apps
================================================================================
`);
            return null;
        }

        this.log.error({ response: response.data }, 'Upload error response');
        return null;
      }

      this.log.info({ media_id: response.data.media_id }, 'Upload success');
      return response.data.media_id;
    } catch (error: any) {
      this.log.error({ err: error, response: error.response?.data }, 'Upload exception');
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
      this.log.warn({ filePath }, "Voice file not AMR, downgrading to 'file'");
      actualType = 'file';
    }

    // 1. 尝试按请求类型（或降级后的类型）上传和发送
    const mediaId = await this.uploadMedia(filePath, actualType);
    if (mediaId) {
      try {
        const config: any = {};
        const response = await this.requestWithRetry('post', `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`, {
          touser: toUser,
          msgtype: actualType,
          agentid: Number(wecom.agentid),
          [actualType]: { media_id: mediaId },
          safe: 0,
        }, config);
        
        if (response.data.errcode === 0) return true;
        
        this.log.warn({ actualType, errcode: response.data.errcode }, 'Send as media failed, will retry as file');
      } catch (error: any) {
      this.log.error({ err: error, actualType }, 'Send as media error');
      }
    }

    // 2. 兜底逻辑：如果不是文件类型且发送失败了，自动转为 'file' 类型重试
    if (actualType !== 'file') {
      this.log.info({ filePath }, "Retrying to send as 'file' type");
      const fileMediaId = await this.uploadMedia(filePath, 'file');
      if (fileMediaId) {
        try {
          const config: any = {};
          const response = await this.requestWithRetry('post', `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`, {
            touser: toUser,
            msgtype: 'file',
            agentid: Number(wecom.agentid),
            file: { media_id: fileMediaId },
            safe: 0,
          }, config);
          return response.data.errcode === 0;
        } catch (error: any) {
          this.log.error({ err: error }, 'Send as file fallback error');
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
