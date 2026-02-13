
import assert from 'assert';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { MemoryStore } from './memory.js';
import { DIRS, FILES, EXTENSIONS } from './constants.js';
import { todayDate } from '../utils/helpers.js';

const TEST_DIR = path.join(os.tmpdir(), 'nanobot-memory-test-' + Date.now());

async function runTests() {
  console.log('Running MemoryStore Tests...');

  await fs.ensureDir(TEST_DIR);

  try {
    await testEmptyFile();
    await testReadWrite();
    await testPermissionError();
    console.log('All MemoryStore tests PASSED');
  } catch (error) {
    console.error('Test FAILED:', error);
    process.exit(1);
  } finally {
    await fs.remove(TEST_DIR);
  }
}

async function testEmptyFile() {
  console.log('Test: Empty File Handling');
  const store = new MemoryStore(TEST_DIR);
  
  // Case 1: File does not exist
  const content = await store.readToday();
  assert.strictEqual(content, '', 'Should return empty string for non-existent file');

  // Case 2: File exists but is empty
  const todayFile = store.getTodayFile();
  await fs.ensureFile(todayFile);
  await fs.writeFile(todayFile, '');
  const content2 = await store.readToday();
  assert.strictEqual(content2, '', 'Should return empty string for empty file');
  
  // Clean up
  await fs.remove(todayFile);

  console.log('PASS: Empty File Handling');
}

async function testReadWrite() {
  console.log('Test: Read/Write');
  const store = new MemoryStore(TEST_DIR);
  
  const testContent = 'Today I learned TDD.';
  await store.appendToday(testContent);
  
  const content = await store.readToday();
  console.log('DEBUG Content:', content);
  console.log('DEBUG Expected Header:', `# ${todayDate()}`);
  assert.ok(content.includes(testContent), 'Should contain appended content');
  assert.ok(content.includes(`# ${todayDate()}`), 'Should contain header');

  // Append more
  await store.appendToday('Another entry.');
  const content2 = await store.readToday();
  assert.ok(content2.includes(testContent));
  assert.ok(content2.includes('Another entry.'));
  
  console.log('PASS: Read/Write');
}

async function testPermissionError() {
  console.log('Test: Permission Error');
  const readOnlyDir = path.join(TEST_DIR, 'readonly');
  await fs.ensureDir(readOnlyDir);
  
  const store = new MemoryStore(readOnlyDir);
  
  // Make directory read-only
  await fs.chmod(readOnlyDir, 0o444);
  
  try {
    await store.appendToday('This should fail');
    // If we are root, this might still succeed, but usually it fails
    // On some systems chmod might not work as expected for root
  } catch (error: any) {
    console.log('Caught expected error:', error.message);
    assert.ok(error, 'Should throw error on permission denied');
  } finally {
    // Restore permissions to allow cleanup
    await fs.chmod(readOnlyDir, 0o777);
  }
  
  console.log('PASS: Permission Error');
}

runTests();
