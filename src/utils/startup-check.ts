import fs from 'fs-extra';

// Simple startup checks for configuration/keys/sandbox/fallback model availability
export async function runStartupChecks() {
  const messages: string[] = [];

  // Sandbox mode
  const sandbox = process.env.NANOBOT__TOOLS__RESTRICT_TO_WORKSPACE;
  if (sandbox === 'false') {
    messages.push('WARN: File access is NOT restricted to workspace. Set NANOBOT__TOOLS__RESTRICT_TO_WORKSPACE=true for safer defaults.');
  } else {
    messages.push('INFO: Workspace sandbox is enabled by default.');
  }

  // Keys (best-effort)
  const keyChecks = [
    { name: 'OPENAI_API_KEY', value: process.env.OPENAI_API_KEY },
    { name: 'ANTHROPIC_API_KEY', value: process.env.ANTHROPIC_API_KEY },
    { name: 'DEEPSEEK_API_KEY', value: process.env.DEEPSEEK_API_KEY },
    { name: 'BRAVE_API_KEY', value: process.env.BRAVE_API_KEY },
  ];
  const missingKeys = keyChecks.filter(k => !k.value).map(k => k.name);
  if (missingKeys.length) {
    messages.push(`WARN: Missing keys: ${missingKeys.join(', ')} (some tools/models may fail)`);
  }

  // WeCom required keys if enabled
  if (process.env.NANOBOT__CHANNELS__WECOM__ENABLED === 'true') {
    const required = ['NANOBOT__CHANNELS__WECOM__CORPID', 'NANOBOT__CHANNELS__WECOM__CORPSECRET', 'NANOBOT__CHANNELS__WECOM__TOKEN', 'NANOBOT__CHANNELS__WECOM__ENCODING_AES_KEY'];
    const missingWecom = required.filter(k => !process.env[k]);
    if (missingWecom.length) {
      messages.push(`ERROR: WeCom enabled but missing: ${missingWecom.join(', ')}`);
    }
  }

  // Fallback model hint
  const fallbackModel = process.env.NANOBOT_FALLBACK_MODEL || 'gpt-4o-mini';
  messages.push(`INFO: Fallback model: ${fallbackModel}`);

  // Config file existence (optional)
  if (!(await fs.pathExists('.nanobot/config.json'))) {
    messages.push('WARN: .nanobot/config.json not found; running with defaults/env only. Run `pnpm dev onboard` to generate.');
  }

  return messages;
}
