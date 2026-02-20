import fs from 'fs-extra';
import path from 'path';
import { createLogger } from './logger.js';

const log = createLogger('cleanup');

export interface CleanupOptions {
  maxAgeDays?: number;
}

export const housekeepingStats = {
  uploads: {
    lastRun: null as number | null,
    lastRemoved: 0,
    lastRetentionDays: null as number | null,
    lastDurationMs: null as number | null,
    lastError: null as string | null,
  },
  sessions: {
    lastRun: null as number | null,
    lastRemoved: 0,
    lastRetentionDays: null as number | null,
    lastDurationMs: null as number | null,
    lastError: null as string | null,
  },
  rate_limits: {
    runcommand_triggers: 0,
    webfetch_triggers: 0,
    runcommand_remaining: 0,
    webfetch_remaining: 0,
  },
};

/**
 * 清理 uploads 目录中过期文件，避免磁盘膨胀。
 * - 仅删除文件，不会递归子目录。
 */
export async function cleanupUploads(workspacePath: string, options: CleanupOptions = {}): Promise<number> {
  const uploadsDir = path.join(workspacePath, 'uploads');
  const maxAgeDays = options.maxAgeDays ?? 7;
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

  const started = Date.now();
  if (!(await fs.pathExists(uploadsDir))) return 0;

  const entries = await fs.readdir(uploadsDir);
  let removed = 0;

  for (const entry of entries) {
    const full = path.join(uploadsDir, entry);
    try {
      const stat = await fs.stat(full);
      if (!stat.isFile()) continue;
      if (stat.mtimeMs < cutoff) {
        await fs.remove(full);
        removed++;
      }
    } catch (err) {
      log.warn({ entry }, 'Cleanup uploads skipped for entry');
    }
  }

  if (removed > 0) {
    log.info({ removed, maxAgeDays }, 'Uploads cleanup completed');
  }

  housekeepingStats.uploads.lastRun = started;
  housekeepingStats.uploads.lastRemoved = removed;
  housekeepingStats.uploads.lastRetentionDays = maxAgeDays;
  housekeepingStats.uploads.lastDurationMs = Date.now() - started;
  housekeepingStats.uploads.lastError = null;

  return removed;
}

export function recordSessionsCleanup(removed: number, retentionDays: number, durationMs: number, error?: any) {
  housekeepingStats.sessions.lastRun = Date.now();
  housekeepingStats.sessions.lastRemoved = removed;
  housekeepingStats.sessions.lastRetentionDays = retentionDays;
  housekeepingStats.sessions.lastDurationMs = durationMs;
  housekeepingStats.sessions.lastError = error ? String(error?.message || error) : null;
}
