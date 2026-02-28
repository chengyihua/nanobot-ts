import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';
// heavy deps按需加载以减少冷启动
import { ToolOptions } from '../types.js';

const truncateContent = (content: string, limit = 30000) => {
  if (content.length <= limit) return content;
  const head = content.slice(0, Math.floor(limit * 0.6));
  const tail = content.slice(-Math.floor(limit * 0.3));
  const skipped = content.length - head.length - tail.length;
  return `${head}\n...\n${tail}\n[truncated ${skipped} chars of fetched content]`;
};

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537.36';

export const createWebTools = (options: ToolOptions) => {
  const { config } = options;

  return {
    webSearch: tool({
      description: 'Search the web using Tavily API (preferred), Brave Search API, or DuckDuckGo (fallback).',
      parameters: z.object({
        query: z.string().describe('The search query'),
        count: z.number().optional().default(5).describe('Number of results to return (max 10)'),
      }),
      execute: async ({ query, count }: { query: string; count: number }) => {
        try {
          const maxResults = Math.min(count, 10);
          
          // 1. 优先尝试 Tavily API
          if (config?.tools?.web?.search?.tavily_api_key) {
             try {
               const response = await axios.post('https://api.tavily.com/search', {
                 api_key: config.tools.web.search.tavily_api_key,
                 query: query,
                 search_depth: "basic",
                 include_answer: true,
                 max_results: maxResults
               }, {
                 timeout: 15000
               });

               const results = response.data.results?.map((r: any) => ({
                 title: r.title,
                 url: r.url,
                 description: r.content,
               })) || [];

               const answer = response.data.answer || null;

               if (results.length > 0 || answer) {
                 return {
                   answer,
                   results,
                   source: 'Tavily API',
                   note: 'Using configured Tavily API'
                 };
               }
             } catch (tavilyError: any) {
               console.warn('Tavily Search failed, falling back to Brave/DuckDuckGo:', tavilyError.message);
             }
          }

          // 2. 尝试 Brave Search（如果配置了API密钥）
          if (config?.tools?.web?.search?.api_key && 
              config.tools.web.search.api_key !== 'your_brave_search_api_key_here') {
            try {
              const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
                headers: {
                  'Accept': 'application/json',
                  'Accept-Encoding': 'gzip',
                  'X-Subscription-Token': config.tools.web.search.api_key,
                },
                params: {
                  q: query,
                  count: maxResults,
                },
                timeout: 10000,
              });

              const results = response.data.web?.results?.map((r: any) => ({
                title: r.title,
                url: r.url,
                description: r.description,
              })) || [];

              if (results.length > 0) {
                return { 
                  results,
                  source: 'Brave Search API',
                  note: 'Using configured Brave Search API'
                };
              }
            } catch (braveError: any) {
              console.warn('Brave Search failed, falling back to DuckDuckGo:', braveError.message);
            }
          }
          
          // 使用DuckDuckGo Instant Answer API（免费）
          console.log('Using DuckDuckGo API for search:', query);
          return await searchWithDuckDuckGo(query, maxResults);
          
        } catch (error: any) {
          return { 
            error: `搜索失败: ${error.message}`,
            suggestion: '请尝试使用webFetch工具直接抓取特定网站，或配置Brave Search API密钥'
          };
        }
      },
    }),

    webFetch: tool({
      description: 'Fetch and extract content from a URL. Supports converting HTML to Markdown and parsing PDFs.',
      parameters: z.object({
        url: z.string().describe('The URL to fetch'),
      }),
      execute: async ({ url }: { url: string }) => {
        // 1. 尝试使用 Tavily Extract API (如果配置了Key)
        if (config?.tools?.web?.search?.tavily_api_key) {
           try {
             console.log('[webFetch] Trying Tavily Extract API...');
             const response = await axios.post('https://api.tavily.com/extract', {
               api_key: config.tools.web.search.tavily_api_key,
               urls: [url]
             }, {
               timeout: 20000
             });

             const result = response.data.results?.[0];
             if (result && result.raw_content) {
               const content = truncateContent(result.raw_content, 30000);
               return {
                 url: result.url || url,
                 title: `Extracted via Tavily`,
                 content,
                 totalChars: result.raw_content.length,
                 source: 'Tavily Extract API'
               };
             }
           } catch (tavilyError: any) {
             console.warn('[webFetch] Tavily Extract failed, falling back to next method:', tavilyError.message);
           }
        }

        // 2. 尝试使用 Jina Reader (免费且高质量Markdown)
        try {
          console.log('[webFetch] Trying Jina Reader...');
          // r.jina.ai 可能会有速率限制，作为第二优先级
          const jinaUrl = `https://r.jina.ai/${url}`;
          
          const headers: Record<string, string> = {
            'X-With-Generated-Alt': 'true' // 可选：尝试获取图片描述
          };

          // 如果配置了 Jina API Key，则添加到 Header 中以提升 Rate Limit
          if (config?.tools?.web?.search?.jina_api_key) {
            headers['Authorization'] = `Bearer ${config.tools.web.search.jina_api_key}`;
          }

          const response = await axios.get(jinaUrl, {
            timeout: 15000,
            headers
          });

          if (response.data && typeof response.data === 'string' && response.data.length > 100) {
             const content = truncateContent(response.data, 30000);
             // 尝试从内容中提取标题（通常第一行是标题）
             const firstLine = response.data.split('\n')[0].replace(/^#+\s*/, '').trim();
             return {
               url,
               title: firstLine || 'Jina Reader Extraction',
               content,
               totalChars: response.data.length,
               source: 'Jina Reader API'
             };
          }
        } catch (jinaError: any) {
             console.warn('[webFetch] Jina Reader failed, falling back to local extraction:', jinaError.message);
        }

        // 3. 兜底：本地提取 (原逻辑)
        try {
          console.log('[webFetch] Falling back to local extraction...');
          // Special handling for PDFs
          if (url.toLowerCase().endsWith('.pdf')) {
            // PDF处理逻辑...
            return { error: 'PDF处理功能暂未实现' };
          }

          // HTML handling
          const response = await axios.get(url, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 15000,
          });

          const html = response.data;
          const { JSDOM } = await import('jsdom');
          const TurndownService = (await import('turndown')).default;
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
            totalChars: markdown.length,
            source: 'Local Extraction'
          };
        } catch (error: any) {
          return { error: `Failed to fetch ${url}: ${error.message}` };
        }
      },
    }),
  };
};

// DuckDuckGo搜索实现
async function searchWithDuckDuckGo(query: string, maxResults: number) {
  try {
    // 方法1：使用Instant Answer API
    const response = await axios.get('https://api.duckduckgo.com/', {
      params: {
        q: query,
        format: 'json',
        no_html: 1,
        skip_disambig: 1,
      },
      timeout: 10000,
    });

    const data = response.data;
    const results = [];
    
    // 提取摘要
    if (data.AbstractText) {
      results.push({
        title: data.Heading || '摘要',
        url: data.AbstractURL || '',
        description: data.AbstractText,
      });
    }
    
    // 提取相关主题
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      data.RelatedTopics.slice(0, Math.min(maxResults, 5)).forEach((topic: any) => {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: extractTitle(topic.Text),
            url: topic.FirstURL,
            description: topic.Text,
          });
        }
      });
    }
    
    // 提取搜索结果
    if (data.Results && Array.isArray(data.Results)) {
      data.Results.slice(0, Math.min(maxResults, 5)).forEach((result: any) => {
        results.push({
          title: extractTitle(result.Text),
          url: result.FirstURL,
          description: result.Text,
        });
      });
    }
    
    if (results.length > 0) {
      return {
        results: results.slice(0, maxResults),
        source: 'DuckDuckGo Instant Answer API',
        note: 'Free API, no credit card required'
      };
    }
    
    // 方法2：如果Instant Answer没有结果，尝试HTML页面
    return await searchWithDuckDuckGoHTML(query, maxResults);
    
  } catch (error: any) {
    console.warn('DuckDuckGo API失败，尝试HTML页面:', error.message);
    return await searchWithDuckDuckGoHTML(query, maxResults);
  }
}

// DuckDuckGo HTML页面搜索
async function searchWithDuckDuckGoHTML(query: string, maxResults: number) {
  try {
    const response = await axios.get('https://html.duckduckgo.com/html/', {
      params: { q: query },
      headers: { 'User-Agent': USER_AGENT },
      timeout: 15000,
    });
    
    const html = response.data;
    const results = [];
    
    // 简单解析HTML结果
    const resultBlocks = html.split('<div class="result ').slice(1);
    
    for (const block of resultBlocks) {
      if (results.length >= maxResults) break;
      
      // 提取标题
      const titleMatch = block.match(/<a class="result__url".*?>(.*?)<\/a>/);
      const urlMatch = block.match(/<a class="result__url".*?href="(.*?)"/);
      const descMatch = block.match(/<a class="result__snippet".*?>(.*?)<\/a>/);
      
      if (titleMatch && urlMatch) {
        const title = cleanHtml(titleMatch[1]);
        const url = urlMatch[1];
        const description = descMatch ? cleanHtml(descMatch[1]) : '';
        
        if (title && url) {
          results.push({
            title,
            url,
            description,
          });
        }
      }
    }
    
    return {
      results: results.slice(0, maxResults),
      source: 'DuckDuckGo HTML',
      note: 'Free, no API key required'
    };
  } catch (error: any) {
    return {
      error: `DuckDuckGo搜索失败: ${error.message}`,
      suggestion: '请尝试使用webFetch工具直接抓取特定网站'
    };
  }
}

// 辅助函数：从文本中提取标题
function extractTitle(text: string): string {
  if (!text) return '无标题';
  const parts = text.split(' - ');
  return parts[0] || text.substring(0, 50) + '...';
}

// 辅助函数：清理HTML标签
function cleanHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}