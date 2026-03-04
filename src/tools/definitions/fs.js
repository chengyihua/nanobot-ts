"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFsTools = void 0;
const ai_1 = require("ai");
const zod_1 = require("zod");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const truncateContent = (content, limit = 30000) => {
    if (content.length <= limit)
        return content;
    const head = content.slice(0, Math.floor(limit * 0.6));
    const tail = content.slice(-Math.floor(limit * 0.3));
    const skipped = content.length - head.length - tail.length;
    return `${head}\n...\n${tail}\n[truncated ${skipped} chars of file content]`;
};
const createFsTools = (options, checkPath) => ({
    readFile: (0, ai_1.tool)({
        description: 'Read a file from the filesystem. Supports text, PDF, and Excel (.xlsx, .xls) files. If the file is very large, it will be truncated. Use readFilePaged for large text files.',
        parameters: zod_1.z.object({
            path: zod_1.z.string().describe('The path to the file to read'),
        }),
        execute: async ({ path: filePath }) => {
            try {
                const fullPath = checkPath(filePath);
                const ext = path_1.default.extname(filePath).toLowerCase();
                const binaryExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.zip', '.tar', '.gz', '.exe', '.dll', '.so', '.dylib'];
                if (binaryExtensions.includes(ext)) {
                    return { error: `File ${filePath} is a binary file and cannot be read as text. To see what's in an image, use describeImage. To send it, use SEND_FILE: path/to/file in your final response.` };
                }
                let content = '';
                if (ext === '.pdf') {
                    const { PDFParse } = await Promise.resolve().then(() => __importStar(require('pdf-parse')));
                    const dataBuffer = await fs_extra_1.default.readFile(fullPath);
                    const parser = new PDFParse({ data: dataBuffer });
                    const result = await parser.getText();
                    content = result.text;
                    await parser.destroy();
                }
                else if (ext === '.xlsx' || ext === '.xls') {
                    const XLSX = await Promise.resolve().then(() => __importStar(require('xlsx')));
                    const readFileXLSX = XLSX.readFile || XLSX.default?.readFile;
                    const utilsXLSX = XLSX.utils || XLSX.default?.utils;
                    if (typeof readFileXLSX !== 'function') {
                        throw new Error('XLSX.readFile is not a function. Check module loading.');
                    }
                    const workbook = readFileXLSX(fullPath);
                    const sheetNames = workbook.SheetNames;
                    content = sheetNames.map((name) => {
                        const sheet = workbook.Sheets[name];
                        return `## Sheet: ${name}\n${utilsXLSX.sheet_to_csv(sheet)}`;
                    }).join('\n\n');
                }
                else {
                    content = await fs_extra_1.default.readFile(fullPath, 'utf-8');
                }
                const truncated = truncateContent(content, 30000);
                return { content: truncated, totalChars: content.length };
            }
            catch (error) {
                return { error: error.message };
            }
        },
    }),
    readFilePaged: (0, ai_1.tool)({
        description: 'Read a specific part of a large file using character offset and limit.',
        parameters: zod_1.z.object({
            path: zod_1.z.string().describe('The path to the file'),
            offset: zod_1.z.number().int().min(0).default(0).describe('Character offset to start reading from'),
            limit: zod_1.z.number().int().min(1).max(20000).default(10000).describe('Number of characters to read'),
        }),
        execute: async ({ path: filePath, offset, limit }) => {
            try {
                const fullPath = checkPath(filePath);
                // Use file descriptor to read only the requested chunk
                const fd = await fs_extra_1.default.open(fullPath, 'r');
                try {
                    const stat = await fs_extra_1.default.fstat(fd);
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
                    const { bytesRead } = await fs_extra_1.default.read(fd, buffer, 0, limit, offset);
                    const chunk = buffer.toString('utf-8', 0, bytesRead);
                    return {
                        content: chunk,
                        offset,
                        limit,
                        totalChars,
                        hasMore: offset + limit < totalChars
                    };
                }
                finally {
                    await fs_extra_1.default.close(fd);
                }
            }
            catch (error) {
                return { error: error.message };
            }
        },
    }),
    writeFile: (0, ai_1.tool)({
        description: 'Write content to a file. IMPORTANT: If content is over 2000 characters, you MUST use appendFile in multiple steps instead to avoid JSON truncation errors.',
        parameters: zod_1.z.object({
            path: zod_1.z.string().describe('The path to the file to write'),
            content: zod_1.z.string().describe('The content to write'),
        }),
        execute: async ({ path: filePath, content }) => {
            try {
                const fullPath = checkPath(filePath);
                await fs_extra_1.default.ensureDir(path_1.default.dirname(fullPath));
                await fs_extra_1.default.writeFile(fullPath, content, 'utf-8');
                return { success: true };
            }
            catch (error) {
                return { error: error.message };
            }
        },
    }),
    appendFile: (0, ai_1.tool)({
        description: 'Append content to an existing file or create it if it does not exist.',
        parameters: zod_1.z.object({
            path: zod_1.z.string().describe('The path to the file'),
            content: zod_1.z.string().describe('The content to append'),
        }),
        execute: async ({ path: filePath, content }) => {
            try {
                const fullPath = checkPath(filePath);
                await fs_extra_1.default.ensureDir(path_1.default.dirname(fullPath));
                await fs_extra_1.default.appendFile(fullPath, content, 'utf-8');
                return { success: true };
            }
            catch (error) {
                return { error: error.message };
            }
        },
    }),
    editFile: (0, ai_1.tool)({
        description: 'Edit a file by replacing old_text with new_text. The old_text must exist exactly in the file.',
        parameters: zod_1.z.object({
            path: zod_1.z.string().describe('The file path to edit'),
            old_text: zod_1.z.string().describe('The exact text to find and replace'),
            new_text: zod_1.z.string().describe('The text to replace with'),
        }),
        execute: async ({ path: filePath, old_text, new_text }) => {
            try {
                const fullPath = checkPath(filePath);
                if (!(await fs_extra_1.default.pathExists(fullPath))) {
                    return { error: `File not found: ${filePath}` };
                }
                const content = await fs_extra_1.default.readFile(fullPath, 'utf-8');
                if (!content.includes(old_text)) {
                    return { error: 'old_text not found in file. Make sure it matches exactly.' };
                }
                const count = (content.match(new RegExp(old_text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
                if (count > 1) {
                    return { error: `old_text appears ${count} times. Please provide more context to make it unique.` };
                }
                const newContent = content.replace(old_text, new_text);
                await fs_extra_1.default.writeFile(fullPath, newContent, 'utf-8');
                return { success: true };
            }
            catch (error) {
                return { error: error.message };
            }
        },
    }),
    listDir: (0, ai_1.tool)({
        description: 'List files in a directory',
        parameters: zod_1.z.object({
            path: zod_1.z.string().describe('The directory path to list'),
        }),
        execute: async ({ path: dirPath }) => {
            try {
                const fullPath = checkPath(dirPath);
                const files = await fs_extra_1.default.readdir(fullPath);
                return { files };
            }
            catch (error) {
                return { error: error.message };
            }
        },
    }),
});
exports.createFsTools = createFsTools;
