import { generateText, CoreMessage, LanguageModelV1 } from 'ai';
import fs from 'fs-extra';
import path from 'path';
import * as dotenv from 'dotenv';
import { Config, getWorkspacePath, loadConfig } from './config.js';
import { buildContext } from './context.js';
import { sessionManager, SessionManager } from './session.js';
import { createTools } from '../tools/index.js';
import { bus, Message } from './bus.js';
import { SubagentManager } from './subagent.js';
import { MemoryStore } from './memory.js';
import { CronService } from '../cron/service.js';
import { parseSessionKey } from '../utils/helpers.js';
import { createModel, isVisionModel } from '../providers/registry.js';

const toolHallucinationPattern = /^\s*(runCommand|readFile|writeFile|listDir|editFile|describeImage|message|spawn|transcribe|synthesize|webSearch|webFetch|cron|spawnSubagent|saveMemory|switchModel|getSystemDiagnostics):\s*(\{[\s\S]*?\}|[^\s\n\r]+)/gim;
const directivePattern = /^\s*(?:SEND_FILE|SEND_IMAGE|SEND_VOICE):\s*([^\n\r]+)/gim;


export class AgentLoop {
  private config: Config;
  private cronService?: CronService;
  private subagentManager?: SubagentManager;
  private memoryStore?: MemoryStore;
  private sessionManager: SessionManager;

  private currentModelId: string | null = null;
  private sessionLocks: Map<string, Promise<void>> = new Map();
  private sessionAbortControllers: Map<string, AbortController> = new Map();
  private sessionAggregators: Map<string, { timer: NodeJS.Timeout; messages: Message[] }> = new Map();

  constructor(config: Config, cronService?: CronService, sessionMgr?: SessionManager) {
    this.config = config;
    this.cronService = cronService;
    this.sessionManager = sessionMgr || sessionManager;
  }

  private isInsideCodeBlock(text: string, pos: number) {
    const prefix = text.substring(0, pos);
    const codeBlocks = prefix.match(/```/g);
    return codeBlocks && codeBlocks.length % 2 !== 0;
  }

  private sanitizeHistory(history: any[], isFinalForLLM: boolean = false) {
    const result: any[] = [];
    for (let i = 0; i < history.length; i++) {
      const msg = history[i];
      
      if (msg.role === 'assistant') {
        const toolCalls = Array.isArray(msg.content) 
          ? msg.content.filter((c: any) => (c as any).type === 'tool-call')
          : [];
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
        } else {
          result.push(msg);
        }
      } else if (msg.role === 'tool') {
        // 确保 tool 消息前面有配对的 assistant
        const lastMsg = result[result.length - 1];
        const lastHasTC = lastMsg && lastMsg.role === 'assistant' && Array.isArray(lastMsg.content) && lastMsg.content.some((c: any) => (c as any).type === 'tool-call');
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

  public async start() {
    console.log('[Agent] Loop started. Waiting for messages...');
    
    const workspacePath = getWorkspacePath(this.config);
    this.memoryStore = new MemoryStore(workspacePath);
    this.subagentManager = new SubagentManager(
      this.getModel(),
      workspacePath,
      bus,
      this.config
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
      let aggregator = this.sessionAggregators.get(sessionId);
      if (aggregator) {
        clearTimeout(aggregator.timer);
        aggregator.messages.push(message);
      } else {
        aggregator = {
          messages: [message],
          timer: null as any
        };
        this.sessionAggregators.set(sessionId, aggregator);
      }

        // 1.5s 聚合窗口结束后执行
        aggregator.timer = setTimeout(async () => {
          const currentAggregator = this.sessionAggregators.get(sessionId);
          if (!currentAggregator) return;
          this.sessionAggregators.delete(sessionId);

          // 合并消息内容
          const combinedContent = currentAggregator.messages.map(m => m.content).join('\n\n');
          const firstMsg = currentAggregator.messages[0];
          const aggregatedMessage: Message = {
            ...firstMsg,
            content: combinedContent,
            metadata: {
              ...firstMsg.metadata,
              aggregatedCount: currentAggregator.messages.length
            }
          };

          // 构建用户消息并存入历史
          const userMessage: CoreMessage = {
            role: 'user',
            content: combinedContent,
          };

          // 处理图片附件（如果支持）
          if (aggregatedMessage.metadata?.msgType === 'image' && aggregatedMessage.metadata?.localPath) {
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
          const isStopCommand = /^(停止|stop|cancel|abort|别做了|停下)/i.test(combinedContent.trim());
          
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
        }, 1500); // 1.5s 聚合窗口
    });
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
        const workspacePath = getWorkspacePath(this.config);
        this.memoryStore = new MemoryStore(workspacePath);
        this.subagentManager = new SubagentManager(
          this.getModel(),
          workspacePath,
          bus,
          this.config
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
      // 强制删除会话锁，让排队的消息能够被处理
      this.sessionLocks.delete(sessionId);
      
      bus.publish({
        id: Math.random().toString(36).substring(7),
        source: 'agent',
        target: channel,
        content: '🔄 会话锁已强制重置。如果之前有任务卡住，现在应该可以处理新消息了。',
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
    context: any,
    channel: string,
    chatId: string,
    message: Message,
    abortSignal?: AbortSignal
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
        
        let toolChoice: 'auto' | 'required' = 'auto';
        
        // Hallucination detection
        let hasHallucination = false;
        const lastMsg = sanitizedForLLM[sanitizedForLLM.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          let hasActualToolCalls = false;
          let text = '';
          if (typeof lastMsg.content === 'string') {
            text = lastMsg.content;
          } else if (Array.isArray(lastMsg.content)) {
            hasActualToolCalls = lastMsg.content.some((c: any) => (c as any).type === 'tool-call');
            const textPart = lastMsg.content.find((c: any) => (c as any).type === 'text');
            if (textPart) text = (textPart as any).text || '';
          }

          if (text.match(toolHallucinationPattern)) {
             let matchFound = false;
             text.replace(toolHallucinationPattern, (match, _p1, _p2, offset) => {
                if (!this.isInsideCodeBlock(text, offset)) {
                   matchFound = true;
                }
                return match;
             });
             if (matchFound) hasHallucination = true;
          } else if (text.match(directivePattern) && !hasActualToolCalls) {
            hasHallucination = true;
          }
        }

        const userMsg = currentHistory[currentHistory.length - 1];
        if (userMsg && userMsg.role === 'user' && typeof userMsg.content === 'string') {
          const toolIntentKeywords = ['列出', '读取', '查找', '搜索', '运行', '执行', 'list', 'read', 'find', 'search', 'run', 'exec'];
          if (toolIntentKeywords.some(k => (userMsg.content as string).toLowerCase().includes(k))) {
            console.log(`[Agent] User message implies tool intent. Setting toolChoice to auto.`);
          }
        }

        if (hasHallucination) {
          console.warn(`[Agent] Forcing tool choice due to detected hallucinations in history.`);
          toolChoice = 'required';
        }

        console.log(`[Agent] Iteration ${iteration}: Sending request to model...`);
        const payloadStr = JSON.stringify(sanitizedForLLM);
        console.log(`[Agent] Messages count: ${sanitizedForLLM.length}, Payload size: ${payloadStr.length} chars, Last message: ${JSON.stringify(sanitizedForLLM[sanitizedForLLM.length-1]).substring(0, 100)}...`);
        
        let result;
        let pendingToolCalls: any[] = [];

        try {
          result = await generateText({
            model,
            system: context.systemPrompt,
            messages: sanitizedForLLM,
            tools,
            toolChoice,
            maxSteps: 1, 
            temperature: this.config.agents.defaults.temperature,
            abortSignal: abortSignal,
          });
          
          if (result.toolCalls && result.toolCalls.length > 0) {
            pendingToolCalls = result.toolCalls;
          }
        } catch (err: any) {
          if (err.name === 'AbortError' || err.message?.includes('aborted')) {
            console.error(`[Agent] LLM call aborted at iteration ${iteration}`);
            finalContent = "任务已被中止。";
          } else {
            console.error(`[Agent] LLM call error at iteration ${iteration}:`, err.message);
            finalContent = `抱歉，我在处理任务时遇到了错误：${err.message}`;
          }
          break;
        }

        console.log(`[Agent] Iteration ${iteration} result:`, {
          text: result.text,
          toolCalls: result.toolCalls?.length || 0,
          finishReason: result.finishReason
        });

        let cleanedText = result.text || '';
        let currentOutputHadHallucination = false;
        if (cleanedText.match(toolHallucinationPattern)) {
          const newText = cleanedText.replace(toolHallucinationPattern, (match, _p1, _p2, offset) => {
            if (this.isInsideCodeBlock(cleanedText, offset)) {
              return match;
            }
            currentOutputHadHallucination = true;
            return '';
          }).trim();

          if (currentOutputHadHallucination) {
            console.warn(`[Agent] Detected hallucination in current output. Cleaning...`);
            cleanedText = newText;
          }
        }

        let currentOutputHasDirective = false;
        if (cleanedText.match(directivePattern) && (!result.toolCalls || result.toolCalls.length === 0)) {
          const workspacePath = getWorkspacePath(this.config);
          let hasActualHallucination = false;
          
          const newText = cleanedText.replace(directivePattern, (match, filePath, offset) => {
            if (this.isInsideCodeBlock(cleanedText, offset)) return match;
            
            const pathToCheck = filePath.trim().replace(/["']$/g, '').replace(/^["']/g, '').trim();
            const absolutePath = path.isAbsolute(pathToCheck) ? pathToCheck : path.join(workspacePath, pathToCheck);
            
            const isVideo = pathToCheck.toLowerCase().match(/\.(mp4|mov|avi|mkv|wmv)$/);
            
            if (fs.existsSync(absolutePath) || isVideo) {
              return match; 
            }
            
            console.warn(`[Agent] Detected premature directive with non-existent file: ${pathToCheck}. Cleaning...`);
            hasActualHallucination = true;
            return '';
          }).trim();
          
          if (hasActualHallucination) {
            currentOutputHasDirective = true;
            cleanedText = newText;
          }
        }

        let intentMismatch = false;
        const lowerText = cleanedText.toLowerCase();
        const sentKeywords = ['发送', '已发', '发给', 'sent', 'delivered'];
        const targetKeywords = ['语音', '文件', '图片', '截图', '录屏', '录音', 'voice', 'audio', 'file', 'image', 'screenshot', 'record'];
        
        const hasSentIntent = sentKeywords.some(k => lowerText.includes(k));
        const hasTargetIntent = targetKeywords.some(k => lowerText.includes(k));

        if ((!result.toolCalls || result.toolCalls.length === 0) && (hasSentIntent && hasTargetIntent)) {
          console.warn(`[Agent] Detected intent-action mismatch: Assistant claims action but no tools called in this iteration.`);
          intentMismatch = true;
        }

        const currentDirectives = cleanedText.match(directivePattern);
        if (currentDirectives) {
          for (const d of currentDirectives) {
            accumulatedDirectives.add(d.trim());
          }
        }

        let pureText = cleanedText.replace(directivePattern, '').trim();

        if (pureText) {
          if (result.toolCalls && result.toolCalls.length > 0) {
            if (accumulatedText) accumulatedText += '\n\n';
            accumulatedText += pureText;
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

        await sessionManager.addMessage(sessionId, assistantMessage);
        currentHistory.push(assistantMessage);

        if (currentDirectives) {
          console.log(`[Agent] Iteration ${iteration}: Assistant output contains directives: ${currentDirectives.join(', ')}`);
        }

        if (result.toolCalls && result.toolCalls.length > 0) {
          console.log(`[Agent] Iteration ${iteration}: Executing ${result.toolCalls.length} tools...`);
          
          const toolResults: any[] = [];
          try {
            // Parallel execution logic
            const toolPromises = result.toolCalls.map(async (toolCall: any) => {
              if (abortSignal?.aborted) return null;
              
              console.log(`[Agent] Tool Call: ${toolCall.toolName}`);
              const tool = (tools as any)[toolCall.toolName];
              if (tool) {
                try {
                  const toolResult = await tool.execute(toolCall.args, { 
                    toolCallId: toolCall.toolCallId, 
                    messages: currentHistory,
                    abortSignal: abortSignal 
                  });
                  return {
                    type: 'tool-result',
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    result: toolResult,
                  };
                } catch (err: any) {
                  console.error(`[Agent] Tool execution error: ${err.message}`);
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
            allToolResults.push(...validResults);

          } finally {
            if (toolResults.length > 0) {
              const toolMessage = {
                role: 'tool',
                content: toolResults,
              } as any;
              await sessionManager.addMessage(sessionId, toolMessage);
              currentHistory.push(toolMessage);
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

            if (missingResults.length > 0) {
              console.warn(`[Agent] Filling ${missingResults.length} missing tool results due to interruption.`);
              const missingMsg = {
                role: 'tool',
                content: missingResults
              } as any;
              await sessionManager.addMessage(sessionId, missingMsg);
              currentHistory.push(missingMsg);
            }
          }
        } else if (currentOutputHadHallucination || currentOutputHasDirective || intentMismatch) {
          console.log(`[Agent] Iteration ${iteration}: Hallucination, premature directive or intent mismatch detected. Retrying with correction...`);
          
          if (intentMismatch && iteration < maxIterations) {
            const correctionMsg = {
              role: 'user',
              content: '[系统纠偏] 你声称已发送或生成了内容，但你没有调用任何工具。请务必调用相应的工具来完成操作，不要只是描述要做什么。',
            } as any;
            await sessionManager.addMessage(sessionId, correctionMsg);
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

  private async handleMessage(message: Message, abortSignal?: AbortSignal) {
    const sessionId = message.metadata?.sessionId || 'default';
    if (!sessionId) {
      console.warn('[Agent] Message missing sessionId, skipping.');
      return;
    }

    const [parsedChannel, parsedChatId] = parseSessionKey(sessionId);
    const channel = message.metadata?.originChannel || message.source || parsedChannel || 'cli';
    const chatId = message.metadata?.originChatId || message.metadata?.fromUser || parsedChatId || 'default';

    const context = await buildContext(this.config, channel, chatId);

    console.log(`[Agent] Processing message from ${message.source} (Target: ${message.target || 'all'}) in session ${sessionId}`);

    const { tools, initPromise } = await createTools({
      config: this.config,
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

    let history = this.sessionManager.getHistory(sessionId);

    const modelId = this.config.agents.defaults.model;
    if (!isVisionModel(modelId)) {
      history = history.map(msg => {
        if (msg.role === 'tool') return msg;
        if (Array.isArray(msg.content)) {
          const textParts = msg.content
            .filter((part: any) => part.type === 'text')
            .map((part: any) => (part as any).text)
            .join('\n');
          return { ...msg, content: textParts || '[图片]' } as CoreMessage;
        }
        return msg;
      });
    }

    try {
      await this.runAgentLoop(sessionId, history, tools, context, channel, chatId, message, abortSignal);
    } catch (error: any) {
      let userFriendlyError = error.message;
      if (userFriendlyError.includes('JSON parsing failed') && userFriendlyError.includes('Text:')) {
        const textIndex = userFriendlyError.indexOf('Text:');
        const errorType = userFriendlyError.substring(0, textIndex).trim();
        const rawText = userFriendlyError.substring(textIndex + 5);
        if (rawText.length > 500) {
          userFriendlyError = `${errorType} (由于生成的参数过长导致截断，无法解析。建议分段操作或精简内容。) \n\n预览内容: ${rawText.substring(0, 200)}...`;
        }
      }

      console.error(`[Agent] Error processing message: ${userFriendlyError}`);

      if (error.message?.includes('Image input not supported') || error.message?.includes('multimodal')) {
        console.warn('[Agent] Model reported image support issue. Stripping images and retrying...');
        
        try {
          let history = this.sessionManager.getHistory(sessionId);
          history = history.map(msg => {
            if (msg.role === 'tool') return msg;
            if (Array.isArray(msg.content)) {
              const textParts = msg.content
                .filter((part: any) => part.type === 'text')
                .map((part: any) => (part as any).text)
                .join('\n');
              return { ...msg, content: textParts || '[图片]' } as CoreMessage;
            }
            return msg;
          });
          
          // Reuse runAgentLoop for retry!
          await this.runAgentLoop(sessionId, history, tools, context, channel, chatId, message, abortSignal);
          return;
        } catch (retryError: any) {
          console.error(`[Agent] Retry failed: ${retryError.message}`);
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
