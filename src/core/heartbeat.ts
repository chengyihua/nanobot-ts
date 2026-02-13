import fs from 'fs-extra';
import path from 'path';
import { Config, getWorkspacePath } from './config.js';
import { bus } from './bus.js';

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
      console.log('[Heartbeat] Service disabled in config.');
      return;
    }

    if (this.running) return;
    
    this.running = true;
    console.log(`[Heartbeat] Service started (every ${this.intervalS}s)`);
    this._runLoop();
  }

  public stop() {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log('[Heartbeat] Service stopped.');
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
      if (isHeartbeatEmpty(content)) {
        return;
      }

      console.log('[Heartbeat] Found actionable tasks in HEARTBEAT.md, waking up agent...');

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
      console.error('[Heartbeat] Error during tick:', error.message);
    }
  }

  private async readHeartbeatFile(): Promise<string | null> {
    try {
      if (!(await fs.pathExists(this.heartbeatFile))) {
        return null;
      }
      return await fs.readFile(this.heartbeatFile, 'utf-8');
    } catch (error: any) {
      console.warn(`[Heartbeat] Failed to read ${this.heartbeatFile}: ${error.message}`);
      return null;
    }
  }
}
