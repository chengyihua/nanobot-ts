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
exports.createWebTools = void 0;
const ai_1 = require("ai");
const zod_1 = require("zod");
const axios_1 = __importDefault(require("axios"));
const truncateContent = (content, limit = 30000) => {
    if (content.length <= limit)
        return content;
    const head = content.slice(0, Math.floor(limit * 0.6));
    const tail = content.slice(-Math.floor(limit * 0.3));
    const skipped = content.length - head.length - tail.length;
    return `${head}\n...\n${tail}\n[truncated ${skipped} chars of fetched content]`;
};
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537.36';
const createWebTools = (options) => {
    const { config } = options;
    return {
        webSearch: (0, ai_1.tool)({
            description: 'Search the web using Brave Search API. Returns titles, URLs, and snippets.',
            parameters: zod_1.z.object({
                query: zod_1.z.string().describe('The search query'),
                count: zod_1.z.number().optional().default(5).describe('Number of results to return (max 10)'),
            }),
            execute: async ({ query, count }) => {
                try {
                    if (!config?.tools?.web?.search?.api_key) {
                        return { error: 'Brave Search API key not configured. Please set NANOBOT__TOOLS__WEB__SEARCH__API_KEY in .env' };
                    }
                    const response = await axios_1.default.get('https://api.search.brave.com/res/v1/web/search', {
                        headers: {
                            'Accept': 'application/json',
                            'Accept-Encoding': 'gzip',
                            'X-Subscription-Token': config.tools.web.search.api_key,
                        },
                        params: {
                            q: query,
                            count: Math.min(count, 10),
                        },
                    });
                    const results = response.data.web?.results?.map((r) => ({
                        title: r.title,
                        url: r.url,
                        description: r.description,
                    })) || [];
                    return { results };
                }
                catch (error) {
                    return { error: error.message };
                }
            },
        }),
        webFetch: (0, ai_1.tool)({
            description: 'Fetch and extract content from a URL. Supports converting HTML to Markdown and parsing PDFs.',
            parameters: zod_1.z.object({
                url: zod_1.z.string().describe('The URL to fetch'),
            }),
            execute: async ({ url }) => {
                try {
                    // Special handling for PDFs
                    if (url.toLowerCase().endsWith('.pdf')) {
                        const response = await axios_1.default.get(url, {
                            responseType: 'arraybuffer',
                            headers: { 'User-Agent': USER_AGENT },
                        });
                        const dataBuffer = Buffer.from(response.data);
                        const { PDFParse } = await Promise.resolve().then(() => __importStar(require('pdf-parse')));
                        const parser = new PDFParse({ data: dataBuffer });
                        const result = await parser.getText();
                        await parser.destroy();
                        const content = result.text;
                        return {
                            url,
                            contentType: 'application/pdf',
                            content: truncateContent(content, 30000),
                            totalChars: content.length
                        };
                    }
                    // HTML handling
                    const response = await axios_1.default.get(url, {
                        headers: { 'User-Agent': USER_AGENT },
                        timeout: 15000,
                    });
                    const html = response.data;
                    const { JSDOM } = await Promise.resolve().then(() => __importStar(require('jsdom')));
                    const TurndownService = (await Promise.resolve().then(() => __importStar(require('turndown')))).default;
                    const turndownService = new TurndownService({
                        headingStyle: 'atx',
                        codeBlockStyle: 'fenced',
                    });
                    // Remove scripts and styles
                    const dom = new JSDOM(html);
                    const doc = dom.window.document;
                    doc.querySelectorAll('script, style, nav, footer, iframe, noscript').forEach(el => el.remove());
                    const markdown = turndownService.turndown(doc.body.innerHTML);
                    const content = truncateContent(markdown, 30000);
                    return {
                        url,
                        title: doc.title,
                        content,
                        totalChars: markdown.length
                    };
                }
                catch (error) {
                    return { error: `Failed to fetch ${url}: ${error.message}` };
                }
            },
        }),
    };
};
exports.createWebTools = createWebTools;
