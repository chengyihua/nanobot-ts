
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import net from 'net';
import { SocksProxyAgent } from 'socks-proxy-agent';
import fetch from 'node-fetch';
import axios from 'axios';
import dotenv from 'dotenv';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Fix __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from parent directory (since script is in scripts/)
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  console.log(`Loading .env from ${envPath}`);
  dotenv.config({ path: envPath });
} else {
  console.warn(`No .env file found at ${envPath}`);
}

async function checkPort(port: number, host: string = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function checkDeepSeekAccess() {
  const proxyUrl = process.env.NANOBOT__CHANNELS__WECOM__PROXY || 'socks://127.0.0.1:1080';
  console.log(`Using Proxy: ${proxyUrl}`);

  // Parse proxy URL to get port for check
  try {
    const url = new URL(proxyUrl);
    const port = parseInt(url.port);
    const hostname = url.hostname;
    
    console.log(`Checking if proxy port ${port} is open on ${hostname}...`);
    const isPortOpen = await checkPort(port, hostname);
    if (!isPortOpen) {
      console.error(`❌ ERROR: Proxy port ${port} is NOT open. Please start the SSH tunnel.`);
      console.error(`Command: ssh -p 10811 -D ${port} -N root@8.134.58.5`);
      return;
    }
    console.log(`✅ Proxy port ${port} is open.`);
  } catch (e: any) {
    console.warn(`Could not parse proxy URL for port check: ${e.message}`);
  }

  // Check DeepSeek API
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (!deepseekKey) {
    console.error('❌ DEEPSEEK_API_KEY is missing in .env');
    return;
  }

  const agent = new SocksProxyAgent(proxyUrl);
  const deepseekUrl = 'https://api.deepseek.com/models'; // or /user/balance if available

  console.log(`Attempting to connect to DeepSeek API via proxy...`);
  try {
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 10000);

    const response = await fetch(deepseekUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${deepseekKey}`,
        'Content-Type': 'application/json'
      },
      agent: agent,
      signal: controller.signal
    });
    clearTimeout(timeout);
    
    const duration = Date.now() - start;
    if (response.ok) {
      console.log(`✅ DeepSeek API connection successful! (${duration}ms)`);
      const data = await response.json();
      console.log('Response sample:', JSON.stringify(data).substring(0, 100) + '...');
    } else {
      console.error(`❌ DeepSeek API returned status: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error('Response body:', text);
    }
  } catch (error: any) {
    console.error(`❌ DeepSeek API connection failed: ${error.message}`);
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      console.error('This usually means the proxy is unreachable or the SSH tunnel is broken.');
    }
  }

  // Check WeCom API Access
  const corpid = process.env.NANOBOT__CHANNELS__WECOM__CORPID;
  const secret = process.env.NANOBOT__CHANNELS__WECOM__CORPSECRET;
  
  if (corpid && secret) {
    const wecomUrl = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${corpid}&corpsecret=${secret}`;
    console.log(`Attempting to connect to WeCom API via proxy...`);
    try {
        const start = Date.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => {
          controller.abort();
        }, 10000);
    
        const response = await fetch(wecomUrl, {
          method: 'GET',
          agent: agent,
          signal: controller.signal
        });
        clearTimeout(timeout);
        
        const duration = Date.now() - start;
        if (response.ok) {
          const data: any = await response.json();
          if (data.errcode === 0) {
             console.log(`✅ WeCom API connection successful! (${duration}ms)`);
          } else {
             console.error(`❌ WeCom API returned error: ${JSON.stringify(data)}`);
          }
        } else {
          console.error(`❌ WeCom API http status: ${response.status}`);
        }
    } catch (error: any) {
        console.error(`❌ WeCom API connection failed: ${error.message}`);
    }
  }

  // Check WeCom API Access with AXIOS (as used in channel code)
  if (corpid && secret) {
    const wecomUrl = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${corpid}&corpsecret=${secret}`;
    console.log(`Attempting to connect to WeCom API via proxy using AXIOS...`);
    
    try {
        const start = Date.now();
        const config: any = {};
        if (proxyUrl) {
            const agent = proxyUrl.startsWith('socks') 
                ? new SocksProxyAgent(proxyUrl) 
                : new HttpsProxyAgent(proxyUrl);
            config.httpsAgent = agent;
            config.proxy = false; 
        }

        const response = await axios.get(wecomUrl, config);
        const duration = Date.now() - start;
        
        if (response.status === 200) {
           if (response.data.errcode === 0) {
              console.log(`✅ WeCom API (Axios) connection successful! (${duration}ms)`);
           } else {
              console.error(`❌ WeCom API (Axios) returned error: ${JSON.stringify(response.data)}`);
           }
        } else {
           console.error(`❌ WeCom API (Axios) http status: ${response.status}`);
        }
    } catch (error: any) {
        console.error(`❌ WeCom API (Axios) connection failed: ${error.message}`);
    }
  }
}

// Run diagnostics
(async () => {
  console.log('--- Starting Diagnostic ---');
  await checkDeepSeekAccess();
  console.log('--- Diagnostic Complete ---');
})();
