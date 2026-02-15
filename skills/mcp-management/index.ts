
import { Plugin } from '../../src/core/plugin.js';
import { ToolOptions } from '../../src/tools/types.js';
import { MCPClientManager } from './scripts/mcp-client.js';

export default function createPlugin(options: ToolOptions): Plugin {
  return {
    name: 'mcp-management',
    init: async (options: ToolOptions) => {
      const manager = new MCPClientManager();
      try {
        await manager.loadConfig(); // Load default config from ~/.claude/.mcp.json or similar
        await manager.connectAll();
        
        const tools: Record<string, any> = {};
        const mcpTools = await manager.getAllTools();
        
        for (const tool of mcpTools) {
          // Register tool with a namespaced name to avoid conflicts
          // e.g. "mcp__server__tool" or just "server__tool"
          const toolName = `${tool.serverName}__${tool.name}`;
          tools[toolName] = {
            description: tool.description,
            parameters: tool.inputSchema,
            execute: async (args: any) => {
              return await manager.callTool(tool.serverName, tool.name, args);
            }
          };
        }
        
        console.log(`[mcp-management] Loaded ${Object.keys(tools).length} MCP tools.`);
        return tools;
      } catch (error) {
        console.warn('[mcp-management] Failed to initialize MCP client:', error);
        return {};
      }
    }
  };
}
