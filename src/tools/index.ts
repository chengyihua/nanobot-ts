import { tool, generateText } from 'ai';
import { z } from 'zod';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
// @ts-ignore
import { jsonSchemaToZod } from 'json-schema-to-zod';

import { SubagentManager } from '../core/subagent.js';
import { MemoryStore } from '../core/memory.js';
import { SessionManager } from '../core/session.js';
import { CronService } from '../cron/service.js';
import { TranscriptionService } from '../core/transcription.js';
import { Config, getWorkspacePath } from '../core/config.js';
import { createModel } from '../providers/registry.js';
import { ToolOptions } from './types.js';
import { PluginLoader } from '../core/plugin-loader.js';

import { createFsTools } from './definitions/fs.js';
import { createCommunicationTools } from './definitions/communication.js';
import { createVisionTools } from './definitions/vision.js';
import { createSystemTools } from './definitions/system.js';
import { createWebTools } from './definitions/web.js';
import { createAgentTools } from './definitions/agent.js';
import { createMemoryTools } from './definitions/memory.js';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537.36';

// MCP Global State to avoid re-initializing on every tool creation
const mcpTools: Record<string, any> = {};
const mcpClients: Record<string, { client: Client, transport: StdioClientTransport, serverConfig: any }> = {};
let mcpInitPromise: Promise<void> | null = null;

// Cleanup on process exit
process.on('exit', () => {
  for (const name in mcpClients) {
    console.log(`[MCP] Closing connection for server ${name}...`);
    try {
      mcpClients[name].transport.close();
    } catch (e) {}
  }
});

// Also handle SIGINT/SIGTERM for cleaner exit
const cleanup = async () => {
  for (const name in mcpClients) {
    console.log(`[MCP] Closing connection for server ${name}...`);
    try {
      await mcpClients[name].transport.close();
    } catch (e) {}
  }
};
process.on('SIGINT', async () => {
  await cleanup();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await cleanup();
  process.exit(0);
});

export async function createTools(options: ToolOptions = {}) {
  const { config } = options;
  const restrictToWorkspace = config?.tools?.restrict_to_workspace ?? false;
  const workspacePath = config ? path.resolve(config.agents.defaults.workspace) : process.cwd();
  
  const transcriptionService = config ? new TranscriptionService(config) : null;

  const getModel = () => {
    if (!config) return null;
    const modelId = config.agents.defaults.model;
    
    try {
      return createModel(modelId, config);
    } catch (error) {
      console.error(`[Tools] Failed to create model for ${modelId}:`, error);
      return null;
    }
  };

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
      // Basic check for OS-level accessibility
      fs.accessSync(path.dirname(resolvedPath), fs.constants.R_OK);
    } catch (e: any) {
      if (e.code === 'EACCES' || e.code === 'EPERM') {
        const osError = `Access denied by SYSTEM: Permission denied for ${filePath}. This is likely a macOS TCC restriction. Please grant 'Full Disk Access' to your terminal/IDE in System Settings.`;
        console.error(`[checkPath] ${osError}`);
        // We throw a more helpful error that the Agent can explain to the user
        throw new Error(osError);
      }
    }
    
    console.log(`[checkPath] Resolved: ${filePath} -> ${resolvedPath} (Restrict: ${restrictToWorkspace})`);
    return resolvedPath;
  };

  const loadMcpTools = async () => {
    const mcpConfigPath = path.join(path.dirname(config?.agents.defaults.workspace || './workspace'), '.nanobot', 'mcp.json');
    if (!(await fs.pathExists(mcpConfigPath))) return;

    // Use a temporary promise to handle concurrent calls while allowing incremental updates
    const currentInit = (async () => {
      try {
        const mcpConfig = await fs.readJson(mcpConfigPath);
        if (!mcpConfig.enabled || !Array.isArray(mcpConfig.servers)) return;

        const newServers = mcpConfig.servers.filter((s: any) => !mcpClients[s.name]);
        if (newServers.length === 0) return;

        console.log(`[MCP] Found ${newServers.length} new servers to connect...`);

        const connectToServer = async (server: any) => {
          // Double check if already connected
          if (mcpClients[server.name]) return;

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
            
            // Handle transport closure
            transport.onclose = () => {
              console.warn(`[MCP] Connection closed for server ${server.name}. Attempting to reconnect in 5s...`);
              delete mcpClients[server.name];
              setTimeout(() => connectToServer(server), 5000);
            };

            const { tools } = await client.listTools();
            
            const convertSchema = (schema: any) => {
              try {
                if (!schema) return z.any();
                // Ensure schema is an object
                if (typeof schema !== 'object') return z.any();
                
                const zodCode = jsonSchemaToZod(schema);
                
                // Wrap in a function to provide 'z'
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
              mcpTools[toolName] = tool({
                description: `[MCP: ${server.name}] ${mcpTool.description}`,
                parameters: convertSchema(mcpTool.inputSchema),
                execute: async (args: any) => {
                  console.log(`[MCP] Calling tool: ${server.name}.${mcpTool.name} with args:`, args);
                  // Ensure client is still connected
                  const activeClient = mcpClients[server.name]?.client;
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
            
            mcpClients[server.name] = { client, transport, serverConfig: server };
            console.log(`[MCP] Registered ${tools.length} tools from ${server.name}`);
          } catch (error) {
            console.error(`[MCP] Failed to connect to server ${server.name}:`, error);
            // Retry initial connection
            setTimeout(() => connectToServer(server), 10000);
          }
        };

        for (const server of newServers) {
          await connectToServer(server);
        }
      } catch (error) {
        console.error(`[MCP] Failed to load MCP config:`, error);
      }
    })();

    mcpInitPromise = currentInit;
    return currentInit;
  };

  // Trigger async loading (will be available in subsequent iterations if not immediate)
  const initPromise = loadMcpTools();

  // --- Initialize Modular Tools ---
  const fsTools = createFsTools(options, checkPath);
  const communicationTools = createCommunicationTools(options);
  const visionTools = createVisionTools(options, checkPath, getModel);
  const systemTools = createSystemTools(options, checkPath);
  const webTools = createWebTools(options);
  const agentTools = createAgentTools(options);
  const memoryTools = createMemoryTools(options);

  // --- Initialize Plugins ---
  let pluginTools = {};
  if (workspacePath) {
      try {
          const loader = new PluginLoader(workspacePath);
          pluginTools = await loader.loadPlugins(options);
      } catch (e) {
          console.error('[Tools] Failed to load plugins:', e);
      }
  }

  const allTools: any = {
    ...fsTools,
    ...communicationTools,
    ...visionTools,
    ...systemTools,
    ...webTools,
    ...agentTools,
    ...memoryTools,
    ...pluginTools,
    
    // Include MCP tools that are already loaded
    ...mcpTools,
  };

  return { tools: allTools, initPromise };
}
