
import assert from 'assert';
import fs from 'fs-extra';
import path from 'path';
import { PluginLoader } from './plugin-loader.js';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_DIR = path.join(path.resolve(__dirname, '../../'), 'test-plugins-temp-' + Date.now());
const PLUGINS_DIR = path.join(TEST_DIR, 'plugins');

async function runTests() {
  console.log('Running Plugin System Tests...');

  // Setup
  await fs.ensureDir(PLUGINS_DIR);

  try {
    await testLoadPlugin();
    console.log('All Plugin System tests PASSED');
  } catch (error) {
    console.error('Test FAILED:', error);
    process.exit(1);
  } finally {
    // Cleanup
    await fs.remove(TEST_DIR);
  }
}

async function testLoadPlugin() {
  console.log('Test: Load Plugin from Directory');
  
  // Create a dummy plugin file
  const pluginContent = `
    import { tool } from 'ai';
    import { z } from 'zod';
    
    export default {
      name: 'test-plugin',
      version: '1.0.0',
      init: async () => {
        return {
          testTool: tool({
            description: 'Test tool',
            parameters: z.object({ val: z.string() }),
            execute: async ({ val }) => ({ result: val })
          })
        };
      }
    };
  `;
  
  const pluginPath = path.join(PLUGINS_DIR, 'test-plugin.ts');
  await fs.writeFile(pluginPath, pluginContent);

  const pluginLoader = new PluginLoader(TEST_DIR); // root dir contains 'plugins'
  
  const options = {
    config: { tools: {} }
  };

  const tools = await pluginLoader.loadPlugins(options as any);
  
  assert.ok(tools.testTool, 'Plugin tool should be loaded');
  assert.strictEqual(typeof tools.testTool.execute, 'function', 'Tool should have execute method');
  
  const result = await tools.testTool.execute({ val: 'works' });
  assert.strictEqual(result.result, 'works', 'Tool execution should return correct result');
  
  console.log('PASS: Load Plugin from Directory');
}

runTests().catch(console.error);
