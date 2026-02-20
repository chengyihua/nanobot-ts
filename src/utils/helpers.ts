import path from 'path';
import os from 'os';
import fs from 'fs-extra';

/**
 * Ensure a directory exists, creating it if necessary.
 */
export function ensureDir(dirPath: string): string {
  fs.ensureDirSync(dirPath);
  return dirPath;
}

/**
 * Get the nanobot data directory (./.nanobot).
 */
export function getDataPath(): string {
  return ensureDir(path.resolve('./.nanobot'));
}

/**
 * Get the workspace path.
 */
export function getWorkspacePath(workspace?: string): string {
  let wsPath: string;
  if (workspace) {
    wsPath = workspace.startsWith('~') 
      ? path.join(os.homedir(), workspace.slice(1)) 
      : path.resolve(workspace);
  } else {
    wsPath = path.join(os.homedir(), '.nanobot', 'workspace');
  }
  return ensureDir(wsPath);
}

/**
 * Get the sessions storage directory.
 */
export function getSessionsPath(): string {
  return ensureDir(path.join(getDataPath(), 'sessions'));
}

/**
 * Get today's date in YYYY-MM-DD format.
 */
export function todayDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get current timestamp in ISO format.
 */
export function timestamp(): string {
  return new Date().toISOString();
}

/**
 * Truncate a string to max length, adding suffix if truncated.
 */
export function truncateString(s: string, maxLen: number = 100, suffix: string = '...'): string {
  if (s.length <= maxLen) {
    return s;
  }
  return s.slice(0, maxLen - suffix.length) + suffix;
}

/**
 * Convert a string to a safe filename.
 */
export function safeFilename(name: string): string {
  // Replace unsafe characters
  const unsafe = /[<>:"/\\|?*]/g;
  return name.replace(unsafe, '_').trim();
}

/**
 * Parse a session key into channel and chat_id.
 * Expected format: "channel:chat_id"
 * If no colon is present, defaults to channel "cli".
 */
export function parseSessionKey(key: string): [string, string] {
  if (!key.includes(':')) {
    // For simple keys like 'default' or 'heartbeat', use 'cli' or 'system' as default channel
    const defaultChannel = key === 'heartbeat' ? 'system' : 'cli';
    return [defaultChannel, key];
  }
  const parts = key.split(':');
  return [parts[0], parts.slice(1).join(':')];
}
