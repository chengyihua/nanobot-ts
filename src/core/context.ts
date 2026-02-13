import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { Config, getWorkspacePath } from './config.js';
import { SkillsLoader } from './skills.js';
import { MemoryStore } from './memory.js';
import { FILES, DIRS } from './constants.js';
import { CoreMessage } from 'ai';

export interface Context {
  systemPrompt: string;
  workspacePath: string;
}

const BOOTSTRAP_FILES = [FILES.AGENTS, FILES.SOUL, FILES.TOOLS, FILES.USER, FILES.IDENTITY];

export class ContextBuilder {
  private config: Config;
  private workspacePath: string;
  private memoryStore: MemoryStore;
  private skillsLoader: SkillsLoader;

  constructor(config: Config) {
    this.config = config;
    this.workspacePath = getWorkspacePath(config);
    this.memoryStore = new MemoryStore(this.workspacePath);
    this.skillsLoader = new SkillsLoader(this.workspacePath);
  }

  public async initialize() {
    await fs.ensureDir(this.workspacePath);
  }

  public async buildSystemPrompt(channel?: string, chatId?: string): Promise<string> {
    const parts: string[] = [];

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

    // 5. Tool Usage Rules
    parts.push(this.getToolUsageRules());

    return parts.join('\n\n---\n\n');
  }

  public buildMessages(
    history: any[], 
    modelId: string, 
    isVision: boolean = false
  ): any[] {
    // 1. Filter/Process History for Vision/Non-Vision models
    let processedHistory = history;
    
    if (!isVision) {
      processedHistory = history.map(msg => {
        if (msg.role === 'tool') return msg;
        if (Array.isArray(msg.content)) {
          // If message has tool calls, we must preserve the array structure
          // otherwise tool calls will be lost when converting to string
          const hasToolCalls = msg.content.some((c: any) => c.type === 'tool-call');
          if (hasToolCalls) {
             // Just filter out images if we want to be strict, but keeping structure is key
             return msg;
          }

          const textParts = msg.content
            .filter((part: any) => part.type === 'text')
            .map((part: any) => (part as any).text)
            .join('\n');
          return { ...msg, content: textParts || '[Image]' };
        }
        return msg;
      });
    }

    // 2. Truncate History if needed
    return this.truncateHistory(processedHistory);
  }

  private getIdentity(channel?: string, chatId?: string): string {
    const now = new Date().toLocaleString();
    const platform = `${process.platform} ${os.arch()}, Node.js ${process.version}`;
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

  private async loadBootstrapFiles(): Promise<string> {
    const parts: string[] = [];
    for (const filename of BOOTSTRAP_FILES) {
      const filePath = path.join(this.workspacePath, filename);
      if (await fs.pathExists(filePath)) {
        let content = await fs.readFile(filePath, 'utf-8');
        
        // Truncate large bootstrap files
        const MAX_FILE_CHARS = 10000;
        if (content.length > MAX_FILE_CHARS) {
          console.warn(`[Context] File ${filename} is too large (${content.length} chars), truncating...`);
          content = content.substring(0, MAX_FILE_CHARS) + '\n\n... (file truncated due to size)';
        }
        parts.push(`## ${filename}\n\n${content}`);
      }
    }
    return parts.join('\n\n');
  }

  private async loadMemoryContext(): Promise<string | null> {
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

  private async appendSkills(parts: string[]) {
    // Always-loaded skills
    const alwaysSkills = await this.skillsLoader.getAlwaysSkills();
    if (alwaysSkills.length > 0) {
      const alwaysContent = await this.skillsLoader.loadSkillsForContext(alwaysSkills);
      if (alwaysContent) {
        parts.push(`# Active Skills\n\n${alwaysContent}`);
      }
    }

    // Available skills summary
    const skillsSummary = await this.skillsLoader.buildSkillsSummary();
    if (skillsSummary) {
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

  private getToolUsageRules(): string {
    return `## Tool Usage Rules (CRITICAL)
1. **NATIVE TOOLS ONLY**: Use the official tool calling interface. Never type "runCommand:" as text.
2. **NO PREAMBLE**: Call tools IMMEDIATELY. Do not say "I will...".
3. **SUBAGENTS**: Use \`spawnSubagent\` for:
   - Complex browser automation (>2 steps)
   - Long-running tasks (>30s)
   - Recursive exploration
4. **FILE/AUDIO**: 
   - To send file: \`SEND_FILE: /path/to/file\` (Verify existence first!)
   - To send voice: \`SEND_VOICE: /path/to/audio\` (Must generate first!)
5. **LARGE FILES**: Use \`appendFile\` for content >2000 chars.
`;
  }

  private truncateHistory(history: any[]): any[] {
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
    const firstMsg = historyToUse.length > 0 ? historyToUse[0] : null;
    
    // If we have a first message, keep it. Then remove from index 1.
    // If only 1 message, we can't really truncate much without losing the request.
    if (historyToUse.length <= 1) return historyToUse;

    const remainingHistory = historyToUse.slice(1);
    
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

  private calculateHistorySize(history: any[]): number {
    return history.reduce((acc, msg) => acc + this.calculateMessageSize(msg), 0);
  }

  private calculateMessageSize(msg: any): number {
    if (typeof msg.content === 'string') {
      return msg.content.length;
    } else if (Array.isArray(msg.content)) {
      return JSON.stringify(msg.content).length;
    }
    return 0;
  }
}
