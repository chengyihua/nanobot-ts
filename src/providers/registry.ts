import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { LanguageModelV1 } from 'ai';
import { Config } from '../core/config.js';
import { ProviderSpec } from './types.js';
import nodeFetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

// Helper to determine proxy and create fetch implementation
export const createProxyFetch = (config: Config, options?: { bypassProxy?: boolean }) => {
  // If bypassProxy is requested, we skip proxy detection and just use direct fetch (with logging)
  if (options?.bypassProxy) {
    console.log('[Registry] Proxy bypass requested for this provider.');
    return createLoggingFetch(undefined); // undefined agent = direct connection
  }

  const proxyUrl = process.env.HTTPS_PROXY || 
                   process.env.https_proxy || 
                   process.env.ALL_PROXY || 
                   process.env.all_proxy;
  
  if (proxyUrl) {
    console.log(`[Registry] Using proxy: ${proxyUrl}`);
    const agent = proxyUrl.startsWith('socks') 
      ? new SocksProxyAgent(proxyUrl) 
      : new HttpsProxyAgent(proxyUrl);
      
    return createLoggingFetch(agent);
  }
  
  // No proxy configured
  console.log('[Registry] No proxy configured, using default fetch with wrappers.');
  return createLoggingFetch(undefined);
};

// Internal helper to wrap node-fetch with logging and timeout
const createLoggingFetch = (agent: any) => {
  return async (url: any, init: any) => {
    const requestId = Math.random().toString(36).substring(7);
    const isDirect = !agent;
    console.log(`[Registry:${requestId}] Fetching URL (${isDirect ? 'direct' : 'proxy'}): ${url}`);
    
    try {
      const timeout = init?.timeout || 120000;
      const options = { ...init, agent, timeout };
      
      console.log(`[Registry:${requestId}] calling nodeFetch with timeout ${timeout}ms...`);
      const response = await nodeFetch(url, options);
      console.log(`[Registry:${requestId}] Fetch completed: ${url} (Status: ${response.status})`);
      
      return response;
    } catch (error: any) {
      if (error.name === 'AbortError' || error.type === 'aborted') {
        console.warn(`[Registry:${requestId}] Fetch aborted for ${url}`);
        // Rethrow as is, but ensure it's not treated as a crash
        throw error;
      }
      if (error.type === 'request-timeout' || error.message.includes('timeout')) {
           console.error(`[Registry:${requestId}] Fetch timed out after ${init?.timeout || 120000}ms for ${url}`);
      }
      console.error(`[Registry:${requestId}] Fetch error for ${url}:`, error.message);
      throw error;
    }
  };
};

// Helper to create an OpenAI-compatible provider factory
const createOpenAICompatible = (
  providerName: keyof Config['providers'],
  defaultBaseURL?: string,
  apiKeyEnvVar?: string,
  bypassProxy: boolean = false
) => {
  return (modelId: string, config: Config): LanguageModelV1 => {
    const providerConfig = config.providers[providerName] as any;
    const apiKey = providerConfig?.api_key || (apiKeyEnvVar ? process.env[apiKeyEnvVar] : undefined) || '';
    const baseURL = providerConfig?.api_base || defaultBaseURL;
    
    console.log(`[Registry] Creating ${providerName} provider for model ${modelId}`);
    console.log(`[Registry] Base URL: ${baseURL}`);
    
    // Check if we should bypass proxy (either forced by provider spec, or configured in provider config)
    // We don't have 'bypass_proxy' in config schema yet, so we rely on the argument.
    const fetchImplementation = createProxyFetch(config, { bypassProxy });

    const provider = createOpenAI({
      apiKey,
      baseURL,
      headers: providerConfig?.extra_headers,
      fetch: fetchImplementation as any,
    });

    // Strip prefix if present (e.g. "deepseek:deepseek-chat" -> "deepseek-chat")
    const actualModelId = modelId.includes(':') ? modelId.split(':')[1] : modelId;
    return provider(actualModelId);
  };
};

export const PROVIDERS: ProviderSpec[] = [
  // === Standard Providers ===
  
  // Anthropic
  {
    name: 'anthropic',
    displayName: 'Anthropic',
    keywords: ['anthropic', 'claude'],
    createModel: (modelId: string, config: Config) => {
      const anthropicConfig = config.providers.anthropic;
      const apiKey = anthropicConfig.api_key || process.env.ANTHROPIC_API_KEY || '';
      
      const fetchImplementation = createProxyFetch(config);

      const provider = createAnthropic({
        apiKey,
        headers: anthropicConfig.extra_headers,
        fetch: fetchImplementation as any,
      });
      return provider(modelId);
    }
  },

  // OpenAI
  {
    name: 'openai',
    displayName: 'OpenAI',
    keywords: ['openai', 'gpt'],
    createModel: createOpenAICompatible('openai', undefined, 'OPENAI_API_KEY')
  },

  // DeepSeek
  {
    name: 'deepseek',
    displayName: 'DeepSeek',
    keywords: ['deepseek'],
    createModel: createOpenAICompatible('deepseek', 'https://api.deepseek.com', 'DEEPSEEK_API_KEY', true)
  },

  // Moonshot (Kimi)
  {
    name: 'moonshot',
    displayName: 'Moonshot',
    keywords: ['moonshot', 'kimi'],
    createModel: createOpenAICompatible('moonshot', 'https://api.moonshot.cn/v1', 'MOONSHOT_API_KEY', true)
  },

  // DashScope (Qwen)
  {
    name: 'dashscope',
    displayName: 'DashScope',
    keywords: ['dashscope', 'qwen'],
    createModel: createOpenAICompatible('dashscope', 'https://dashscope.aliyuncs.com/compatible-mode/v1', 'DASHSCOPE_API_KEY', true)
  },

  // Zhipu (GLM)
  {
    name: 'zhipu',
    displayName: 'Zhipu AI',
    keywords: ['zhipu', 'glm', 'zai', 'glm-5'],
    createModel: createOpenAICompatible('zhipu', 'https://open.bigmodel.cn/api/paas/v4', 'ZHIPUAI_API_KEY', true)
  },

  // Groq
  {
    name: 'groq',
    displayName: 'Groq',
    keywords: ['groq', 'llama'],
    createModel: createOpenAICompatible('groq', 'https://api.groq.com/openai/v1', 'GROQ_API_KEY')
  },

  // OpenRouter
  {
    name: 'openrouter',
    displayName: 'OpenRouter',
    keywords: ['openrouter'],
    createModel: createOpenAICompatible('openrouter', 'https://openrouter.ai/api/v1', 'OPENROUTER_API_KEY'),
    isGateway: true
  },

  // AiHubMix
  {
    name: 'aihubmix',
    displayName: 'AiHubMix',
    keywords: ['aihubmix'],
    createModel: createOpenAICompatible('aihubmix', 'https://aihubmix.com/v1', 'OPENAI_API_KEY'),
    isGateway: true
  },

  // Local / vLLM
  {
    name: 'vllm',
    displayName: 'vLLM/Local',
    keywords: ['vllm', 'local'],
    createModel: createOpenAICompatible('vllm', 'http://localhost:8000/v1', 'HOSTED_VLLM_API_KEY'),
    isGateway: true
  }
];

/**
 * Resolve the provider and create the model instance based on modelId and config.
 */
export function createModel(modelId: string, config: Config): LanguageModelV1 {
  const lowId = modelId.toLowerCase();
  
  console.log(`[Registry] Resolving model: ${modelId}`);

  // 1. Explicit Provider Prefix (e.g. "anthropic:claude-3-5-sonnet")
  if (modelId.includes(':')) {
    const providerName = modelId.split(':')[0];
    const spec = PROVIDERS.find(p => p.name === providerName.toLowerCase());
    if (spec) {
      console.log(`[Registry] Using explicit provider: ${spec.displayName} for ${modelId}`);
      return spec.createModel(modelId, config);
    }
  }

  // 2. Keyword Matching (e.g. "claude-3-5-sonnet" -> Anthropic)
  // Skip gateways for keyword matching unless explicitly requested
  const matchedSpec = PROVIDERS.find(p => !p.isGateway && p.keywords.some(k => lowId.includes(k)));
  if (matchedSpec) {
    console.log(`[Registry] Auto-detected provider: ${matchedSpec.displayName} for ${modelId}`);
    return matchedSpec.createModel(modelId, config);
  }

  // 3. Fallback to OpenAI (default behavior)
  console.log(`[Registry] No matching provider found for ${modelId}, falling back to OpenAI.`);
  const openaiSpec = PROVIDERS.find(p => p.name === 'openai');
  if (openaiSpec) {
    // If falling back to OpenAI, we should check if the model ID looks like a DeepSeek/Moonshot/etc model
    // that accidentally fell through. But if it truly falls back, it will use OpenAI's API URL.
    return openaiSpec.createModel(modelId, config);
  }

  throw new Error(`Failed to resolve provider for model: ${modelId}`);
}

/**
 * Check if a model is a vision model (heuristic).
 */
export function isVisionModel(modelId: string): boolean {
  const lowId = modelId.toLowerCase();
  if (lowId.includes('gpt-4o') || lowId.includes('gpt-4-turbo') || lowId.includes('gpt-4-vision')) return true;
  if (lowId.includes('claude-3')) return true;
  if (lowId.includes('gemini-1.5')) return true;
  if (lowId.includes('vision')) return true;
  if (lowId.includes('qwen-vl')) return true;
  return false;
}
