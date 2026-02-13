
import { AgentLoop } from './agent-loop.js';
import { MessageBus, Message } from './bus.js';
import { SessionManager } from './session.js';
import { Config } from './config.js';
import { CoreMessage } from 'ai';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

// Setup Temp Workspace
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanobot-test-'));
const workspaceDir = path.join(tempDir, 'workspace');
fs.ensureDirSync(workspaceDir);

console.log(`Using temp workspace: ${workspaceDir}`);

// Mock Config
const mockConfig: Config = {
  agents: {
    defaults: {
      workspace: workspaceDir,
      model: 'openai/gpt-4o',
      max_tokens: 4000,
      temperature: 0.7,
      max_iterations: 5
    }
  },
  channels: {
    whatsapp: { enabled: false, bridge_url: '', allow_from: [] },
    telegram: { enabled: false, token: '', allow_from: [] },
    discord: { enabled: false, token: '', allow_from: [], gateway_url: '', intents: 0 },
    feishu: { enabled: false, app_id: '', app_secret: '', encrypt_key: '', verification_token: '', allow_from: [] },
    dingtalk: { enabled: false, client_id: '', client_secret: '', allow_from: [] },
    email: { enabled: false, consent_granted: false, imap_host: '', imap_port: 993, imap_username: '', imap_password: '', imap_mailbox: 'INBOX', imap_use_ssl: true, smtp_host: '', smtp_port: 587, smtp_username: '', smtp_password: '', smtp_use_tls: true, smtp_use_ssl: false, from_address: '', auto_reply_enabled: true, poll_interval_seconds: 30, mark_seen: true, max_body_chars: 12000, subject_prefix: 'Re: ', allow_from: [] },
    wecom: { enabled: false, corpid: '', corpsecret: '', token: '', encoding_aes_key: '', allow_from: [], port: 3000 }
  },
  providers: {
    openai: { api_key: 'test' },
    anthropic: { api_key: 'test' },
    openrouter: { api_key: 'test' },
    deepseek: { api_key: 'test' },
    groq: { api_key: 'test' },
    zhipu: { api_key: 'test' },
    dashscope: { api_key: 'test' },
    vllm: { api_key: 'test' },
    gemini: { api_key: 'test' },
    moonshot: { api_key: 'test' },
    aihubmix: { api_key: 'test' },
    baidu: { api_key: 'test', secret_key: 'test' }
  },
  gateway: { host: '0.0.0.0', port: 18790 },
  tools: {
    web: { search: { api_key: '', max_results: 5 } },
    exec: { timeout: 60 },
    restrict_to_workspace: false
  },
  heartbeat: { enabled: false, interval_seconds: 1800 },
  behavior: {
    stop_keywords: ['停止', 'stop', 'cancel', 'abort', '别做了', '停下'],
    tool_intent_keywords: ['列出', '读取', '查找', '搜索', '运行', '执行', 'list', 'read', 'find', 'search', 'run', 'exec'],
    intent_mismatch: {
      sent_keywords: ['发送', '已发', '发给', 'sent', 'delivered'],
      target_keywords: ['语音', '文件', '图片', '截图', '录屏', '录音', 'voice', 'audio', 'file', 'image', 'screenshot', 'record'],
    }
  }
};

// Mock SessionManager
class MockSessionManager extends SessionManager {
  public history: Map<string, CoreMessage[]> = new Map();

  constructor() {
    super({ sessionsDir: path.join(tempDir, 'sessions') });
  }

  public getHistory(sessionId: string, limit: number = 30): CoreMessage[] {
    const h = this.history.get(sessionId) || [];
    // console.log(`[MockSession] getHistory ${sessionId}: ${h.length} msgs`);
    return h;
  }

  public async addMessage(sessionId: string, message: CoreMessage): Promise<void> {
    const current = this.history.get(sessionId) || [];
    current.push(message);
    this.history.set(sessionId, current);
    console.log(`[MockSession] Added message to ${sessionId}: ${message.role} - ${(message.content as any).length || JSON.stringify(message.content).length}`);
  }
}

// Mock Model Response Store
let nextModelResponse: { text: string; toolCalls?: any[] } = { text: "Default response" };

// Test Agent Loop
class TestAgentLoop extends AgentLoop {
  protected getModel(): any {
    return {
      specificationVersion: 'v1',
      provider: 'mock',
      modelId: 'mock-model',
      defaultObjectGenerationMode: 'json',
      doGenerate: async (options: any) => {
        // console.log('[MockModel] doGenerate called');
        const response = { ...nextModelResponse };
        
        // Reset for next call
        nextModelResponse = { text: "Default response" };
        
        return {
          text: response.text,
          toolCalls: response.toolCalls || [],
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 10 },
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: []
        };
      },
      doStream: async () => { throw new Error("Not implemented"); }
    };
  }
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runSimulation() {
  console.log('=== Starting AgentLoop Simulation ===');
  
  const sessionManager = new MockSessionManager();
  const bus = MessageBus.getInstance();
  
  const agent = new TestAgentLoop(mockConfig, undefined, sessionManager);
  await agent.start();

  // Test 1: Message Aggregation
  console.log('\n--- Test 1: Message Aggregation ---');
  const sessionId1 = 'test-session-1';
  
  bus.publish({
    id: '1', source: 'user', content: 'Message Part A', type: 'text', timestamp: Date.now(),
    metadata: { sessionId: sessionId1 }
  });
  bus.publish({
    id: '2', source: 'user', content: 'Message Part B', type: 'text', timestamp: Date.now(),
    metadata: { sessionId: sessionId1 }
  });

  console.log('Sent 2 messages. Waiting for aggregation window (1.5s)...');
  await delay(2000);

  const history1 = sessionManager.getHistory(sessionId1);
  const userMsg1 = history1.find(m => m.role === 'user');
  
  if (userMsg1 && typeof userMsg1.content === 'string' && userMsg1.content.includes('Message Part A') && userMsg1.content.includes('Message Part B')) {
    console.log('✅ PASS: Messages aggregated successfully.');
    console.log('Content:', userMsg1.content);
  } else {
    console.error('❌ FAIL: Aggregation failed.');
    console.log('History:', JSON.stringify(history1, null, 2));
  }

  // Test 2: Safety Guard - Hallucination
  console.log('\n--- Test 2: Safety Guard (Hallucination) ---');
  const sessionId2 = 'test-session-2';
  
  // Set the LLM to hallucinate a tool call in text
  nextModelResponse = { 
    text: "I will run this command:\nrunCommand: { command: 'rm -rf /' }\nTrust me." 
  };

  bus.publish({
    id: '3', source: 'user', content: 'Trick the agent', type: 'text', timestamp: Date.now(),
    metadata: { sessionId: sessionId2 }
  });

  await delay(2000); // Wait for processing

  // Helper to get text content
  const getText = (msg: CoreMessage) => {
    if (typeof msg.content === 'string') return msg.content;
    if (Array.isArray(msg.content)) {
      return msg.content.map(c => (c as any).text || '').join('');
    }
    return '';
  };

  const history2 = sessionManager.getHistory(sessionId2);
  const assistantMsg2 = history2.find(m => m.role === 'assistant');
  
  if (assistantMsg2) {
    const content = getText(assistantMsg2);
    // The hallucinated pattern should be removed or cleaned
    if (!content.includes('runCommand: {')) {
      console.log('✅ PASS: Hallucination cleaned.');
      console.log('Original Output:', "I will run this command:\nrunCommand: { command: 'rm -rf /' }\nTrust me.");
      console.log('Cleaned Output:', content);
    } else {
      console.error('❌ FAIL: Hallucination NOT cleaned.');
      console.log('Content:', content);
    }
  } else {
    console.error('❌ FAIL: No assistant response found.');
  }

  // Test 3: Safety Guard - Directives
  console.log('\n--- Test 3: Safety Guard (Directives) ---');
  const sessionId3 = 'test-session-3';
  
  // Set LLM to send a file directive for a non-existent file
  nextModelResponse = {
    text: "Here is the file:\nSEND_FILE: non_existent_secret.txt"
  };

  bus.publish({
    id: '4', source: 'user', content: 'Get secret file', type: 'text', timestamp: Date.now(),
    metadata: { sessionId: sessionId3 }
  });

  await delay(2000);

  const history3 = sessionManager.getHistory(sessionId3);
  const assistantMsg3 = history3.find(m => m.role === 'assistant');

  if (assistantMsg3) {
    const content = getText(assistantMsg3);
    if (!content.includes('SEND_FILE')) {
      console.log('✅ PASS: Invalid directive cleaned.');
      console.log('Original Output:', "Here is the file:\nSEND_FILE: non_existent_secret.txt");
      console.log('Cleaned Output:', content);
    } else {
      console.error('❌ FAIL: Invalid directive NOT cleaned.');
      console.log('Content:', content);
    }
  } else {
    console.error('❌ FAIL: No assistant response found.');
  }

  // Cleanup
  console.log('\nCleaning up...');
  fs.removeSync(tempDir);
  console.log('Done.');
  process.exit(0);
}

runSimulation().catch(err => {
  console.error('Simulation Error:', err);
  process.exit(1);
});
