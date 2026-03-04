"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCommunicationTools = void 0;
const ai_1 = require("ai");
const zod_1 = require("zod");
const bus_js_1 = require("../../core/bus.js");
const createCommunicationTools = (options) => {
    const { originChannel, originChatId } = options;
    return {
        message: (0, ai_1.tool)({
            description: 'Send a message to a user on a chat channel. Use this when you need to send a message to a specific chat channel or respond to a background task.',
            parameters: zod_1.z.object({
                content: zod_1.z.string().describe('The message content to send'),
                channel: zod_1.z.string().optional().describe('Optional: target channel (e.g., wecom)'),
                chatId: zod_1.z.string().optional().describe('Optional: target chat/user ID'),
            }),
            execute: async ({ content, channel, chatId }) => {
                const targetChannel = channel || originChannel;
                const targetChatId = chatId || originChatId;
                if (!targetChannel) {
                    return { error: 'No channel specified and no default channel available' };
                }
                bus_js_1.bus.publish({
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
exports.createCommunicationTools = createCommunicationTools;
