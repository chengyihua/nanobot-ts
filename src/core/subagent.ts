import crypto from 'crypto';
import { streamText, LanguageModelV1 } from 'ai';
import { MessageBus } from './bus.js';
import { ToolRegistry } from './tool-registry.js';
import { Config } from './config.js';

/**
 * Manages background subagent execution.
 * 
 * Subagents are lightweight agent instances that run in the background
 * to handle specific tasks.
 */
export class SubagentManager {
  private model: LanguageModelV1;
  private workspace: string;
  private bus: MessageBus;
  private config: Config;
  private toolRegistry: ToolRegistry;
  private runningTasks: Map<string, Promise<void>> = new Map();

  constructor(
    model: LanguageModelV1,
    workspace: string,
    bus: MessageBus,
    config: Config,
    toolRegistry: ToolRegistry
  ) {
    this.model = model;
    this.workspace = workspace;
    this.bus = bus;
    this.config = config;
    this.toolRegistry = toolRegistry;
  }

  /**
   * Spawn a subagent to execute a task in the background.
   */
  public async spawn(
    task: string,
    label?: string,
    originChannel: string = 'cli',
    originChatId: string = 'direct'
  ): Promise<string> {
    const taskId = crypto.randomUUID().slice(0, 8);
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

  private async runSubagent(
    taskId: string,
    task: string,
    label: string,
    origin: { channel: string; chatId: string }
  ): Promise<void> {
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
        if ((subagentTools as any)[toolName]) {
          delete (subagentTools as any)[toolName];
        }
      }

      const systemPrompt = this.buildSubagentPrompt(task);

      const result = await streamText({
        model: this.model,
        system: systemPrompt,
        messages: [{ role: 'user', content: task }],
        tools: subagentTools as any,
        maxSteps: 15,
      });

      let fullText = '';
      
      // Stream processing
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          fullText += part.textDelta;
          // Optional: Publish streaming updates if needed
          // For now, we only log to console to avoid flooding the bus for non-streaming clients
          // But user requested "real-time stream thinking process"
          // So we publish with a special metadata flag
          await this.bus.publish({
            id: crypto.randomUUID(),
            source: 'subagent',
            target: origin.channel,
            content: part.textDelta,
            type: 'text',
            timestamp: Date.now(),
            metadata: {
              sessionId: `${origin.channel}:${origin.chatId}`,
              to: origin.chatId,
              originChannel: origin.channel,
              originChatId: origin.chatId,
              subagentId: taskId,
              stream: true,
              chunkType: 'text-delta'
            }
          });
        } else if (part.type === 'tool-call') {
           await this.bus.publish({
            id: crypto.randomUUID(),
            source: 'subagent',
            target: origin.channel,
            content: `🛠️ Calling tool: ${part.toolName}`,
            type: 'text',
            timestamp: Date.now(),
            metadata: {
              sessionId: `${origin.channel}:${origin.chatId}`,
              to: origin.chatId,
              originChannel: origin.channel,
              originChatId: origin.chatId,
              subagentId: taskId,
              stream: true,
              chunkType: 'tool-call',
              toolName: part.toolName
            }
          });
        }
      }

      console.log(`[Subagent] [${taskId}] completed successfully`);
      
      // Send final result
      await this.bus.publish({
        id: crypto.randomUUID(),
        source: 'subagent',
        target: origin.channel,
        content: `✅ Subagent [${label}] completed:\n\n${fullText}`,
        type: 'text',
        timestamp: Date.now(),
        metadata: {
          sessionId: `${origin.channel}:${origin.chatId}`,
          to: origin.chatId,
          originChannel: origin.channel,
          originChatId: origin.chatId,
          subagentId: taskId,
        }
      });
    } catch (error: any) {
      console.error(`[Subagent] [${taskId}] failed:`, error);
      await this.bus.publish({
        id: crypto.randomUUID(),
        source: 'subagent',
        target: origin.channel,
        content: `❌ Subagent [${label}] failed: ${error.message || String(error)}`,
        type: 'text',
        timestamp: Date.now(),
        metadata: {
          sessionId: `${origin.channel}:${origin.chatId}`,
          to: origin.chatId,
          originChannel: origin.channel,
          originChatId: origin.chatId,
          subagentId: taskId,
        }
      });
    }
  }

  private buildSubagentPrompt(task: string): string {
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

  public getRunningCount(): number {
    return this.runningTasks.size;
  }
}
