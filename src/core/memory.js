"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryStore = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const helpers_js_1 = require("../utils/helpers.js");
const constants_js_1 = require("./constants.js");
/**
 * Memory system for the agent.
 *
 * Supports daily notes (memory/YYYY-MM-DD.md) and long-term memory (MEMORY.md).
 */
class MemoryStore {
    constructor(workspace) {
        this.workspace = workspace;
        this.memoryDir = path_1.default.join(workspace, constants_js_1.DIRS.MEMORY);
        fs_extra_1.default.ensureDirSync(this.memoryDir);
        this.memoryFile = path_1.default.join(this.memoryDir, constants_js_1.FILES.MEMORY);
    }
    /**
     * Get path to today's memory file.
     */
    getTodayFile() {
        return path_1.default.join(this.memoryDir, `${(0, helpers_js_1.todayDate)()}${constants_js_1.EXTENSIONS.MARKDOWN}`);
    }
    /**
     * Read today's memory notes.
     */
    async readToday() {
        const todayFile = this.getTodayFile();
        if (await fs_extra_1.default.pathExists(todayFile)) {
            return fs_extra_1.default.readFile(todayFile, 'utf-8');
        }
        return '';
    }
    /**
     * Append content to today's memory notes.
     */
    async appendToday(content) {
        const todayFile = this.getTodayFile();
        const exists = await fs_extra_1.default.pathExists(todayFile);
        const MAX_CHARS = 20000; // soft cap per day
        let merged;
        if (!exists) {
            merged = `# ${(0, helpers_js_1.todayDate)()}\n\n${content}`;
        }
        else {
            const existing = await fs_extra_1.default.readFile(todayFile, 'utf-8');
            merged = `${existing}\n${content}`;
        }
        if (merged.length > MAX_CHARS) {
            const headerEnd = merged.indexOf('\n\n');
            const header = headerEnd > -1 ? merged.slice(0, headerEnd) : '';
            const body = merged.slice(-MAX_CHARS);
            merged = header ? `${header}\n\n${body}` : body;
        }
        await fs_extra_1.default.writeFile(todayFile, merged, 'utf-8');
    }
    /**
     * Read long-term memory (MEMORY.md).
     */
    async readLongTerm() {
        if (await fs_extra_1.default.pathExists(this.memoryFile)) {
            return fs_extra_1.default.readFile(this.memoryFile, 'utf-8');
        }
        return '';
    }
    /**
     * Write to long-term memory (MEMORY.md).
     * @deprecated Use appendLongTerm instead for safer updates.
     */
    async writeLongTerm(content) {
        await fs_extra_1.default.writeFile(this.memoryFile, content, 'utf-8');
    }
    /**
     * Append to long-term memory (MEMORY.md).
     */
    async appendLongTerm(content) {
        const exists = await fs_extra_1.default.pathExists(this.memoryFile);
        const contentToWrite = exists ? `\n${content}` : content;
        await fs_extra_1.default.appendFile(this.memoryFile, contentToWrite, 'utf-8');
    }
    /**
     * Search memory files for a keyword.
     * Returns snippets containing the keyword.
     */
    async searchMemory(query, limit = 10) {
        const results = [];
        const lowerQuery = query.toLowerCase();
        // Helper to check and add unique results
        const addResult = (source, text) => {
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
                if (results.length >= limit)
                    return results;
                if (line.trim().length > 0) {
                    addResult('Long-term', line);
                }
            }
        }
        // 2. Search daily files (newest first)
        const files = await this.listMemoryFiles();
        for (const file of files) {
            if (results.length >= limit)
                break;
            const content = await fs_extra_1.default.readFile(file, 'utf-8');
            const lines = content.split('\n');
            const date = path_1.default.basename(file, '.md');
            for (const line of lines) {
                if (results.length >= limit)
                    break;
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
    async getRecentMemories(days = 7) {
        const memories = [];
        const today = new Date();
        for (let i = 0; i < days; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const filePath = path_1.default.join(this.memoryDir, `${dateStr}.md`);
            if (await fs_extra_1.default.pathExists(filePath)) {
                const content = await fs_extra_1.default.readFile(filePath, 'utf-8');
                memories.push(content);
            }
        }
        return memories.join('\n\n---\n\n');
    }
    /**
     * List all memory files sorted by date (newest first).
     */
    async listMemoryFiles() {
        if (!(await fs_extra_1.default.pathExists(this.memoryDir))) {
            return [];
        }
        const files = await fs_extra_1.default.readdir(this.memoryDir);
        return files
            .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
            .sort((a, b) => b.localeCompare(a))
            .map(f => path_1.default.join(this.memoryDir, f));
    }
    /**
     * Get memory context for the agent.
     */
    async getMemoryContext() {
        const parts = [];
        // Long-term memory
        const longTerm = await this.readLongTerm();
        if (longTerm) {
            parts.push('## Long-term Memory\n' + longTerm);
        }
        // Today's notes
        const today = await this.readToday();
        if (today) {
            parts.push("## Today's Notes\n" + today);
        }
        return parts.length > 0 ? parts.join('\n\n') : '';
    }
}
exports.MemoryStore = MemoryStore;
