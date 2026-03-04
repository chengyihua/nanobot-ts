
import { z } from 'zod';
import { tool } from 'ai';
import { MCPClientManager } from '../../core/mcp/client-manager.js';

export function createMCPTools(mcpManager: MCPClientManager) {
  return {
    mcp_list_servers: tool({
      description: 'List all connected MCP servers and their status',
      parameters: z.object({}),
      execute: async () => {
        const servers = mcpManager.getServers();
        return {
          connected_servers: servers,
          count: servers.length,
        };
      },
    }),

    mcp_connect_server: tool({
      description: 'Connect to a new MCP server at runtime',
      parameters: z.object({
        name: z.string().describe('Unique name for the server'),
        command: z.string().describe('Command to execute (e.g. npx, python, docker)'),
        args: z.array(z.string()).optional().describe('Arguments for the command'),
        env: z.record(z.string()).optional().describe('Environment variables'),
      }),
      execute: async ({ name, command, args = [], env = {} }) => {
        try {
          await mcpManager.connectServer(name, { command, args, env });
          return { success: true, message: `Connected to MCP server '${name}'` };
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      },
    }),

    mcp_list_tools: tool({
      description: 'List available tools from a specific MCP server or all servers',
      parameters: z.object({
        server_name: z.string().optional().describe('Filter by server name'),
      }),
      execute: async ({ server_name }) => {
        const tools = await mcpManager.listTools();
        if (server_name) {
          return tools.filter(t => t.serverName === server_name);
        }
        return tools.map(t => ({
          name: t.name,
          originalName: t.originalName,
          server: t.serverName,
          description: t.description,
          inputSchema: t.inputSchema,
        }));
      },
    }),

    mcp_call_tool: tool({
      description: 'Execute a tool from a specific MCP server dynamically',
      parameters: z.object({
        server_name: z.string().describe('Name of the MCP server'),
        tool_name: z.string().describe('Original name of the tool on the server (not the namespaced one)'),
        arguments: z.record(z.any()).describe('Arguments for the tool'),
      }),
      execute: async ({ server_name, tool_name, arguments: args }) => {
        try {
          const result = await mcpManager.callTool(server_name, tool_name, args);
          return result;
        } catch (error: any) {
          return { error: error.message };
        }
      },
    }),
  };
}
