"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSystemTools = void 0;
const ai_1 = require("ai");
const zod_1 = require("zod");
const execa_1 = require("execa");
const createSystemTools = (options, checkPath) => {
    const { cronService } = options;
    return {
        runCommand: (0, ai_1.tool)({
            description: 'Run a shell command',
            parameters: zod_1.z.object({
                command: zod_1.z.string().describe('The command to execute'),
                cwd: zod_1.z.string().optional().describe('Optional: working directory for the command'),
            }),
            execute: async ({ command, cwd }, { abortSignal } = {}) => {
                const danger = isDangerousCommand(command);
                if (danger) {
                    return { error: `Command blocked for safety: ${danger}` };
                }
                try {
                    const targetCwd = cwd ? checkPath(cwd) : process.cwd();
                    const { stdout, stderr } = await (0, execa_1.execa)(command, {
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
                }
                catch (error) {
                    return {
                        error: error.message,
                        stdout: error.stdout?.substring(0, 5000),
                        stderr: error.stderr?.substring(0, 5000),
                    };
                }
            },
        }),
        cron: (0, ai_1.tool)({
            description: 'Manage scheduled tasks (cron jobs).',
            parameters: zod_1.z.object({
                action: zod_1.z.enum(['list', 'add', 'remove']).describe('Action to perform'),
                schedule: zod_1.z.string().optional().describe('Cron schedule (e.g. "* * * * *") for "add" action'),
                command: zod_1.z.string().optional().describe('Command/Task description for "add" action'),
                id: zod_1.z.string().optional().describe('Job ID for "remove" action'),
            }),
            execute: async ({ action, schedule, command, id }) => {
                if (!cronService) {
                    return { error: 'Cron service not available' };
                }
                try {
                    if (action === 'list') {
                        const jobs = cronService.listJobs();
                        return { jobs };
                    }
                    else if (action === 'add') {
                        if (!schedule || !command) {
                            return { error: 'Schedule and command are required for "add" action' };
                        }
                        const job = await cronService.addJob({
                            name: command.slice(0, 50),
                            schedule: { kind: 'cron', expr: schedule, tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
                            message: command
                        });
                        return { success: true, id: job.id };
                    }
                    else if (action === 'remove') {
                        if (!id) {
                            return { error: 'ID is required for "remove" action' };
                        }
                        const success = cronService.removeJob(id);
                        return { success };
                    }
                    return { error: 'Invalid action' };
                }
                catch (error) {
                    return { error: error.message };
                }
            },
        }),
    };
};
exports.createSystemTools = createSystemTools;
function isDangerousCommand(cmd) {
    const normalized = cmd.trim().toLowerCase();
    const patterns = [
        { re: /\brm\s+-rf\s+\/\b/, reason: 'rm -rf / is destructive' },
        { re: /\brm\s+-rf\s+--no-preserve-root\b/, reason: 'rm -rf --no-preserve-root is destructive' },
        { re: /\brm\s+-rf\s+\*\b/, reason: 'rm -rf * is destructive' },
        { re: /:?\(\)\s*{\s*:\s*\|\s*:\s*;\s*}\s*;/, reason: 'fork bomb detected' },
        { re: /\bmkfs\w*\b/, reason: 'filesystem formatting command' },
        { re: /\bdd\b.*\bof=\/dev\/sd/, reason: 'raw disk write detected' },
        { re: /\bshutdown\b|\breboot\b|\bpoweroff\b/, reason: 'system shutdown/reboot' },
    ];
    for (const { re, reason } of patterns) {
        if (re.test(normalized))
            return reason;
    }
    return null;
}
