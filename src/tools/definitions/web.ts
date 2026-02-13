import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
import TurndownService from 'turndown';
import { JSDOM } from 'jsdom';
import { PDFParse } from 'pdf-parse';
import { ToolOptions } from '../types.js';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537.36';

export const createWebTools = (options: ToolOptions) => {
  const { config } = options;

  return {
    webSearch: tool({
      description: 'Search the web using Brave Search API. Returns titles, URLs, and snippets.',
      parameters: z.object({
        query: z.string().describe('The search query'),
        count: z.number().optional().default(5).describe('Number of results to return (max 10)'),
      }),
      execute: async ({ query, count }: { query: string; count: number }) => {
        try {
          if (!config?.tools?.web?.search?.api_key) {
            return { error: 'Brave Search API key not configured. Please set NANOBOT__TOOLS__WEB__SEARCH__API_KEY in .env' };
          }

          const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
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

          const results = response.data.web?.results?.map((r: any) => ({
            title: r.title,
            url: r.url,
            description: r.description,
          })) || [];

          return { results };
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),

    webFetch: tool({
      description: 'Fetch and extract content from a URL. Supports converting HTML to Markdown and parsing PDFs.',
      parameters: z.object({
        url: z.string().describe('The URL to fetch'),
      }),
      execute: async ({ url }: { url: string }) => {
        try {
          // Special handling for PDFs
          if (url.toLowerCase().endsWith('.pdf')) {
            const response = await axios.get(url, {
              responseType: 'arraybuffer',
              headers: { 'User-Agent': USER_AGENT },
            });
            const dataBuffer = Buffer.from(response.data);
            const parser = new PDFParse({ data: dataBuffer });
            const result = await parser.getText();
            await parser.destroy();
            
            const content = result.text;
            const MAX_CHARS = 30000;
            return {
              url,
              contentType: 'application/pdf',
              content: content.length > MAX_CHARS 
                ? content.substring(0, MAX_CHARS) + `\n\n... (truncated, total: ${content.length})` 
                : content,
              totalChars: content.length
            };
          }

          // HTML handling
          const response = await axios.get(url, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 15000,
          });

          const html = response.data;
          const turndownService = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced',
          });
          
          // Remove scripts and styles
          const dom = new JSDOM(html);
          const doc = dom.window.document;
          doc.querySelectorAll('script, style, nav, footer, iframe, noscript').forEach(el => el.remove());
          
          const markdown = turndownService.turndown(doc.body.innerHTML);
          
          const MAX_CHARS = 30000;
          const content = markdown.length > MAX_CHARS 
            ? markdown.substring(0, MAX_CHARS) + `\n\n... (truncated, total: ${markdown.length})` 
            : markdown;

          return {
            url,
            title: doc.title,
            content,
            totalChars: markdown.length
          };
        } catch (error: any) {
          return { error: `Failed to fetch ${url}: ${error.message}` };
        }
      },
    }),
  };
};
