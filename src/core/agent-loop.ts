import { generateText, CoreMessage, LanguageModelV1 } from 'ai';
import fs from 'fs-extra';
import path from 'path';
import * as dotenv from 'dotenv';
import { Config, getWorkspacePath, loadConfig } from './config.js';
import { ContextBuilder } from './context.js';
import { sessionManager, SessionManager } from './session.js';
import { ToolRegistry } from './tool-registry.js';
import { bus, Message } from './bus.js';
import { SubagentManager } from './subagent.js';
import { MemoryStore } from './memory.js';
import { CronService } from '../cron/service.js';
import { parseSessionKey } from '../utils/helpers.js';
import { createModel, isVisionModel } from '../providers/registry.js';
import { MessageAggregator } from './message-aggregator.js';
import { SafetyGuard } from './safety-guard.js';

export class AgentLoop {
  private config: Config;
  private cronService?: CronService;
  private subagentManager?: SubagentManager;
  private memoryStore?: MemoryStore;
  private sessionManager: SessionManager;
  private messageAggregator: MessageAggregator;
  private safetyGuard: SafetyGuard;
  private toolRegistry: ToolRegistry;

  private currentModelId: string | null = null;
  private sessionLocks: Map<string, Promise<void>> = new Map();
  private sessionAbortControllers: Map<string, AbortController> = new Map();

  constructor(config: Config, cronService?: CronService, sessionMgr?: SessionManager, toolRegistry?: ToolRegistry) {
    this.config = config;
    this.cronService = cronService;
    this.sessionManager = sessionMgr || sessionManager;
    this.safetyGuard = new SafetyGuard(config);
    this.messageAggregator = new MessageAggregator(this.handleAggregatedMessage.bind(this));
    this.toolRegistry = toolRegistry || new ToolRegistry(config);
  }

  private sanitizeHistory(history: any[], isFinalForLLM: boolean = false) {
    const result: any[] = [];
    for (let i = 0; i < history.length; i++) {
      const msg = history[i];
      
      if (msg.role === 'assistant') {
        let toolCalls: any[] = [];
        
        if (Array.isArray(msg.content)) {
          toolCalls = msg.content.filter((c: any) => (c as any).type === 'tool-call');
        } else if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
          // Normalize OpenAI format to Vercel AI SDK format for consistent processing
          toolCalls = msg.tool_calls.map((tc: any) => ({
             type: 'tool-call',
             toolCallId: tc.id,
             toolName: tc.function.name,
             args: typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments
          }));
        }

        const hasToolCalls = toolCalls.length > 0;

        if (hasToolCalls) {
          // 查找后续是否有 tool 消息
          let hasFollowingTool = false;
          for (let j = i + 1; j < history.length; j++) {
            if (history[j].role === 'tool') {
              hasFollowingTool = true;
              break;
            }
            if (history[j].role === 'assistant' || history[j].role === 'user') {
              // 遇到了非 tool 消息，说明配对中断了
              break;
            }
          }

          if (hasFollowingTool) {
            result.push(msg);
          } else if (!isFinalForLLM) {
            // 如果不是最终发送给 LLM，允许暂时没有 tool 结果
            result.push(msg);
          } else {
            // 最终发送给 LLM 时，如果没有 tool 结果，为了保持连贯性，我们尝试填充一个占位结果
            // 但是如果这是最后一条消息（即刚刚生成了 tool call 但还没执行），我们不能填充，而是应该保留它
            // 以便 LLM 知道它刚才想调用什么（或者被 context builder 处理）
            // 实际上，如果最后一条是 assistant tool call，那么我们应该把这个 tool call 删除，或者填充错误信息
            // 否则 LLM 会报错 "insufficient tool messages"
            
            // 检查这是否是历史记录中的最后一条消息
            const isLastMessage = i === history.length - 1;
            
            if (isLastMessage) {
                 // 如果是最后一条，且我们正在准备发给 LLM，说明上一轮意外中断了。
                 // 我们必须填充一个错误结果，告诉 LLM 上一次调用失败了，请重试或继续。
                 const toolNames = toolCalls.map((tc: any) => tc.toolName).join(', ');
                 console.warn(`[Agent] Found interrupted last assistant tool-call [${toolNames}] at index ${i}. Filling error result to recover.`);
                 
                 result.push(msg);
                 const placeholderResults = toolCalls.map((tc: any) => ({
                   type: 'tool-result',
                   toolCallId: tc.toolCallId,
                   toolName: tc.toolName,
                   result: "System Error: The previous tool execution was interrupted or timed out. Please retry if necessary.",
                   isError: true
                 }));
                 result.push({
                   role: 'tool',
                   content: placeholderResults
                 });
            } else {
                // 如果不是最后一条，中间断层了，同样需要填充
                const toolNames = toolCalls.map((tc: any) => tc.toolName).join(', ');
                console.warn(`[Agent] Found incomplete assistant tool-call [${toolNames}] at index ${i}. Filling placeholder to preserve memory.`);
                
                result.push(msg);
                const placeholderResults = toolCalls.map((tc: any) => ({
                  type: 'tool-result',
                  toolCallId: tc.toolCallId,
                  toolName: tc.toolName,
                  result: "Error: Result lost or skipped in previous turn.",
                  isError: true
                }));
                result.push({
                  role: 'tool',
                  content: placeholderResults
                });
            }
          }
        } else {
          result.push(msg);
        }
      } else if (msg.role === 'tool') {
        // 确保 tool 消息前面有配对的 assistant
        const lastMsg = result[result.length - 1];
        const lastHasTC = lastMsg && lastMsg.role === 'assistant' && (
            (Array.isArray(lastMsg.content) && lastMsg.content.some((c: any) => (c as any).type === 'tool-call')) ||
            (lastMsg.tool_calls && Array.isArray(lastMsg.tool_calls) && lastMsg.tool_calls.length > 0)
        );
        if (lastHasTC) {
          result.push(msg);
        } else {
          console.warn(`[Agent] Removing orphaned tool result at index ${i}.`);
          continue;
        }
      } else {
        result.push(msg);
      }
    }
    return result;
  }

  private async executeTools(
    toolCalls: any[], 
    tools: any, 
    currentHistory: any[], 
    abortSignal?: AbortSignal
  ): Promise<{ results: any[], missing: any[] }> {
    const toolResults: any[] = [];
    const pendingToolCalls = [...toolCalls];

    console.log(`[Agent] Preparing to execute ${toolCalls.length} tools: ${toolCalls.map(tc => tc.toolName).join(', ')}`);

    // Parallel execution logic
    const toolPromises = toolCalls.map(async (toolCall: any) => {
      if (abortSignal?.aborted) return null;
      
      console.log(`[Agent] Starting Tool Call: ${toolCall.toolName}`);
      const tool = (tools as any)[toolCall.toolName];
      if (tool) {
        try {
          const startTime = Date.now();
          const toolResult = await tool.execute(toolCall.args, { 
            toolCallId: toolCall.toolCallId, 
            messages: currentHistory,
            abortSignal: abortSignal 
          });
          const duration = Date.now() - startTime;
          console.log(`[Agent] Finished Tool Call: ${toolCall.toolName} (${duration}ms)`);
          
          return {
            type: 'tool-result',
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            result: toolResult,
          };
        } catch (err: any) {
          console.error(`[Agent] Tool execution error for ${toolCall.toolName}: ${err.message}`);
          return {
            type: 'tool-result',
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            result: `Error: ${err.message}`,
            isError: true,
          };
        }
      } else {
        console.warn(`[Agent] Tool not found: ${toolCall.toolName}`);
        return {
          type: 'tool-result',
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          result: `Error: Tool "${toolCall.toolName}" not found.`,
          isError: true,
        };
      }
    });

    const results = await Promise.all(toolPromises);
    const validResults = results.filter(r => r !== null);
    toolResults.push(...validResults);
    
    const completedIds = new Set(toolResults.map(r => r.toolCallId));
    const missingResults = pendingToolCalls
      .filter(tc => !completedIds.has(tc.toolCallId))
      .map(tc => ({
        type: 'tool-result',
        toolCallId: tc.toolCallId,
        toolName: tc.toolName,
        result: "Error: Task interrupted or aborted before execution.",
        isError: true
      }));

    return { results: toolResults, missing: missingResults };
  }

  public async start() {
    console.log('[Agent] Loop started. Waiting for messages...');
    
    // Cleanup stale sessions to control disk usage
    try {
      const removed = sessionManager.cleanup(30);
      if (removed > 0) {
        console.log(`[Agent] Cleaned ${removed} old session(s).`);
      }
    } catch (e) {
      console.warn('[Agent] Session cleanup skipped:', (e as any)?.message);
    }

    // Initialize Tool Registry (load MCP, plugins, etc.)
    await this.toolRegistry.initialize();

    const workspacePath = getWorkspacePath(this.config);
    this.memoryStore = new MemoryStore(workspacePath);
    this.subagentManager = new SubagentManager(
      this.getModel(),
      workspacePath,
      bus,
      this.config,
      this.toolRegistry
    );

    // Listen for messages targeted at the agent
    bus.onMessage(async (message: Message) => {
      if (message.source === 'agent') return; // Ignore own messages
      
      const sessionId = message.metadata?.sessionId || 'default';
      
      // 系统指令拦截：在进入锁逻辑之前处理，确保忙碌时也能重置
      if (message.content.trim() === '/reload' || message.content.trim() === '/reset') {
        // 中断当前正在进行的任务
        const controller = this.sessionAbortControllers.get(sessionId);
        if (controller) {
          console.log(`[Agent] Aborting current task for session ${sessionId} due to system command.`);
          controller.abort();
          this.sessionAbortControllers.delete(sessionId);
        }
        await this.handleSystemCommand(message);
        return;
      }

      // 聚合逻辑
      this.messageAggregator.add(sessionId, message);
    });
  }

  private async handleAggregatedMessage(sessionId: string, aggregatedMessage: Message) {
    console.log(`[Agent] [Session:${sessionId}] Received aggregated message from ${aggregatedMessage.source}`);
    
    // 构建用户消息并存入历史
    const combinedContent = aggregatedMessage.content;
    const userMessage: CoreMessage = {
      role: 'user',
      content: combinedContent,
    };

    // 处理图片附件（如果支持）
    if (aggregatedMessage.type === 'image') {
       // Assuming content is URL or base64
       const msgContent: any[] = [
         { type: 'image', image: combinedContent }
       ];
       if (aggregatedMessage.metadata?.caption) {
         msgContent.push({ type: 'text', text: aggregatedMessage.metadata.caption });
       }
       userMessage.content = msgContent;
    } else if (aggregatedMessage.metadata?.msgType === 'image' && aggregatedMessage.metadata?.localPath) {
      const modelId = this.config.agents.defaults.model;
      if (isVisionModel(modelId)) {
        try {
          const workspacePath = getWorkspacePath(this.config);
          const fullPath = path.isAbsolute(aggregatedMessage.metadata.localPath) 
            ? aggregatedMessage.metadata.localPath 
            : path.join(workspacePath, aggregatedMessage.metadata.localPath);
          
          if (await fs.pathExists(fullPath)) {
            const imageBuffer = await fs.readFile(fullPath);
            const base64Image = imageBuffer.toString('base64');
            const mimeType = fullPath.endsWith('.png') ? 'image/png' : 'image/jpeg';
            
            userMessage.content = [
              { type: 'text', text: combinedContent },
              { type: 'image', image: base64Image, mimeType },
            ];
          }
        } catch (err) {
          console.error('[Agent] Error attaching image to message:', err);
        }
      }
    }
    
    // 始终先存入历史记录
    await this.sessionManager.addMessage(sessionId, userMessage);

    // 智能中断逻辑：只有当新消息是明确的停止指令时，才中断当前任务
    // 否则，让新消息排队，保证上下文的完整性和工具执行的原子性
    const stopKeywords = this.config.behavior.stop_keywords.join('|');
    const stopPattern = new RegExp(`^(${stopKeywords})`, 'i');
    const isStopCommand = stopPattern.test(combinedContent.trim());
    
    if (isStopCommand && this.sessionAbortControllers.has(sessionId)) {
      console.log(`[Agent] Stop command detected for session ${sessionId}. Aborting current task.`);
      this.sessionAbortControllers.get(sessionId)?.abort();
    }

    // 消息处理队列锁
    // 如果当前有任务在运行，我们等待它完成（除非被上述逻辑强制中断）
    // 使用 Promise 链实现简单的队列
    const currentLock = this.sessionLocks.get(sessionId) || Promise.resolve();
    
    const nextTask = currentLock.then(async () => {
       // 在开始处理前，我们不再手动检查去重，而是依赖 handleMessage 内部的状态隔离
       // 每一条排队的消息都会触发一次 handleMessage，读取当时的完整历史
       
       const controller = new AbortController();
       this.sessionAbortControllers.set(sessionId, controller);
      
      try {
        // 重新获取最新的聚合消息（因为在等待期间可能有新消息进入 History）
        // 但为了简化，我们还是传入当前的 userMessage 作为触发器
        // handleMessage 会重新读取 History
        await this.handleMessage(aggregatedMessage, controller.signal);
      } catch (error: any) {
        if (error.name === 'AbortError' || error.message === 'AbortError' || error.message === 'signal is aborted') {
          console.log(`[Agent] Task aborted for session ${sessionId}`);
        } else {
          console.error(`[Agent] Error in task for session ${sessionId}:`, error);
        }
      } finally {
         // 只有当当前的 controller 仍然是这一个时才删除
        if (this.sessionAbortControllers.get(sessionId) === controller) {
          this.sessionAbortControllers.delete(sessionId);
        }
      }
    }).catch(err => {
      console.error(`[Agent] Queue error for session ${sessionId}:`, err);
    });

    // 更新锁
    this.sessionLocks.set(sessionId, nextTask);
  }

  public async switchModel(modelId: string) {
    console.log(`[Agent] Switching model to: ${modelId}`);
    this.currentModelId = modelId;
    return { success: true, modelId };
  }

  protected getModel(): LanguageModelV1 {
    const modelId = this.currentModelId || this.config.agents.defaults.model;
    return createModel(modelId, this.config);
  }

  private async handleSystemCommand(message: Message) {
    const sessionId = message.metadata?.sessionId || 'default';
    const [parsedChannel, parsedChatId] = parseSessionKey(sessionId);
    const channel = message.metadata?.originChannel || message.source || parsedChannel || 'cli';
    const chatId = message.metadata?.originChatId || message.metadata?.fromUser || parsedChatId || 'default';

    if (message.content.trim() === '/reload') {
      console.log(`[Agent] Reloading configuration and environment for session ${sessionId}...`);
      try {
        dotenv.config({ override: true });
        const newConfig = await loadConfig();
        this.config = newConfig;
        
        // Re-initialize Tool Registry
        if (this.toolRegistry) {
          await this.toolRegistry.close();
        }
        this.toolRegistry = new ToolRegistry(this.config);
        await this.toolRegistry.initialize();

        const workspacePath = getWorkspacePath(this.config);
        this.memoryStore = new MemoryStore(workspacePath);
        this.subagentManager = new SubagentManager(
          this.getModel(),
          workspacePath,
          bus,
          this.config,
          this.toolRegistry
        );
        console.log('[Agent] Reload successful.');
        bus.publish({
          id: Math.random().toString(36).substring(7),
          source: 'agent',
          target: channel,
          content: '✅ 环境变量与配置已成功重新加载！新的技能和配置现在已生效。',
          type: 'text',
          timestamp: Date.now(),
          metadata: { ...message.metadata, sessionId, to: message.metadata?.to || chatId },
        });
      } catch (error: any) {
        console.error('[Agent] Reload failed:', error);
        bus.publish({
          id: Math.random().toString(36).substring(7),
          source: 'agent',
          target: channel,
          content: `❌ 重新加载失败: ${error.message}`,
          type: 'text',
          timestamp: Date.now(),
          metadata: { ...message.metadata, sessionId, to: message.metadata?.to || chatId },
        });
      }
      return;
    }

    if (message.content.trim() === '/reset') {
      console.log(`[Agent] Resetting session ${sessionId}...`);
      
      // 1. 强制删除会话锁
      this.sessionLocks.delete(sessionId);
      
      // 2. 清除会话历史 (内存缓存 + 磁盘文件)
      await this.sessionManager.clearSession(sessionId);
      
      bus.publish({
        id: Math.random().toString(36).substring(7),
        source: 'agent',
        target: channel,
        content: '🔄 会话已重置。历史记录已清除，内存缓存已刷新。',
        type: 'text',
        timestamp: Date.now(),
        metadata: { ...message.metadata, sessionId, to: message.metadata?.to || chatId },
      });
      return;
    }
  }

  private async runAgentLoop(
    sessionId: string,
    initialHistory: any[],
    tools: any,
    contextBuilder: ContextBuilder,
    systemPrompt: string,
    channel: string,
    chatId: string,
    message: Message,
    abortSignal?: AbortSignal,
    forceTextOnly: boolean = false
  ) {
    let iteration = 0;
    let finalContent = '';
    let accumulatedText = '';
    let summaryText = ''; 
    let accumulatedDirectives = new Set<string>(); 
    let allToolResults: any[] = []; 

    let currentHistory = initialHistory;
    
    // Initial sanitization
    currentHistory = this.sanitizeHistory(currentHistory, true);

    try {
      const model = this.getModel();
      const maxIterations = this.config.agents.defaults.max_iterations || 15; 
      
      console.log(`[Agent] Calling LLM with ${Object.keys(tools).length} tools (Manual Loop)...`);

      while (iteration < maxIterations) {
        if (abortSignal?.aborted) {
          throw new Error('AbortError');
        }
        iteration++;
        
        const sanitizedForLLM = this.sanitizeHistory(currentHistory, true);
        
        let toolChoice: 'auto' | 'required' | 'none' = 'auto';
        
        // Hallucination detection
        let hasHallucination = this.safetyGuard.detectHallucination(sanitizedForLLM);
        
        // Check last assistant message for DSML hallucination
        const lastHistMsg = sanitizedForLLM[sanitizedForLLM.length - 1];
        if (lastHistMsg && lastHistMsg.role === 'assistant' && typeof lastHistMsg.content === 'string') {
           if (lastHistMsg.content.includes('<｜DSML｜function_calls>') || lastHistMsg.content.includes('<tool_code>')) {
              hasHallucination = true;
           }
        }

        if (hasHallucination) {
          console.warn(`[Agent] Forcing tool choice due to detected hallucinations in history.`);
          toolChoice = 'required';
        }

    const modelId = this.currentModelId || this.config.agents.defaults.model;
    const isVision = forceTextOnly ? false : isVisionModel(modelId);
    const historyToUse = contextBuilder.buildMessages(sanitizedForLLM, modelId, isVision);

    console.log(`[Agent] Iteration ${iteration}: Sending request to model...`);
    const payloadStr = JSON.stringify(historyToUse);
    const lastMsg = historyToUse.length > 0 ? historyToUse[historyToUse.length-1] : null;
    console.log(`[Agent] Messages count: ${historyToUse.length}, Payload size: ${payloadStr.length} chars, Last message: ${lastMsg ? JSON.stringify(lastMsg).substring(0, 100) : 'None'}...`);
    
    let result;
    let pendingToolCalls: any[] = [];

    // Create a specific controller for this request to handle timeout
    const requestController = new AbortController();
    const timeoutId = setTimeout(() => {
        console.warn(`[Agent] Request timed out at iteration ${iteration}`);
        requestController.abort();
    }, 180000); // 3 minutes timeout

    // Link user abort signal to request controller
    const onUserAbort = () => requestController.abort();
    if (abortSignal) {
        abortSignal.addEventListener('abort', onUserAbort);
    }

    try {
      result = await generateText({
        model,
        system: systemPrompt,
        messages: historyToUse,
        tools,

            toolChoice,
            maxSteps: 1, 
            temperature: this.config.agents.defaults.temperature,
            abortSignal: requestController.signal,
          });
          
          if (result.toolCalls && result.toolCalls.length > 0) {
            pendingToolCalls = result.toolCalls;
          }
        } catch (err: any) {
          if (err.name === 'AbortError' || err.message?.includes('aborted')) {
            console.error(`[Agent] LLM call aborted at iteration ${iteration}`);
            finalContent = "任务已被中止（或超时）。";
          } else {
            console.error(`[Agent] LLM call error at iteration ${iteration}:`, err.message);
            finalContent = `抱歉，我在处理任务时遇到了错误：${err.message}`;
          }
          break;
        } finally {
            clearTimeout(timeoutId);
            if (abortSignal) {
                abortSignal.removeEventListener('abort', onUserAbort);
            }
        }

        console.log(`[Agent] Iteration ${iteration} result:`, {
          text: result.text,
          toolCalls: result.toolCalls?.length || 0,
          finishReason: result.finishReason
        });

        const originalText = result.text || '';
        let cleanedText = this.safetyGuard.cleanOutput(originalText);
        const currentOutputHadHallucination = cleanedText !== originalText;

        const currentOutputHasDirective = false;
        const directiveValidation = this.safetyGuard.validateDirectives(cleanedText, !!(result.toolCalls && result.toolCalls.length > 0));
        
        if (directiveValidation.hasHallucination) {
          // currentOutputHasDirective = true; // Disabled strictly as per user request to rely on prompt
          // cleanedText = directiveValidation.text;
        }

        // Disabled IntentMismatch check as it conflicts with natural language capabilities
        const intentMismatch = false;

        const { directives: currentDirectives, cleanText: pureText } = this.safetyGuard.parseDirectives(cleanedText);
        
        if (currentDirectives.length > 0) {
          for (const d of currentDirectives) {
            accumulatedDirectives.add(d);
          }
        }

        if (pureText) {
          if (result.toolCalls && result.toolCalls.length > 0) {
            // Streaming behavior: Send intermediate text immediately instead of accumulating
            console.log(`[Agent] Sending intermediate text: ${pureText.substring(0, 50)}...`);
            bus.publish({
              id: Math.random().toString(36).substring(7),
              source: 'agent',
              target: channel,
              content: pureText,
              type: 'text',
              timestamp: Date.now(),
              metadata: { 
                ...message.metadata, 
                sessionId,
                to: message.metadata?.to || chatId
              },
            });
            // Do not accumulate text to avoid duplication in final response
            // if (accumulatedText) accumulatedText += '\n\n';
            // accumulatedText += pureText;
          } else {
            summaryText = pureText;
          }
        }

        const assistantContent: Array<any> = [];
        if (cleanedText) {
          assistantContent.push({ type: 'text', text: cleanedText });
        }
        if (result.toolCalls && result.toolCalls.length > 0) {
          for (const toolCall of result.toolCalls) {
            assistantContent.push({
              type: 'tool-call',
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              args: toolCall.args,
            });
          }
        }

        const assistantMessage = {
          role: 'assistant',
          content: assistantContent.length > 0 ? assistantContent : '',
        } as any;

        await this.sessionManager.addMessage(sessionId, assistantMessage);
        currentHistory.push(assistantMessage);

        if (currentDirectives) {
          console.log(`[Agent] Iteration ${iteration}: Assistant output contains directives: ${currentDirectives.join(', ')}`);
        }

        if (result.toolCalls && result.toolCalls.length > 0) {
          console.log(`[Agent] Iteration ${iteration}: Executing ${result.toolCalls.length} tools...`);
          
          const { results, missing } = await this.executeTools(
            result.toolCalls,
            tools,
            currentHistory,
            abortSignal
          );
          
          allToolResults.push(...results);

          if (results.length > 0) {
            // Streaming behavior: Send tool execution results immediately
            const toolOutput = results.map(r => {
              const originalCall = result.toolCalls?.find((tc: any) => tc.toolCallId === r.toolCallId);
              const args = originalCall ? (originalCall.args as any) : {};
              
              let header = `**🔨 ${r.toolName}**`;
              if (r.toolName === 'runCommand' && args.command) {
                const cmd = args.command;
                const truncatedCmd = cmd.length > 50 ? cmd.substring(0, 47) + '...' : cmd;
                header += `: \`${truncatedCmd}\``;
              } else if ((r.toolName === 'readFile' || r.toolName === 'read_file') && args.file_path) {
                 const fname = args.file_path.split('/').pop();
                 header += `: \`${fname}\``;
              }

              let status = '✅ **Success**';
              const res = r.result;
              
              if (r.isError) {
                status = '❌ **Failed**';
              } else if (typeof res === 'string' && res.startsWith('Error:')) {
                status = '❌ **Failed**';
              } else if (res && typeof res === 'object' && 'exitCode' in res && res.exitCode !== 0) {
                status = '❌ **Failed**';
              }
              
              return `${header}\n${status}`;
            }).join('\n\n');

            console.log(`[Agent] Sending tool result update:\n${toolOutput}`);
            bus.publish({
              id: Math.random().toString(36).substring(7),
              source: 'agent',
              target: channel,
              content: toolOutput,
              type: 'text',
              timestamp: Date.now(),
              metadata: { 
                ...message.metadata, 
                sessionId,
                to: message.metadata?.to || chatId
              },
            });

            const toolMessage = {
              role: 'tool',
              content: results,
            } as any;
            await this.sessionManager.addMessage(sessionId, toolMessage);
            currentHistory.push(toolMessage);
          }

          if (missing.length > 0) {
            console.warn(`[Agent] Filling ${missing.length} missing tool results due to interruption.`);
            const missingMsg = {
              role: 'tool',
              content: missing
            } as any;
            await this.sessionManager.addMessage(sessionId, missingMsg);
            currentHistory.push(missingMsg);
          }
        } else if (currentOutputHadHallucination || currentOutputHasDirective || intentMismatch) {
          console.log(`[Agent] Iteration ${iteration}: Hallucination, premature directive or intent mismatch detected. Retrying with correction...`);
          
          let correctionText = '';

          if (currentOutputHadHallucination) {
             correctionText += '[系统警告] 检测到你尝试使用纯文本格式调用工具（例如 "runCommand: {...}" 或 XML 标签）。这是被禁止的。如果你需要调用工具，必须使用系统提供的原生工具调用（Function Calling）功能。如果你的意图只是聊天，请直接回答，不要生成伪造的工具调用代码。\n';
          }

          if (currentOutputHasDirective) {
             correctionText += '[系统警告] 检测到你使用了文件/媒体发送指令（如 SEND_FILE），但相关文件并不存在。请先调用工具生成或确认文件存在，然后再发送指令。\n';
          }

          if (intentMismatch) {
             correctionText += '[系统警告] 你声称已发送或生成了内容，但你没有调用任何工具。请务必调用相应的工具来完成操作，不要只是描述要做什么。\n';
          }

          if (iteration < maxIterations && correctionText) {
            const correctionMsg = {
              role: 'user',
              content: correctionText.trim(),
            } as any;
            await this.sessionManager.addMessage(sessionId, correctionMsg);
            currentHistory.push(correctionMsg);
          }
        } else {
          let content = summaryText || pureText || accumulatedText;
          
          if (!content.trim() && accumulatedText) {
            content = accumulatedText;
          }

          if (accumulatedDirectives.size > 0) {
            const directives = Array.from(accumulatedDirectives).join('\n');
            content = `${content}\n\n${directives}`.trim();
          }
          
          if (content.trim()) {
            finalContent = content.trim();
          } else if (allToolResults.length > 0) {
            const lastResult = allToolResults[allToolResults.length - 1].result;
            const resultString = typeof lastResult === 'string' ? lastResult : JSON.stringify(lastResult, null, 2);
            finalContent = `任务已处理完成。最后的结果如下：\n\n${resultString}`;
          } else {
            finalContent = '抱歉，我未能生成有效的回复。';
          }
          break;
        }

        if (iteration >= maxIterations) {
          console.warn(`[Agent] Reached maximum iterations (${iteration}). Stopping.`);
          let content = summaryText || pureText || accumulatedText;
          if (accumulatedDirectives.size > 0) {
            const directives = Array.from(accumulatedDirectives).join('\n');
            content = `${content}\n\n${directives}`.trim();
          }

          if (content.trim()) {
            finalContent = content.trim() + '\n\n(注意：由于处理步骤过多，以上是已完成的部分结果。)';
          } else if (allToolResults.length > 0) {
            const lastResult = allToolResults[allToolResults.length - 1].result;
            finalContent = (typeof lastResult === 'string' ? lastResult : JSON.stringify(lastResult, null, 2)) + '\n\n(注意：任务未完全结束，以上是最后的工具执行结果。)';
          } else {
            finalContent = '抱歉，我尝试了多次但未能完成任务。';
          }
          break;
        }
      }

      console.log(`[Agent] Response completed in ${iteration} iterations.`);

      bus.publish({
        id: Math.random().toString(36).substring(7),
        source: 'agent',
        target: channel,
        content: finalContent,
        type: 'text',
        timestamp: Date.now(),
        metadata: { 
          ...message.metadata, 
          sessionId,
          to: message.metadata?.to || chatId
        },
      });

      if (this.memoryStore && finalContent && finalContent.length > 0) {
        const summary = `[${new Date().toLocaleTimeString()}] ${finalContent.slice(0, 500)}${finalContent.length > 500 ? '...' : ''}`;
        await this.memoryStore.appendToday(summary);
        console.log(`[Agent] Auto-saved response to today's memory.`);
      }

    } catch (error: any) {
      // Re-throw to let caller handle it (especially image errors)
      throw error;
    }
  }

  private async handleMessage(message: Message, abortSignal: AbortSignal) {
    const sessionId = message.metadata?.sessionId || 'default';
    const channel = message.metadata?.originChannel || message.source || 'cli';
    const chatId = message.metadata?.originChatId || message.metadata?.fromUser || 'default';
    
    console.log(`[Agent] [Session:${sessionId}] Starting handleMessage logic. Channel: ${channel}`);
    
    try {
      const history = await this.sessionManager.getHistory(sessionId);
      if (history.length === 0) {
        // 如果没有历史记录，可能是首次会话，或者 sessionManager 出错
        console.warn(`[Agent] [Session:${sessionId}] History is empty, initializing with user message.`);
      }
      
      const contextBuilder = new ContextBuilder(this.config);
      await contextBuilder.initialize();
      
      // Inject tool definitions into system prompt
      const toolDefinitions = this.toolRegistry.getToolDefinitionsSummary();
      const systemPrompt = await contextBuilder.buildSystemPrompt(channel, chatId, toolDefinitions);

      const { tools, initPromise } = this.toolRegistry.getTools({
        subagentManager: this.subagentManager,
        memoryStore: this.memoryStore,
        sessionManager: this.sessionManager,
        cronService: this.cronService,
        originChannel: channel,
        originChatId: chatId,
        agentLoop: this, 
      });

      if (initPromise) {
        await initPromise;
      }
      
      // 启动循环
      await this.runAgentLoop(
        sessionId, 
        history, 
        tools, 
        contextBuilder, 
        systemPrompt, 
        channel, 
        chatId, 
        message,
        abortSignal
      );
      
      console.log(`[Agent] [Session:${sessionId}] Loop completed.`);

    } catch (error: any) {
      console.error(`[Agent] [Session:${sessionId}] Error in handleMessage:`, error);
      
      // Error handling logic (restored)
      let userFriendlyError = error.message;
      if (userFriendlyError.includes('JSON parsing failed') && userFriendlyError.includes('Text:')) {
        const textIndex = userFriendlyError.indexOf('Text:');
        const errorType = userFriendlyError.substring(0, textIndex).trim();
        const rawText = userFriendlyError.substring(textIndex + 5);
        if (rawText.length > 500) {
          userFriendlyError = `${errorType} (由于生成的参数过长导致截断，无法解析。建议分段操作或精简内容。) \n\n预览内容: ${rawText.substring(0, 200)}...`;
        }
      }

      if (error.message?.includes('Image input not supported') || error.message?.includes('multimodal')) {
        console.warn(`[Agent] [Session:${sessionId}] Model reported image support issue. Retrying with text only...`);
        try {
            // Need to rebuild tools/context if needed, but for retry just call runAgentLoop with forceTextOnly=true
            const history = await this.sessionManager.getHistory(sessionId);
            const contextBuilder = new ContextBuilder(this.config);
            await contextBuilder.initialize();
            
            const toolDefinitions = this.toolRegistry.getToolDefinitionsSummary();
            const systemPrompt = await contextBuilder.buildSystemPrompt(channel, chatId, toolDefinitions);
            
            const { tools } = this.toolRegistry.getTools({
                subagentManager: this.subagentManager,
                memoryStore: this.memoryStore,
                sessionManager: this.sessionManager,
                cronService: this.cronService,
                originChannel: channel,
                originChatId: chatId,
                agentLoop: this, 
            });

            await this.runAgentLoop(sessionId, history, tools, contextBuilder, systemPrompt, channel, chatId, message, abortSignal, true);
            return;
        } catch (retryError: any) {
             console.error(`[Agent] [Session:${sessionId}] Retry failed: ${retryError.message}`);
        }
      }

      bus.publish({
        id: Math.random().toString(36).substring(7),
        source: 'agent',
        target: channel,
        content: `Sorry, I encountered an error: ${userFriendlyError}`,
        type: 'text',
        timestamp: Date.now(),
        metadata: { ...message.metadata, sessionId },
      });
    }
  }
}
