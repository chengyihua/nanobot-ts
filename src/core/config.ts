import { z } from 'zod';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define Project Root (Works for both src/ and dist/)
export const PROJECT_ROOT = path.resolve(__dirname, '../../');

// Default configuration values
export const DEFAULT_CONFIG_DIR = path.join(PROJECT_ROOT, '.nanobot');
export const DEFAULT_CONFIG_PATH = path.join(DEFAULT_CONFIG_DIR, 'config.json');

export async function saveConfig(config: Config, configPath: string = DEFAULT_CONFIG_PATH): Promise<void> {
  await fs.ensureDir(path.dirname(configPath));
  await fs.writeJson(configPath, config, { spaces: 2 });
}

// WhatsApp (Not implemented for now, but kept for schema compatibility)
export const WhatsAppConfigSchema = z.object({
  enabled: z.boolean().default(false),
  bridge_url: z.string().default('ws://localhost:3001'),
  allow_from: z.array(z.string()).default([]),
});

// QQ Official
export const QQOfficialConfigSchema = z.object({
  enabled: z.boolean().default(false),
  appid: z.string().default(''),
  token: z.string().default(''),
  secret: z.string().default(''),
  sandbox: z.boolean().default(false),
  intents: z.array(z.string()).default([
    'GUILD_MESSAGES', 
    'DIRECT_MESSAGE', 
    'GROUP_AT_MESSAGE_CREATE', 
    'C2C_MESSAGE_CREATE'
  ]),
  webhook: z.object({
    enabled: z.boolean().default(false),
    port: z.number().default(8080),
    path: z.string().default('/qq-official-webhook'),
  }).default({} as any),
});

// Telegram
export const TelegramConfigSchema = z.object({
  enabled: z.boolean().default(false),
  token: z.string().default(''),
  allow_from: z.array(z.string()).default([]),
  proxy: z.string().optional(),
});

// Feishu/Lark
export const FeishuConfigSchema = z.object({
  enabled: z.boolean().default(false),
  app_id: z.string().default(''),
  app_secret: z.string().default(''),
  encrypt_key: z.string().default(''),
  verification_token: z.string().default(''),
  allow_from: z.array(z.string()).default([]),
});

// DingTalk
export const DingTalkConfigSchema = z.object({
  enabled: z.boolean().default(false),
  client_id: z.string().default(''),
  client_secret: z.string().default(''),
  allow_from: z.array(z.string()).default([]),
});

// Discord
export const DiscordConfigSchema = z.object({
  enabled: z.boolean().default(false),
  token: z.string().default(''),
  allow_from: z.array(z.string()).default([]),
  gateway_url: z.string().default('wss://gateway.discord.gg/?v=10&encoding=json'),
  intents: z.number().default(37377),
});

// Email
export const EmailConfigSchema = z.object({
  enabled: z.boolean().default(false),
  consent_granted: z.boolean().default(false),
  imap_host: z.string().default(''),
  imap_port: z.number().default(993),
  imap_username: z.string().default(''),
  imap_password: z.string().default(''),
  imap_mailbox: z.string().default('INBOX'),
  imap_use_ssl: z.boolean().default(true),
  smtp_host: z.string().default(''),
  smtp_port: z.number().default(587),
  smtp_username: z.string().default(''),
  smtp_password: z.string().default(''),
  smtp_use_tls: z.boolean().default(true),
  smtp_use_ssl: z.boolean().default(false),
  from_address: z.string().default(''),
  auto_reply_enabled: z.boolean().default(true),
  poll_interval_seconds: z.number().default(30),
  mark_seen: z.boolean().default(true),
  max_body_chars: z.number().default(12000),
  subject_prefix: z.string().default('Re: '),
  allow_from: z.array(z.string()).default([]),
});

// WeCom (Future)
export const WeComConfigSchema = z.object({
  enabled: z.boolean().default(false),
  corpid: z.string().default(''),
  corpsecret: z.string().default(''),
  agentid: z.number().optional(),
  token: z.string().default(''),
  encoding_aes_key: z.string().default(''),
  allow_from: z.preprocess((val) => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return val.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    return val;
  }, z.array(z.string())).default([]),
  // Optional IP allowlist for callback source validation
  allow_ips: z.preprocess((val) => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return val.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    return val;
  }, z.array(z.string())).default([]),
  port: z.number().default(8080),
  proxy: z.string().optional(),
});

// QQ
export const QQConfigSchema = z.object({
  enabled: z.boolean().default(false),
  port: z.number().default(3001),
  api_url: z.string().default('http://127.0.0.1:5700'),
  access_token: z.string().optional(),
  allow_from: z.array(z.string()).default([]),
});

// WeChat (iPad Protocol via Wechaty)
export const WeChatiPadConfigSchema = z.object({
  enabled: z.boolean().default(false),
  puppet: z.string().default('wechaty-puppet-padlocal'), // or wechaty-puppet-wechat4u, etc.
  token: z.string().optional(), // Token for puppet-padlocal
  allow_from: z.array(z.string()).default([]),
});

export const ChannelsConfigSchema = z.object({
  whatsapp: WhatsAppConfigSchema.default({} as any),
  telegram: TelegramConfigSchema.default({} as any),
  discord: DiscordConfigSchema.default({} as any),
  feishu: FeishuConfigSchema.default({} as any),
  dingtalk: DingTalkConfigSchema.default({} as any),
  email: EmailConfigSchema.default({} as any),
  wecom: WeComConfigSchema.default({} as any),
  qq: QQConfigSchema.default({} as any),
  qq_official: QQOfficialConfigSchema.default({} as any),
  wechat_ipad: WeChatiPadConfigSchema.default({} as any),
});

// Agent Defaults
export const AgentDefaultsSchema = z.object({
  workspace: z.string().default('workspace'),
  model: z.string().default('anthropic/claude-3-5-sonnet-20240620'),
  max_tokens: z.number().default(8192),
  temperature: z.number().default(0.7),
  max_iterations: z.number().default(20),
  timeout_ms: z.number().default(300000), // Default 5 minutes
});

export const AgentsConfigSchema = z.object({
  defaults: AgentDefaultsSchema.default({} as any),
});

// Provider
export const ProviderConfigSchema = z.object({
  api_key: z.string().default(''),
  api_base: z.string().url().optional().or(z.literal('')),
  extra_headers: z.record(z.string(), z.string()).optional(),
  model: z.string().optional(), // Allow provider-specific default model
});

export const BaiduConfigSchema = z.object({
  api_key: z.string().default(''),
  secret_key: z.string().default(''),
});

export const ProvidersConfigSchema = z.object({
  anthropic: ProviderConfigSchema.default({} as any),
  openai: ProviderConfigSchema.default({} as any),
  openrouter: ProviderConfigSchema.default({} as any),
  deepseek: ProviderConfigSchema.default({} as any),
  groq: ProviderConfigSchema.default({} as any),
  zhipu: ProviderConfigSchema.default({} as any),
  dashscope: ProviderConfigSchema.default({} as any),
  vllm: ProviderConfigSchema.default({} as any),
  gemini: ProviderConfigSchema.default({} as any),
  moonshot: ProviderConfigSchema.default({} as any),
  aihubmix: ProviderConfigSchema.default({} as any),
  baidu: BaiduConfigSchema.default({} as any),
});

// Gateway
export const GatewayConfigSchema = z.object({
  host: z.string().default('0.0.0.0'),
  port: z.number().default(8080),
});

// Redis
export const RedisConfigSchema = z.object({
  host: z.string().default('localhost'),
  port: z.number().default(6379),
  password: z.string().optional(),
  db: z.number().default(0),
});

// Tools
export const WebSearchConfigSchema = z.object({
  api_key: z.string().default(''),
  max_results: z.number().default(5),
});

export const WebToolsConfigSchema = z.object({
  search: WebSearchConfigSchema.default({} as any),
  rate_limits: z.object({
    webfetch_max: z.number().default(10),
    webfetch_window_seconds: z.number().default(30),
  }).default({} as any),
});

export const ExecToolConfigSchema = z.object({
  timeout: z.number().default(60),
  rate_limits: z.object({
    runcommand_max: z.number().default(5),
    runcommand_window_seconds: z.number().default(30),
  }).default({} as any),
});

export const HeartbeatConfigSchema = z.object({
  enabled: z.boolean().default(true),
  interval_seconds: z.number().default(1800), // 30 minutes
});

export const HousekeepingConfigSchema = z.object({
  uploads_retention_days: z.number().default(7),
  sessions_retention_days: z.number().default(30),
});

export const ToolsConfigSchema = z.object({
  web: WebToolsConfigSchema.default({} as any),
  exec: ExecToolConfigSchema.default({} as any),
  // Safer默认值：限制文件访问在工作区内，需显式关闭才会全盘访问
  restrict_to_workspace: z.boolean().default(true),
  // 运行时控制：并发、输出裁剪、历史压缩
  tool_concurrency: z.number().default(3),
  tool_result_maxchars: z.number().default(4000),
  history_max_user_msgs: z.number().default(12),
  history_max_tool_msgs: z.number().default(12),
});

// Behavior (Refactored hardcoded values)
export const BehaviorConfigSchema = z.object({
  stop_keywords: z.array(z.string()).default(['停止', 'stop', 'cancel', 'abort', '别做了', '停下']),
});

// Root Config
export const ConfigSchema = z.object({
  agents: AgentsConfigSchema.default({} as any),
  channels: ChannelsConfigSchema.default({} as any),
  providers: ProvidersConfigSchema.default({} as any),
  gateway: GatewayConfigSchema.default({} as any),
  redis: RedisConfigSchema.default({} as any),
  tools: ToolsConfigSchema.default({} as any),
  heartbeat: HeartbeatConfigSchema.default({} as any),
  housekeeping: HousekeepingConfigSchema.default({} as any),
  behavior: BehaviorConfigSchema.default({} as any),
});

export type Config = z.infer<typeof ConfigSchema>;

export async function loadConfig(configPath: string = DEFAULT_CONFIG_PATH): Promise<Config> {
  let userConfig = {};
  
  // Try loading from file
  if (await fs.pathExists(configPath)) {
    try {
      userConfig = await fs.readJson(configPath);
    } catch (error) {
      console.warn(`Warning: Failed to parse config file at ${configPath}. Using defaults.`);
    }
  }

  // Handle environment variables (NANOBOT__AGENTS__DEFAULTS__MODEL -> agents.defaults.model)
  // This is a simplified version of Pydantic's BaseSettings
  const envConfig: any = {};
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
      } else if (value.toLowerCase() === 'false') {
        current[lastPart] = false;
      } else if (!isNaN(Number(value))) {
        current[lastPart] = Number(value);
      } else {
        current[lastPart] = value;
      }
    }
  }

  // Merge env into file config (env takes priority)
  const mergedConfig = mergeDeep(userConfig, envConfig);

  // Auto-map standard environment variables to providers if not already set
  // This simplifies config by supporting standard variable names directly
  const envMappings: Record<string, string> = {
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

  const result = ConfigSchema.safeParse(mergedConfig);
  
  if (!result.success) {
    console.error('Configuration validation failed:', JSON.stringify(result.error.format(), null, 2));
    console.warn('Proceeding with partial configuration and defaults where validation failed.');
    
    // Create a full default config
    const defaultConfig = ConfigSchema.parse({});
    // Merge user's partial config into defaults to ensure structure is valid
    const safeConfig = mergeDeep(defaultConfig, mergedConfig);
    
    return safeConfig as Config;
  }

  return result.data;
}

export function getWorkspacePath(config: Config): string {
  const workspace = config.agents.defaults.workspace;
  if (workspace.startsWith('~')) {
    return path.join(os.homedir(), workspace.slice(1));
  }
  return path.resolve(PROJECT_ROOT, workspace);
}

export function getCronStorePath(config: Config): string {
  const workspace = getWorkspacePath(config);
  return path.join(path.dirname(workspace), 'cron.json');
}

function mergeDeep(target: any, source: any): any {
  const output = Object.assign({}, target);
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target))
          Object.assign(output, { [key]: source[key] });
        else
          output[key] = mergeDeep(target[key], source[key]);
      } else {
        // Protect against overwriting objects with non-objects (e.g. bad config)
        if (!(key in target) || !isObject(target[key])) {
          Object.assign(output, { [key]: source[key] });
        } else {
          console.warn(`[Config] Type mismatch for '${key}': keeping default object instead of overwriting with ${typeof source[key]}`);
        }
      }
    });
  }
  return output;
}

function isObject(item: any) {
  return (item && typeof item === 'object' && !Array.isArray(item));
}
