"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.housekeepingStats = void 0;
exports.cleanupUploads = cleanupUploads;
exports.recordSessionsCleanup = recordSessionsCleanup;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const logger_js_1 = require("./logger.js");
const log = (0, logger_js_1.createLogger)('cleanup');
exports.housekeepingStats = {
    uploads: {
        lastRun: null,
        lastRemoved: 0,
        lastRetentionDays: null,
        lastDurationMs: null,
        lastError: null,
    },
    sessions: {
        lastRun: null,
        lastRemoved: 0,
        lastRetentionDays: null,
        lastDurationMs: null,
        lastError: null,
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
async function cleanupUploads(workspacePath, options = {}) {
    const uploadsDir = path_1.default.join(workspacePath, 'uploads');
    const maxAgeDays = options.maxAgeDays ?? 7;
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    const started = Date.now();
    if (!(await fs_extra_1.default.pathExists(uploadsDir)))
        return 0;
    const entries = await fs_extra_1.default.readdir(uploadsDir);
    let removed = 0;
    for (const entry of entries) {
        const full = path_1.default.join(uploadsDir, entry);
        try {
            const stat = await fs_extra_1.default.stat(full);
            if (!stat.isFile())
                continue;
            if (stat.mtimeMs < cutoff) {
                await fs_extra_1.default.remove(full);
                removed++;
            }
        }
        catch (err) {
            log.warn({ entry }, 'Cleanup uploads skipped for entry');
        }
    }
    if (removed > 0) {
        log.info({ removed, maxAgeDays }, 'Uploads cleanup completed');
    }
    exports.housekeepingStats.uploads.lastRun = started;
    exports.housekeepingStats.uploads.lastRemoved = removed;
    exports.housekeepingStats.uploads.lastRetentionDays = maxAgeDays;
    exports.housekeepingStats.uploads.lastDurationMs = Date.now() - started;
    exports.housekeepingStats.uploads.lastError = null;
    return removed;
}
function recordSessionsCleanup(removed, retentionDays, durationMs, error) {
    exports.housekeepingStats.sessions.lastRun = Date.now();
    exports.housekeepingStats.sessions.lastRemoved = removed;
    exports.housekeepingStats.sessions.lastRetentionDays = retentionDays;
    exports.housekeepingStats.sessions.lastDurationMs = durationMs;
    exports.housekeepingStats.sessions.lastError = error ? String(error?.message || error) : null;
}
