import { generateText, CoreMessage, LanguageModelV1 } from 'ai';
import fs from 'fs-extra';
import path from 'path';
import * as dotenv from 'dotenv';
import crypto from 'crypto';
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
import { createLogger } from '../utils/logger.js';
import { agentMetrics } from './metrics.js';
import { cleanupUploads, recordSessionsCleanup } from '../utils/cleanup.js';

export class AgentLoop {
  private config: Config;
  private cronService?: CronService;
  private subagentManager?: SubagentManager;
  private memoryStore?: MemoryStore;
  private sessionManager: SessionManager;
  private messageAggregator: MessageAggregator;
  private safetyGuard: SafetyGuard;
  private toolRegistry: ToolRegistry;
  private log = createLogger('agent-loop');

  private currentModelId: string | null = null;
  private sessionLocks: Map<string, Promise<void>> = new Map();
  private sessionAbortControllers: Map<string, AbortController> = new Map();
  private metrics = agentMetrics;
  private toolConcurrency: number;
  private toolResultLimit: number;
  private historyUserLimit: number;
  private historyToolLimit: number;

  constructor(config: Config, cronService?: CronService, sessionMgr?: SessionManager, toolRegistry?: ToolRegistry) {
    this.config = config;
    this.cronService = cronService;
    this.sessionManager = sessionMgr || sessionManager;
    this.safetyGuard = new SafetyGuard(config);
    this.messageAggregator = new MessageAggregator(this.handleAggregatedMessage.bind(this));
    this.toolRegistry = toolRegistry || new ToolRegistry(config);

    // Config-driven knobs with sane fallbacks
    this.toolConcurrency = Number(this.config.tools?.tool_concurrency ?? 3);
    this.toolResultLimit = Number(this.config.tools?.tool_result_maxchars ?? 4000);
    this.historyUserLimit = Number(this.config.tools?.history_max_user_msgs ?? 12);
    this.historyToolLimit = Number(this.config.tools?.history_max_tool_msgs ?? 12);
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
              this.log.warn({ toolNames, index: i }, 'Found interrupted assistant tool-call; filling error result to recover');

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
              this.log.warn({ toolNames, index: i }, 'Found incomplete assistant tool-call; filling placeholder to preserve memory');

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
          this.log.warn({ index: i }, 'Removing orphaned tool result');
          continue;
        }
      } else {
        result.push(msg);
      }
    }
    return result;
  }

  /**
   * Trim历史，限制用户消息和工具结果的数量，防止上下文爆炸。
   * 采用“跳过”策略：超出配额的旧消息会被丢弃，其余保持顺序。
   */
  private trimHistory(history: any[]) {
    if (!history || history.length === 0) return history;

    const maxUsers = Math.max(0, this.historyUserLimit);
    const maxTools = Math.max(0, this.historyToolLimit);

    let userCount = 0;
    let toolCount = 0;
    const kept: any[] = [];

    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      if (msg.role === 'user') {
        if (userCount >= maxUsers) continue;
        userCount++;
      } else if (msg.role === 'tool') {
        if (toolCount >= maxTools) continue;
        toolCount++;
      }
      kept.push(msg);
    }

    return kept.reverse();
  }

  /**
   * 裁剪工具输出，避免长文本填满上下文。
   */
  private truncateToolResult(result: any) {
    const limit = this.toolResultLimit;
    if (!limit || limit <= 0 || result === null || result === undefined) return result;

    const truncateString = (val: string) => {
      if (val.length <= limit) return val;
      const head = val.slice(0, Math.floor(limit * 0.6));
      const tail = val.slice(-Math.floor(limit * 0.3));
      const skipped = val.length - head.length - tail.length;
      return `${head}\n...\n${tail}\n[truncated ${skipped} chars]`;
    };

    if (typeof result === 'string') {
      return truncateString(result);
    }

    if (Array.isArray(result)) {
      return result.map((item) => (typeof item === 'string' ? truncateString(item) : item));
    }

    if (typeof result === 'object') {
      // 1) 若存在标准输出字段，优先摘要
      const keys = Object.keys(result);
      const outputKey = keys.find(k => ['stdout', 'content', 'output', 'text'].includes(k));
      if (outputKey && typeof (result as any)[outputKey] === 'string') {
        const copy = { ...result };
        copy[outputKey] = truncateString((result as any)[outputKey]);
        return copy;
      }
      // 2) 默认逐字段截断字符串
      const copy: any = Array.isArray(result) ? [] : { ...result };
      for (const key of keys) {
        const val = (result as any)[key];
        copy[key] = typeof val === 'string' ? truncateString(val) : val;
      }
      return copy;
    }

    return result;
  }

  private async executeTools(
    toolCalls: any[],
    tools: any,
    currentHistory: any[],
    abortSignal?: AbortSignal,
    sessionId?: string,
    requestId?: string
  ): Promise<{ results: any[], missing: any[] }> {
    const toolResults: any[] = [];
    const pendingToolCalls = [...toolCalls];

    this.log.debug({ sessionId, requestId, toolCount: toolCalls.length, tools: toolCalls.map(tc => tc.toolName) }, 'Preparing to execute tools');

    // Parallel execution logic
    const batches = [] as any[];
    for (let i = 0; i < toolCalls.length; i += this.toolConcurrency) {
      batches.push(toolCalls.slice(i, i + this.toolConcurrency));
    }

    for (const batch of batches) {
      const batchPromises = batch.map(async (toolCall: any) => {
        if (abortSignal?.aborted) return null;

        this.log.debug({ tool: toolCall.toolName }, 'Starting tool call');
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
          this.log.debug({ tool: toolCall.toolName, duration }, 'Finished tool call');

          const safeResult = this.truncateToolResult(toolResult);

          return {
            type: 'tool-result',
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            result: safeResult,
          };
        } catch (err: any) {
          this.log.error({ tool: toolCall.toolName, err }, 'Tool execution error');
          return {
            type: 'tool-result',
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            result: `Error: ${err.message}`,
            isError: true,
          };
        }
      } else {
        this.log.warn({ tool: toolCall.toolName }, 'Tool not found');
        return {
          type: 'tool-result',
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          result: `Error: Tool "${toolCall.toolName}" not found.`,
          isError: true,
        };
        }
      });

      const results = await Promise.all(batchPromises);
      const validResults = results.filter(r => r !== null);
      toolResults.push(...validResults);
    }

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
          this.log.warn({ sessionId }, 'Task aborted for session');
        } else {
          this.log.error({ sessionId, err: error }, 'Error in task');
        }
      } finally {
        // 只有当当前的 controller 仍然是这一个时才删除
        if (this.sessionAbortControllers.get(sessionId) === controller) {
          this.sessionAbortControllers.delete(sessionId);
        }
      }
    }).catch(err => {
      this.log.error({ sessionId, err }, 'Queue error');
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
    const accumulatedDirectives = new Set<string>();
    const allToolResults: any[] = [];
    let consecutiveToolErrors = 0;

    let currentHistory = initialHistory;

    // Initial sanitization
    currentHistory = this.sanitizeHistory(currentHistory, true);

    let toolsUsed: string[] = [];

    try {
      const model = this.getModel();
      const maxIterations = this.config.agents.defaults.max_iterations || 15;
      const maxTokens = this.config.agents.defaults.max_tokens || 8192;
      // Default loop timeout from config (default 5 min)
      const loopTimeoutMs = this.config.agents.defaults.timeout_ms || 300000;
      const budgetElapsed = () => Date.now() - startedAt > loopTimeoutMs;

      this.log.info({ requestId, sessionId, tools: Object.keys(tools).length }, 'Calling LLM (manual loop)');

      while (iteration < maxIterations) {
        if (abortSignal?.aborted) {
          throw new Error('AbortError');
        }
        if (budgetElapsed()) {
          this.log.warn({ requestId, sessionId, iteration }, 'Loop timeout reached, stopping early');
          finalContent = finalContent || '处理超时，已返回当前结果。';
          break;
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
          this.log.warn({ requestId, sessionId }, 'Forcing tool choice due to hallucination detection');
          toolChoice = 'required';
        }

        const modelId = this.currentModelId || this.config.agents.defaults.model;
        const isVision = forceTextOnly ? false : isVisionModel(modelId);
        const historyToUse = contextBuilder.buildMessages(sanitizedForLLM, modelId, isVision);

        const payloadStr = JSON.stringify(historyToUse);
        const lastMsg = historyToUse.length > 0 ? historyToUse[historyToUse.length - 1] : null;
        this.log.debug({ requestId, sessionId, iteration, msgCount: historyToUse.length, payloadSize: payloadStr.length, lastMessagePreview: lastMsg ? JSON.stringify(lastMsg).substring(0, 100) : 'None' }, 'Sending request to model');

        let result;
        let pendingToolCalls: any[] = [];
        toolsUsed = [];

        // Create a specific controller for this request to handle timeout
        const requestController = new AbortController();
        const timeoutId = setTimeout(() => {
          this.log.warn({ requestId, sessionId, iteration }, 'LLM request timed out');
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
            maxTokens,
            abortSignal: requestController.signal,
          });

          if (result.toolCalls && result.toolCalls.length > 0) {
            pendingToolCalls = result.toolCalls;
            toolsUsed = pendingToolCalls.map((t: any) => t.toolName);
            this.metrics.tool_calls += pendingToolCalls.length;
          }
        } catch (err: any) {
          if (err.name === 'AbortError' || err.message?.includes('aborted')) {
            this.log.error({ requestId, sessionId, iteration }, 'LLM call aborted');
            this.metrics.timeouts += 1;
            finalContent = "任务已被中止（或超时）。";
          } else {
            this.log.error({ requestId, sessionId, iteration, err }, 'LLM call error');
            // 模型降级一次：尝试备用模型
            const fallbackModelId = process.env.NANOBOT_FALLBACK_MODEL || 'gpt-4o-mini';
      const fallbackModel = createModel(fallbackModelId, this.config);
      this.log.warn({ requestId, sessionId, iteration, fallbackModelId }, 'Retrying with fallback model');
      const retry = await generateText({
        model: fallbackModel,
        system: systemPrompt,
        messages: historyToUse,
        tools,
        toolChoice,
        maxSteps: 1,
        temperature: this.config.agents.defaults.temperature,
        maxTokens,
      });
      result = retry;
      continue;
          }
          break;
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
          if (result.toolCalls && result.toolCalls.length > 0) {
            // Streaming behavior: Send intermediate text immediately instead of accumulating
            this.log.debug({ requestId, sessionId, iteration }, 'Sending intermediate text');
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
          this.log.debug({ requestId, sessionId, iteration, directives: currentDirectives }, 'Assistant output has directives');
        }

        if (result.toolCalls && result.toolCalls.length > 0) {
          this.log.debug({ requestId, sessionId, iteration, tools: result.toolCalls.length }, 'Executing tools');

          const { results, missing } = await this.executeTools(
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

      this.log.info({ requestId, sessionId, iterations: iteration, toolsUsed: toolsUsed.length, totalToolResults: allToolResults.length, duration_ms: Date.now() - startedAt }, 'Response completed');

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

      if (this.memoryStore && finalContent && finalContent.length > 0) {
        const summary = `[${new Date().toLocaleTimeString()}] ${finalContent.slice(0, 500)}${finalContent.length > 500 ? '...' : ''}`;
        await this.memoryStore.appendToday(summary);
        this.log.debug({ requestId, sessionId }, 'Auto-saved response to today memory');
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
      const history = this.trimHistory(fullHistory);
      if (history.length === 0) {
        // 如果没有历史记录，可能是首次会话，或者 sessionManager 出错
        this.log.warn({ sessionId }, 'History is empty, initializing with user message');
      } else if (history.length !== fullHistory.length) {
        this.log.debug({ sessionId, before: fullHistory.length, after: history.length }, 'History trimmed for size control');
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
          this.log.error({ sessionId, requestId, err: retryError }, 'Retry without images failed');
        }
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
