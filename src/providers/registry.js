"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROVIDERS = exports.createProxyFetch = void 0;
exports.createModel = createModel;
exports.isVisionModel = isVisionModel;
const openai_1 = require("@ai-sdk/openai");
const anthropic_1 = require("@ai-sdk/anthropic");
const node_fetch_1 = __importDefault(require("node-fetch"));
const https_proxy_agent_1 = require("https-proxy-agent");
const socks_proxy_agent_1 = require("socks-proxy-agent");
// Helper to determine proxy and create fetch implementation
const createProxyFetch = (config) => {
    const proxyUrl = config.channels?.wecom?.proxy ||
        process.env.HTTPS_PROXY ||
        process.env.https_proxy ||
        process.env.ALL_PROXY ||
        process.env.all_proxy;
    if (proxyUrl) {
        console.log(`[Registry] Using proxy: ${proxyUrl}`);
        const agent = proxyUrl.startsWith('socks')
            ? new socks_proxy_agent_1.SocksProxyAgent(proxyUrl)
            : new https_proxy_agent_1.HttpsProxyAgent(proxyUrl);
        return async (url, init) => {
            const requestId = Math.random().toString(36).substring(7);
            console.log(`[Registry:${requestId}] Fetching URL via proxy: ${url}`);
            // console.log(`[Registry:${requestId}] Headers:`, JSON.stringify(init?.headers));
            try {
                // Set a default timeout of 120s (2 minutes) for slow proxies/models
                const timeout = init?.timeout || 120000;
                const options = { ...init, agent, timeout };
                console.log(`[Registry:${requestId}] calling nodeFetch with timeout ${timeout}ms...`);
                const response = await (0, node_fetch_1.default)(url, options);
                console.log(`[Registry:${requestId}] Fetch completed: ${url} (Status: ${response.status})`);
                // Wrap the response.json() and response.text() to log when body is read
                const originalJson = response.json.bind(response);
                response.json = async () => {
                    console.log(`[Registry:${requestId}] Reading JSON body...`);
                    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Body read timeout')), 60000));
                    const data = await Promise.race([originalJson(), timeoutPromise]);
                    console.log(`[Registry:${requestId}] JSON body read (${JSON.stringify(data).length} chars)`);
                    return data;
                };
                // Also wrap text() just in case
                const originalText = response.text.bind(response);
                response.text = async () => {
                    console.log(`[Registry:${requestId}] Reading text body...`);
                    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Body read timeout')), 60000));
                    const data = await Promise.race([originalText(), timeoutPromise]);
                    console.log(`[Registry:${requestId}] Text body read (${data.length} chars)`);
                    return data;
                };
                return response;
            }
            catch (error) {
                if (error.type === 'request-timeout' || error.message.includes('timeout')) {
                    console.error(`[Registry:${requestId}] Fetch timed out after ${init?.timeout || 120000}ms for ${url}`);
                }
                console.error(`[Registry:${requestId}] Fetch error for ${url}:`, error.message);
                throw error;
            }
        };
    }
    // No proxy configured, but we still want the timeout and logging wrapper!
    // Otherwise default fetch has no timeout and we can't debug body reads.
    console.log('[Registry] No proxy configured, using default fetch with wrappers.');
    return async (url, init) => {
        const requestId = Math.random().toString(36).substring(7);
        console.log(`[Registry:${requestId}] Fetching URL (direct): ${url}`);
        try {
            const timeout = init?.timeout || 120000;
            // const controller = new AbortController();
            // const timeoutId = setTimeout(() => controller.abort(), timeout);
            // const signal = init?.signal ? anySignal([init.signal, controller.signal]) : controller.signal; 
            // Note: node-fetch supports 'timeout' option directly, simpler than AbortController
            const options = { ...init, timeout };
            console.log(`[Registry:${requestId}] calling nodeFetch with timeout ${timeout}ms...`);
            const response = await (0, node_fetch_1.default)(url, options);
            console.log(`[Registry:${requestId}] Fetch completed: ${url} (Status: ${response.status})`);
            const originalJson = response.json.bind(response);
            response.json = async () => {
                console.log(`[Registry:${requestId}] Reading JSON body...`);
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Body read timeout')), 60000));
                const data = await Promise.race([originalJson(), timeoutPromise]);
                console.log(`[Registry:${requestId}] JSON body read (${JSON.stringify(data).length} chars)`);
                return data;
            };
            const originalText = response.text.bind(response);
            response.text = async () => {
                console.log(`[Registry:${requestId}] Reading text body...`);
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Body read timeout')), 60000));
                const data = await Promise.race([originalText(), timeoutPromise]);
                console.log(`[Registry:${requestId}] Text body read (${data.length} chars)`);
                return data;
            };
            return response;
        }
        catch (error) {
            if (error.type === 'request-timeout' || error.message.includes('timeout')) {
                console.error(`[Registry:${requestId}] Fetch timed out after ${init?.timeout || 120000}ms for ${url}`);
            }
            console.error(`[Registry:${requestId}] Fetch error for ${url}:`, error.message);
            throw error;
        }
    };
};
exports.createProxyFetch = createProxyFetch;
// Helper to create an OpenAI-compatible provider factory
const createOpenAICompatible = (providerName, defaultBaseURL, apiKeyEnvVar) => {
    return (modelId, config) => {
        const providerConfig = config.providers[providerName];
        const apiKey = providerConfig?.api_key || (apiKeyEnvVar ? process.env[apiKeyEnvVar] : undefined) || '';
        const baseURL = providerConfig?.api_base || defaultBaseURL;
        const fetchImplementation = (0, exports.createProxyFetch)(config);
        const provider = (0, openai_1.createOpenAI)({
            apiKey,
            baseURL,
            headers: providerConfig?.extra_headers,
            fetch: fetchImplementation,
        });
        // Strip prefix if present (e.g. "deepseek:deepseek-chat" -> "deepseek-chat")
        const actualModelId = modelId.includes(':') ? modelId.split(':')[1] : modelId;
        return provider(actualModelId);
    };
};
exports.PROVIDERS = [
    // === Standard Providers ===
    // Anthropic
    {
        name: 'anthropic',
        displayName: 'Anthropic',
        keywords: ['anthropic', 'claude'],
        createModel: (modelId, config) => {
            const anthropicConfig = config.providers.anthropic;
            const apiKey = anthropicConfig.api_key || process.env.ANTHROPIC_API_KEY || '';
            const fetchImplementation = (0, exports.createProxyFetch)(config);
            const provider = (0, anthropic_1.createAnthropic)({
                apiKey,
                headers: anthropicConfig.extra_headers,
                fetch: fetchImplementation,
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
function createModel(modelId, config) {
    const lowId = modelId.toLowerCase();
    // 1. Explicit Provider Prefix (e.g. "anthropic:claude-3-5-sonnet")
    if (modelId.includes(':')) {
        const providerName = modelId.split(':')[0];
        const spec = exports.PROVIDERS.find(p => p.name === providerName.toLowerCase());
        if (spec) {
            console.log(`[Registry] Using explicit provider: ${spec.displayName} for ${modelId}`);
            return spec.createModel(modelId, config);
        }
    }
    // 2. Keyword Matching (e.g. "claude-3-5-sonnet" -> Anthropic)
    // Skip gateways for keyword matching unless explicitly requested
    const matchedSpec = exports.PROVIDERS.find(p => !p.isGateway && p.keywords.some(k => lowId.includes(k)));
    if (matchedSpec) {
        console.log(`[Registry] Auto-detected provider: ${matchedSpec.displayName} for ${modelId}`);
        return matchedSpec.createModel(modelId, config);
    }
    // 3. Fallback to OpenAI (default behavior)
    console.log(`[Registry] No matching provider found for ${modelId}, falling back to OpenAI.`);
    const openaiSpec = exports.PROVIDERS.find(p => p.name === 'openai');
    if (openaiSpec) {
        return openaiSpec.createModel(modelId, config);
    }
    throw new Error(`Failed to resolve provider for model: ${modelId}`);
}
/**
 * Check if a model is a vision model (heuristic).
 */
function isVisionModel(modelId) {
    const lowId = modelId.toLowerCase();
    if (lowId.includes('gpt-4o') || lowId.includes('gpt-4-turbo') || lowId.includes('gpt-4-vision'))
        return true;
    if (lowId.includes('claude-3'))
        return true;
    if (lowId.includes('gemini-1.5'))
        return true;
    if (lowId.includes('vision'))
        return true;
    if (lowId.includes('qwen-vl'))
        return true;
    return false;
}
