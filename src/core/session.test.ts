import assert from 'assert';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { SessionManager } from './session.js';
import { type CoreMessage } from 'ai';

const TEST_DIR = path.join(os.tmpdir(), 'nanobot-test-sessions-' + Date.now());

async function runTests() {
  console.log('Running SessionManager Tests...');

  // Setup
  await fs.ensureDir(TEST_DIR);

  try {
    await testLRUCache();
    await testPersistence();
    await testSearch();
    console.log('All SessionManager tests PASSED');
  } catch (error) {
    console.error('Test FAILED:', error);
    process.exit(1);
  } finally {
    // Cleanup
    await fs.remove(TEST_DIR);
  }
}

async function testLRUCache() {
  console.log('Test: LRU Cache Eviction');
  const manager = new SessionManager({ 
    sessionsDir: TEST_DIR,
    cacheMax: 2 
  });

  // Create s1 and modify it in memory
  const s1 = manager.getOrCreate('s1');
  s1.metadata['temp'] = 'exists';

  // Create s2
  manager.getOrCreate('s2');
  
  // Cache should have s1, s2. Accessing s1 should keep it alive.
  manager.getOrCreate('s1');
  
  // Create s3. Now cache should have s1, s3. s2 might be evicted if it was least recently used.
  // Wait, LRU order: 
  // 1. get s1 -> [s1]
  // 2. get s2 -> [s2, s1] (most recent first)
  // 3. get s1 -> [s1, s2]
  // 4. get s3 -> [s3, s1] (s2 evicted)
  
  manager.getOrCreate('s3');

  // Check s1 (should still be in cache with metadata)
  const s1_check = manager.getOrCreate('s1');
  assert.strictEqual(s1_check.metadata['temp'], 'exists', 's1 should still be in cache');
  
  // Check s2 (should be evicted, so metadata lost when reloaded from disk/empty)
  // First, verify s2 was evicted by checking if we get a fresh object
  // Since we didn't save s2 to disk, reloading it will return a fresh empty session
  const s2_check = manager.getOrCreate('s2');
  // We didn't set metadata on s2, but we can check referential equality if we kept a reference?
  // No, easiest is to rely on side effects or just trust the logic.
  
  // Let's do the "eviction test" more explicitly
  const manager2 = new SessionManager({ 
    sessionsDir: TEST_DIR,
    cacheMax: 1 
  });
  
  const sessA = manager2.getOrCreate('sessA');
  sessA.metadata['foo'] = 'bar';
  
  const sessB = manager2.getOrCreate('sessB'); // sessA should be evicted
  
  const sessA_new = manager2.getOrCreate('sessA'); // Reloaded
  assert.strictEqual(sessA_new.metadata['foo'], undefined, 'Evicted session data not saved to disk should be lost');
  
  console.log('PASS: LRU Cache Eviction');
}

async function testPersistence() {
  console.log('Test: Persistence');
  const manager = new SessionManager({ sessionsDir: TEST_DIR });
  const sessionId = 'persist-test';
  
  const msg: CoreMessage = { role: 'user', content: 'hello' };
  await manager.addMessage(sessionId, msg);
  
  // Check file exists
  const filePath = path.join(TEST_DIR, `${sessionId}.jsonl`);
  assert.ok(fs.existsSync(filePath), 'Session file should be created');
  
  // Check content
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(content.includes('hello'), 'File should contain message content');
  
  // Verify reload
  // Clear cache by creating new manager
  const manager2 = new SessionManager({ sessionsDir: TEST_DIR });
  const history = manager2.getHistory(sessionId);
  assert.strictEqual(history.length, 1);
  assert.strictEqual(history[0].content, 'hello');
  
  console.log('PASS: Persistence');
}

async function testSearch() {
  console.log('Test: Search');
  const manager = new SessionManager({ sessionsDir: TEST_DIR });
  
  await manager.addMessage('search-1', { role: 'user', content: 'apple pie recipe' });
  await manager.addMessage('search-2', { role: 'assistant', content: 'banana bread recipe' });
  
  const results = await manager.searchAllSessions('apple');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].sessionId, 'search-1');
  assert.ok(results[0].content.includes('apple'));
  
  const results2 = await manager.searchAllSessions('bread');
  assert.strictEqual(results2.length, 1);
  assert.strictEqual(results2[0].sessionId, 'search-2');
  
  console.log('PASS: Search');
}

runTests();
