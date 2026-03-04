import fs from 'fs-extra';
import path from 'path';
import os from 'os';

import { Config, getWorkspacePath } from './config.js';
import { PluginLoader } from './plugin-loader.js';
import { createModel } from '../providers/registry.js';
import { ToolOptions } from '../tools/types.js';
import { MCPClientManager } from './mcp/client-manager.js';
import { jsonSchemaToZod } from '../utils/json-schema-to-zod.js';
import { tool } from 'ai';
import { z } from 'zod';

import { createFsTools } from '../tools/definitions/fs.js';
import { createCommunicationTools } from '../tools/definitions/communication.js';
import { createVisionTools } from '../tools/definitions/vision.js';
import { createSystemTools } from '../tools/definitions/system.js';
import { createWebTools } from '../tools/definitions/web.js';
import { createAgentTools } from '../tools/definitions/agent.js';
import { createMemoryTools } from '../tools/definitions/memory.js';
import { createMCPTools } from '../tools/definitions/mcp.js';
import { createLogger } from '../utils/logger.js';
import { housekeepingStats } from '../utils/cleanup.js';

export class ToolRegistry {
  private config: Config;
  private log = createLogger('tool-registry');
  private pluginTools: Record<string, any> = {};
  private mcpTools: Record<string, any> = {};
  private mcpManager?: MCPClientManager;
  private cleanupRegistered = false;

  constructor(config: Config, mcpManager?: MCPClientManager) {
    this.config = config;
    this.mcpManager = mcpManager || new MCPClientManager(config);
    this.setupCleanup();
  }

  private setupCleanup() {
    if (this.cleanupRegistered) return;
    this.cleanupRegistered = true;

    // Note: We don't register SIGINT/SIGTERM here directly to avoid conflicts if multiple registries exist
    // or if the main app handles it. But for safety, we can add a method to call manually.
  }

  public async close() {
    if (this.mcpManager) {
      await this.mcpManager.close();
    }
  }

  public async initialize() {
    // Initialize MCP Manager
    if (this.mcpManager) {
      await this.mcpManager.initialize();
    }
    // Load Plugins
    await this.loadPlugins();
    // Load MCP Tools
    await this.loadMCPTools();
  }

  private async loadMCPTools() {
    if (!this.mcpManager) return;
    
    try {
      const tools = await this.mcpManager.listTools();
      for (const t of tools) {
        this.mcpTools[t.name] = tool({
          description: t.description || '',
          parameters: jsonSchemaToZod(t.inputSchema) as z.ZodTypeAny,
          execute: async (args: any) => {
            return await this.mcpManager!.callTool(t.serverName, t.originalName, args);
          },
        });
      }
      this.log.info({ count: tools.length }, 'Loaded MCP tools');
    } catch (error) {
      this.log.error({ error }, 'Failed to load MCP tools');
    }
  }

  private async loadPlugins() {
    const workspacePath = getWorkspacePath(this.config);
    if (workspacePath) {
      try {
        const loader = new PluginLoader(workspacePath);
        this.pluginTools = await loader.loadPlugins({ config: this.config });
      } catch (e) {
        this.log.warn({ err: e }, 'Failed to load plugins');
      }
    }
  }

  public getTools(contextOptions: ToolOptions = {}) {
    // Merge provided options with config
    const options = { ...contextOptions, config: this.config };
    
    // Helpers
    const restrictToWorkspace = this.config.tools?.restrict_to_workspace ?? false;
    const workspacePath = getWorkspacePath(this.config);

    const checkPath = (filePath: string) => {
      let resolvedPath = filePath;
      if (filePath.startsWith('~')) {
        resolvedPath = path.join(os.homedir(), filePath.slice(1));
      }
      resolvedPath = path.resolve(resolvedPath);
      
      if (restrictToWorkspace) {
        if (!resolvedPath.startsWith(workspacePath)) {
          const errorMsg = `Access denied by CONFIG: Path ${filePath} is outside the workspace ${workspacePath}. To fix this, set NANOBOT__TOOLS__RESTRICT_TO_WORKSPACE=false in your .env file.`;
          console.error(`[checkPath] ${errorMsg}`);
          throw new Error(errorMsg);
        }
      } else {
        console.log(`[checkPath] FULL ACCESS MODE: ${resolvedPath}`);
      }
      
      try {
        fs.accessSync(path.dirname(resolvedPath), fs.constants.R_OK);
      } catch (e: any) {
        if (e.code === 'EACCES' || e.code === 'EPERM') {
          const osError = `Access denied by SYSTEM: Permission denied for ${filePath}. This is likely a macOS TCC restriction. Please grant 'Full Disk Access' to your terminal/IDE in System Settings.`;
          console.error(`[checkPath] ${osError}`);
          throw new Error(osError);
        }
      }
      
      console.log(`[checkPath] Resolved: ${filePath} -> ${resolvedPath} (Restrict: ${restrictToWorkspace})`);
      return resolvedPath;
    };

    const getModel = () => {
      const modelId = this.config.agents.defaults.model;
      try {
        return createModel(modelId, this.config);
      } catch (error) {
        this.log.error({ err: error, modelId }, 'Failed to create model for tool');
        return null;
      }
    };

    // Create standard tools with context
    const fsTools = createFsTools(options, checkPath);
    const communicationTools = createCommunicationTools(options);
    const visionTools = createVisionTools(options, checkPath, getModel);
    const systemTools = createSystemTools(options, checkPath);
    const webTools = createWebTools(options);
    const agentTools = createAgentTools(options);
    const memoryTools = createMemoryTools(options);
    const mcpMetaTools = this.mcpManager ? createMCPTools(this.mcpManager) : {};

    // 高风险工具的轻量限流器（滑动窗口计数），避免命令/网络工具被滥用
    const execRate = this.config.tools?.exec?.rate_limits;
    const webRate = this.config.tools?.web?.rate_limits;
    const rateLimits: Record<string, { windowMs: number; max: number; hits: number[] }> = {
      runCommand: {
        windowMs: (execRate?.runcommand_window_seconds ?? 30) * 1000,
        max: execRate?.runcommand_max ?? 5,
        hits: [],
      },
      webFetch: {
        windowMs: (webRate?.webfetch_window_seconds ?? 30) * 1000,
        max: webRate?.webfetch_max ?? 10,
        hits: [],
      },
    };

    const wrapWithRateLimit = (toolName: string, toolImpl: any) => {
      const limitCfg = rateLimits[toolName];
      if (!limitCfg || typeof toolImpl?.execute !== 'function') return toolImpl;

      const originalExecute = toolImpl.execute;
      toolImpl.execute = async (...args: any[]) => {
        let now = Date.now();
        limitCfg.hits = limitCfg.hits.filter(t => now - t < limitCfg.windowMs);
        
        if (limitCfg.hits.length >= limitCfg.max) {
          const oldestHit = limitCfg.hits[0];
          const waitMs = limitCfg.windowMs - (now - oldestHit) + 100; // Add buffer
          
          if (waitMs > 0) {
            this.log.info({ tool: toolName, waitMs }, 'Rate limit reached, throttling execution...');
            await new Promise(resolve => setTimeout(resolve, waitMs));
            
            // Re-check time after waiting
            now = Date.now();
            limitCfg.hits = limitCfg.hits.filter(t => now - t < limitCfg.windowMs);
          }
        }
        
        limitCfg.hits.push(now);
        const remaining = Math.max(0, limitCfg.max - limitCfg.hits.length);
        
        if (toolName === 'runCommand') {
          housekeepingStats.rate_limits.runcommand_remaining = remaining;
          housekeepingStats.rate_limits.runcommand_triggers += 1; // Count throttled calls too
        } else if (toolName === 'webFetch') {
          housekeepingStats.rate_limits.webfetch_remaining = remaining;
          housekeepingStats.rate_limits.webfetch_triggers += 1;
        }

        return originalExecute.apply(toolImpl, args);
      };
      return toolImpl;
    };

    // 注册工具
    const toolsMap = {
      tools: {
        ...fsTools,
        ...communicationTools,
        ...visionTools,
        ...systemTools,
        ...webTools,
        ...agentTools,
        ...memoryTools,
        ...mcpMetaTools,
        ...this.pluginTools,
        ...this.mcpTools,
      },
      initPromise: Promise.resolve()
    };

    // 包裹限流的工具
    ['runCommand', 'webFetch'].forEach(name => {
      if ((toolsMap.tools as any)[name]) {
        (toolsMap.tools as any)[name] = wrapWithRateLimit(name, (toolsMap.tools as any)[name]);
      }
    });

    return toolsMap;
  }

  public getToolDefinitionsSummary(options: ToolOptions = {}): string {
    const { tools } = this.getTools(options);
    const toolDefinitions = Object.entries(tools).map(([name, tool]: [string, any]) => {
      return `- **${name}**: ${tool.description}`;
    }).join('\n');
    return toolDefinitions;
  }
}
