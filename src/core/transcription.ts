import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import { execa } from 'execa';
import { Config, getWorkspacePath } from './config.js';

export class TranscriptionService {
  private config: Config;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  // 使用用户提供的 Key 作为默认值
  private readonly BAIDU_API_KEY = 'nvjnBEBeSkdfcxac8BsVS3Pu';
  private readonly BAIDU_SECRET_KEY = 'TqzOSoxOqpg9lkdy5TObqNBuX7BrYIGw';

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * 获取百度 Access Token
   */
  private async getAccessToken(): Promise<string | null> {
    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const apiKey = this.config.providers.baidu?.api_key || this.BAIDU_API_KEY;
    const secretKey = this.config.providers.baidu?.secret_key || this.BAIDU_SECRET_KEY;

    if (!apiKey || !secretKey) {
      console.error('[BaiduVoice] Missing API Key or Secret Key');
      return null;
    }

    try {
      const response = await axios.get('https://aip.baidubce.com/oauth/2.0/token', {
        params: {
          grant_type: 'client_credentials',
          client_id: apiKey,
          client_secret: secretKey,
        },
      });

      if (response.data.access_token) {
        this.accessToken = response.data.access_token;
        // Token 有效期通常为 30 天，我们设置提前 1 小时过期以保安全
        this.tokenExpiresAt = now + (response.data.expires_in - 3600) * 1000;
        return this.accessToken;
      }
    } catch (error: any) {
      console.error('[BaiduVoice] Failed to get access token:', error.message);
    }

    return null;
  }

  /**
   * 识别语音文件 (ASR)
   */
  public async transcribe(filePath: string): Promise<string> {
    let processedPath = filePath;
    const isTempFile = false;

    // 路径处理
    if (!path.isAbsolute(processedPath)) {
      const workspacePath = getWorkspacePath(this.config);
      processedPath = path.resolve(workspacePath, processedPath);
    }

    if (!fs.existsSync(processedPath)) {
      console.error(`[BaiduVoice] File not found: ${processedPath}`);
      return '';
    }

    try {
      const token = await this.getAccessToken();
      if (!token) return '';

      // 百度 ASR 建议使用 16k 采样率的 wav 或 pcm，但同时也支持 amr
      // 如果不是支持的格式，可以考虑转换。这里为了简单直接读取
      const audioBuffer = await fs.readFile(processedPath);
      const base64Audio = audioBuffer.toString('base64');
      const fileSize = audioBuffer.length;

      let format = 'wav';
      let rate = 16000;

      if (processedPath.toLowerCase().endsWith('.amr')) {
        format = 'amr';
        rate = 8000;
      }
      if (processedPath.toLowerCase().endsWith('.pcm')) format = 'pcm';
      if (processedPath.toLowerCase().endsWith('.m4a')) {
        // M4A 转换成 WAV 以获得更好兼容性
        const wavPath = processedPath.replace(/\.m4a$/i, '.wav');
        try {
          await execa('ffmpeg', ['-i', processedPath, '-ar', '16000', '-ac', '1', '-y', wavPath]);
          processedPath = wavPath;
          const newBuffer = await fs.readFile(processedPath);
          const newBase64 = newBuffer.toString('base64');
          return await this.sendToBaiduASR(newBase64, newBuffer.length, 'wav', 16000, token);
        } catch (e) {
          console.warn('[BaiduVoice] FFMPEG conversion failed, trying original file');
        }
      }

      return await this.sendToBaiduASR(base64Audio, fileSize, format, rate, token);
    } catch (error: any) {
      console.error('[BaiduVoice] Transcription error:', error.message);
      return '';
    } finally {
      if (isTempFile && processedPath !== filePath) {
        await fs.remove(processedPath).catch(() => {});
      }
    }
  }

  private async sendToBaiduASR(base64Data: string, size: number, format: string, rate: number, token: string): Promise<string> {
    try {
      const response = await axios.post('http://vop.baidu.com/server_api', {
        format,
        rate,
        channel: 1,
        cuid: 'nanobot_client',
        token: token,
        speech: base64Data,
        len: size,
      }, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.data.err_no === 0 && response.data.result) {
        return response.data.result[0] || '';
      } else {
        console.error(`[BaiduVoice] ASR Error (Rate: ${rate}, Format: ${format}):`, response.data.err_msg);
        return '';
      }
    } catch (error: any) {
      console.error('[BaiduVoice] ASR Request failed:', error.message);
      return '';
    }
  }

  /**
   * 合成语音消息 (TTS)
   * @param text 要合成的文本
   * @param outputFileName 输出文件名（可选，默认生成在 workspace/audio 目录下）
   * @returns 生成的音频文件绝对路径
   */
  public async synthesize(text: string, outputFileName?: string): Promise<string | null> {
    try {
      const token = await this.getAccessToken();
      if (!token) return null;

      const workspacePath = getWorkspacePath(this.config);
      const audioDir = path.join(workspacePath, 'audio');
      await fs.ensureDir(audioDir);

      const fileName = outputFileName || `tts_${Date.now()}.mp3`;
      const isAmr = fileName.toLowerCase().endsWith('.amr');
      
      // 百度 TTS 不直接支持 AMR
      // 如果需要 AMR，我们请求 aue=5 (pcm-8k)，然后用 ffmpeg 转换
      const tempPcmPath = path.join(audioDir, `temp_${Date.now()}.pcm`);
      const finalPath = path.isAbsolute(fileName) ? fileName : path.join(audioDir, fileName);

      console.log(`[BaiduVoice] Synthesizing text: "${text.slice(0, 20)}..."`);

      const response = await axios({
        method: 'post',
        url: 'http://tsn.baidu.com/text2audio',
        data: new URLSearchParams({
          // 百度 TTS 参数：aue=5 代表 pcm-8k，更适合直接转 AMR
          tex: text,
          lan: 'zh',
          tok: token,
          ctp: '1',
          cuid: 'nanobot_client',
          spd: '5',
          pit: '5',
          vol: '5',
          per: '4',
          aue: isAmr ? '5' : '3', 
        }).toString(),
        responseType: 'arraybuffer',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const contentType = response.headers['content-type'];
      if (contentType && contentType.includes('application/json')) {
        const errorInfo = JSON.parse(Buffer.from(response.data).toString());
        console.error('[BaiduVoice] TTS Error:', errorInfo.err_msg);
        return null;
      }

      if (isAmr) {
        await fs.writeFile(tempPcmPath, response.data);
        try {
          // 转换为企业微信要求的 AMR 格式：8k 采样率，单声道
          // 这里的输入是 pcm_s16le, 8000Hz, mono
          await execa('ffmpeg', [
            '-f', 's16le',
            '-ar', '8000',
            '-ac', '1',
            '-i', tempPcmPath,
            '-c:a', 'libopencore_amrnb',
            '-y', finalPath
          ]);
          console.log(`[BaiduVoice] Converted to AMR: ${finalPath}`);
          return finalPath;
        } catch (e: any) {
          console.error('[BaiduVoice] FFMPEG conversion to AMR failed. Check if ffmpeg has amr encoder (libopencore_amrnb).');
          console.error('Error:', e.message);
          // 如果转换失败，尝试保存为 wav 格式作为保底（微信文件发送）
          const wavPath = finalPath.replace(/\.amr$/i, '.wav');
          await execa('ffmpeg', [
            '-f', 's16le',
            '-ar', '8000',
            '-ac', '1',
            '-i', tempPcmPath,
            '-y', wavPath
          ]);
          return wavPath;
        } finally {
          await fs.remove(tempPcmPath).catch(() => {});
        }
      } else {
        await fs.writeFile(finalPath, response.data);
        return finalPath;
      }
    } catch (error: any) {
      console.error('[BaiduVoice] TTS Request failed:', error.message);
      return null;
    }
  }
}
