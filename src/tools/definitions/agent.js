"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAgentTools = void 0;
const ai_1 = require("ai");
const zod_1 = require("zod");
const createAgentTools = (options) => {
    const { subagentManager, originChannel, originChatId } = options;
    return {
        spawnSubagent: (0, ai_1.tool)({
            description: 'Spawn a sub-agent to perform a complex task in parallel. Returns a task ID immediately.',
            parameters: zod_1.z.object({
                name: zod_1.z.string().describe('Name of the sub-agent'),
                goal: zod_1.z.string().describe('The goal/task for the sub-agent'),
                context: zod_1.z.string().optional().describe('Additional context'),
            }),
            execute: async ({ name, goal, context }) => {
                if (!subagentManager) {
                    return { error: 'Subagent manager not available' };
                }
                try {
                    const fullTask = context ? `${goal}\n\nContext: ${context}` : goal;
                    const channel = originChannel || 'cli';
                    const chatId = originChatId || 'direct';
                    const taskId = await subagentManager.spawn(fullTask, name, channel, chatId);
                    return { success: true, taskId, message: `Subagent ${name} started. Task ID: ${taskId}. Use checkSubagentStatus to monitor progress.` };
                }
                catch (error) {
                    return { error: error.message };
                }
            },
        }),
    };
};
exports.createAgentTools = createAgentTools;
