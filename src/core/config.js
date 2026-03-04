"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigSchema = exports.BehaviorConfigSchema = exports.ToolsConfigSchema = exports.HousekeepingConfigSchema = exports.HeartbeatConfigSchema = exports.ExecToolConfigSchema = exports.WebToolsConfigSchema = exports.WebSearchConfigSchema = exports.RedisConfigSchema = exports.GatewayConfigSchema = exports.ProvidersConfigSchema = exports.BaiduConfigSchema = exports.ProviderConfigSchema = exports.AgentsConfigSchema = exports.AgentDefaultsSchema = exports.ChannelsConfigSchema = exports.WeChatiPadConfigSchema = exports.QQConfigSchema = exports.WeComConfigSchema = exports.EmailConfigSchema = exports.DiscordConfigSchema = exports.DingTalkConfigSchema = exports.FeishuConfigSchema = exports.TelegramConfigSchema = exports.QQOfficialConfigSchema = exports.WhatsAppConfigSchema = exports.DEFAULT_CONFIG_PATH = exports.DEFAULT_CONFIG_DIR = exports.PROJECT_ROOT = void 0;
exports.saveConfig = saveConfig;
exports.loadConfig = loadConfig;
exports.getWorkspacePath = getWorkspacePath;
exports.getCronStorePath = getCronStorePath;
const zod_1 = require("zod");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const url_1 = require("url");
const __filename = (0, url_1.fileURLToPath)(import.meta.url);
const __dirname = path_1.default.dirname(__filename);
// Define Project Root (Works for both src/ and dist/)
exports.PROJECT_ROOT = path_1.default.resolve(__dirname, '../../');
// Default configuration values
exports.DEFAULT_CONFIG_DIR = path_1.default.join(exports.PROJECT_ROOT, '.nanobot');
exports.DEFAULT_CONFIG_PATH = path_1.default.join(exports.DEFAULT_CONFIG_DIR, 'config.json');
async function saveConfig(config, configPath = exports.DEFAULT_CONFIG_PATH) {
    await fs_extra_1.default.ensureDir(path_1.default.dirname(configPath));
    await fs_extra_1.default.writeJson(configPath, config, { spaces: 2 });
}
// WhatsApp (Not implemented for now, but kept for schema compatibility)
exports.WhatsAppConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().default(false),
    bridge_url: zod_1.z.string().default('ws://localhost:3001'),
    allow_from: zod_1.z.array(zod_1.z.string()).default([]),
});
// QQ Official
exports.QQOfficialConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().default(false),
    appid: zod_1.z.string().default(''),
    token: zod_1.z.string().default(''),
    secret: zod_1.z.string().default(''),
    sandbox: zod_1.z.boolean().default(false),
    intents: zod_1.z.array(zod_1.z.string()).default([
        'GUILD_MESSAGES',
        'DIRECT_MESSAGE',
        'GROUP_AT_MESSAGE_CREATE',
        'C2C_MESSAGE_CREATE'
    ]),
    webhook: zod_1.z.object({
        enabled: zod_1.z.boolean().default(false),
        port: zod_1.z.number().default(8080),
        path: zod_1.z.string().default('/qq-official-webhook'),
    }).default({}),
});
// Telegram
exports.TelegramConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().default(false),
    token: zod_1.z.string().default(''),
    allow_from: zod_1.z.array(zod_1.z.string()).default([]),
    proxy: zod_1.z.string().optional(),
});
// Feishu/Lark
exports.FeishuConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().default(false),
    app_id: zod_1.z.string().default(''),
    app_secret: zod_1.z.string().default(''),
    encrypt_key: zod_1.z.string().default(''),
    verification_token: zod_1.z.string().default(''),
    allow_from: zod_1.z.array(zod_1.z.string()).default([]),
});
// DingTalk
exports.DingTalkConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().default(false),
    client_id: zod_1.z.string().default(''),
    client_secret: zod_1.z.string().default(''),
    allow_from: zod_1.z.array(zod_1.z.string()).default([]),
});
// Discord
exports.DiscordConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().default(false),
    token: zod_1.z.string().default(''),
    allow_from: zod_1.z.array(zod_1.z.string()).default([]),
    gateway_url: zod_1.z.string().default('wss://gateway.discord.gg/?v=10&encoding=json'),
    intents: zod_1.z.number().default(37377),
});
// Email
exports.EmailConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().default(false),
    consent_granted: zod_1.z.boolean().default(false),
    imap_host: zod_1.z.string().default(''),
    imap_port: zod_1.z.number().default(993),
    imap_username: zod_1.z.string().default(''),
    imap_password: zod_1.z.string().default(''),
    imap_mailbox: zod_1.z.string().default('INBOX'),
    imap_use_ssl: zod_1.z.boolean().default(true),
    smtp_host: zod_1.z.string().default(''),
    smtp_port: zod_1.z.number().default(587),
    smtp_username: zod_1.z.string().default(''),
    smtp_password: zod_1.z.string().default(''),
    smtp_use_tls: zod_1.z.boolean().default(true),
    smtp_use_ssl: zod_1.z.boolean().default(false),
    from_address: zod_1.z.string().default(''),
    auto_reply_enabled: zod_1.z.boolean().default(true),
    poll_interval_seconds: zod_1.z.number().default(30),
    mark_seen: zod_1.z.boolean().default(true),
    max_body_chars: zod_1.z.number().default(12000),
    subject_prefix: zod_1.z.string().default('Re: '),
    allow_from: zod_1.z.array(zod_1.z.string()).default([]),
});
// WeCom (Future)
exports.WeComConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().default(false),
    corpid: zod_1.z.string().default(''),
    corpsecret: zod_1.z.string().default(''),
    agentid: zod_1.z.number().optional(),
    token: zod_1.z.string().default(''),
    encoding_aes_key: zod_1.z.string().default(''),
    allow_from: zod_1.z.preprocess((val) => {
        if (typeof val === 'string') {
            try {
                return JSON.parse(val);
            }
            catch {
                return val.split(',').map(s => s.trim()).filter(Boolean);
            }
        }
        return val;
    }, zod_1.z.array(zod_1.z.string())).default([]),
    // Optional IP allowlist for callback source validation
    allow_ips: zod_1.z.preprocess((val) => {
        if (typeof val === 'string') {
            try {
                return JSON.parse(val);
            }
            catch {
                return val.split(',').map(s => s.trim()).filter(Boolean);
            }
        }
        return val;
    }, zod_1.z.array(zod_1.z.string())).default([]),
    port: zod_1.z.number().default(8080),
    proxy: zod_1.z.string().optional(),
});
// QQ
exports.QQConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().default(false),
    port: zod_1.z.number().default(3001),
    api_url: zod_1.z.string().default('http://127.0.0.1:5700'),
    access_token: zod_1.z.string().optional(),
    allow_from: zod_1.z.array(zod_1.z.string()).default([]),
});
// WeChat (iPad Protocol via Wechaty)
exports.WeChatiPadConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().default(false),
    puppet: zod_1.z.string().default('wechaty-puppet-padlocal'), // or wechaty-puppet-wechat4u, etc.
    token: zod_1.z.string().optional(), // Token for puppet-padlocal
    allow_from: zod_1.z.array(zod_1.z.string()).default([]),
});
exports.ChannelsConfigSchema = zod_1.z.object({
    whatsapp: exports.WhatsAppConfigSchema.default({}),
    telegram: exports.TelegramConfigSchema.default({}),
    discord: exports.DiscordConfigSchema.default({}),
    feishu: exports.FeishuConfigSchema.default({}),
    dingtalk: exports.DingTalkConfigSchema.default({}),
    email: exports.EmailConfigSchema.default({}),
    wecom: exports.WeComConfigSchema.default({}),
    qq: exports.QQConfigSchema.default({}),
    qq_official: exports.QQOfficialConfigSchema.default({}),
    wechat_ipad: exports.WeChatiPadConfigSchema.default({}),
});
// Agent Defaults
exports.AgentDefaultsSchema = zod_1.z.object({
    workspace: zod_1.z.string().default('workspace'),
    model: zod_1.z.string().default('anthropic/claude-3-5-sonnet-20240620'),
    max_tokens: zod_1.z.number().default(8192),
    temperature: zod_1.z.number().default(0.7),
    max_iterations: zod_1.z.number().default(20),
    timeout_ms: zod_1.z.number().default(300000), // Default 5 minutes
});
exports.AgentsConfigSchema = zod_1.z.object({
    defaults: exports.AgentDefaultsSchema.default({}),
});
// Provider
exports.ProviderConfigSchema = zod_1.z.object({
    api_key: zod_1.z.string().default(''),
    api_base: zod_1.z.string().url().optional().or(zod_1.z.literal('')),
    extra_headers: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
    model: zod_1.z.string().optional(), // Allow provider-specific default model
});
exports.BaiduConfigSchema = zod_1.z.object({
    api_key: zod_1.z.string().default(''),
    secret_key: zod_1.z.string().default(''),
});
exports.ProvidersConfigSchema = zod_1.z.object({
    anthropic: exports.ProviderConfigSchema.default({}),
    openai: exports.ProviderConfigSchema.default({}),
    openrouter: exports.ProviderConfigSchema.default({}),
    deepseek: exports.ProviderConfigSchema.default({}),
    groq: exports.ProviderConfigSchema.default({}),
    zhipu: exports.ProviderConfigSchema.default({}),
    dashscope: exports.ProviderConfigSchema.default({}),
    vllm: exports.ProviderConfigSchema.default({}),
    gemini: exports.ProviderConfigSchema.default({}),
    moonshot: exports.ProviderConfigSchema.default({}),
    aihubmix: exports.ProviderConfigSchema.default({}),
    baidu: exports.BaiduConfigSchema.default({}),
});
// Gateway
exports.GatewayConfigSchema = zod_1.z.object({
    host: zod_1.z.string().default('0.0.0.0'),
    port: zod_1.z.number().default(8080),
});
// Redis
exports.RedisConfigSchema = zod_1.z.object({
    host: zod_1.z.string().default('localhost'),
    port: zod_1.z.number().default(6379),
    password: zod_1.z.string().optional(),
    db: zod_1.z.number().default(0),
});
// Tools
exports.WebSearchConfigSchema = zod_1.z.object({
    api_key: zod_1.z.string().default(''),
    max_results: zod_1.z.number().default(5),
});
exports.WebToolsConfigSchema = zod_1.z.object({
    search: exports.WebSearchConfigSchema.default({}),
    rate_limits: zod_1.z.object({
        webfetch_max: zod_1.z.number().default(10),
        webfetch_window_seconds: zod_1.z.number().default(30),
    }).default({}),
});
exports.ExecToolConfigSchema = zod_1.z.object({
    timeout: zod_1.z.number().default(60),
    rate_limits: zod_1.z.object({
        runcommand_max: zod_1.z.number().default(5),
        runcommand_window_seconds: zod_1.z.number().default(30),
    }).default({}),
});
exports.HeartbeatConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().default(true),
    interval_seconds: zod_1.z.number().default(1800), // 30 minutes
});
exports.HousekeepingConfigSchema = zod_1.z.object({
    uploads_retention_days: zod_1.z.number().default(7),
    sessions_retention_days: zod_1.z.number().default(30),
});
exports.ToolsConfigSchema = zod_1.z.object({
    web: exports.WebToolsConfigSchema.default({}),
    exec: exports.ExecToolConfigSchema.default({}),
    // Safer默认值：限制文件访问在工作区内，需显式关闭才会全盘访问
    restrict_to_workspace: zod_1.z.boolean().default(true),
    // 运行时控制：并发、输出裁剪、历史压缩
    tool_concurrency: zod_1.z.number().default(3),
    tool_result_maxchars: zod_1.z.number().default(4000),
    history_max_user_msgs: zod_1.z.number().default(12),
    history_max_tool_msgs: zod_1.z.number().default(12),
});
// Behavior (Refactored hardcoded values)
exports.BehaviorConfigSchema = zod_1.z.object({
    stop_keywords: zod_1.z.array(zod_1.z.string()).default(['停止', 'stop', 'cancel', 'abort', '别做了', '停下']),
});
// Root Config
exports.ConfigSchema = zod_1.z.object({
    agents: exports.AgentsConfigSchema.default({}),
    channels: exports.ChannelsConfigSchema.default({}),
    providers: exports.ProvidersConfigSchema.default({}),
    gateway: exports.GatewayConfigSchema.default({}),
    redis: exports.RedisConfigSchema.default({}),
    tools: exports.ToolsConfigSchema.default({}),
    heartbeat: exports.HeartbeatConfigSchema.default({}),
    housekeeping: exports.HousekeepingConfigSchema.default({}),
    behavior: exports.BehaviorConfigSchema.default({}),
});
async function loadConfig(configPath = exports.DEFAULT_CONFIG_PATH) {
    let userConfig = {};
    // Try loading from file
    if (await fs_extra_1.default.pathExists(configPath)) {
        try {
            userConfig = await fs_extra_1.default.readJson(configPath);
        }
        catch (error) {
            console.warn(`Warning: Failed to parse config file at ${configPath}. Using defaults.`);
        }
    }
    // Handle environment variables (NANOBOT__AGENTS__DEFAULTS__MODEL -> agents.defaults.model)
    // This is a simplified version of Pydantic's BaseSettings
    const envConfig = {};
    for (const [key, value] of Object.entries(process.env)) {
        if (key.startsWith('NANOBOT__') && value !== undefined) {
            const parts = key.slice(9).toLowerCase().split('__');
            let current = envConfig;
            for (let i = 0; i < parts.length - 1; i++) {
                current[parts[i]] = current[parts[i]] || {};
                current = current[parts[i]];
            }
            const lastPart = parts[parts.length - 1];
            // Skip empty values for numeric/boolean fields to avoid validation errors
            if (value.trim() === '') {
                continue;
            }
            // Type conversion for common types
            if (value.toLowerCase() === 'true') {
                current[lastPart] = true;
            }
            else if (value.toLowerCase() === 'false') {
                current[lastPart] = false;
            }
            else if (!isNaN(Number(value))) {
                current[lastPart] = Number(value);
            }
            else {
                current[lastPart] = value;
            }
        }
    }
    // Merge env into file config (env takes priority)
    const mergedConfig = mergeDeep(userConfig, envConfig);
    // Auto-map standard environment variables to providers if not already set
    // This simplifies config by supporting standard variable names directly
    const envMappings = {
        'ANTHROPIC_API_KEY': 'providers.anthropic.api_key',
        'OPENAI_API_KEY': 'providers.openai.api_key',
        'DEEPSEEK_API_KEY': 'providers.deepseek.api_key',
        'MOONSHOT_API_KEY': 'providers.moonshot.api_key',
        'DASHSCOPE_API_KEY': 'providers.dashscope.api_key',
        'ZHIPUAI_API_KEY': 'providers.zhipu.api_key',
        'GROQ_API_KEY': 'providers.groq.api_key',
        'OPENROUTER_API_KEY': 'providers.openrouter.api_key',
        'GOOGLE_GENERATIVE_AI_API_KEY': 'providers.gemini.api_key',
        'BAIDU_API_KEY': 'providers.baidu.api_key',
        'BAIDU_SECRET_KEY': 'providers.baidu.secret_key',
    };
    for (const [envKey, configPath] of Object.entries(envMappings)) {
        if (process.env[envKey]) {
            const parts = configPath.split('.');
            let current = mergedConfig;
            // Navigate to parent
            for (let i = 0; i < parts.length - 1; i++) {
                current[parts[i]] = current[parts[i]] || {};
                current = current[parts[i]];
            }
            // Set if empty
            const lastPart = parts[parts.length - 1];
            if (!current[lastPart]) {
                current[lastPart] = process.env[envKey];
            }
        }
    }
    const result = exports.ConfigSchema.safeParse(mergedConfig);
    if (!result.success) {
        console.error('Configuration validation failed:', JSON.stringify(result.error.format(), null, 2));
        console.warn('Proceeding with partial configuration and defaults where validation failed.');
        // Create a full default config
        const defaultConfig = exports.ConfigSchema.parse({});
        // Merge user's partial config into defaults to ensure structure is valid
        const safeConfig = mergeDeep(defaultConfig, mergedConfig);
        return safeConfig;
    }
    return result.data;
}
function getWorkspacePath(config) {
    const workspace = config.agents.defaults.workspace;
    if (workspace.startsWith('~')) {
        return path_1.default.join(os_1.default.homedir(), workspace.slice(1));
    }
    return path_1.default.resolve(exports.PROJECT_ROOT, workspace);
}
function getCronStorePath(config) {
    const workspace = getWorkspacePath(config);
    return path_1.default.join(path_1.default.dirname(workspace), 'cron.json');
}
function mergeDeep(target, source) {
    const output = Object.assign({}, target);
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target))
                    Object.assign(output, { [key]: source[key] });
                else
                    output[key] = mergeDeep(target[key], source[key]);
            }
            else {
                // Protect against overwriting objects with non-objects (e.g. bad config)
                if (!(key in target) || !isObject(target[key])) {
                    Object.assign(output, { [key]: source[key] });
                }
                else {
                    console.warn(`[Config] Type mismatch for '${key}': keeping default object instead of overwriting with ${typeof source[key]}`);
                }
            }
        });
    }
    return output;
}
function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}
