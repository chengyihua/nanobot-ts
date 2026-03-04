import { Config } from '../config.js';
import { createLogger } from '../../utils/logger.js';

export class ContextManager {
  private config: Config;
  private log = createLogger('context-manager');
  private historyUserLimit: number;
  private historyToolLimit: number;

  constructor(config: Config) {
    this.config = config;
    this.historyUserLimit = Number(this.config.tools?.history_max_user_msgs ?? 12);
    this.historyToolLimit = Number(this.config.tools?.history_max_tool_msgs ?? 12);
  }

  /**
   * Cleans up history by handling orphan tool calls and ensuring correct message pairing.
   * This is crucial for avoiding LLM API errors.
   */
  public sanitizeHistory(history: any[], isFinalForLLM: boolean = false): any[] {
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
          // Check if there is a following tool message
          let hasFollowingTool = false;
          for (let j = i + 1; j < history.length; j++) {
            if (history[j].role === 'tool') {
              hasFollowingTool = true;
              break;
            }
            if (history[j].role === 'assistant' || history[j].role === 'user') {
              // Encountered non-tool message, pairing broken
              break;
            }
          }

          if (hasFollowingTool) {
            result.push(msg);
          } else if (!isFinalForLLM) {
            // If not final for LLM, allow temporary missing tool results
            result.push(msg);
          } else {
            // When sending to LLM, if tool result is missing, we must fill a placeholder
            // to maintain coherence or handle interruption
            
            // Check if this is the last message in history
            const isLastMessage = i === history.length - 1;

            if (isLastMessage) {
              // If it's the last one and we are sending to LLM, the previous turn was interrupted.
              // Fill error result to tell LLM to retry or continue.
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
              // If not last message, it's a gap in history, fill placeholder
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
        // Ensure tool message is preceded by a paired assistant message
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
   * Trims history to limit user messages and tool results, preventing context explosion.
   * Uses "skip" strategy: older messages exceeding quota are dropped, preserving order.
   */
  public trimHistory(history: any[]): any[] {
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
}
