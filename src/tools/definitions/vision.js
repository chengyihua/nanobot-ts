"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createVisionTools = void 0;
const ai_1 = require("ai");
const zod_1 = require("zod");
const fs_extra_1 = __importDefault(require("fs-extra"));
const createVisionTools = (options, checkPath, getModel) => {
    return {
        describeImage: (0, ai_1.tool)({
            description: 'Describe an image file using AI vision capabilities.',
            parameters: zod_1.z.object({
                path: zod_1.z.string().describe('The path to the image file'),
                prompt: zod_1.z.string().default('What is in this image? Describe it in detail.').describe('Specific question or prompt about the image'),
            }),
            execute: async ({ path: imagePath, prompt }) => {
                try {
                    const fullPath = checkPath(imagePath);
                    if (!await fs_extra_1.default.pathExists(fullPath)) {
                        return { error: `File not found: ${imagePath}` };
                    }
                    const model = getModel();
                    if (!model) {
                        return { error: 'LLM model not configured' };
                    }
                    const imageBuffer = await fs_extra_1.default.readFile(fullPath);
                    const base64Image = imageBuffer.toString('base64');
                    const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
                    const { text } = await (0, ai_1.generateText)({
                        model,
                        messages: [
                            {
                                role: 'user',
                                content: [
                                    { type: 'text', text: prompt },
                                    { type: 'image', image: base64Image, mimeType },
                                ],
                            },
                        ],
                    });
                    // Ensure we return a plain object and log the response
                    console.log(`[Tool:describeImage] Vision response length: ${text.length}`);
                    return { description: text };
                }
                catch (error) {
                    return { error: error.message };
                }
            },
        }),
    };
};
exports.createVisionTools = createVisionTools;
