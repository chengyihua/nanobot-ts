import fs from 'fs-extra';
import path from 'path';
import { Config, getWorkspacePath } from './config.js';
import { bus } from './bus.js';
import { createLogger } from '../utils/logger.js';
import { cleanupUploads, recordSessionsCleanup } from '../utils/cleanup.js';
import { sessionManager } from './session.js';

const HEARTBEAT_PROMPT = `Read HEARTBEAT.md in your workspace (if it exists).
Follow any instructions or tasks listed there.
If nothing needs attention, reply with just: HEARTBEAT_OK`;

function isHeartbeatEmpty(content: string | null): boolean {
  if (!content) return true;

  const lines = content.split('\n');

  for (let line of lines) {
    line = line.trim();
    
    // Ignore empty lines, comments, and HTML comments
    if (!line || line.startsWith('#') || line.startsWith('<!--')) {
      continue;
    }

    // Ignore completed tasks: "- [x]" or "* [x]" (case insensitive)
    if (/^[-*]\s*\[x\]/i.test(line)) {
      continue;
    }

    // Ignore empty incomplete task markers: "- [ ]" or "* [ ]" with nothing else
    if (/^[-*]\s*\[\s*\]\s*$/.test(line)) {
      continue;
    }

    // Found actionable content (e.g., "- [ ] Do something" or just "Do something")
    return false; 
  }

  return true;
}

export class HeartbeatService {
  private config: Config;
  private intervalS: number;
  private enabled: boolean;
  private running: boolean = false;
  private timer: NodeJS.Timeout | null = null;
  private log = createLogger('heartbeat');

  constructor(config: Config) {
    this.config = config;
    // Use config values or defaults if somehow missing
    this.enabled = config.heartbeat?.enabled ?? true;
    this.intervalS = config.heartbeat?.interval_seconds ?? 1800;
  }

  private get heartbeatFile(): string {
    const workspace = getWorkspacePath(this.config);
    return path.join(workspace, 'HEARTBEAT.md');
  }

  public async start() {
    if (!this.enabled) {
      this.log.info('Service disabled in config.');
      return;
    }

    if (this.running) return;
    
    this.running = true;
    this.log.info({ interval_s: this.intervalS }, 'Service started');
    this._runLoop();
  }

  public stop() {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.log.info('Service stopped.');
  }

  private async _runLoop() {
    if (!this.running) return;

    const startTime = Date.now();

    try {
      await this.tick();
    } catch (error: any) {
      console.error('[Heartbeat] Loop error:', error.message);
    }

    if (this.running) {
      // Calculate delay to maintain a stable start-to-start interval
      const elapsed = Date.now() - startTime;
      const intervalMs = this.intervalS * 1000;
      const delay = Math.max(0, intervalMs - elapsed);
      
      this.timer = setTimeout(() => this._runLoop(), delay);
    }
  }

  private async tick() {
    try {
      const content = await this.readHeartbeatFile();
      if (this.isSnoozed(content)) {
        return;
      }

      const workspace = getWorkspacePath(this.config);
      const retention = this.config.housekeeping?.uploads_retention_days ?? 7;
      await cleanupUploads(workspace, { maxAgeDays: retention });

      // Session 归档清理（防止磁盘无限增长）
      const sessionRetention = this.config.housekeeping?.sessions_retention_days ?? 30;
      const start = Date.now();
      const removedSessions = sessionManager.cleanup(sessionRetention);
      recordSessionsCleanup(removedSessions, sessionRetention, Date.now() - start);
      if (removedSessions > 0) {
        this.log.info({ removedSessions }, 'Session cleanup completed');
      }

      const actionable = this.countActionable(content);
      if (isHeartbeatEmpty(content)) {
        return;
      }

      const MAX_TASKS = 50;
      if (actionable > MAX_TASKS) {
        this.log.warn({ actionable }, `Heartbeat has ${actionable} tasks; consider pruning HEARTBEAT.md`);
      }

      this.log.info('Found actionable tasks in HEARTBEAT.md, waking up agent...');

      bus.publish({
        id: Math.random().toString(36).substring(7),
        source: 'heartbeat',
        content: HEARTBEAT_PROMPT,
        type: 'text',
        timestamp: Date.now(),
        metadata: {
          sessionId: 'heartbeat',
        },
      });
    } catch (error: any) {
      this.log.error({ err: error }, 'Error during tick');
    }
  }

  // Skip heartbeat if file contains SNOOZE_UNTIL: ISO string or SNOOZE_MINUTES: N
  private isSnoozed(content: string | null): boolean {
    if (!content) return false;
    const lines = content.split('\n').map(l => l.trim());
    const untilLine = lines.find(l => l.toUpperCase().startsWith('SNOOZE_UNTIL:'));
    if (untilLine) {
      const ts = untilLine.split(':').slice(1).join(':').trim();
      const until = Date.parse(ts);
      if (!isNaN(until) && Date.now() < until) return true;
    }
    const minutesLine = lines.find(l => l.toUpperCase().startsWith('SNOOZE_MINUTES:'));
    if (minutesLine) {
      const minutes = parseInt(minutesLine.split(':')[1]);
      if (!isNaN(minutes)) {
        const fileMtime = fs.statSync(this.heartbeatFile).mtimeMs;
        if (Date.now() - fileMtime < minutes * 60 * 1000) return true;
      }
    }
    return false;
  }

  private async readHeartbeatFile(): Promise<string | null> {
    try {
      if (!(await fs.pathExists(this.heartbeatFile))) {
        return null;
      }
      return await fs.readFile(this.heartbeatFile, 'utf-8');
    } catch (error: any) {
      this.log.warn({ err: error, file: this.heartbeatFile }, 'Failed to read heartbeat file');
      return null;
    }
  }

  private countActionable(content: string | null): number {
    if (!content) return 0;
    let count = 0;
    for (const raw of content.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#') || line.startsWith('<!--')) continue;
      if (/^[-*]\s*\[x\]/i.test(line)) continue;
      if (/^[-*]\s*\[\s*\]\s*$/.test(line)) continue;
      count++;
    }
    return count;
  }
}
