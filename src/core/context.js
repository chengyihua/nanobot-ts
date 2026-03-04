"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextBuilder = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const url_1 = require("url");
const config_js_1 = require("./config.js");
const skills_js_1 = require("./skills.js");
const memory_js_1 = require("./memory.js");
const constants_js_1 = require("./constants.js");
const __filename = (0, url_1.fileURLToPath)(import.meta.url);
const __dirname = path_1.default.dirname(__filename);
const BOOTSTRAP_FILES = [constants_js_1.FILES.AGENTS, constants_js_1.FILES.SOUL, constants_js_1.FILES.TOOLS, constants_js_1.FILES.USER, constants_js_1.FILES.IDENTITY];
class ContextBuilder {
    constructor(config) {
        this.config = config;
        this.workspacePath = (0, config_js_1.getWorkspacePath)(config);
        this.memoryStore = new memory_js_1.MemoryStore(this.workspacePath);
        this.skillsLoader = new skills_js_1.SkillsLoader(this.workspacePath);
    }
    async initialize() {
        await fs_extra_1.default.ensureDir(this.workspacePath);
    }
    async buildSystemPrompt(channel, chatId, toolDefinitions) {
        const parts = [];
        // 1. Identity & Core Capabilities
        parts.push(this.getIdentity(channel, chatId));
        // 2. Bootstrap files (AGENTS.md, SOUL.md, etc.)
        const bootstrapContent = await this.loadBootstrapFiles();
        if (bootstrapContent) {
            parts.push(bootstrapContent);
        }
        // 3. Memory context
        const memoryContext = await this.loadMemoryContext();
        if (memoryContext) {
            parts.push(`# Memory\n\n${memoryContext}`);
        }
        // 4. Skills
        await this.appendSkills(parts);
        // 5. Native Tools (Injected)
        if (toolDefinitions) {
            parts.push(`# Available System Tools\n\n${toolDefinitions}\n\n(Note: These are NATIVE tools. Use them directly.)`);
        }
        // 6. Tool Usage Rules
        parts.push(this.getToolUsageRules());
        return parts.join('\n\n---\n\n');
    }
    buildMessages(history, modelId, isVision = false) {
        // 1. Filter/Process History for Vision/Non-Vision models
        let processedHistory = history;
        if (!isVision) {
            processedHistory = history.map(msg => {
                if (msg.role === 'tool')
                    return msg;
                if (Array.isArray(msg.content)) {
                    // If message has tool calls, we must preserve the array structure
                    // otherwise tool calls will be lost when converting to string
                    const hasToolCalls = msg.content.some((c) => c.type === 'tool-call');
                    if (hasToolCalls) {
                        // Just filter out images if we want to be strict, but keeping structure is key
                        return msg;
                    }
                    const textParts = msg.content
                        .filter((part) => part.type === 'text')
                        .map((part) => part.text)
                        .join('\n');
                    return { ...msg, content: textParts || '[Image]' };
                }
                return msg;
            });
        }
        // 2. Truncate History if needed
        return this.truncateHistory(processedHistory);
    }
    getIdentity(channel, chatId) {
        const now = new Date().toLocaleString();
        const platform = `${process.platform} ${os_1.default.arch()}, Node.js ${process.version}`;
        const restrictToWorkspace = this.config.tools?.restrict_to_workspace ?? false;
        let identity = `# nanobot 🐈

You are nanobot, a powerful AI assistant with SYSTEM-LEVEL permissions.
- **Time**: ${now}
- **System**: ${platform}
- **Workspace**: ${this.workspacePath}
- **Mode**: ${restrictToWorkspace ? 'Restricted (Workspace Only)' : 'UNRESTRICTED (Full System Access)'}

${restrictToWorkspace
            ? `- You can ONLY access files inside the workspace directory.`
            : `- You have COMPLETE access to the host file system. Use absolute paths.`}

## Capabilities
- Read/Write files, Execute shell commands
- Search web, Fetch pages
- Spawn subagents for complex tasks
- Send messages to chat channels`;
        if (channel && chatId) {
            identity += `\n\n## Current Session\nChannel: ${channel}\nChat ID: ${chatId}`;
        }
        return identity;
    }
    async loadBootstrapFiles() {
        const mtimes = {};
        for (const filename of BOOTSTRAP_FILES) {
            const filePath = path_1.default.join(this.workspacePath, filename);
            if (await fs_extra_1.default.pathExists(filePath)) {
                const stat = await fs_extra_1.default.stat(filePath);
                mtimes[filename] = stat.mtimeMs;
            }
        }
        if (this.bootstrapCache) {
            const unchanged = Object.keys(mtimes).every((k) => this.bootstrapCache.mtimes[k] === mtimes[k]);
            if (unchanged)
                return this.bootstrapCache.value;
        }
        const parts = [];
        for (const filename of BOOTSTRAP_FILES) {
            const filePath = path_1.default.join(this.workspacePath, filename);
            if (await fs_extra_1.default.pathExists(filePath)) {
                let content = await fs_extra_1.default.readFile(filePath, 'utf-8');
                const MAX_FILE_CHARS = 10000;
                if (content.length > MAX_FILE_CHARS) {
                    console.warn(`[Context] File ${filename} is too large (${content.length} chars), truncating...`);
                    content = content.substring(0, MAX_FILE_CHARS) + '\n\n... (file truncated due to size)';
                }
                parts.push(`## ${filename}\n\n${content}`);
            }
        }
        const value = parts.join('\n\n');
        this.bootstrapCache = { value, mtimes };
        return value;
    }
    async loadMemoryContext() {
        let memoryContext = await this.memoryStore.getMemoryContext();
        if (memoryContext) {
            const MAX_MEMORY_CHARS = 30000;
            if (memoryContext.length > MAX_MEMORY_CHARS) {
                console.warn(`[Context] Memory context is too large (${memoryContext.length} chars), truncating...`);
                memoryContext = memoryContext.substring(0, MAX_MEMORY_CHARS) + '\n\n... (memory truncated due to size)';
            }
        }
        return memoryContext;
    }
    async appendSkills(parts) {
        // Always-loaded skills
        const alwaysSkills = await this.skillsLoader.getAlwaysSkills();
        if (alwaysSkills.length > 0) {
            const alwaysContent = await this.skillsLoader.loadSkillsForContext(alwaysSkills);
            if (alwaysContent) {
                parts.push(`# Active Skills\n\n${alwaysContent}`);
            }
        }
        // Available skills summary with cache (based on skills directory mtime)
        const skillsMtime = await this.getSkillsMtime();
        const skillsSummary = this.skillsCache && this.skillsCache.mtime === skillsMtime
            ? this.skillsCache.value
            : await this.skillsLoader.buildSkillsSummary();
        if (skillsSummary) {
            this.skillsCache = { value: skillsSummary, mtime: skillsMtime };
            parts.push(`# Available Skills (Native AI Skills)

The following is a COMPLETE and AUTHORITATIVE list of skills you possess. 
DO NOT scan the 'skills' directory or read files to find out what skills you have.

${skillsSummary}

## CRITICAL: PRIORITIZE SKILLS OVER CUSTOM SCRIPTS
1. **USE SKILLS FIRST**: If a skill exists (e.g., 'browser'), use it.
2. **HOW TO USE**: Use the summary above. ONLY read \`SKILL.md\` if you need syntax.
`);
        }
    }
    async getSkillsMtime() {
        const dirs = [
            path_1.default.join(this.workspacePath, 'skills'),
            path_1.default.resolve(__dirname, '../../skills'),
        ];
        let latest = 0;
        for (const dir of dirs) {
            if (await fs_extra_1.default.pathExists(dir)) {
                const stat = await fs_extra_1.default.stat(dir);
                latest = Math.max(latest, stat.mtimeMs);
            }
        }
        return latest;
    }
    getToolUsageRules() {
        return `## Tool Usage Rules (CRITICAL)
1. **NATIVE TOOLS ONLY**: Use the official tool calling interface. Never type "runCommand:" as text.
2. **DUAL MODE**: You are both a Chatbot and a Tool User.
   - **CHAT MODE**: For greetings, jokes, general knowledge, or questions about yourself, **REPLY DIRECTLY WITH TEXT**. Do NOT use tools.
   - **TOOL MODE**: For file operations, system commands, web search, or complex tasks, **USE TOOLS IMMEDIATELY**.
3. **NO PREAMBLE (TOOL MODE)**: When you decide to use tools, call them IMMEDIATELY. Do not say "I will...".
4. **SUBAGENTS**: Use \`spawnSubagent\` for:
   - Complex browser automation (>2 steps)
   - Long-running tasks (>30s)
   - Recursive exploration
5. **FILE/AUDIO**: 
   - To send file: \`SEND_FILE: /path/to/file\` (Verify existence first!)
   - To send voice: \`SEND_VOICE: /path/to/audio\` (Must generate first!)
6. **LARGE FILES**: Use \`appendFile\` for content >2000 chars.
`;
    }
    truncateHistory(history) {
        const MAX_HISTORY_CHARS = 100000; // Conservative limit for 128k context
        let totalChars = this.calculateHistorySize(history);
        if (totalChars <= MAX_HISTORY_CHARS) {
            return history;
        }
        console.warn(`[Context] History too large (${totalChars} chars). Truncating...`);
        // Always keep the first message (usually system prompt or initial context if passed in history)
        // and the last N messages to fit within limit.
        // NOTE: In Vercel AI SDK, 'system' is separate, so history[0] is usually user's first msg.
        // We'll try to keep the most recent messages.
        const historyToUse = [...history];
        let firstMsg = historyToUse.length > 0 ? historyToUse[0] : null;
        // Only preserve the first message if it's a User or System message.
        // If it's an Assistant message (especially with tool calls) or a Tool message, 
        // it's likely part of a conversation flow that can be truncated if needed,
        // and preserving it blindly might create orphans (e.g. Assistant without Tool).
        if (firstMsg && (firstMsg.role === 'assistant' || firstMsg.role === 'tool')) {
            firstMsg = null;
        }
        // If we have a first message to preserve, keep it. Then remove from index 1.
        // If not, we treat the whole history as truncatable.
        if (historyToUse.length <= 1)
            return historyToUse;
        let remainingHistory;
        if (firstMsg) {
            remainingHistory = historyToUse.slice(1);
        }
        else {
            remainingHistory = historyToUse;
        }
        // Ensure we don't truncate down to nothing (keep at least 1 message in remaining)
        while (totalChars > MAX_HISTORY_CHARS && remainingHistory.length > 1) {
            const removed = remainingHistory.shift(); // Remove oldest
            if (removed) {
                totalChars -= this.calculateMessageSize(removed);
            }
        }
        // Safety check: Remove orphan tool messages at the beginning of remainingHistory
        // If we removed an assistant message that had tool calls, the next message might be a tool result
        while (remainingHistory.length > 0 && remainingHistory[0].role === 'tool') {
            const removed = remainingHistory.shift();
            if (removed) {
                totalChars -= this.calculateMessageSize(removed);
                console.warn('[Context] Removed orphan tool message during truncation.');
            }
        }
        const result = firstMsg ? [firstMsg, ...remainingHistory] : remainingHistory;
        console.warn(`[Context] Truncated history to ${result.length} messages (${totalChars} chars).`);
        return result;
    }
    calculateHistorySize(history) {
        return history.reduce((acc, msg) => acc + this.calculateMessageSize(msg), 0);
    }
    calculateMessageSize(msg) {
        if (typeof msg.content === 'string') {
            return msg.content.length;
        }
        else if (Array.isArray(msg.content)) {
            return JSON.stringify(msg.content).length;
        }
        return 0;
    }
}
exports.ContextBuilder = ContextBuilder;
