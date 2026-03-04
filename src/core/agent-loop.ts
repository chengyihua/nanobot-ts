import { generateText, CoreMessage, LanguageModelV1 } from 'ai';
import fs from 'fs-extra';
import path from 'path';
import * as dotenv from 'dotenv';
import crypto from 'crypto';
import { Config, getWorkspacePath, loadConfig } from './config.js';
import { ContextBuilder } from './context.js';
import { sessionManager, SessionManager } from './session.js';
import { ToolRegistry } from './tool-registry.js';
import { bus } from './bus.js';
import type { Message } from './bus.js';
import { SubagentManager } from './subagent.js';
import { MemoryStore } from './memory.js';
import { CronService } from '../cron/service.js';
import { parseSessionKey } from '../utils/helpers.js';
import { createModel, isVisionModel } from '../providers/registry.js';
import { MessageAggregator } from './message-aggregator.js';
import { SafetyGuard } from './safety-guard.js';
import { createLogger } from '../utils/logger.js';
import { agentMetrics } from './metrics.js';
import { cleanupUploads, recordSessionsCleanup } from '../utils/cleanup.js';
import { ContextManager } from './agent/context-manager.js';
import { StepExecutor } from './agent/step-executor.js';

export class AgentLoop {
  private config: Config;
  private cronService?: CronService;
  private subagentManager?: SubagentManager;
  private memoryStore?: MemoryStore;
  private sessionManager: SessionManager;
  private messageAggregator: MessageAggregator;
  private safetyGuard: SafetyGuard;
  private toolRegistry: ToolRegistry;
  private contextManager: ContextManager;
  private stepExecutor: StepExecutor;
  private log = createLogger('agent-loop');

  private currentModelId: string | null = null;
  private sessionLocks: Map<string, Promise<void>> = new Map();
  private sessionLockTimestamps: Map<string, number> = new Map(); // Track when lock was acquired
  private sessionAbortControllers: Map<string, AbortController> = new Map();
  private metrics = agentMetrics;

  constructor(config: Config, cronService?: CronService, sessionMgr?: SessionManager, toolRegistry?: ToolRegistry) {
    this.config = config;
    this.cronService = cronService;
    this.sessionManager = sessionMgr || sessionManager;
    this.safetyGuard = new SafetyGuard(config);
    this.messageAggregator = new MessageAggregator(this.handleAggregatedMessage.bind(this));
    this.toolRegistry = toolRegistry || new ToolRegistry(config);
    this.contextManager = new ContextManager(config);
    this.stepExecutor = new StepExecutor(config);
  }





  // --- Stall Detector State ---
  private recentToolCalls: string[] = [];
  private recentContents: string[] = [];
  private static readonly STALL_THRESHOLD = 3; // Number of identical actions before triggering stall detection

  public async start() {
    this.log.info('Loop started. Waiting for messages...');

    // Cleanup stale sessions to control disk usage
    const sessionRetention = this.config.housekeeping?.sessions_retention_days ?? 30;
    try {
      const start = Date.now();
      const removed = sessionManager.cleanup(sessionRetention);
      recordSessionsCleanup(removed, sessionRetention, Date.now() - start);
      if (removed > 0) {
        this.log.info({ removed }, 'Old sessions cleaned');
      }
    } catch (e) {
      recordSessionsCleanup(0, sessionRetention, 0, e);
      this.log.warn({ err: e }, 'Session cleanup skipped');
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

    // Cleanup uploads目录中过期文件，默认保留7天
    const uploadsRetention = this.config.housekeeping?.uploads_retention_days ?? 7;
    try {
      const removedUploads = await cleanupUploads(workspacePath, { maxAgeDays: uploadsRetention });
      if (removedUploads > 0) {
        this.log.info({ removedUploads }, 'Old uploads cleaned');
      }
    } catch (e) {
      this.log.warn({ err: e }, 'Uploads cleanup skipped');
    }

    // Listen for messages targeted at the agent
    bus.onMessage(async (message: Message) => {
      if (message.source === 'agent') return; // Ignore own messages

      const sessionId = message.metadata?.sessionId || 'default';

      // 系统指令拦截：在进入锁逻辑之前处理，确保忙碌时也能重置
      if (message.content.trim() === '/reload' || message.content.trim() === '/reset') {
        // 中断当前正在进行的任务
        const controller = this.sessionAbortControllers.get(sessionId);
        if (controller) {
          this.log.warn({ sessionId }, 'Aborting current task due to system command');
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
    // attach requestId if missing
    const requestId = aggregatedMessage.metadata?.requestId || crypto.randomUUID();
    aggregatedMessage.metadata = { ...aggregatedMessage.metadata, requestId };
    this.log.info({ sessionId, requestId, source: aggregatedMessage.source }, 'Received aggregated message');

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
          this.log.error({ err }, 'Error attaching image to message');
        }
      }
    }

    // 始终先存入历史记录
    await this.sessionManager.addMessage(sessionId, userMessage);

    // 智能中断逻辑：只有当新消息是明确的停止指令时，才中断当前任务
    // 否则，让新消息排队，保证上下文的完整性和工具执行的原子性
    const keywords = this.config.behavior?.stop_keywords || ['停止', 'stop', 'cancel', 'abort', '别做了', '停下'];
    const stopKeywords = keywords.join('|');
    const stopPattern = new RegExp(`^(${stopKeywords})`, 'i');
    const isStopCommand = stopPattern.test(combinedContent.trim());

    if (isStopCommand && this.sessionAbortControllers.has(sessionId)) {
      this.log.warn({ sessionId }, 'Stop command detected; aborting current task');
      this.sessionAbortControllers.get(sessionId)?.abort();
    }

    // 消息处理队列锁
    // 如果当前有任务在运行，我们等待它完成（除非被上述逻辑强制中断）
    // 使用 Promise 链实现简单的队列
    const currentLock = this.sessionLocks.get(sessionId) || Promise.resolve();
    const lockTimestamp = this.sessionLockTimestamps.get(sessionId) || 0;
    
    // Check for stale lock (e.g. held for more than 5 minutes)
    const LOCK_TIMEOUT_MS = 5 * 60 * 1000;
    const isStale = this.sessionLocks.has(sessionId) && (Date.now() - lockTimestamp > LOCK_TIMEOUT_MS);

    if (isStale) {
      this.log.warn({ sessionId, lockTimestamp }, 'Stale session lock detected, forcing reset');
      // Abort the previous controller if it exists
      const prevController = this.sessionAbortControllers.get(sessionId);
      if (prevController) {
        try {
          prevController.abort();
        } catch (e) { /* ignore */ }
        this.sessionAbortControllers.delete(sessionId);
      }
      // We don't await currentLock here because it might be hung indefinitely
      // Just proceed as if the lock is free, but we should be careful about race conditions
      // In a robust system, we might want to "break" the promise chain, but here we just start a new one.
      this.sessionLocks.delete(sessionId);
      this.sessionLockTimestamps.delete(sessionId);
    } else if (this.sessionLocks.has(sessionId)) {
      this.log.info({ sessionId }, 'Session is busy, queuing new message...');
    }

    const nextTask = (isStale ? Promise.resolve() : currentLock).then(async () => {
      this.log.info({ sessionId, requestId }, 'Acquired session lock, starting processing');
      this.sessionLockTimestamps.set(sessionId, Date.now()); // Update timestamp
      
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
          this.log.warn({ sessionId }, 'Task aborted for session');
        } else {
          this.log.error({ sessionId, err: error }, 'Error in task');
          
          // Attempt to send error message to user via bus
          try {
             const channel = aggregatedMessage.metadata?.originChannel || aggregatedMessage.source || 'cli';
             const chatId = aggregatedMessage.metadata?.originChatId || aggregatedMessage.metadata?.fromUser || 'default';
             bus.publish({
                id: Math.random().toString(36).substring(7),
                source: 'agent',
                target: channel,
                content: `I encountered an error processing your request: ${error.message || 'Unknown error'}`,
                type: 'text',
                timestamp: Date.now(),
                metadata: {
                  ...aggregatedMessage.metadata,
                  sessionId,
                  requestId,
                  to: aggregatedMessage.metadata?.to || chatId
                },
            });
          } catch (pubErr) {
             this.log.error({ err: pubErr }, 'Failed to publish error message');
          }
        }
      } finally {
        // 只有当当前的 controller 仍然是这一个时才删除
        if (this.sessionAbortControllers.get(sessionId) === controller) {
          this.sessionAbortControllers.delete(sessionId);
        }
        
        // Clear lock timestamp immediately if this was the last task
        // This ensures the next request doesn't see a stale timestamp
        // We only clear it if we are sure we are the ones holding the lock,
        // but since this is sequential, it's generally safe to clear if queue is empty.
        // However, a safer way is just to update it. We delete it to be clean.
        this.sessionLockTimestamps.delete(sessionId);
        this.sessionLocks.delete(sessionId); // Explicitly release the lock promise reference
      }
    }).catch(err => {
      this.log.error({ sessionId, err }, 'Queue error');
      // Ensure cleanup even on queue errors
      this.sessionLocks.delete(sessionId);
      this.sessionLockTimestamps.delete(sessionId);
    });

    // 更新锁
    this.sessionLocks.set(sessionId, nextTask);
  }

  public async switchModel(modelId: string) {
    this.log.info({ modelId }, 'Switching model');
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
    const requestId = message.metadata?.requestId || crypto.randomUUID();

    if (message.content.trim() === '/reload') {
      this.log.info({ sessionId }, 'Reloading configuration and environment');
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
        this.log.info({ sessionId }, 'Reload successful');

        bus.publish({
          id: Math.random().toString(36).substring(7),
          source: 'agent',
          target: channel,
          content: '✅ 环境变量与配置已成功重新加载！新的技能和配置现在已生效。',
          type: 'text',
          timestamp: Date.now(),
          metadata: { ...message.metadata, sessionId, requestId, to: message.metadata?.to || chatId },
        });
      } catch (error: any) {
        this.log.error({ sessionId, err: error }, 'Reload failed');
        
        // Don't send error message if it's just an abort (though reload rarely aborts)
        if (error.name === 'AbortError' || error.message?.includes('aborted')) {
          return;
        }

        bus.publish({
          id: Math.random().toString(36).substring(7),
          source: 'agent',
          target: channel,
          content: `❌ 重新加载失败: ${error.message}`,
          type: 'text',
          timestamp: Date.now(),
          metadata: { ...message.metadata, sessionId, requestId, to: message.metadata?.to || chatId },
        });
      }
      return;
    }

    if (message.content.trim() === '/reset') {
      this.log.info({ sessionId }, 'Resetting session');

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
        metadata: { ...message.metadata, sessionId, requestId, to: message.metadata?.to || chatId },
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
    forceTextOnly: boolean = false,
    requestId?: string
  ) {
    const startedAt = Date.now();
    let iteration = 0;
    let finalContent = '';
    const accumulatedText = '';
    let summaryText = '';
    let lastPublishedText = '';
    const accumulatedDirectives = new Set<string>();
    const allToolResults: any[] = [];
    let consecutiveToolErrors = 0;

    let currentHistory = initialHistory;

    // Initial sanitization
    currentHistory = this.contextManager.sanitizeHistory(currentHistory, true);

    let toolsUsed: string[] = [];

    try {
      const model = this.getModel();
      // --- Intelligent Termination Logic ---
      // Instead of hard maxIterations, we use a very high safety cap
      // and rely on stall detection and natural completion.
      const maxIterations = this.config.agents.defaults.max_iterations > 5000 
        ? this.config.agents.defaults.max_iterations 
        : 5000; // Force high limit for continuous execution
      const maxTokens = this.config.agents.defaults.max_tokens || 8192;
      // Default loop timeout from config (default 10 min)
      const loopTimeoutMs = this.config.agents.defaults.timeout_ms || 600000;
      // Sliding window check: checks if time since last activity exceeds timeout, OR total time exceeds a hard limit (e.g. 30 min)
      let lastActivityTime = Date.now();
      const budgetElapsed = () => {
        const now = Date.now();
        // 1. Sliding window timeout (stalled)
        if (now - lastActivityTime > loopTimeoutMs) return true;
        // 2. Hard total limit (3x timeout) to prevent infinite loops even with activity
        if (now - startedAt > loopTimeoutMs * 3) return true;
        return false;
      };

      this.log.info({ requestId, sessionId, tools: Object.keys(tools).length }, 'Calling LLM (manual loop)');

      // Loop detection state
      // Reset stall detector for new session
      this.recentToolCalls = [];
      this.recentContents = [];
      const recentToolCalls = this.recentToolCalls;
      const MAX_REPEAT_HISTORY = 5;

      while (iteration < maxIterations) {
        // Update activity timestamp at start of each iteration
        lastActivityTime = Date.now();

        if (abortSignal?.aborted) {
          throw new Error('AbortError');
        }
        if (budgetElapsed()) {
          const elapsedMin = ((Date.now() - startedAt) / 60000).toFixed(1);
          this.log.warn({ requestId, sessionId, iteration, elapsedMin }, 'Loop timeout reached, stopping early');
          finalContent = finalContent || `处理超时（已运行 ${elapsedMin} 分钟），已返回当前结果。`;
          break;
        }
        iteration++;

        const sanitizedForLLM = this.contextManager.sanitizeHistory(currentHistory, true);

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
          this.log.warn({ requestId, sessionId }, 'Forcing tool choice due to hallucination detection');
          toolChoice = 'required';
        }

        const modelId = this.currentModelId || this.config.agents.defaults.model;
        const isVision = forceTextOnly ? false : isVisionModel(modelId);
        const historyToUse = contextBuilder.buildMessages(sanitizedForLLM, modelId, isVision);

        const payloadStr = JSON.stringify(historyToUse);
        const lastMsg = historyToUse.length > 0 ? historyToUse[historyToUse.length - 1] : null;
        this.log.debug({ requestId, sessionId, iteration, msgCount: historyToUse.length, payloadSize: payloadStr.length, lastMessagePreview: lastMsg ? JSON.stringify(lastMsg).substring(0, 100) : 'None' }, 'Sending request to model');

        let result: any;
        let pendingToolCalls: any[] = [];
        toolsUsed = [];

        // Create a specific controller for this request to handle timeout
        const requestController = new AbortController();
        const timeoutId = setTimeout(() => {
          this.log.warn({ requestId, sessionId, iteration }, 'LLM request timed out');
          requestController.abort();
        }, 600000); // 10 minutes timeout (align with loop timeout)

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
            maxTokens,
            abortSignal: requestController.signal,
          });

          this.log.debug({ requestId, sessionId, iteration }, 'LLM call returned successfully');

          if (result.toolCalls && result.toolCalls.length > 0) {
            pendingToolCalls = result.toolCalls;
            toolsUsed = pendingToolCalls.map((t: any) => t.toolName);
            this.metrics.tool_calls += pendingToolCalls.length;
            
            // Loop Detection Logic
            // We hash the tool calls (name + args) to detect repetition
            const callSignatures = pendingToolCalls.map((t: any) => {
               // Normalize args for consistent hashing
               const argsStr = JSON.stringify(t.args || {});
               return `${t.toolName}:${argsStr}`;
            }).join('|');

            recentToolCalls.push(callSignatures);
            if (recentToolCalls.length > MAX_REPEAT_HISTORY) {
                recentToolCalls.shift();
            }

            // Check if all recent calls are identical
            if (recentToolCalls.length === MAX_REPEAT_HISTORY && recentToolCalls.every(s => s === callSignatures)) {
                this.log.warn({ requestId, sessionId, callSignatures }, 'Detected potential infinite loop (identical tool calls)');
                consecutiveToolErrors++; // Treat as error to trigger backoff or stop
                
                if (consecutiveToolErrors > 2) {
                    finalContent = "系统检测到连续重复执行相同的操作，已强制终止任务以避免死循环。";
                    break;
                }
            } else {
                // Reset counter if pattern breaks
                // But only if it's a completely different tool or args
                // If it's just one different tool in a batch, we might still be looping.
                // For simplicity, we only reset if the signature is different.
                if (recentToolCalls.length > 1 && recentToolCalls[recentToolCalls.length - 1] !== recentToolCalls[recentToolCalls.length - 2]) {
                   // Only reset strict error counter if we are genuinely doing something different
                   // We don't reset consecutiveToolErrors here because that's for execution errors
                }
            }
          }
        } catch (err: any) {
          if (err.name === 'AbortError' || err.message?.includes('aborted')) {
            this.log.error({ requestId, sessionId, iteration }, 'LLM call aborted');
            this.metrics.timeouts += 1;
            finalContent = "任务已被中止（或超时）。";
            break;
          } 
          
          // Handle JSON parsing errors (truncation) by feeding back to LLM
          if (err.message && (err.message.includes('JSON parsing failed') || err.message.includes('Invalid arguments'))) {
             this.log.warn({ requestId, sessionId, iteration, err }, 'JSON parsing/validation failed. Sending guidance to LLM.');
             
             // 1. Notify user (optional, but good for transparency)
             bus.publish({
               id: Math.random().toString(36).substring(7),
               source: 'agent',
               target: channel,
               content: `⚠️ 检测到工具调用参数过长导致解析失败，正在自动重试并要求模型分段处理...`,
               type: 'text',
               timestamp: Date.now(),
               metadata: { ...message.metadata, sessionId, requestId, to: message.metadata?.to || chatId },
             });

             // 2. Add system guidance to history
             const guidanceMessage = {
               role: 'user',
               content: `[System Error] Previous tool call failed: JSON parsing error (likely due to output truncation). \n\n**Action Required:**\n- The content you tried to write/pass was too long.\n- DO NOT retry the exact same action.\n- PLEASE split the content into smaller chunks (e.g. write partial file, then append) or reduce the argument size.`
             } as any;
             
             currentHistory.push(guidanceMessage);
             await this.sessionManager.addMessage(sessionId, guidanceMessage);
             
             // 3. Continue loop to let LLM retry
             continue;
          }

          {
            this.log.error({ requestId, sessionId, iteration, err }, 'LLM call error');
            // 模型降级一次：尝试备用模型
            const fallbackModelId = process.env.NANOBOT_FALLBACK_MODEL || 'deepseek:deepseek-chat';
            // Use the same model creation logic to ensure bypassProxy is respected if it's deepseek
            const fallbackModel = createModel(fallbackModelId, this.config);
            this.log.warn({ requestId, sessionId, iteration, fallbackModelId }, 'Retrying with fallback model');

            try {
              const retry = await generateText({
                model: fallbackModel,
                system: systemPrompt,
                messages: historyToUse,
                tools,
                toolChoice,
                maxSteps: 1,
                temperature: this.config.agents.defaults.temperature,
                maxTokens,
                abortSignal: requestController.signal,
              });
              result = retry;
            } catch (retryErr: any) {
              this.log.error({ requestId, sessionId, iteration, retryErr }, 'Fallback model also failed');
              throw retryErr;
            }
          }
        } finally {
          clearTimeout(timeoutId);
          if (abortSignal) {
            abortSignal.removeEventListener('abort', onUserAbort);
          }
        }

        this.log.debug({
          requestId,
          sessionId,
          iteration,
          toolCalls: result.toolCalls?.length || 0,
          finishReason: result.finishReason
        }, 'LLM iteration result');

        const originalText = result.text || '';
        const cleanedText = this.safetyGuard.cleanOutput(originalText);
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
          // Always update summaryText so it captures the latest text
          summaryText = pureText;

          // Only publish text content immediately if there are tool calls
          // This ensures the user sees the "thought" before the tool runs.
          // If there are NO tool calls, this is the final response, 
          // so we let the loop break and publish it once at the end.
          if (result.toolCalls && result.toolCalls.length > 0) {
            this.log.debug({ requestId, sessionId, iteration }, 'Sending text response');
            
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
            lastPublishedText = pureText;
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
          this.log.debug({ requestId, sessionId, iteration, directives: currentDirectives }, 'Assistant output has directives');
        }

        // --- Stall Detection Logic ---
        if (result.toolCalls && result.toolCalls.length > 0) {
          // Check for repetitive tool usage
          const currentToolCallSignature = result.toolCalls.map((tc: any) => `${tc.toolName}:${JSON.stringify(tc.args)}`).join('|');
          
          // Add to recent history
          this.recentToolCalls.push(currentToolCallSignature);
          if (this.recentToolCalls.length > AgentLoop.STALL_THRESHOLD) {
            this.recentToolCalls.shift();
          }

          // Check if all recent calls are identical
          if (this.recentToolCalls.length === AgentLoop.STALL_THRESHOLD && this.recentToolCalls.every(c => c === currentToolCallSignature)) {
            this.log.warn({ signature: currentToolCallSignature }, 'Stall detected: Repetitive tool usage');
            finalContent = `任务似乎陷入了循环，我连续多次执行了相同的操作 (${currentToolCallSignature})。为了避免浪费资源，我已停止执行。请检查任务描述或提供更多指导。`;
            break;
          }
        } else {
          // No tool calls - Check for repetitive text content
          // Only check if text is substantial (> 10 chars)
          if (pureText && pureText.length > 10) {
             this.recentContents.push(pureText);
             if (this.recentContents.length > AgentLoop.STALL_THRESHOLD) {
                this.recentContents.shift();
             }

             if (this.recentContents.length === AgentLoop.STALL_THRESHOLD && this.recentContents.every(c => c === pureText)) {
                this.log.warn('Stall detected: Repetitive text output');
                finalContent = `任务似乎陷入了循环，我连续多次输出了相同的内容。为了避免无限循环，我已停止执行。`;
                break;
             }
          }
        }

        if (result.toolCalls && result.toolCalls.length > 0) {
          this.log.debug({ requestId, sessionId, iteration, tools: result.toolCalls.length }, 'Executing tools');

          const { results, missing } = await this.stepExecutor.executeTools(
            result.toolCalls,
            tools,
            currentHistory,
            abortSignal,
            sessionId,
            requestId
          );

          allToolResults.push(...results);

          // 简单错误检测并退避
          const toolError = results.some(r => r.isError || (typeof r.result === 'string' && r.result.startsWith('Error:')));
          if (toolError) {
            consecutiveToolErrors += 1;
            this.metrics.tool_errors += 1;
            const backoffMs = Math.min(2000, 200 * 2 ** (consecutiveToolErrors - 1));
            await new Promise(res => setTimeout(res, backoffMs));
          } else {
            consecutiveToolErrors = 0;
          }

          if (results.length > 0) {
            // Streaming behavior: Send tool execution results immediately
            
            // Check config for verbose output preference
            // Ensure boolean conversion and fallback
            const configValue = this.config.agents?.defaults?.verbose_tool_output;
            const verboseOutput = configValue === undefined ? true : configValue;
            
            this.log.info({ 
              verboseOutput, 
              rawConfigValue: configValue,
              configDefaults: this.config.agents?.defaults 
            }, 'Verbose tool output check');

            const toolOutput = results.map(r => {
              const originalCall = result.toolCalls?.find((tc: any) => tc.toolCallId === r.toolCallId);
              const args = originalCall ? (originalCall.args as any) : {};

              if (verboseOutput) {
                  // --- Original Verbose Mode ---
                  let header = `**🔨 ${r.toolName}**`;
                  if (r.toolName === 'runCommand' && args.command) {
                    const cmd = args.command;
                    // Show full command in a code block on new line for mobile readability
                    header += `:\n\`\`\`bash\n${cmd}\n\`\`\``;
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

              } else {
                  // --- Simplified User-Friendly Mode ---
                  let header = `**🔨 ${r.toolName}**`;
                  if (r.toolName === 'runCommand' && args.command) {
                    const cmd = args.command.length > 50 ? args.command.substring(0, 47) + '...' : args.command;
                    header += `: \`${cmd}\``;
                  } else if ((r.toolName === 'readFile' || r.toolName === 'read_file') && args.file_path) {
                    const fname = args.file_path.split('/').pop();
                    header += `: \`${fname}\``;
                  } else if (r.toolName === 'web_search' && args.query) {
                    header += `: "${args.query}"`;
                  } else if (r.toolName === 'spawnSubagent' && args.goal) {
                    header += `: "${args.goal.substring(0, 30)}..."`;
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
                  
                  return `${header} ${status}`;
              }
            }).join('\n\n');

            this.log.debug({ requestId, sessionId, iteration }, `Tool result update:\n${toolOutput}`);
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
                requestId,
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
            this.log.warn({ requestId, sessionId, missing: missing.length }, 'Filling missing tool results due to interruption');
            const missingMsg = {
              role: 'tool',
              content: missing
            } as any;
            await this.sessionManager.addMessage(sessionId, missingMsg);
            currentHistory.push(missingMsg);
          }
        } else if (currentOutputHadHallucination || currentOutputHasDirective || intentMismatch) {
          this.log.warn({ requestId, sessionId, iteration }, 'Detected hallucination/directive/intent mismatch, retrying');

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

          if (content && content === lastPublishedText) {
            this.log.debug('Skipping duplicate content as final response');
            content = '';
          }

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
          this.log.warn({ requestId, sessionId, iteration }, 'Reached maximum iterations, stopping');
          let content = summaryText || pureText || accumulatedText;
          if (accumulatedDirectives.size > 0) {
            const directives = Array.from(accumulatedDirectives).join('\n');
            content = `${content}\n\n${directives}`.trim();
          }

          if (content.trim()) {
            finalContent = content.trim() + '\n\n(注意：由于处理步骤过多（已达' + maxIterations + '步），以上是已完成的部分结果。)';
          } else if (allToolResults.length > 0) {
            const lastResult = allToolResults[allToolResults.length - 1].result;
            const resultString = typeof lastResult === 'string' ? lastResult : JSON.stringify(lastResult, null, 2);
            finalContent = resultString + '\n\n(注意：任务未完全结束，以上是最后的工具执行结果。)';
          } else {
            finalContent = '抱歉，我尝试了多次但未能完成任务。';
          }
          break;
        }
      }

      this.log.info({ requestId, sessionId, iterations: iteration, toolsUsed: toolsUsed.length, totalToolResults: allToolResults.length, duration_ms: Date.now() - startedAt }, 'Response completed');
      
      console.log(`[Agent] Publishing response to ${channel} for ${chatId}`);
      this.log.info({ channel, chatId, contentPreview: finalContent.substring(0, 50) }, 'Publishing response to bus');

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
          requestId,
          to: message.metadata?.to || chatId
        },
      });
      this.log.info({ channel, chatId }, 'Response published to bus');

      if (this.memoryStore && finalContent && finalContent.length > 0) {
        // Construct a rich log entry for the summary system
        const now = new Date();
        const timeStr = [now.getHours(), now.getMinutes(), now.getSeconds()]
          .map(n => n.toString().padStart(2, '0'))
          .join(':');
        let logEntry = `### [${timeStr}] Interaction\n\n`;
        
        // 1. User Input
        if (message.content) {
          // Truncate long inputs
          const inputPreview = typeof message.content === 'string' 
            ? message.content 
            : '[Complex/Multi-modal Input]';
          logEntry += `**User:** ${inputPreview.slice(0, 500)}${inputPreview.length > 500 ? '...' : ''}\n\n`;
        }

        // 2. Tool Executions
        if (allToolResults.length > 0) {
          logEntry += `**Tools Used:**\n`;
          allToolResults.forEach(t => {
            const resultPreview = typeof t.result === 'string' ? t.result.slice(0, 100) : JSON.stringify(t.result).slice(0, 100);
            logEntry += `- \`${t.toolName}\`: ${resultPreview}...\n`;
          });
          logEntry += '\n';
        }

        // 3. Agent Response
        logEntry += `**Agent:** ${finalContent.slice(0, 1000)}${finalContent.length > 1000 ? '...' : ''}\n`;

        await this.memoryStore.appendToday(logEntry);
        this.log.debug({ requestId, sessionId }, 'Auto-saved rich interaction log to today memory');
      }

    } catch (error: any) {
      this.log.error({ requestId, sessionId, err: error }, 'Unexpected error in runAgentLoop');
      throw error;
    }
  }

  private async handleMessage(message: Message, abortSignal: AbortSignal) {
    const sessionId = message.metadata?.sessionId || 'default';
    const channel = message.metadata?.originChannel || message.source || 'cli';
    const chatId = message.metadata?.originChatId || message.metadata?.fromUser || 'default';
    const requestId = message.metadata?.requestId || crypto.randomUUID();
    this.metrics.turns += 1;

    this.log.info({ sessionId, channel, requestId }, 'Starting handleMessage');

    try {
      const fullHistory = await this.sessionManager.getHistory(sessionId);
      const history = this.contextManager.trimHistory(fullHistory);
      if (history.length === 0) {
        // 如果没有历史记录，可能是首次会话，或者 sessionManager 出错
        this.log.warn({ sessionId }, 'History is empty, initializing with user message');
      } else if (history.length !== fullHistory.length) {
        this.log.debug({ sessionId, before: fullHistory.length, after: history.length }, 'History trimmed for size control');
      }

      const contextBuilder = new ContextBuilder(this.config);
      await contextBuilder.initialize();

      // Ensure SubagentManager is initialized
      if (!this.subagentManager) {
        this.log.warn({ sessionId }, 'SubagentManager is not initialized in AgentLoop! Attempting lazy initialization...');
        try {
           const workspacePath = getWorkspacePath(this.config);
           this.subagentManager = new SubagentManager(
             this.getModel(),
             workspacePath,
             bus,
             this.config,
             this.toolRegistry
           );
           this.log.info({ sessionId }, 'SubagentManager initialized lazily.');
        } catch (initErr) {
           this.log.error({ sessionId, err: initErr }, 'Failed to lazy initialize SubagentManager');
        }
      }

      // Inject tool definitions into system prompt
      const toolDefinitions = this.toolRegistry.getToolDefinitionsSummary({
        subagentManager: this.subagentManager,
        memoryStore: this.memoryStore,
      });
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
        abortSignal,
        false,
        requestId
      );

      this.log.info({ sessionId, requestId }, 'Loop completed');

    } catch (error: any) {
      this.log.error({ sessionId, requestId, err: error }, 'Error in handleMessage');

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
        this.log.warn({ sessionId, requestId }, 'Model reported image support issue. Retrying with text only...');
        try {
          // Need to rebuild tools/context if needed, but for retry just call runAgentLoop with forceTextOnly=true
          const history = await this.sessionManager.getHistory(sessionId);
          const contextBuilder = new ContextBuilder(this.config);
          await contextBuilder.initialize();

          const toolDefinitions = this.toolRegistry.getToolDefinitionsSummary({
            subagentManager: this.subagentManager,
            memoryStore: this.memoryStore,
          });
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
          this.log.error({ sessionId, requestId, err: retryError }, 'Retry without images failed');
        }
      }

      // Don't send "Sorry, I encountered an error" if it's just an abort
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        return;
      }

      bus.publish({
        id: Math.random().toString(36).substring(7),
        source: 'agent',
        target: channel,
        content: `Sorry, I encountered an error: ${userFriendlyError}`,
        type: 'text',
        timestamp: Date.now(),
        metadata: { ...message.metadata, sessionId, requestId },
      });
    }
  }
}
