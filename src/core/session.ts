import { type CoreMessage } from 'ai';
import fs from 'fs-extra';
import path from 'path';
import { LRUCache } from 'lru-cache';
import { getSessionsPath } from '../utils/helpers.js';
import { EXTENSIONS } from './constants.js';
import { createLogger } from '../utils/logger.js';

export interface SessionData {
  key: string;
  messages: CoreMessage[];
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, any>;
}

export class SessionManager {
  private sessionsDir: string;
  private cache: LRUCache<string, SessionData>;
  private log = createLogger('session');

  constructor(options?: { cacheMax?: number; cacheTTL?: number; sessionsDir?: string }) {
    this.sessionsDir = options?.sessionsDir || getSessionsPath();
    this.cache = new LRUCache({
      max: options?.cacheMax || 50,
      ttl: options?.cacheTTL || 1000 * 60 * 60, // 1 hour
      updateAgeOnGet: true,
    });
  }

  private getSessionPath(key: string): string {
    const safeKey = key.replace(/[:/\\?%*|"<>]/g, '_');
    return path.join(this.sessionsDir, `${safeKey}${EXTENSIONS.JSONL}`);
  }

  private getArchivePath(key: string): string {
    const safeKey = key.replace(/[:/\\?%*|"<>]/g, '_');
    return path.join(this.sessionsDir, `${safeKey}${EXTENSIONS.ARCHIVE_JSONL}`);
  }

  public async clearSession(sessionId: string): Promise<void> {
    // 1. Remove from cache
    this.cache.delete(sessionId);

    // 2. Remove files from disk
    const filePath = this.getSessionPath(sessionId);
    const archivePath = this.getArchivePath(sessionId);

    try {
      if (await fs.pathExists(filePath)) {
        await fs.unlink(filePath);
      }
      if (await fs.pathExists(archivePath)) {
        await fs.unlink(archivePath);
      }
      this.log.info({ sessionId }, 'Cleared session (cache + disk)');
    } catch (error) {
      this.log.error({ sessionId, err: error }, 'Error clearing session');
    }
  }

  public getHistory(sessionId: string, limit: number = 30): CoreMessage[] {
    const session = this.getOrCreate(sessionId);
    
    if (session.messages.length <= limit) {
      return session.messages;
    }

    // 从 limit 位置开始切分
    const messages = session.messages.slice(-limit);
    
    // 确保切分后的第一条消息不是 tool 消息
    // 如果是 tool 消息，说明其配对的 assistant 消息被切掉了
    // 同时也确保第一条不是 assistant 且带 tool_calls 的消息，如果它的 tool 结果在 limit 之外
    while (messages.length > 0) {
      const first = messages[0];
      if (first.role === 'tool') {
        messages.shift();
        continue;
      }
      
      // 如果第一条是 assistant 且带工具调用，我们需要检查它的结果是否也在这个 slice 里
      if (first.role === 'assistant' && Array.isArray(first.content)) {
        const hasToolCalls = first.content.some((c: any) => c.type === 'tool-call');
        if (hasToolCalls) {
          // 检查后面是否有对应的 tool 消息
          const hasToolResult = messages.some(m => m.role === 'tool');
          if (!hasToolResult) {
            // 如果这个 slice 里没有结果，说明配对被切断了，为了安全，把这条 assistant 也切掉
            messages.shift();
            continue;
          }
        }
      }
      break;
    }
    
    return messages;
  }

  public getOrCreate(key: string): SessionData {
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const session = this.loadFromDisk(key) || {
      key,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {},
    };

    this.cache.set(key, session);
    return session;
  }

  private loadFromDisk(key: string): SessionData | null {
    const filePath = this.getSessionPath(key);
    if (!fs.existsSync(filePath)) return null;

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      const messages: CoreMessage[] = [];
      let metadata: Record<string, any> = {};
      let createdAt = new Date().toISOString();
      let updatedAt = new Date().toISOString();

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data._type === 'metadata') {
            metadata = data.metadata || {};
            createdAt = data.created_at || createdAt;
            updatedAt = data.updated_at || updatedAt;
          } else if (data.role && (data.content !== undefined)) {
            messages.push(data);
          }
        } catch (e) {
          // If a line is corrupted, we don't just warn, we log it for debugging
          // and skip it to keep the history as intact as possible.
          // The next saveToDisk will effectively "clean" the file.
          this.log.warn({ sessionId: key, preview: line.slice(0, 100) }, 'Skipping corrupted line in session file');
          continue;
        }
      }
      
      return {
        key,
        messages,
        createdAt,
        updatedAt,
        metadata,
      };
    } catch (error) {
      this.log.error({ sessionId: key, err: error }, 'Error loading session');
      return null;
    }
  }

  public async addMessage(sessionId: string, message: CoreMessage): Promise<void> {
    const session = this.getOrCreate(sessionId);
    session.messages.push(message);
    session.updatedAt = new Date().toISOString();

    // Optimize: Only compact (rewrite file) when history gets too long (e.g. > 100)
    // Otherwise just append to file for O(1) performance
    // Note: getHistory will handle the context window slicing (default 30)
    if (session.messages.length > 100) {
      // Archive older messages before truncation
      const messagesToArchive = session.messages.slice(0, -50);
      await this.appendToArchive(session.key, messagesToArchive);

      // Keep last 50 messages during compaction to prevent infinite growth
      session.messages = session.messages.slice(-50);
      await this.saveToDisk(session);
    } else {
      await this.appendMessageToDisk(session.key, message);
    }
  }

  private async appendToArchive(key: string, messages: CoreMessage[]) {
    if (messages.length === 0) return;
    const archivePath = this.getArchivePath(key);
    try {
      const content = messages.map(msg => JSON.stringify(msg)).join('\n') + '\n';
      await fs.appendFile(archivePath, content, 'utf-8');
    } catch (error) {
      this.log.error({ sessionId: key, err: error }, 'Error appending to archive');
    }
  }

  public async searchArchive(sessionId: string, query: string, limit: number = 20): Promise<string[]> {
    const archivePath = this.getArchivePath(sessionId);
    if (!fs.existsSync(archivePath)) return [];

    const results: string[] = [];
    const lowerQuery = query.toLowerCase();

    try {
      const stream = fs.createReadStream(archivePath, { encoding: 'utf-8' });
      let buffer = '';

      for await (const chunk of stream) {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line) as CoreMessage;
            if (typeof msg.content === 'string') {
              if (msg.content.toLowerCase().includes(lowerQuery)) {
                results.push(`[${msg.role}] ${msg.content}`);
              }
            } else if (Array.isArray(msg.content)) {
              const textContent = msg.content
                .filter(c => c.type === 'text')
                .map(c => (c as any).text)
                .join(' ');
              if (textContent.toLowerCase().includes(lowerQuery)) {
                results.push(`[${msg.role}] ${textContent}`);
              }
            }
            if (results.length >= limit) {
              stream.destroy();
              return results;
            }
          } catch (e) {
            continue;
          }
        }
      }
    } catch (error) {
      this.log.error({ sessionId, err: error }, 'Error searching archive');
    }

    return results;
  }

  public async searchAllSessions(query: string, limit: number = 20): Promise<Array<{sessionId: string, role: string, content: string}>> {
    const results: Array<{sessionId: string, role: string, content: string}> = [];
    if (!fs.existsSync(this.sessionsDir)) return results;

    const lowerQuery = query.toLowerCase();
    
    // Get all files
    const files = await fs.readdir(this.sessionsDir);
    const jsonlFiles = files.filter(f => f.endsWith(EXTENSIONS.JSONL));

    // Sort by modification time (newest first) to find recent context
    const fileStats = await Promise.all(jsonlFiles.map(async f => {
        const stats = await fs.stat(path.join(this.sessionsDir, f));
        return { file: f, mtime: stats.mtime.getTime() };
    }));
    fileStats.sort((a, b) => b.mtime - a.mtime);

    for (const { file } of fileStats) {
        if (results.length >= limit) break;
        
        const filePath = path.join(this.sessionsDir, file);
        // Determine session ID
        let sessionId = file;
        if (file.endsWith(EXTENSIONS.ARCHIVE_JSONL)) {
            sessionId = file.replace(EXTENSIONS.ARCHIVE_JSONL, '').replace(/_/g, ':') + ' (Archive)';
        } else {
            sessionId = file.replace(EXTENSIONS.JSONL, '').replace(/_/g, ':');
        }

        try {
             const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
             let buffer = '';
             
             for await (const chunk of stream) {
                buffer += chunk;
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line
                
                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);
                        if (data._type === 'metadata') continue;
                        
                        let textContent = '';
                        if (typeof data.content === 'string') {
                            textContent = data.content;
                        } else if (Array.isArray(data.content)) {
                             textContent = data.content
                                .filter((c: any) => c.type === 'text')
                                .map((c: any) => c.text)
                                .join(' ');
                        }

                        if (textContent && textContent.toLowerCase().includes(lowerQuery)) {
                            results.push({
                                sessionId,
                                role: data.role,
                                content: textContent
                            });
                            if (results.length >= limit) {
                                stream.destroy();
                                break;
                            }
                        }
                    } catch (e) { continue; }
                }
                if (results.length >= limit) break;
             }
        } catch (e) {
            this.log.error({ file, err: e }, 'Error searching archive file');
        }
    }

    return results;
  }

  private async appendMessageToDisk(key: string, message: CoreMessage) {
    const filePath = this.getSessionPath(key);
    // If file doesn't exist, fall back to full save
    if (!fs.existsSync(filePath)) {
      const session = this.getOrCreate(key);
      await this.saveToDisk(session);
      return;
    }
    try {
      await fs.appendFile(filePath, JSON.stringify(message) + '\n', 'utf-8');
    } catch (error) {
      this.log.error({ sessionId: key, err: error }, 'Error appending to session');
    }
  }

  private async saveToDisk(session: SessionData) {
    const filePath = this.getSessionPath(session.key);
    const tempPath = `${filePath}.${Math.random().toString(36).substring(7)}.tmp`;
    try {
      const metadataLine = JSON.stringify({
        _type: 'metadata',
        created_at: session.createdAt,
        updated_at: session.updatedAt,
        metadata: session.metadata,
      });

      const messageLines = session.messages.map(msg => JSON.stringify(msg));
      const content = [metadataLine, ...messageLines].join('\n') + '\n';
      
      await fs.writeFile(tempPath, content, 'utf-8');
      await fs.move(tempPath, filePath, { overwrite: true });
    } catch (error) {
      this.log.error({ sessionId: session.key, err: error }, 'Error saving session');
      if (await fs.pathExists(tempPath)) {
        await fs.remove(tempPath);
      }
    }
  }

  public deleteSession(key: string): boolean {
    this.cache.delete(key);
    const filePath = this.getSessionPath(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }

  public listSessions(): any[] {
    const sessions: any[] = [];
    if (!fs.existsSync(this.sessionsDir)) return sessions;

    const files = fs.readdirSync(this.sessionsDir).filter(f => f.endsWith('.jsonl'));
    for (const file of files) {
      try {
        const filePath = path.join(this.sessionsDir, file);
        // Use fs.openSync and readSync to read only the first chunk instead of the whole file
        const fd = fs.openSync(filePath, 'r');
        const buffer = Buffer.alloc(4096); // Read first 4KB should be enough for metadata
        const bytesRead = fs.readSync(fd, buffer, 0, 4096, 0);
        fs.closeSync(fd);
        
        const content = buffer.toString('utf-8', 0, bytesRead);
        const firstLine = content.split('\n')[0];
        
        if (firstLine) {
          const data = JSON.parse(firstLine);
          if (data._type === 'metadata') {
            // Use file stats for modification time as it's more accurate with append-only strategy
            const stats = fs.statSync(filePath);
            sessions.push({
              key: file.replace('.jsonl', '').replace(/_/g, ':'),
              createdAt: data.created_at,
              updatedAt: stats.mtime.toISOString(), // Use filesystem mtime
              path: filePath,
            });
          }
        }
      } catch (e) {
        continue;
      }
    }

    return sessions.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  public clear(sessionId: string): void {
    const session = this.getOrCreate(sessionId);
    session.messages = [];
    session.updatedAt = new Date().toISOString();
    this.saveToDisk(session);
  }

  /**
   * Remove sessions older than maxAgeDays (default 30)
   */
  public cleanup(maxAgeDays = 30): number {
    if (!fs.existsSync(this.sessionsDir)) return 0;
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    let removed = 0;
    for (const file of fs.readdirSync(this.sessionsDir).filter(f => f.endsWith('.jsonl'))) {
      const filePath = path.join(this.sessionsDir, file);
      try {
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(filePath);
          removed++;
        }
      } catch (_) { /* ignore single-file errors */ }
    }
    return removed;
  }
}

export const sessionManager = new SessionManager();
