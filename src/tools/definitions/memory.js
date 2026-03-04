"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMemoryTools = void 0;
const ai_1 = require("ai");
const zod_1 = require("zod");
const createMemoryTools = (options) => {
    const { memoryStore, sessionManager } = options;
    return {
        saveMemory: (0, ai_1.tool)({
            description: 'Save important information to long-term memory.',
            parameters: zod_1.z.object({
                content: zod_1.z.string().describe('The information to save'),
                category: zod_1.z.enum(['fact', 'preference', 'insight', 'task']).describe('Category of the memory'),
                tags: zod_1.z.array(zod_1.z.string()).optional().describe('Tags for retrieval'),
            }),
            execute: async ({ content, category, tags }) => {
                if (!memoryStore) {
                    return { error: 'Memory store not available' };
                }
                try {
                    const tagsStr = tags && tags.length > 0 ? ` ${tags.map(t => `#${t}`).join(' ')}` : '';
                    const formattedContent = `[${category.toUpperCase()}] ${content}${tagsStr}`;
                    await memoryStore.appendLongTerm(formattedContent);
                    return { success: true };
                }
                catch (error) {
                    return { error: error.message };
                }
            },
        }),
        search_memory: (0, ai_1.tool)({
            description: 'Search long-term memory for information.',
            parameters: zod_1.z.object({
                query: zod_1.z.string().describe('Search query'),
                limit: zod_1.z.number().optional().default(5).describe('Number of results'),
            }),
            execute: async ({ query, limit }) => {
                if (!memoryStore) {
                    return { error: 'Memory store not available' };
                }
                try {
                    const results = await memoryStore.searchMemory(query, limit);
                    return { results };
                }
                catch (error) {
                    return { error: error.message };
                }
            },
        }),
        search_chat_history: (0, ai_1.tool)({
            description: 'Search through all chat history sessions (both active and archived) for past conversations.',
            parameters: zod_1.z.object({
                query: zod_1.z.string().describe('The text to search for'),
                limit: zod_1.z.number().optional().default(10).describe('Max number of matching messages to return'),
            }),
            execute: async ({ query, limit }) => {
                if (!sessionManager) {
                    return { error: 'Session manager not available' };
                }
                try {
                    const results = await sessionManager.searchAllSessions(query, limit);
                    return { results };
                }
                catch (error) {
                    return { error: error.message };
                }
            },
        }),
    };
};
exports.createMemoryTools = createMemoryTools;
