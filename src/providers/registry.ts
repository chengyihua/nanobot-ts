import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { LanguageModelV1 } from 'ai';
import { Config } from '../core/config.js';
import { ProviderSpec } from './types.js';

// Helper to create an OpenAI-compatible provider factory
const createOpenAICompatible = (
  providerName: keyof Config['providers'],
  defaultBaseURL?: string,
  apiKeyEnvVar?: string
) => {
  return (modelId: string, config: Config): LanguageModelV1 => {
    const providerConfig = config.providers[providerName] as any;
    const apiKey = providerConfig?.api_key || (apiKeyEnvVar ? process.env[apiKeyEnvVar] : undefined) || '';
    const baseURL = providerConfig?.api_base || defaultBaseURL;
    
    const provider = createOpenAI({
      apiKey,
      baseURL,
      headers: providerConfig?.extra_headers,
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
      
      const provider = createAnthropic({
        apiKey,
        headers: anthropicConfig.extra_headers,
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
    createModel: createOpenAICompatible('deepseek', 'https://api.deepseek.com', 'DEEPSEEK_API_KEY')
  },

  // Moonshot (Kimi)
  {
    name: 'moonshot',
    displayName: 'Moonshot',
    keywords: ['moonshot', 'kimi'],
    createModel: createOpenAICompatible('moonshot', 'https://api.moonshot.cn/v1', 'MOONSHOT_API_KEY')
  },

  // DashScope (Qwen)
  {
    name: 'dashscope',
    displayName: 'DashScope',
    keywords: ['dashscope', 'qwen'],
    createModel: createOpenAICompatible('dashscope', 'https://dashscope.aliyuncs.com/compatible-mode/v1', 'DASHSCOPE_API_KEY')
  },

  // Zhipu (GLM)
  {
    name: 'zhipu',
    displayName: 'Zhipu AI',
    keywords: ['zhipu', 'glm', 'zai'],
    createModel: createOpenAICompatible('zhipu', 'https://open.bigmodel.cn/api/paas/v4', 'ZHIPUAI_API_KEY')
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

  // 1. Explicit Provider Prefix (e.g. "anthropic:claude-3-5-sonnet")
  if (modelId.includes(':')) {
    const [providerName, ...rest] = modelId.split(':');
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
