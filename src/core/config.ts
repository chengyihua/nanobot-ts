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
  allow_from: z.array(z.string()).default([]),
  port: z.number().default(3000),
});

export const ChannelsConfigSchema = z.object({
  whatsapp: WhatsAppConfigSchema.default({}),
  telegram: TelegramConfigSchema.default({}),
  discord: DiscordConfigSchema.default({}),
  feishu: FeishuConfigSchema.default({}),
  dingtalk: DingTalkConfigSchema.default({}),
  email: EmailConfigSchema.default({}),
  wecom: WeComConfigSchema.default({}),
});

// Agent Defaults
export const AgentDefaultsSchema = z.object({
  workspace: z.string().default(path.join(PROJECT_ROOT, 'workspace')),
  model: z.string().default('anthropic/claude-3-5-sonnet-20240620'),
  max_tokens: z.number().default(8192),
  temperature: z.number().default(0.7),
  max_iterations: z.number().default(20),
});

export const AgentsConfigSchema = z.object({
  defaults: AgentDefaultsSchema.default({}),
});

// Provider
export const ProviderConfigSchema = z.object({
  api_key: z.string().default(''),
  api_base: z.string().url().optional().or(z.literal('')),
  extra_headers: z.record(z.string()).optional(),
  model: z.string().optional(), // Allow provider-specific default model
});

export const BaiduConfigSchema = z.object({
  api_key: z.string().default(''),
  secret_key: z.string().default(''),
});

export const ProvidersConfigSchema = z.object({
  anthropic: ProviderConfigSchema.default({}),
  openai: ProviderConfigSchema.default({}),
  openrouter: ProviderConfigSchema.default({}),
  deepseek: ProviderConfigSchema.default({}),
  groq: ProviderConfigSchema.default({}),
  zhipu: ProviderConfigSchema.default({}),
  dashscope: ProviderConfigSchema.default({}),
  vllm: ProviderConfigSchema.default({}),
  gemini: ProviderConfigSchema.default({}),
  moonshot: ProviderConfigSchema.default({}),
  aihubmix: ProviderConfigSchema.default({}),
  baidu: BaiduConfigSchema.default({}),
});

// Gateway
export const GatewayConfigSchema = z.object({
  host: z.string().default('0.0.0.0'),
  port: z.number().default(18790),
});

// Tools
export const WebSearchConfigSchema = z.object({
  api_key: z.string().default(''),
  max_results: z.number().default(5),
});

export const WebToolsConfigSchema = z.object({
  search: WebSearchConfigSchema.default({}),
});

export const ExecToolConfigSchema = z.object({
  timeout: z.number().default(60),
});

export const HeartbeatConfigSchema = z.object({
  enabled: z.boolean().default(true),
  interval_seconds: z.number().default(1800), // 30 minutes
});

export const ToolsConfigSchema = z.object({
  web: WebToolsConfigSchema.default({}),
  exec: ExecToolConfigSchema.default({}),
  restrict_to_workspace: z.boolean().default(false),
});

// Root Config
export const ConfigSchema = z.object({
  agents: AgentsConfigSchema.default({}),
  channels: ChannelsConfigSchema.default({}),
  providers: ProvidersConfigSchema.default({}),
  gateway: GatewayConfigSchema.default({}),
  tools: ToolsConfigSchema.default({}),
  heartbeat: HeartbeatConfigSchema.default({}),
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
  let mergedConfig = mergeDeep(userConfig, envConfig);

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
    // Attempt to return the merged config anyway, casting to Config
    // This allows valid parts (like model choice) to work even if wecom.agentid is broken
    return mergedConfig as Config;
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
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

function isObject(item: any) {
  return (item && typeof item === 'object' && !Array.isArray(item));
}
