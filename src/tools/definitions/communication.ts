import { tool } from 'ai';
import { z } from 'zod';
import { bus } from '../../core/bus.js';
import { ToolOptions } from '../types.js';

export const createCommunicationTools = (options: ToolOptions) => {
  const { originChannel, originChatId } = options;

  return {
    message: tool({
      description: 'Send a message to a user on a chat channel. Use this when you need to send a message to a specific chat channel or respond to a background task.',
      parameters: z.object({
        content: z.string().describe('The message content to send'),
        channel: z.string().optional().describe('Optional: target channel (e.g., wecom)'),
        chatId: z.string().optional().describe('Optional: target chat/user ID'),
      }),
      execute: async ({ content, channel, chatId }: { content: string; channel?: string; chatId?: string }) => {
        const targetChannel = channel || originChannel;
        const targetChatId = chatId || originChatId;

        if (!targetChannel) {
          return { error: 'No channel specified and no default channel available' };
        }

        bus.publish({
          id: Math.random().toString(36).substring(7),
          source: 'agent',
          target: targetChannel,
          content,
          type: 'text',
          timestamp: Date.now(),
          metadata: {
            sessionId: `${targetChannel}:${targetChatId}`,
            to: targetChatId,
          },
        });

        return { success: true, status: `Message sent to ${targetChannel}:${targetChatId}` };
      },
    }),
  };
};
