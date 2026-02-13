import { tool } from 'ai';
import { z } from 'zod';
import { ToolOptions } from '../types.js';

export const createAgentTools = (options: ToolOptions) => {
  const { subagentManager } = options;

  return {
    spawnSubagent: tool({
      description: 'Spawn a sub-agent to perform a complex task in parallel. Returns a task ID immediately.',
      parameters: z.object({
        name: z.string().describe('Name of the sub-agent'),
        goal: z.string().describe('The goal/task for the sub-agent'),
        context: z.string().optional().describe('Additional context'),
      }),
      execute: async ({ name, goal, context }: { name: string; goal: string; context?: string }) => {
        if (!subagentManager) {
          return { error: 'Subagent manager not available' };
        }
        
        try {
          const taskId = await subagentManager.spawn(name, goal, context);
          return { success: true, taskId, message: `Subagent ${name} started. Task ID: ${taskId}. Use checkSubagentStatus to monitor progress.` };
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),
  };
};
