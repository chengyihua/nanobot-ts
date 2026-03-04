
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Config } from "../config.js";
import { createLogger } from "../../utils/logger.js";

const log = createLogger('mcp');

export class MCPClientManager {
  private clients: Map<string, Client>;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.clients = new Map();
  }

  public async initialize(): Promise<void> {
    const servers = this.config.mcp?.servers || {};
    
    for (const [name, serverConfig] of Object.entries(servers)) {
      if (serverConfig.disabled) {
        log.info({ name }, 'Skipping disabled MCP server');
        continue;
      }

      await this.connectServer(name, serverConfig);
    }
  }

  public async connectServer(name: string, serverConfig: { command: string, args?: string[], env?: Record<string, string> }): Promise<void> {
    try {
      log.info({ name, command: serverConfig.command }, 'Connecting to MCP server...');
      
      // Filter out undefined values from env
      const env = Object.entries({ ...process.env, ...serverConfig.env })
        .reduce((acc, [key, value]) => {
          if (value !== undefined) acc[key] = value;
          return acc;
        }, {} as Record<string, string>);

      const transport = new StdioClientTransport({
        command: serverConfig.command,
        args: serverConfig.args,
        env,
      });

      const client = new Client(
        {
          name: "nanobot-client",
          version: "1.0.0",
        },
        {
          capabilities: {
            // Minimal capabilities for now
          },
        }
      );

      await client.connect(transport);
      this.clients.set(name, client);
      log.info({ name }, 'Connected to MCP server');
    } catch (error) {
      log.error({ name, error }, 'Failed to connect to MCP server');
      throw error;
    }
  }

  public async disconnectServer(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (client) {
      try {
        await client.close();
        this.clients.delete(name);
        log.info({ name }, 'Disconnected from MCP server');
      } catch (error) {
        log.error({ name, error }, 'Error disconnecting from MCP server');
        throw error;
      }
    }
  }

  public getServers(): string[] {
    return Array.from(this.clients.keys());
  }

  public async close(): Promise<void> {
    for (const [name, client] of this.clients.entries()) {
      try {
        await client.close();
        log.info({ name }, 'Disconnected from MCP server');
      } catch (error) {
        log.error({ name, error }, 'Error disconnecting from MCP server');
      }
    }
    this.clients.clear();
  }

  public async listTools(): Promise<any[]> {
    const allTools: any[] = [];

    for (const [serverName, client] of this.clients.entries()) {
      try {
        const result = await client.listTools();
        const tools = result.tools.map(tool => ({
          ...tool,
          serverName, // Tag with server name for routing
          // Ensure name is unique or namespaced if needed
          originalName: tool.name,
          name: `${serverName}__${tool.name}`
        }));
        allTools.push(...tools);
      } catch (error) {
        log.error({ serverName, error }, 'Failed to list tools from MCP server');
      }
    }

    return allTools;
  }

  public async callTool(serverName: string, toolName: string, args: any): Promise<any> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`MCP server '${serverName}' not found or not connected`);
    }

    try {
      // Find the tool to get its original name if needed (handling namespacing)
      // If toolName contains __, it might be namespaced. The user might pass "server__tool" or just "tool"
      // But the MCP client expects the original name as defined on the server.
      
      // However, if we are calling via mcp_call_tool, we likely pass the original name directly.
      // If we are calling via the flattened tool, the execute function in tool-registry passes t.originalName.
      
      const result = await client.callTool({
        name: toolName,
        arguments: args,
      });
      return result;
    } catch (error) {
      log.error({ serverName, toolName, error }, 'Error calling MCP tool');
      throw error;
    }
  }
}
