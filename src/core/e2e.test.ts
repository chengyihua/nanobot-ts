
import assert from 'assert';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { AgentLoop } from './agent-loop.js';
import { Config, loadConfig } from './config.js';
import { SessionManager } from './session.js';
import { MessageBus } from './bus.js';
import { LanguageModelV1 } from 'ai';

// --- Mocks ---

// We don't strictly implement LanguageModelV1 to avoid extensive boilerplate,
// but we provide the methods required by generateText.
class MockModel {
  readonly specificationVersion = 'v1';
  readonly provider = 'mock';
  readonly modelId = 'mock-model';
  readonly defaultObjectGenerationMode = 'json';
  
  constructor(private responses: any[]) {}

  async doGenerate(options: any) {
    const response = this.responses.shift();
    if (!response) {
      throw new Error('MockModel: No more responses configured');
    }
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 10));

    return {
      text: response.text,
      toolCalls: response.toolCalls,
      finishReason: response.finishReason || 'stop',
      usage: { promptTokens: 10, completionTokens: 10 },
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    };
  }

  async doStream(options: any): Promise<any> {
    throw new Error('Not implemented');
  }
}

class TestAgentLoop extends AgentLoop {
  constructor(
    config: Config, 
    sessionMgr: SessionManager,
    private mockModel: MockModel
  ) {
    super(config, undefined, sessionMgr);
  }

  protected getModel(): LanguageModelV1 {
    return this.mockModel as unknown as LanguageModelV1;
  }
}

// --- Test Setup ---

const TEST_DIR = path.join(os.tmpdir(), 'nanobot-e2e-test-' + Date.now());
const WORKSPACE_DIR = path.join(TEST_DIR, 'workspace');
const SESSIONS_DIR = path.join(TEST_DIR, 'sessions');

async function runTests() {
  console.log('Running E2E Tests...');

  await fs.ensureDir(WORKSPACE_DIR);
  await fs.ensureDir(SESSIONS_DIR);

  try {
    await testAgentToolLoop();
    console.log('All E2E tests PASSED');
  } catch (error) {
    console.error('Test FAILED:', error);
    // Print stack trace
    console.error(error);
    process.exit(1);
  } finally {
    // Cleanup
    // Note: AgentLoop attaches listeners to bus. In a real app they persist.
    // In tests, we might want to remove them, but AgentLoop doesn't expose a stop method yet.
    // We'll just leave them for now as the process exits.
    await fs.remove(TEST_DIR);
  }
}

async function testAgentToolLoop() {
  console.log('Test: Agent Tool Execution Loop');

  // 1. Setup Config & Session
  const config = await loadConfig(); // Load defaults
  config.agents.defaults.workspace = WORKSPACE_DIR;
  
  // Disable cron for test
  config.heartbeat = { enabled: false, interval_seconds: 3600 };
  
  const sessionManager = new SessionManager({ sessionsDir: SESSIONS_DIR });

  // 2. Prepare Workspace File
  const testFile = 'test.txt';
  await fs.writeFile(path.join(WORKSPACE_DIR, testFile), 'Hello from E2E Test');

  // 3. Configure Mock Responses
  // Response 1: Call readFile('test.txt')
  // Response 2: Final answer
  const mockResponses = [
    {
      toolCalls: [{
        toolCallType: 'function',
        toolCallId: 'call_1',
        toolName: 'readFile',
        args: JSON.stringify({ path: testFile })
      }],
      finishReason: 'tool-calls'
    },
    {
      text: 'The file content is: Hello from E2E Test',
      finishReason: 'stop'
    }
  ];
  
  const mockModel = new MockModel(mockResponses);
  const agent = new TestAgentLoop(config, sessionManager, mockModel);
  
  // Start Agent (initializes subsystems)
  await agent.start();

  // 4. Simulate Incoming Message
  const bus = MessageBus.getInstance();
  const sessionId = 'e2e-test-session';
  
  const responsePromise = new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout waiting for agent response')), 10000);
    
    const handler = (msg: any) => {
      // Listen for outbound message
      if (msg.source === 'agent' && msg.metadata?.sessionId === sessionId) {
        // Ignore "thinking" messages or tool outputs if they are broadcasted (usually only final text is broadcasted as 'text' type)
        // But wait, tool results are also messages? No, usually agent sends final response.
        
        // AgentLoop publishes:
        // bus.publish({ ... source: 'agent', content: finalContent ... })
        
        clearTimeout(timeout);
        bus.off('message', handler); // Cleanup listener
        resolve(msg.content);
      }
    };
    
    bus.on('message', handler);
  });

  console.log('Sending message to agent...');
  bus.publish({
    id: 'msg-1',
    source: 'user',
    content: 'Read test.txt and tell me what it says.',
    type: 'text',
    timestamp: Date.now(),
    metadata: { sessionId }
  });

  // 5. Verify Response
  const response = await responsePromise;
  console.log('Agent Response:', response);
  
  assert.ok(response.includes('Hello from E2E Test'), 'Response should contain file content');
  
  console.log('PASS: Agent Tool Execution Loop');
}

runTests();
