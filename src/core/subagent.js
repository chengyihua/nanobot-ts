"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubagentManager = void 0;
const crypto_1 = __importDefault(require("crypto"));
const ai_1 = require("ai");
/**
 * Manages background subagent execution.
 *
 * Subagents are lightweight agent instances that run in the background
 * to handle specific tasks.
 */
class SubagentManager {
    constructor(model, workspace, bus, config, toolRegistry) {
        this.runningTasks = new Map();
        this.model = model;
        this.workspace = workspace;
        this.bus = bus;
        this.config = config;
        this.toolRegistry = toolRegistry;
    }
    /**
     * Spawn a subagent to execute a task in the background.
     */
    async spawn(task, label, originChannel = 'cli', originChatId = 'direct') {
        const taskId = crypto_1.default.randomUUID().slice(0, 8);
        const displayLabel = label || (task.length > 30 ? task.slice(0, 30) + '...' : task);
        const origin = {
            channel: originChannel,
            chatId: originChatId,
        };
        // Run in background without awaiting
        const promise = this.runSubagent(taskId, task, displayLabel, origin);
        this.runningTasks.set(taskId, promise);
        // Cleanup when done
        promise.finally(() => this.runningTasks.delete(taskId));
        console.log(`[Subagent] Spawned [${taskId}]: ${displayLabel}`);
        return `Subagent [${displayLabel}] started (id: ${taskId}). I'll notify you when it completes.`;
    }
    async runSubagent(taskId, task, label, origin) {
        console.log(`[Subagent] [${taskId}] starting task: ${label}`);
        try {
            // Build subagent tools (no message tool, no spawn tool, no cron, no memory)
            const { tools: subagentTools, initPromise } = this.toolRegistry.getTools({
                originChannel: origin.channel,
                originChatId: origin.chatId,
            });
            if (initPromise) {
                await initPromise;
            }
            // Remove tools that shouldn't be available to subagents
            const forbiddenTools = ['spawnSubagent', 'cron', 'saveMemory', 'message'];
            for (const toolName of forbiddenTools) {
                if (subagentTools[toolName]) {
                    delete subagentTools[toolName];
                }
            }
            const systemPrompt = this.buildSubagentPrompt(task);
            const { text } = await (0, ai_1.generateText)({
                model: this.model,
                system: systemPrompt,
                messages: [{ role: 'user', content: task }],
                tools: subagentTools,
                maxSteps: 15,
            });
            console.log(`[Subagent] [${taskId}] completed successfully`);
            // Notify completion
            this.bus.publish({
                id: crypto_1.default.randomUUID(),
                source: 'subagent',
                target: origin.channel, // Send back to origin channel
                content: `✅ Subagent Task [${label}] Completed:\n\n${text}`,
                type: 'text',
                timestamp: Date.now(),
                metadata: {
                    sessionId: `${origin.channel}:${origin.chatId}`, // Ensure it routes to correct session
                    to: origin.chatId, // Specific recipient
                    taskId,
                    originChannel: origin.channel,
                    originChatId: origin.chatId
                }
            });
        }
        catch (error) {
            console.error(`[Subagent] [${taskId}] failed:`, error);
            this.bus.publish({
                id: crypto_1.default.randomUUID(),
                source: 'subagent',
                target: origin.channel,
                content: `❌ Subagent Task [${label}] Failed:\n\n${error instanceof Error ? error.message : String(error)}`,
                type: 'text',
                timestamp: Date.now(),
                metadata: {
                    sessionId: `${origin.channel}:${origin.chatId}`,
                    to: origin.chatId,
                    taskId
                }
            });
        }
    }
    buildSubagentPrompt(task) {
        const restrictToWorkspace = this.config.tools?.restrict_to_workspace ?? false;
        return `# Subagent

You are a subagent spawned by the main agent to complete a specific task.

## Your Task
${task}

## Rules
1. Stay focused - complete only the assigned task, nothing else
2. Your final response will be reported back to the main agent
3. Do not initiate conversations or take on side tasks
4. Be concise but informative in your findings

## What You Can Do
${restrictToWorkspace
            ? `- Read and write files in the workspace`
            : `- You have FULL access to the entire file system. You can and SHOULD use absolute paths like '/Users/chengyihua/...' or paths starting with '~/' when needed.`}
- Execute shell commands
- Search the web and fetch web pages
- Complete the task thoroughly

## What You Cannot Do
- Send messages directly to users (no message tool available)
- Spawn other subagents
- Access the main agent's conversation history

## Workspace
Your primary workspace is at: ${this.workspace}
(Note: You are NOT restricted to this workspace unless explicitly told so above.)

When you have completed the task, provide a clear summary of your findings or actions.`;
    }
    getRunningCount() {
        return this.runningTasks.size;
    }
}
exports.SubagentManager = SubagentManager;
