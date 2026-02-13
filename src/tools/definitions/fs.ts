import { tool } from 'ai';
import { z } from 'zod';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { PDFParse } from 'pdf-parse';
import * as XLSX from 'xlsx';
import { ToolOptions } from '../types.js';

const readFileXLSX = (XLSX as any).readFile || (XLSX as any).default?.readFile;
const utilsXLSX = (XLSX as any).utils || (XLSX as any).default?.utils;

export const createFsTools = (options: ToolOptions, checkPath: (p: string) => string) => ({
  readFile: tool({
    description: 'Read a file from the filesystem. Supports text, PDF, and Excel (.xlsx, .xls) files. If the file is very large, it will be truncated. Use readFilePaged for large text files.',
    parameters: z.object({
      path: z.string().describe('The path to the file to read'),
    }),
    execute: async ({ path: filePath }: { path: string }) => {
      try {
        const fullPath = checkPath(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const binaryExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.zip', '.tar', '.gz', '.exe', '.dll', '.so', '.dylib'];
        
        if (binaryExtensions.includes(ext)) {
          return { error: `File ${filePath} is a binary file and cannot be read as text. To see what's in an image, use describeImage. To send it, use SEND_FILE: path/to/file in your final response.` };
        }

        let content = '';
        
        if (ext === '.pdf') {
          const dataBuffer = await fs.readFile(fullPath);
          const parser = new PDFParse({ data: dataBuffer });
          const result = await parser.getText();
          content = result.text;
          await parser.destroy();
        } else if (ext === '.xlsx' || ext === '.xls') {
          if (typeof readFileXLSX !== 'function') {
            throw new Error('XLSX.readFile is not a function. Check module loading.');
          }
          const workbook = readFileXLSX(fullPath);
          const sheetNames = workbook.SheetNames;
          content = sheetNames.map((name: string) => {
            const sheet = workbook.Sheets[name];
            return `## Sheet: ${name}\n${utilsXLSX.sheet_to_csv(sheet)}`;
          }).join('\n\n');
        } else {
          content = await fs.readFile(fullPath, 'utf-8');
        }
        
        const MAX_READ_CHARS = 30000;
        if (content.length > MAX_READ_CHARS) {
          content = content.substring(0, MAX_READ_CHARS) + `\n\n... (content truncated). Total size: ${content.length} chars.`;
        }
        
        return { content, totalChars: content.length };
      } catch (error: any) {
        return { error: error.message };
      }
    },
  }),

  readFilePaged: tool({
    description: 'Read a specific part of a large file using character offset and limit.',
    parameters: z.object({
      path: z.string().describe('The path to the file'),
      offset: z.number().int().min(0).default(0).describe('Character offset to start reading from'),
      limit: z.number().int().min(1).max(20000).default(10000).describe('Number of characters to read'),
    }),
    execute: async ({ path: filePath, offset, limit }: { path: string; offset: number; limit: number }) => {
      try {
        const fullPath = checkPath(filePath);
        
        // Use file descriptor to read only the requested chunk
        const fd = await fs.open(fullPath, 'r');
        try {
          const stat = await fs.fstat(fd);
          const totalChars = stat.size; // This is bytes, not chars, but close enough for text approximation usually
          
          if (offset >= totalChars) {
            return {
              content: '',
              offset,
              limit,
              totalChars,
              hasMore: false
            };
          }

          const buffer = Buffer.alloc(limit);
          const { bytesRead } = await fs.read(fd, buffer, 0, limit, offset);
          const chunk = buffer.toString('utf-8', 0, bytesRead);
          
          return {
            content: chunk,
            offset,
            limit,
            totalChars,
            hasMore: offset + limit < totalChars
          };
        } finally {
          await fs.close(fd);
        }
      } catch (error: any) {
        return { error: error.message };
      }
    },
  }),

  writeFile: tool({
    description: 'Write content to a file. IMPORTANT: If content is over 2000 characters, you MUST use appendFile in multiple steps instead to avoid JSON truncation errors.',
    parameters: z.object({
      path: z.string().describe('The path to the file to write'),
      content: z.string().describe('The content to write'),
    }),
    execute: async ({ path: filePath, content }: { path: string; content: string }) => {
      try {
        const fullPath = checkPath(filePath);
        await fs.ensureDir(path.dirname(fullPath));
        await fs.writeFile(fullPath, content, 'utf-8');
        return { success: true };
      } catch (error: any) {
        return { error: error.message };
      }
    },
  }),

  appendFile: tool({
    description: 'Append content to an existing file or create it if it does not exist.',
    parameters: z.object({
      path: z.string().describe('The path to the file'),
      content: z.string().describe('The content to append'),
    }),
    execute: async ({ path: filePath, content }: { path: string; content: string }) => {
      try {
        const fullPath = checkPath(filePath);
        await fs.ensureDir(path.dirname(fullPath));
        await fs.appendFile(fullPath, content, 'utf-8');
        return { success: true };
      } catch (error: any) {
        return { error: error.message };
      }
    },
  }),

  editFile: tool({
    description: 'Edit a file by replacing old_text with new_text. The old_text must exist exactly in the file.',
    parameters: z.object({
      path: z.string().describe('The file path to edit'),
      old_text: z.string().describe('The exact text to find and replace'),
      new_text: z.string().describe('The text to replace with'),
    }),
    execute: async ({ path: filePath, old_text, new_text }: { path: string; old_text: string; new_text: string }) => {
      try {
        const fullPath = checkPath(filePath);
        if (!(await fs.pathExists(fullPath))) {
          return { error: `File not found: ${filePath}` };
        }
        
        const content = await fs.readFile(fullPath, 'utf-8');
        if (!content.includes(old_text)) {
          return { error: 'old_text not found in file. Make sure it matches exactly.' };
        }

        const count = (content.match(new RegExp(old_text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        if (count > 1) {
          return { error: `old_text appears ${count} times. Please provide more context to make it unique.` };
        }

        const newContent = content.replace(old_text, new_text);
        await fs.writeFile(fullPath, newContent, 'utf-8');
        return { success: true };
      } catch (error: any) {
        return { error: error.message };
      }
    },
  }),

  listDir: tool({
    description: 'List files in a directory',
    parameters: z.object({
      path: z.string().describe('The directory path to list'),
    }),
    execute: async ({ path: dirPath }: { path: string }) => {
      try {
        const fullPath = checkPath(dirPath);
        const files = await fs.readdir(fullPath);
        return { files };
      } catch (error: any) {
        return { error: error.message };
      }
    },
  }),
});
