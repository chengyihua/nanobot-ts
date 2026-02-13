import { Config } from '../core/config.js';
import { SubagentManager } from '../core/subagent.js';
import { MemoryStore } from '../core/memory.js';
import { SessionManager } from '../core/session.js';
import { CronService } from '../cron/service.js';

export interface ToolOptions {
  config?: Config;
  subagentManager?: SubagentManager;
  memoryStore?: MemoryStore;
  sessionManager?: SessionManager;
  cronService?: CronService;
  originChannel?: string;
  originChatId?: string;
  agentLoop?: any;
}
