
import assert from 'assert';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { loadConfig } from './config.js';

const TEST_DIR = path.join(os.tmpdir(), 'nanobot-config-test-' + Date.now());
const CONFIG_PATH = path.join(TEST_DIR, 'config.json');

async function runTests() {
  console.log('Running Config Tests...');

  await fs.ensureDir(TEST_DIR);

  // Backup env
  const envBackup = { ...process.env };

  try {
    await testDefaults();
    await testFileLoading();
    await testMalformedJSON();
    await testEnvOverride();
    await testStandardEnvMapping();
    console.log('All Config tests PASSED');
  } catch (error) {
    console.error('Test FAILED:', error);
    process.exit(1);
  } finally {
    // Restore env
    process.env = envBackup;
    await fs.remove(TEST_DIR);
  }
}

async function testDefaults() {
  console.log('Test: Defaults');
  
  // Ensure no config file
  await fs.remove(CONFIG_PATH);
  
  const config = await loadConfig(CONFIG_PATH);
  
  assert.ok(config.agents.defaults.model, 'Should have default model');
  assert.ok(config.tools.web.search, 'Should have default web tools');
  assert.ok(path.isAbsolute(config.agents.defaults.workspace), 'Workspace path should be absolute');
  
  console.log('PASS: Defaults');
}

async function testFileLoading() {
  console.log('Test: File Loading');
  
  const testConfig = {
    agents: {
      defaults: {
        model: 'test-model-v1',
        temperature: 0.99
      }
    }
  };
  
  await fs.writeJson(CONFIG_PATH, testConfig);
  
  const config = await loadConfig(CONFIG_PATH);
  
  assert.strictEqual(config.agents.defaults.model, 'test-model-v1');
  assert.strictEqual(config.agents.defaults.temperature, 0.99);
  
  console.log('PASS: File Loading');
}

async function testMalformedJSON() {
  console.log('Test: Malformed JSON');
  
  await fs.writeFile(CONFIG_PATH, '{ "broken": "json", }'); // Trailing comma might be allowed in some parsers, let's make it properly broken
  await fs.writeFile(CONFIG_PATH, '{ "broken": "json"'); // Missing closing brace
  
  // loadConfig catches error and warns, then uses defaults
  const config = await loadConfig(CONFIG_PATH);
  
  // Should fallback to defaults
  assert.ok(config.agents.defaults.model, 'Should have default model on error');
  assert.notStrictEqual(config.agents.defaults.model, undefined);
  
  console.log('PASS: Malformed JSON');
}

async function testEnvOverride() {
  console.log('Test: Env Override');
  
  // Set env var: NANOBOT__AGENTS__DEFAULTS__MODEL
  process.env.NANOBOT__AGENTS__DEFAULTS__MODEL = 'env-model-v2';
  process.env.NANOBOT__AGENTS__DEFAULTS__TEMPERATURE = '0.1'; // String number
  process.env.NANOBOT__CHANNELS__TELEGRAM__ENABLED = 'true'; // Boolean
  
  // Clean up config file to ensure we are testing env override of defaults
  await fs.remove(CONFIG_PATH);
  
  const config = await loadConfig(CONFIG_PATH);
  
  assert.strictEqual(config.agents.defaults.model, 'env-model-v2');
  assert.strictEqual(config.agents.defaults.temperature, 0.1);
  assert.strictEqual(config.channels.telegram.enabled, true);
  
  // Cleanup env vars for this test
  delete process.env.NANOBOT__AGENTS__DEFAULTS__MODEL;
  delete process.env.NANOBOT__AGENTS__DEFAULTS__TEMPERATURE;
  delete process.env.NANOBOT__CHANNELS__TELEGRAM__ENABLED;
  
  console.log('PASS: Env Override');
}

async function testStandardEnvMapping() {
  console.log('Test: Standard Env Mapping');
  
  process.env.OPENAI_API_KEY = 'sk-test-123';
  
  await fs.remove(CONFIG_PATH);
  
  const config = await loadConfig(CONFIG_PATH);
  
  assert.strictEqual(config.providers.openai.api_key, 'sk-test-123');
  
  delete process.env.OPENAI_API_KEY;
  
  console.log('PASS: Standard Env Mapping');
}

runTests();
