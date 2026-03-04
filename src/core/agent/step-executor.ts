import { Config } from '../config.js';
import { createLogger } from '../../utils/logger.js';

export class StepExecutor {
  private config: Config;
  private log = createLogger('step-executor');
  private toolConcurrency: number;
  private toolResultLimit: number;

  constructor(config: Config) {
    this.config = config;
    this.toolConcurrency = Number(this.config.tools?.tool_concurrency ?? 3);
    this.toolResultLimit = Number(this.config.tools?.tool_result_maxchars ?? 4000);
  }

  /**
   * Executes a batch of tool calls with concurrency control and result truncation.
   */
  public async executeTools(
    toolCalls: any[],
    tools: any,
    currentHistory: any[],
    abortSignal?: AbortSignal,
    sessionId?: string,
    requestId?: string
  ): Promise<{ results: any[], missing: any[] }> {
    const toolResults: any[] = [];
    const missing: any[] = [];
    
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
          // Add to missing list instead of returning a result immediately? 
          // Original logic was not shown completely but likely handled missing tools.
          // Based on typical pattern, we return a "Tool not found" error result to LLM
          return {
            type: 'tool-result',
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            result: `Error: Tool '${toolCall.toolName}' not found`,
            isError: true,
          };
        }
      });

      const results = await Promise.all(batchPromises);
      for (const res of results) {
        if (res) toolResults.push(res);
      }
    }

    return { results: toolResults, missing };
  }

  /**
   * Truncates tool output to avoid context overflow.
   */
  private truncateToolResult(result: any): any {
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
      // 1) If standard output fields exist, prioritize summarizing them
      const keys = Object.keys(result);
      const outputKey = keys.find(k => ['stdout', 'content', 'output', 'text'].includes(k));
      if (outputKey && typeof (result as any)[outputKey] === 'string') {
        const copy = { ...result };
        copy[outputKey] = truncateString((result as any)[outputKey]);
        return copy;
      }
      // 2) Default field-by-field truncation
      const copy: any = Array.isArray(result) ? [] : { ...result };
      for (const key of keys) {
        const val = (result as any)[key];
        copy[key] = typeof val === 'string' ? truncateString(val) : val;
      }
      return copy;
    }

    return result;
  }
}
