import { tool } from 'ai';
import { z } from 'zod';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
// @ts-ignore
import { jsonSchemaToZod } from 'json-schema-to-zod';

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

export class ToolRegistry {
  private config: Config;
  private mcpTools: Record<string, any> = {};
  private mcpClients: Record<string, { client: Client, transport: StdioClientTransport, serverConfig: any }> = {};
  private pluginTools: Record<string, any> = {};
  private mcpInitPromise: Promise<void> | null = null;
  private cleanupRegistered = false;

  constructor(config: Config) {
    this.config = config;
    this.setupCleanup();
  }

  private setupCleanup() {
    if (this.cleanupRegistered) return;
    this.cleanupRegistered = true;

    const cleanup = async () => {
      for (const name in this.mcpClients) {
        console.log(`[MCP] Closing connection for server ${name}...`);
        try {
          await this.mcpClients[name].transport.close();
        } catch (e) {}
      }
    };

    process.on('exit', () => {
      for (const name in this.mcpClients) {
        try {
          this.mcpClients[name].transport.close();
        } catch (e) {}
      }
    });

    // Note: We don't register SIGINT/SIGTERM here directly to avoid conflicts if multiple registries exist
    // or if the main app handles it. But for safety, we can add a method to call manually.
  }

  public async close() {
    for (const name in this.mcpClients) {
      console.log(`[MCP] Closing connection for server ${name}...`);
      try {
        await this.mcpClients[name].transport.close();
      } catch (e) {}
    }
    this.mcpClients = {};
  }

  public async initialize() {
    // Load Plugins
    await this.loadPlugins();
    
    // Start MCP loading (non-blocking)
    this.mcpInitPromise = this.loadMcpTools();
    
    return this.mcpInitPromise;
  }

  private async loadPlugins() {
    const workspacePath = getWorkspacePath(this.config);
    if (workspacePath) {
      try {
        const loader = new PluginLoader(workspacePath);
        // We pass empty options here just to satisfy the interface if needed, 
        // or we might need to adjust PluginLoader to not require options if it only needs config
        this.pluginTools = await loader.loadPlugins({ config: this.config });
      } catch (e) {
        console.error('[Tools] Failed to load plugins:', e);
      }
    }
  }

  private async loadMcpTools() {
    const workspacePath = getWorkspacePath(this.config);
    const mcpConfigPath = path.join(path.dirname(workspacePath), '.nanobot', 'mcp.json');
    
    if (!(await fs.pathExists(mcpConfigPath))) return;

    try {
      const mcpConfig = await fs.readJson(mcpConfigPath);
      if (!mcpConfig.enabled || !Array.isArray(mcpConfig.servers)) return;

      const newServers = mcpConfig.servers.filter((s: any) => !this.mcpClients[s.name]);
      if (newServers.length === 0) return;

      console.log(`[MCP] Found ${newServers.length} new servers to connect...`);

      const connectToServer = async (server: any) => {
        if (this.mcpClients[server.name]) return;

        try {
          const env: Record<string, string> = {
            ...process.env,
            ...(server.env || {}),
          };

          if (server.port) {
            env.MCP_HTTP_PORT = String(server.port);
            env.PORT = String(server.port);
          }

          console.log(`[MCP] Connecting to server: ${server.name}...`);
          const transport = new StdioClientTransport({
            command: server.command,
            args: server.args,
            stderr: 'inherit',
            env: env as any,
          });

          const client = new Client(
            { name: 'nanobot-client', version: '0.1.0' },
            { capabilities: {} }
          );

          await client.connect(transport);
          
          transport.onclose = () => {
            console.warn(`[MCP] Connection closed for server ${server.name}. Attempting to reconnect in 5s...`);
            delete this.mcpClients[server.name];
            setTimeout(() => connectToServer(server), 5000);
          };

          const { tools } = await client.listTools();
          
          const convertSchema = (schema: any) => {
            try {
              if (!schema) return z.any();
              if (typeof schema !== 'object') return z.any();
              const zodCode = jsonSchemaToZod(schema);
              const schemaFn = new Function('z', `return ${zodCode}`);
              const zodSchema = schemaFn(z);
              return zodSchema || z.any();
            } catch (e) {
              console.warn(`[MCP] Failed to convert schema for tool, falling back to z.any():`, e);
              return z.any();
            }
          };

          for (const mcpTool of tools) {
            const toolName = `mcp_${server.name}_${mcpTool.name.replace(/-/g, '_')}`;
            this.mcpTools[toolName] = tool({
              description: `[MCP: ${server.name}] ${mcpTool.description}`,
              parameters: convertSchema(mcpTool.inputSchema),
              execute: async (args: any) => {
                console.log(`[MCP] Calling tool: ${server.name}.${mcpTool.name} with args:`, args);
                const activeClient = this.mcpClients[server.name]?.client;
                if (!activeClient) {
                  return { error: `MCP server ${server.name} is currently disconnected. Please try again in a few seconds.` };
                }
                const result = await activeClient.callTool({
                  name: mcpTool.name,
                  arguments: args,
                });
                return result;
              },
            });
          }
          
          this.mcpClients[server.name] = { client, transport, serverConfig: server };
          console.log(`[MCP] Registered ${tools.length} tools from ${server.name}`);
        } catch (error) {
          console.error(`[MCP] Failed to connect to server ${server.name}:`, error);
          setTimeout(() => connectToServer(server), 10000);
        }
      };

      for (const server of newServers) {
        await connectToServer(server);
      }
    } catch (error) {
      console.error(`[MCP] Failed to load MCP config:`, error);
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
        ...this.mcpTools,
      },
      initPromise: this.mcpInitPromise
    };
  }
}
