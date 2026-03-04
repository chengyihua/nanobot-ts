"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionManager = exports.SessionManager = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const lru_cache_1 = require("lru-cache");
const helpers_js_1 = require("../utils/helpers.js");
const constants_js_1 = require("./constants.js");
const logger_js_1 = require("../utils/logger.js");
class SessionManager {
    constructor(options) {
        this.log = (0, logger_js_1.createLogger)('session');
        this.sessionsDir = options?.sessionsDir || (0, helpers_js_1.getSessionsPath)();
        this.cache = new lru_cache_1.LRUCache({
            max: options?.cacheMax || 50,
            ttl: options?.cacheTTL || 1000 * 60 * 60, // 1 hour
            updateAgeOnGet: true,
        });
    }
    getSessionPath(key) {
        const safeKey = key.replace(/[:/\\?%*|"<>]/g, '_');
        return path_1.default.join(this.sessionsDir, `${safeKey}${constants_js_1.EXTENSIONS.JSONL}`);
    }
    getArchivePath(key) {
        const safeKey = key.replace(/[:/\\?%*|"<>]/g, '_');
        return path_1.default.join(this.sessionsDir, `${safeKey}${constants_js_1.EXTENSIONS.ARCHIVE_JSONL}`);
    }
    async clearSession(sessionId) {
        // 1. Remove from cache
        this.cache.delete(sessionId);
        // 2. Remove files from disk
        const filePath = this.getSessionPath(sessionId);
        const archivePath = this.getArchivePath(sessionId);
        try {
            if (await fs_extra_1.default.pathExists(filePath)) {
                await fs_extra_1.default.unlink(filePath);
            }
            if (await fs_extra_1.default.pathExists(archivePath)) {
                await fs_extra_1.default.unlink(archivePath);
            }
            this.log.info({ sessionId }, 'Cleared session (cache + disk)');
        }
        catch (error) {
            this.log.error({ sessionId, err: error }, 'Error clearing session');
        }
    }
    getHistory(sessionId, limit = 30) {
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
                const hasToolCalls = first.content.some((c) => c.type === 'tool-call');
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
    getOrCreate(key) {
        if (this.cache.has(key)) {
            return this.cache.get(key);
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
    loadFromDisk(key) {
        const filePath = this.getSessionPath(key);
        if (!fs_extra_1.default.existsSync(filePath))
            return null;
        try {
            const content = fs_extra_1.default.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n').filter(line => line.trim());
            const messages = [];
            let metadata = {};
            let createdAt = new Date().toISOString();
            let updatedAt = new Date().toISOString();
            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    if (data._type === 'metadata') {
                        metadata = data.metadata || {};
                        createdAt = data.created_at || createdAt;
                        updatedAt = data.updated_at || updatedAt;
                    }
                    else if (data.role && (data.content !== undefined)) {
                        messages.push(data);
                    }
                }
                catch (e) {
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
        }
        catch (error) {
            this.log.error({ sessionId: key, err: error }, 'Error loading session');
            return null;
        }
    }
    async addMessage(sessionId, message) {
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
        }
        else {
            await this.appendMessageToDisk(session.key, message);
        }
    }
    async appendToArchive(key, messages) {
        if (messages.length === 0)
            return;
        const archivePath = this.getArchivePath(key);
        try {
            const content = messages.map(msg => JSON.stringify(msg)).join('\n') + '\n';
            await fs_extra_1.default.appendFile(archivePath, content, 'utf-8');
        }
        catch (error) {
            this.log.error({ sessionId: key, err: error }, 'Error appending to archive');
        }
    }
    async searchArchive(sessionId, query, limit = 20) {
        const archivePath = this.getArchivePath(sessionId);
        if (!fs_extra_1.default.existsSync(archivePath))
            return [];
        const results = [];
        const lowerQuery = query.toLowerCase();
        try {
            const stream = fs_extra_1.default.createReadStream(archivePath, { encoding: 'utf-8' });
            let buffer = '';
            for await (const chunk of stream) {
                buffer += chunk;
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line
                for (const line of lines) {
                    if (!line.trim())
                        continue;
                    try {
                        const msg = JSON.parse(line);
                        if (typeof msg.content === 'string') {
                            if (msg.content.toLowerCase().includes(lowerQuery)) {
                                results.push(`[${msg.role}] ${msg.content}`);
                            }
                        }
                        else if (Array.isArray(msg.content)) {
                            const textContent = msg.content
                                .filter(c => c.type === 'text')
                                .map(c => c.text)
                                .join(' ');
                            if (textContent.toLowerCase().includes(lowerQuery)) {
                                results.push(`[${msg.role}] ${textContent}`);
                            }
                        }
                        if (results.length >= limit) {
                            stream.destroy();
                            return results;
                        }
                    }
                    catch (e) {
                        continue;
                    }
                }
            }
        }
        catch (error) {
            this.log.error({ sessionId, err: error }, 'Error searching archive');
        }
        return results;
    }
    async searchAllSessions(query, limit = 20) {
        const results = [];
        if (!fs_extra_1.default.existsSync(this.sessionsDir))
            return results;
        const lowerQuery = query.toLowerCase();
        // Get all files
        const files = await fs_extra_1.default.readdir(this.sessionsDir);
        const jsonlFiles = files.filter(f => f.endsWith(constants_js_1.EXTENSIONS.JSONL));
        // Sort by modification time (newest first) to find recent context
        const fileStats = await Promise.all(jsonlFiles.map(async (f) => {
            const stats = await fs_extra_1.default.stat(path_1.default.join(this.sessionsDir, f));
            return { file: f, mtime: stats.mtime.getTime() };
        }));
        fileStats.sort((a, b) => b.mtime - a.mtime);
        for (const { file } of fileStats) {
            if (results.length >= limit)
                break;
            const filePath = path_1.default.join(this.sessionsDir, file);
            // Determine session ID
            let sessionId = file;
            if (file.endsWith(constants_js_1.EXTENSIONS.ARCHIVE_JSONL)) {
                sessionId = file.replace(constants_js_1.EXTENSIONS.ARCHIVE_JSONL, '').replace(/_/g, ':') + ' (Archive)';
            }
            else {
                sessionId = file.replace(constants_js_1.EXTENSIONS.JSONL, '').replace(/_/g, ':');
            }
            try {
                const stream = fs_extra_1.default.createReadStream(filePath, { encoding: 'utf-8' });
                let buffer = '';
                for await (const chunk of stream) {
                    buffer += chunk;
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // Keep incomplete line
                    for (const line of lines) {
                        if (!line.trim())
                            continue;
                        try {
                            const data = JSON.parse(line);
                            if (data._type === 'metadata')
                                continue;
                            let textContent = '';
                            if (typeof data.content === 'string') {
                                textContent = data.content;
                            }
                            else if (Array.isArray(data.content)) {
                                textContent = data.content
                                    .filter((c) => c.type === 'text')
                                    .map((c) => c.text)
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
                        }
                        catch (e) {
                            continue;
                        }
                    }
                    if (results.length >= limit)
                        break;
                }
            }
            catch (e) {
                this.log.error({ file, err: e }, 'Error searching archive file');
            }
        }
        return results;
    }
    async appendMessageToDisk(key, message) {
        const filePath = this.getSessionPath(key);
        // If file doesn't exist, fall back to full save
        if (!fs_extra_1.default.existsSync(filePath)) {
            const session = this.getOrCreate(key);
            await this.saveToDisk(session);
            return;
        }
        try {
            await fs_extra_1.default.appendFile(filePath, JSON.stringify(message) + '\n', 'utf-8');
        }
        catch (error) {
            this.log.error({ sessionId: key, err: error }, 'Error appending to session');
        }
    }
    async saveToDisk(session) {
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
            await fs_extra_1.default.writeFile(tempPath, content, 'utf-8');
            await fs_extra_1.default.move(tempPath, filePath, { overwrite: true });
        }
        catch (error) {
            this.log.error({ sessionId: session.key, err: error }, 'Error saving session');
            if (await fs_extra_1.default.pathExists(tempPath)) {
                await fs_extra_1.default.remove(tempPath);
            }
        }
    }
    deleteSession(key) {
        this.cache.delete(key);
        const filePath = this.getSessionPath(key);
        if (fs_extra_1.default.existsSync(filePath)) {
            fs_extra_1.default.unlinkSync(filePath);
            return true;
        }
        return false;
    }
    listSessions() {
        const sessions = [];
        if (!fs_extra_1.default.existsSync(this.sessionsDir))
            return sessions;
        const files = fs_extra_1.default.readdirSync(this.sessionsDir).filter(f => f.endsWith('.jsonl'));
        for (const file of files) {
            try {
                const filePath = path_1.default.join(this.sessionsDir, file);
                // Use fs.openSync and readSync to read only the first chunk instead of the whole file
                const fd = fs_extra_1.default.openSync(filePath, 'r');
                const buffer = Buffer.alloc(4096); // Read first 4KB should be enough for metadata
                const bytesRead = fs_extra_1.default.readSync(fd, buffer, 0, 4096, 0);
                fs_extra_1.default.closeSync(fd);
                const content = buffer.toString('utf-8', 0, bytesRead);
                const firstLine = content.split('\n')[0];
                if (firstLine) {
                    const data = JSON.parse(firstLine);
                    if (data._type === 'metadata') {
                        // Use file stats for modification time as it's more accurate with append-only strategy
                        const stats = fs_extra_1.default.statSync(filePath);
                        sessions.push({
                            key: file.replace('.jsonl', '').replace(/_/g, ':'),
                            createdAt: data.created_at,
                            updatedAt: stats.mtime.toISOString(), // Use filesystem mtime
                            path: filePath,
                        });
                    }
                }
            }
            catch (e) {
                continue;
            }
        }
        return sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    clear(sessionId) {
        const session = this.getOrCreate(sessionId);
        session.messages = [];
        session.updatedAt = new Date().toISOString();
        this.saveToDisk(session);
    }
    /**
     * Remove sessions older than maxAgeDays (default 30)
     */
    cleanup(maxAgeDays = 30) {
        if (!fs_extra_1.default.existsSync(this.sessionsDir))
            return 0;
        const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
        let removed = 0;
        for (const file of fs_extra_1.default.readdirSync(this.sessionsDir).filter(f => f.endsWith('.jsonl'))) {
            const filePath = path_1.default.join(this.sessionsDir, file);
            try {
                const stat = fs_extra_1.default.statSync(filePath);
                if (stat.mtimeMs < cutoff) {
                    fs_extra_1.default.unlinkSync(filePath);
                    removed++;
                }
            }
            catch (_) { /* ignore single-file errors */ }
        }
        return removed;
    }
}
exports.SessionManager = SessionManager;
exports.sessionManager = new SessionManager();
