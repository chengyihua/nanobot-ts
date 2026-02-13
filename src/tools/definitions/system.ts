import { tool } from 'ai';
import { z } from 'zod';
import { execa } from 'execa';
import { ToolOptions } from '../types.js';

export const createSystemTools = (options: ToolOptions, checkPath: (p: string) => string) => {
  const { cronService } = options;

  return {
    runCommand: tool({
      description: 'Run a shell command',
      parameters: z.object({
        command: z.string().describe('The command to execute'),
        cwd: z.string().optional().describe('Optional: working directory for the command'),
      }),
      execute: async ({ command, cwd }: { command: string; cwd?: string }, { abortSignal }: any = {}) => {
        try {
          const targetCwd = cwd ? checkPath(cwd) : process.cwd();
          const { stdout, stderr } = await execa(command, { 
            shell: true,
            cwd: targetCwd,
            signal: abortSignal
          });
          let out = stdout;
          let err = stderr;
          const MAX_EXEC_CHARS = 30000;
          if (out.length > MAX_EXEC_CHARS) {
            out = out.substring(0, MAX_EXEC_CHARS) + '\n\n... (stdout truncated)';
          }
          if (err.length > MAX_EXEC_CHARS) {
            err = err.substring(0, MAX_EXEC_CHARS) + '\n\n... (stderr truncated)';
          }

          return { stdout: out, stderr: err };
        } catch (error: any) {
          return {
            error: error.message,
            stdout: error.stdout?.substring(0, 5000),
            stderr: error.stderr?.substring(0, 5000),
          };
        }
      },
    }),

    cron: tool({
      description: 'Manage scheduled tasks (cron jobs).',
      parameters: z.object({
        action: z.enum(['list', 'add', 'remove']).describe('Action to perform'),
        schedule: z.string().optional().describe('Cron schedule (e.g. "* * * * *") for "add" action'),
        command: z.string().optional().describe('Command/Task description for "add" action'),
        id: z.string().optional().describe('Job ID for "remove" action'),
      }),
      execute: async ({ action, schedule, command, id }: { action: string; schedule?: string; command?: string; id?: string }) => {
        if (!cronService) {
          return { error: 'Cron service not available' };
        }

        try {
          if (action === 'list') {
            const jobs = cronService.listJobs();
            return { jobs };
          } else if (action === 'add') {
            if (!schedule || !command) {
              return { error: 'Schedule and command are required for "add" action' };
            }
            const job = await cronService.addJob({
              name: command.slice(0, 50),
              schedule: { kind: 'cron', expr: schedule, tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
              message: command
            });
            return { success: true, id: job.id };
          } else if (action === 'remove') {
            if (!id) {
              return { error: 'ID is required for "remove" action' };
            }
            const success = cronService.removeJob(id);
            return { success };
          }
          return { error: 'Invalid action' };
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),
  };
};
