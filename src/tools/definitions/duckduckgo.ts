import { tool } from 'ai';
import { z } from 'zod';
import axios from 'axios';

/**
 * DuckDuckGo Instant Answer API 工具
 * 完全免费，无需API密钥，无需信用卡
 */
export const createDuckDuckGoTools = () => {
  return {
    duckduckgoSearch: tool({
      description: 'Search the web using DuckDuckGo Instant Answer API. Free, no API key required.',
      parameters: z.object({
        query: z.string().describe('The search query'),
        count: z.number().optional().default(5).describe('Number of results to return (max 10)'),
      }),
      execute: async ({ query, count }: { query: string; count: number }) => {
        try {
          // DuckDuckGo Instant Answer API
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
          
          // 提取相关信息
          const results = [];
          
          // 1. 摘要信息
          if (data.AbstractText) {
            results.push({
              title: data.Heading || '摘要',
              url: data.AbstractURL || '',
              description: data.AbstractText,
              type: 'abstract',
            });
          }
          
          // 2. 相关主题
          if (data.RelatedTopics && data.RelatedTopics.length > 0) {
            data.RelatedTopics.slice(0, Math.min(count, 5)).forEach((topic: any) => {
              if (topic.Text && topic.FirstURL) {
                results.push({
                  title: topic.Text.split(' - ')[0] || '相关主题',
                  url: topic.FirstURL,
                  description: topic.Text,
                  type: 'related_topic',
                });
              }
            });
          }
          
          // 3. 搜索结果
          if (data.Results && data.Results.length > 0) {
            data.Results.slice(0, Math.min(count, 5)).forEach((result: any) => {
              results.push({
                title: result.Text.split(' - ')[0] || '搜索结果',
                url: result.FirstURL,
                description: result.Text,
                type: 'web_result',
              });
            });
          }
          
          // 如果没有结果，尝试使用HTML抓取
          if (results.length === 0) {
            // 备用方案：使用DuckDuckGo HTML页面
            const htmlResponse = await axios.get('https://html.duckduckgo.com/html/', {
              params: { q: query },
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537.36',
              },
              timeout: 15000,
            });
            
            // 简单解析HTML结果
            const html = htmlResponse.data;
            const titleMatches = html.match(/<a class="result__url".*?>(.*?)<\/a>/g) || [];
            const urlMatches = html.match(/<a class="result__url".*?href="(.*?)"/g) || [];
            const descMatches = html.match(/<a class="result__snippet".*?>(.*?)<\/a>/g) || [];
            
            for (let i = 0; i < Math.min(titleMatches.length, count); i++) {
              const title = titleMatches[i]?.replace(/<[^>]*>/g, '').trim() || `结果 ${i+1}`;
              const url = urlMatches[i]?.match(/href="(.*?)"/)?.[1] || '';
              const description = descMatches[i]?.replace(/<[^>]*>/g, '').trim() || '';
              
              if (title && url) {
                results.push({
                  title,
                  url,
                  description,
                  type: 'html_result',
                });
              }
            }
          }
          
          return { 
            results: results.slice(0, count),
            source: 'DuckDuckGo Instant Answer API',
            isFree: true,
            totalResults: results.length
          };
        } catch (error: any) {
          return { 
            error: `DuckDuckGo搜索失败: ${error.message}`,
            fallback: '建议使用webFetch工具直接抓取特定网站'
          };
        }
      },
    }),
  };
};