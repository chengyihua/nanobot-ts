import fs from 'fs-extra';
import path from 'path';
import { todayDate } from '../utils/helpers.js';
import { DIRS, FILES, EXTENSIONS } from './constants.js';

/**
 * Memory system for the agent.
 * 
 * Supports daily notes (memory/YYYY-MM-DD.md) and long-term memory (MEMORY.md).
 */
export class MemoryStore {
  private workspace: string;
  private memoryDir: string;
  private memoryFile: string;

  constructor(workspace: string) {
    this.workspace = workspace;
    this.memoryDir = path.join(workspace, DIRS.MEMORY);
    fs.ensureDirSync(this.memoryDir);
    this.memoryFile = path.join(this.memoryDir, FILES.MEMORY);
  }

  /**
   * Get path to today's memory file.
   */
  public getTodayFile(): string {
    return path.join(this.memoryDir, `${todayDate()}${EXTENSIONS.MARKDOWN}`);
  }

  /**
   * Read today's memory notes.
   */
  public async readToday(): Promise<string> {
    const todayFile = this.getTodayFile();
    if (await fs.pathExists(todayFile)) {
      return fs.readFile(todayFile, 'utf-8');
    }
    return '';
  }

  /**
   * Append content to today's memory notes.
   */
  public async appendToday(content: string): Promise<void> {
    const todayFile = this.getTodayFile();
    const exists = await fs.pathExists(todayFile);
    const MAX_CHARS = 20000; // soft cap per day

    let merged: string;
    if (!exists) {
      merged = `# ${todayDate()}\n\n${content}`;
    } else {
      const existing = await fs.readFile(todayFile, 'utf-8');
      // Simple deduplication: avoid appending identical content
      if (existing.includes(content.trim())) {
        return;
      }
      merged = `${existing}\n${content}`;
    }

    if (merged.length > MAX_CHARS) {
      const headerEnd = merged.indexOf('\n\n');
      const header = headerEnd > -1 ? merged.slice(0, headerEnd) : '';
      const body = merged.slice(-MAX_CHARS);
      merged = header ? `${header}\n\n${body}` : body;
    }

    await fs.writeFile(todayFile, merged, 'utf-8');
  }

  /**
   * Read long-term memory (MEMORY.md).
   */
  public async readLongTerm(): Promise<string> {
    if (await fs.pathExists(this.memoryFile)) {
      return fs.readFile(this.memoryFile, 'utf-8');
    }
    return '';
  }

  /**
   * Write to long-term memory (MEMORY.md).
   * @deprecated Use appendLongTerm instead for safer updates.
   */
  public async writeLongTerm(content: string): Promise<void> {
    await fs.writeFile(this.memoryFile, content, 'utf-8');
  }

  /**
   * Append to long-term memory (MEMORY.md).
   */
  public async appendLongTerm(content: string): Promise<void> {
    const exists = await fs.pathExists(this.memoryFile);
    const contentToWrite = exists ? `\n${content}` : content;
    await fs.appendFile(this.memoryFile, contentToWrite, 'utf-8');
  }

  /**
   * Search memory files for a keyword.
   * Returns snippets containing the keyword.
   */
  public async searchMemory(query: string, limit: number = 10): Promise<string[]> {
    const results: string[] = [];
    const lowerQuery = query.toLowerCase();

    // Helper to check and add unique results
    const addResult = (source: string, text: string) => {
      if (text.toLowerCase().includes(lowerQuery)) {
        const snippet = `[${source}] ${text.trim()}`;
        results.push(snippet);
        return true;
      }
      return false;
    };

    // 1. Search long-term memory
    const longTerm = await this.readLongTerm();
    if (longTerm) {
      const lines = longTerm.split('\n');
      for (const line of lines) {
        if (results.length >= limit) return results;
        if (line.trim().length > 0) {
          addResult('Long-term', line);
        }
      }
    }

    // 2. Search daily files (newest first)
    const files = await this.listMemoryFiles();
    for (const file of files) {
      if (results.length >= limit) break;
      
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');
      const date = path.basename(file, '.md');
      
      for (const line of lines) {
        if (results.length >= limit) break;
        if (line.trim().length > 0) {
           addResult(date, line);
        }
      }
    }
    
    return results;
  }

  /**
   * Get memories from the last N days.
   */
  public async getRecentMemories(days: number = 7): Promise<string> {
    const memories: string[] = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const filePath = path.join(this.memoryDir, `${dateStr}.md`);

      if (await fs.pathExists(filePath)) {
        const content = await fs.readFile(filePath, 'utf-8');
        memories.push(content);
      }
    }

    return memories.join('\n\n---\n\n');
  }

  /**
   * List all memory files sorted by date (newest first).
   */
  public async listMemoryFiles(): Promise<string[]> {
    if (!(await fs.pathExists(this.memoryDir))) {
      return [];
    }

    const files = await fs.readdir(this.memoryDir);
    return files
      .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort((a, b) => b.localeCompare(a))
      .map(f => path.join(this.memoryDir, f));
  }

  /**
   * Get memory context for the agent.
   */
  public async getMemoryContext(): Promise<string> {
    const parts: string[] = [];

    // Long-term memory
    const longTerm = await this.readLongTerm();
    if (longTerm) {
      parts.push('## Long-term Memory\n' + longTerm);
    }

    // Daily Summaries (Last 3 days)
    const dailySummaries = await this.getRecentDailySummaries(3);
    if (dailySummaries) {
      parts.push('## Recent Daily Summaries\n' + dailySummaries);
    }

    // Hourly Summaries (Today)
    const hourlySummaries = await this.getTodayHourlySummaries();
    if (hourlySummaries) {
      parts.push("## Today's Hourly Summaries\n" + hourlySummaries);
    }

    // Today's notes
    const today = await this.readToday();
    if (today) {
      parts.push("## Today's Notes (Raw)\n" + today);
    }

    return parts.length > 0 ? parts.join('\n\n') : '';
  }

  private async getRecentDailySummaries(count: number): Promise<string> {
    const dailyDir = path.join(this.memoryDir, 'daily');
    if (!(await fs.pathExists(dailyDir))) return '';

    const files = await fs.readdir(dailyDir);
    const sortedFiles = files
      .filter(f => f.endsWith('_summary.md'))
      .sort()
      .reverse()
      .slice(0, count);

    const summaries: string[] = [];
    for (const file of sortedFiles) {
      const content = await fs.readFile(path.join(dailyDir, file), 'utf-8');
      summaries.push(`### ${file.replace('_summary.md', '')}\n${content}`);
    }
    return summaries.join('\n\n');
  }

  private async getTodayHourlySummaries(): Promise<string> {
    const hourlyDir = path.join(this.memoryDir, 'hourly');
    if (!(await fs.pathExists(hourlyDir))) return '';

    const todayStr = new Date().toISOString().split('T')[0];
    const files = await fs.readdir(hourlyDir);
    const sortedFiles = files
      .filter(f => f.startsWith(todayStr) && f.endsWith('_summary.md'))
      .sort();

    const summaries: string[] = [];
    for (const file of sortedFiles) {
      const content = await fs.readFile(path.join(hourlyDir, file), 'utf-8');
      const time = file.split('_')[1]; // 2023-10-27_14_summary.md -> 14
      summaries.push(`### ${time}:00 - ${parseInt(time)+1}:00\n${content}`);
    }
    return summaries.join('\n\n');
  }
}
