import { tool } from 'ai';
import { z } from 'zod';
import { ToolOptions } from '../types.js';

export const createMemoryTools = (options: ToolOptions) => {
  const { memoryStore, sessionManager } = options;

  return {
    saveMemory: tool({
      description: 'Save important information to long-term memory.',
      parameters: z.object({
        content: z.string().describe('The information to save'),
        category: z.enum(['fact', 'preference', 'insight', 'task']).describe('Category of the memory'),
        tags: z.array(z.string()).optional().describe('Tags for retrieval'),
      }),
      execute: async ({ content, category, tags }: { content: string; category: string; tags?: string[] }) => {
        if (!memoryStore) {
          return { error: 'Memory store not available' };
        }
        try {
          const tagsStr = tags && tags.length > 0 ? ` ${tags.map(t => `#${t}`).join(' ')}` : '';
          const formattedContent = `[${category.toUpperCase()}] ${content}${tagsStr}`;
          await memoryStore.appendLongTerm(formattedContent);
          return { success: true };
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),

    search_memory: tool({
      description: 'Search long-term memory for information.',
      parameters: z.object({
        query: z.string().describe('Search query'),
        limit: z.number().optional().default(5).describe('Number of results'),
      }),
      execute: async ({ query, limit }: { query: string; limit: number }) => {
        if (!memoryStore) {
          return { error: 'Memory store not available' };
        }
        try {
          const results = await memoryStore.searchMemory(query, limit);
          return { results };
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),

    search_chat_history: tool({
      description: 'Search through all chat history sessions (both active and archived) for past conversations.',
      parameters: z.object({
        query: z.string().describe('The text to search for'),
        limit: z.number().optional().default(10).describe('Max number of matching messages to return'),
      }),
      execute: async ({ query, limit }: { query: string; limit: number }) => {
        if (!sessionManager) {
          return { error: 'Session manager not available' };
        }
        try {
          const results = await sessionManager.searchAllSessions(query, limit);
          return { results };
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),
  };
};
