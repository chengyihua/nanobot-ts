import fs from 'fs-extra';
import path from 'path';
import { generateText } from 'ai';
import { createModel } from '../../providers/registry.js';
import { MemoryStore } from '../memory.js';
import { Config, getWorkspacePath } from '../config.js';
import { createLogger } from '../../utils/logger.js';
import { todayDate } from '../../utils/helpers.js';

const log = createLogger('summary-service');

export class SummaryService {
  private config: Config;
  private memoryStore: MemoryStore;
  private workspacePath: string;

  constructor(config: Config) {
    this.config = config;
    this.workspacePath = getWorkspacePath(config);
    this.memoryStore = new MemoryStore(this.workspacePath);
  }

  /**
   * Generates an hourly summary for the current hour (based on previous hour's logs).
   * Typically runs at XX:00.
   */
  public async generateHourlySummary(): Promise<void> {
    const now = new Date();
    const currentHour = now.getHours();
    const prevHour = currentHour === 0 ? 23 : currentHour - 1;
    
    // If it's 00:00, we're summarizing 23:00-00:00 of YESTERDAY.
    // Otherwise, we're summarizing (currentHour-1):00 to currentHour:00 of TODAY.
    
    let targetDate = new Date();
    if (currentHour === 0) {
      targetDate.setDate(targetDate.getDate() - 1);
    }
    const dateStr = targetDate.toISOString().split('T')[0];
    
    log.info({ hour: prevHour, date: dateStr }, 'Generating hourly summary');

    // Read the memory file for the target date
    const memoryFile = path.join(this.workspacePath, 'memory', `${dateStr}.md`);
    if (!await fs.pathExists(memoryFile)) {
      log.warn({ file: memoryFile }, 'Memory file not found, skipping summary');
      return;
    }

    const content = await fs.readFile(memoryFile, 'utf-8');
    
    // Extract logs for the specific hour
    // Assuming format: ### [HH:MM:SS] Interaction
    const hourPrefix = `[${prevHour.toString().padStart(2, '0')}:`;
    log.info({ hourPrefix, totalLines: content.split('\n').length }, 'Scanning for events');
    
    const allLines = content.split('\n');
    const capturedLines: string[] = [];
    let isCapturing = false;

    for (const line of allLines) {
      const trimmed = line.trim();
      // Start of a new interaction block
      if (trimmed.startsWith('### [')) {
        if (trimmed.includes(hourPrefix)) {
          isCapturing = true;
          capturedLines.push(line);
        } else {
          isCapturing = false;
        }
      } else if (isCapturing) {
        capturedLines.push(line);
      }
    }
    
    if (capturedLines.length === 0) {
      log.info('No events found for this hour');
      return;
    }

    const eventsText = capturedLines.join('\n');
    
    // Generate summary using LLM
    try {
      const modelId = this.config.agents.defaults.model;
      const model = createModel(modelId, this.config);
      const { text } = await generateText({
        model,
        prompt: `
        You are an intelligent summarizer. Analyze the following log entries from ${prevHour}:00 to ${prevHour + 1}:00.
        
        Events:
        ${eventsText}
        
        Instructions:
        1. Summarize the key activities, user requests, and system actions.
        2. Identify any errors or issues.
        3. Highlight important decisions or outcomes.
        4. Keep it concise (3-5 bullet points).
        5. Output in Markdown format.
        6. Language: Use the same language as the events (likely Chinese).
        `
      });

      // Save summary
      const summaryDir = path.join(this.workspacePath, 'memory', 'hourly');
      await fs.ensureDir(summaryDir);
      const summaryFile = path.join(summaryDir, `${dateStr}_${prevHour.toString().padStart(2, '0')}_summary.md`);
      
      await fs.writeFile(summaryFile, text, 'utf-8');
      log.info({ file: summaryFile }, 'Hourly summary generated');

    } catch (error) {
      log.error({ err: error }, 'Failed to generate hourly summary');
    }
  }

  /**
   * Generates a daily summary.
   * Typically runs at 00:00 or 00:10 for the previous day.
   */
  public async generateDailySummary(): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    log.info({ date: dateStr }, 'Generating daily summary');

    // Read all hourly summaries for that day
    const summaryDir = path.join(this.workspacePath, 'memory', 'hourly');
    if (!await fs.pathExists(summaryDir)) {
        log.warn('Hourly summary directory not found');
        return;
    }

    const files = await fs.readdir(summaryDir);
    const hourlyFiles = files.filter(f => f.startsWith(dateStr) && f.endsWith('_summary.md'));
    
    if (hourlyFiles.length === 0) {
      // Fallback: Read the daily memory file directly
      const memoryFile = path.join(this.workspacePath, 'memory', `${dateStr}.md`);
      if (await fs.pathExists(memoryFile)) {
         const content = await fs.readFile(memoryFile, 'utf-8');
         await this.summarizeContent(content, dateStr);
         return;
      }
      log.info('No data found for daily summary');
      return;
    }

    // Aggregate hourly summaries
    let aggregatedContent = '';
    for (const file of hourlyFiles.sort()) {
      const content = await fs.readFile(path.join(summaryDir, file), 'utf-8');
      aggregatedContent += `\n\n### ${file.split('_')[1]}:00 - ${file.split('_')[1]}:59\n${content}`;
    }

    await this.summarizeContent(aggregatedContent, dateStr);
  }

  private async summarizeContent(content: string, dateStr: string) {
    try {
      const modelId = this.config.agents.defaults.model;
      const model = createModel(modelId, this.config);
      const { text } = await generateText({
        model,
        prompt: `
        You are an intelligent summarizer. Create a comprehensive Daily Summary for ${dateStr}.
        
        Input Data:
        ${content}
        
        Instructions:
        1. Synthesize the day's events into a cohesive narrative or structured list.
        2. Group by: Key Achievements, User Interactions, System Issues, Next Steps.
        3. Be thorough but concise.
        4. Output in Markdown.
        5. Language: Use the same language as the input (likely Chinese).
        `
      });

      const dailyDir = path.join(this.workspacePath, 'memory', 'daily');
      await fs.ensureDir(dailyDir);
      const summaryFile = path.join(dailyDir, `${dateStr}_summary.md`);
      
      await fs.writeFile(summaryFile, text, 'utf-8');
      log.info({ file: summaryFile }, 'Daily summary generated');

    } catch (error) {
      log.error({ err: error }, 'Failed to generate daily summary');
    }
  }
}
