import { tool, generateText } from 'ai';
import { z } from 'zod';
import fs from 'fs-extra';
import { ToolOptions } from '../types.js';

export const createVisionTools = (
  options: ToolOptions, 
  checkPath: (p: string) => string,
  getModel: () => any
) => {
  return {
    describeImage: tool({
      description: 'Describe an image file using AI vision capabilities.',
      parameters: z.object({
        path: z.string().describe('The path to the image file'),
        prompt: z.string().default('What is in this image? Describe it in detail.').describe('Specific question or prompt about the image'),
      }),
      execute: async ({ path: imagePath, prompt }: { path: string; prompt: string }) => {
        try {
          const fullPath = checkPath(imagePath);
          if (!await fs.pathExists(fullPath)) {
            return { error: `File not found: ${imagePath}` };
          }
          const model = getModel();
          if (!model) {
            return { error: 'LLM model not configured' };
          }

          const imageBuffer = await fs.readFile(fullPath);
          const base64Image = imageBuffer.toString('base64');
          const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

          const { text } = await generateText({
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
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),
  };
};
