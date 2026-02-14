import { tool } from 'ai';
import { z } from 'zod';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

import { Config, getWorkspacePath } from './config.js';
import { PluginLoader } from './plugin-loader.js';
import { createModel } from '../providers/registry.js';
import { ToolOptions } from '../tools/types.js';
import { TranscriptionService } from './transcription.js';

import { createFsTools } from '../tools/definitions/fs.js';
import { createCommunicationTools } from '../tools/definitions/communication.js';
import { createVisionTools } from '../tools/definitions/vision.js';
import { createSystemTools } from '../tools/definitions/system.js';
import { createWebTools } from '../tools/definitions/web.js';
import { createAgentTools } from '../tools/definitions/agent.js';
import { createMemoryTools } from '../tools/definitions/memory.js';
import { createLogger } from '../utils/logger.js';

export class ToolRegistry {
  private config: Config;
  private log = createLogger('tool-registry');
  private pluginTools: Record<string, any> = {};
  private cleanupRegistered = false;

  constructor(config: Config) {
    this.config = config;
    this.setupCleanup();
  }

  private setupCleanup() {
    if (this.cleanupRegistered) return;
    this.cleanupRegistered = true;

    // Note: We don't register SIGINT/SIGTERM here directly to avoid conflicts if multiple registries exist
    // or if the main app handles it. But for safety, we can add a method to call manually.
  }

  public async close() {
    // No-op for now as MCP client cleanup is removed
  }

  public async initialize() {
    // Load Plugins
    await this.loadPlugins();
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
        console.error(`[Tools] Failed to create model for ${modelId}:`, error);
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

    return {
      tools: {
        ...fsTools,
        ...communicationTools,
        ...visionTools,
        ...systemTools,
        ...webTools,
        ...agentTools,
        ...memoryTools,
        ...this.pluginTools,
      },
      initPromise: Promise.resolve()
    };
  }

  public getToolDefinitionsSummary(): string {
    const { tools } = this.getTools();
    const toolDefinitions = Object.entries(tools).map(([name, tool]: [string, any]) => {
      return `- **${name}**: ${tool.description}`;
    }).join('\n');
    return toolDefinitions;
  }
}
