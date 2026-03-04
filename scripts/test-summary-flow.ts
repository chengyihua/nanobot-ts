
import path from 'path';
import fs from 'fs-extra';
import { SummaryService } from '../src/core/summary/service.js';
import { MemoryStore } from '../src/core/memory.js';
import { loadConfig } from '../src/core/config.js';
import { createLogger } from '../src/utils/logger.js';

const log = createLogger('test-summary');

async function runTest() {
  try {
    // 1. Load Config
    const config = await loadConfig();
    const workspacePath = path.resolve(process.cwd(), '../workspace_test_summary'); // Use a separate workspace for testing
    
    // Ensure test workspace exists and is clean
    await fs.ensureDir(workspacePath);
    await fs.emptyDir(workspacePath);
    
    // Mock config to point to test workspace if needed, 
    // but SummaryService takes config and workspacePath is derived or passed?
    // Looking at SummaryService code:
    // constructor(config: Config) { ... this.workspacePath = getWorkspacePath(config); ... }
    // So we need to override the workspace path in config or mock getWorkspacePath.
    // Let's modify config.workspace_path temporarily.
    
    // Create a temporary config object
    // We must update agents.defaults.workspace because getWorkspacePath(config) uses it.
    const testConfig = JSON.parse(JSON.stringify(config));
    if (!testConfig.agents) testConfig.agents = {};
    if (!testConfig.agents.defaults) testConfig.agents.defaults = {};
    testConfig.agents.defaults.workspace = workspacePath;

    // 2. Initialize Components
    const memoryStore = new MemoryStore(workspacePath);
    const summaryService = new SummaryService(testConfig);

    // 3. Generate Mock Data
    const now = new Date();
    const currentHour = now.getHours();
    const prevHour = currentHour === 0 ? 23 : currentHour - 1;
    
    // We need to write to the file that SummaryService reads.
    // SummaryService reads from memory/${dateStr}.md
    // And it looks for lines containing `[HH:` where HH is the previous hour.
    
    let targetDate = new Date();
    if (currentHour === 0) {
      targetDate.setDate(targetDate.getDate() - 1);
    }
    const dateStr = targetDate.toISOString().split('T')[0];
    const memoryFile = path.join(workspacePath, 'memory', `${dateStr}.md`);
    
    await fs.ensureDir(path.dirname(memoryFile));
    
    const mockLog = `
### [${prevHour.toString().padStart(2, '0')}:15:00] Interaction

**User:** 请帮我查询一下北京今天的天气。

**Tools Used:**
- \`weather_query\`: {"location": "Beijing", "temperature": "25C", "condition": "Sunny"}...

**Agent:** 北京今天天气晴朗，气温25摄氏度。
    
### [${prevHour.toString().padStart(2, '0')}:45:00] Interaction

**User:** 好的，那上海呢？

**Tools Used:**
- \`weather_query\`: {"location": "Shanghai", "temperature": "22C", "condition": "Cloudy"}...

**Agent:** 上海今天多云，气温22摄氏度。
    `;

    await fs.writeFile(memoryFile, mockLog, 'utf-8');
    log.info({ file: memoryFile }, 'Written mock data to memory file');
    
    // Debug: Read back file content
    const writtenContent = await fs.readFile(memoryFile, { encoding: 'utf-8' });
    console.log('DEBUG: Written content length:', writtenContent.length);
    if (typeof writtenContent === 'string') {
      console.log('DEBUG: Written content preview:', writtenContent.substring(0, 100));
    }
    console.log('DEBUG: Searching for prefix:', `[${prevHour.toString().padStart(2, '0')}:`);

    // 4. Trigger Summary Generation
    log.info('Triggering hourly summary generation...');
    await summaryService.generateHourlySummary();

    // 5. Verify Output
    const summaryDir = path.join(workspacePath, 'memory', 'hourly');
    const expectedSummaryFile = path.join(summaryDir, `${dateStr}_${prevHour.toString().padStart(2, '0')}_summary.md`);
    
    if (await fs.pathExists(expectedSummaryFile)) {
      const summaryContent = await fs.readFile(expectedSummaryFile, 'utf-8');
      log.info({ file: expectedSummaryFile }, 'Summary generated successfully!');
      console.log('\n=== Generated Summary ===\n');
      console.log(summaryContent);
      console.log('\n=========================\n');
    } else {
      log.error({ file: expectedSummaryFile }, 'Summary file NOT found!');
      process.exit(1);
    }

  } catch (error) {
    log.error({ err: error }, 'Test failed');
    process.exit(1);
  } finally {
    // Cleanup
    // await fs.remove(path.resolve(process.cwd(), '../workspace_test_summary'));
  }
}

runTest();
