"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDir = ensureDir;
exports.getDataPath = getDataPath;
exports.getWorkspacePath = getWorkspacePath;
exports.getSessionsPath = getSessionsPath;
exports.todayDate = todayDate;
exports.timestamp = timestamp;
exports.truncateString = truncateString;
exports.safeFilename = safeFilename;
exports.parseSessionKey = parseSessionKey;
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const fs_extra_1 = __importDefault(require("fs-extra"));
/**
 * Ensure a directory exists, creating it if necessary.
 */
function ensureDir(dirPath) {
    fs_extra_1.default.ensureDirSync(dirPath);
    return dirPath;
}
/**
 * Get the nanobot data directory (./.nanobot).
 */
function getDataPath() {
    return ensureDir(path_1.default.resolve('./.nanobot'));
}
/**
 * Get the workspace path.
 */
function getWorkspacePath(workspace) {
    let wsPath;
    if (workspace) {
        wsPath = workspace.startsWith('~')
            ? path_1.default.join(os_1.default.homedir(), workspace.slice(1))
            : path_1.default.resolve(workspace);
    }
    else {
        wsPath = path_1.default.join(os_1.default.homedir(), '.nanobot', 'workspace');
    }
    return ensureDir(wsPath);
}
/**
 * Get the sessions storage directory.
 */
function getSessionsPath() {
    return ensureDir(path_1.default.join(getDataPath(), 'sessions'));
}
/**
 * Get today's date in YYYY-MM-DD format.
 */
function todayDate() {
    return new Date().toISOString().split('T')[0];
}
/**
 * Get current timestamp in ISO format.
 */
function timestamp() {
    return new Date().toISOString();
}
/**
 * Truncate a string to max length, adding suffix if truncated.
 */
function truncateString(s, maxLen = 100, suffix = '...') {
    if (s.length <= maxLen) {
        return s;
    }
    return s.slice(0, maxLen - suffix.length) + suffix;
}
/**
 * Convert a string to a safe filename.
 */
function safeFilename(name) {
    // Replace unsafe characters
    const unsafe = /[<>:"/\\|?*]/g;
    return name.replace(unsafe, '_').trim();
}
/**
 * Parse a session key into channel and chat_id.
 * Expected format: "channel:chat_id"
 * If no colon is present, defaults to channel "cli".
 */
function parseSessionKey(key) {
    if (!key.includes(':')) {
        // For simple keys like 'default' or 'heartbeat', use 'cli' or 'system' as default channel
        const defaultChannel = key === 'heartbeat' ? 'system' : 'cli';
        return [defaultChannel, key];
    }
    const parts = key.split(':');
    return [parts[0], parts.slice(1).join(':')];
}
