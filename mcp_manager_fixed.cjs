#!/usr/bin/env node

/**
 * 通用MCP管理器
 * 可以处理任何MCP服务器
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class MCPManager {
  constructor() {
    this.servers = new Map(); // name -> {process, tools}
    this.requests = new Map(); // id -> {resolve, reject}
    this.nextRequestId = 1;
  }

  // 从配置文件加载MCP服务器
  async loadConfig(configPath) {
    try {
      const configData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData);
      
      console.log(`📋 加载MCP配置: ${config.servers.length} 个服务器`);
      
      for (const serverConfig of config.servers) {
        await this.startServer(serverConfig);
      }
      
      return true;
    } catch (error) {
      console.error(`❌ 加载配置失败: ${error.message}`);
      return false;
    }
  }

  // 启动MCP服务器
  async startServer(config) {
    console.log(`🚀 启动MCP服务器: ${config.name}`);
    
    const server = {
      name: config.name,
      config,
      process: null,
      tools: [],
      ready: false
    };

    try {
      // 启动进程
      server.process = spawn(config.command, config.args || [], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // 监听输出
      server.process.stdout.on('data', (data) => {
        this.handleServerOutput(server, data);
      });

      server.process.stderr.on('data', (data) => {
        console.error(`[${server.name} 错误]: ${data.toString()}`);
      });

      // 初始化服务器
      await this.initializeServer(server);
      
      this.servers.set(config.name, server);
      console.log(`✅ MCP服务器 ${config.name} 启动成功`);
      
      return server;
    } catch (error) {
      console.error(`❌ 启动MCP服务器 ${config.name} 失败: ${error.message}`);
      return null;
    }
  }

  // 初始化MCP服务器
  async initializeServer(server) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`初始化超时: ${server.name}`));
      }, 10000);

      // 发送初始化请求
      const initId = this.nextRequestId++;
      this.requests.set(initId, {
        resolve: (result) => {
          clearTimeout(timeout);
          console.log(`✅ ${server.name} 初始化成功`);
          
          // 获取工具列表
          this.listTools(server).then(() => {
            server.ready = true;
            resolve(server);
          }).catch(reject);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });

      const initRequest = {
        jsonrpc: '2.0',
        id: initId,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'MCP管理器',
            version: '1.0.0'
          }
        }
      };

      server.process.stdin.write(JSON.stringify(initRequest) + '\n');
    });
  }

  // 获取工具列表
  async listTools(server) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`获取工具列表超时: ${server.name}`));
      }, 5000);

      const toolsId = this.nextRequestId++;
      this.requests.set(toolsId, {
        resolve: (result) => {
          clearTimeout(timeout);
          if (result && result.tools) {
            server.tools = result.tools;
            console.log(`🛠️  ${server.name} 有 ${result.tools.length} 个工具:`);
            result.tools.forEach((tool, index) => {
              console.log(`  ${index + 1}. ${tool.name} - ${tool.description.substring(0, 60)}...`);
            });
          }
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });

      const toolsRequest = {
        jsonrpc: '2.0',
        id: toolsId,
        method: 'tools/list'
      };

      server.process.stdin.write(JSON.stringify(toolsRequest) + '\n');
    });
  }

  // 处理服务器输出
  handleServerOutput(server, data) {
    const lines = data.toString().split('\n');
    
    for (const line of lines) {
      if (line.trim() === '') continue;
      
      try {
        const response = JSON.parse(line);
        
        // 处理响应
        if (response.id && this.requests.has(response.id)) {
          const { resolve, reject } = this.requests.get(response.id);
          this.requests.delete(response.id);
          
          if (response.error) {
            reject(new Error(`MCP错误: ${JSON.stringify(response.error)}`));
          } else {
            resolve(response.result);
          }
        } else {
          // 服务器推送的消息
          console.log(`[${server.name} 推送]:`, response);
        }
      } catch (error) {
        // 忽略非JSON输出
        if (!line.includes('12306 MCP Server running')) {
          console.log(`[${server.name} 输出]: ${line}`);
        }
      }
    }
  }

  // 调用工具
  async callTool(serverName, toolName, toolArgs = {}) {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`服务器不存在: ${serverName}`);
    }

    if (!server.ready) {
      throw new Error(`服务器未就绪: ${serverName}`);
    }

    // 检查工具是否存在
    const tool = server.tools.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`工具不存在: ${toolName} (在服务器 ${serverName})`);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`调用工具超时: ${toolName}`));
      }, 15000);

      const callId = this.nextRequestId++;
      this.requests.set(callId, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });

      const callRequest = {
        jsonrpc: '2.0',
        id: callId,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: toolArgs
        }
      };

      console.log(`🔧 调用工具: ${serverName}.${toolName}`);
      server.process.stdin.write(JSON.stringify(callRequest) + '\n');
    });
  }

  // 查找工具
  findTool(toolName) {
    for (const [serverName, server] of this.servers) {
      const tool = server.tools.find(t => t.name === toolName);
      if (tool) {
        return { serverName, tool };
      }
    }
    return null;
  }

  // 列出所有工具
  listAllTools() {
    const allTools = [];
    for (const [serverName, server] of this.servers) {
      for (const tool of server.tools) {
        allTools.push({
          server: serverName,
          name: tool.name,
          description: tool.description
        });
      }
    }
    return allTools;
  }

  // 停止所有服务器
  stopAll() {
    console.log('🛑 停止所有MCP服务器...');
    for (const [name, server] of this.servers) {
      if (server.process) {
        server.process.kill();
        console.log(`✅ 停止服务器: ${name}`);
      }
    }
    this.servers.clear();
  }
}

// 使用示例
async function main() {
  console.log('🚀 MCP管理器启动');
  
  const manager = new MCPManager();
  
  try {
    // 加载配置
    const configPath = path.join(__dirname, '.nanobot/mcp.json');
    await manager.loadConfig(configPath);
    
    // 等待服务器启动
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 列出所有工具
    console.log('\n📋 所有可用工具:');
    const allTools = manager.listAllTools();
    allTools.forEach((tool, index) => {
      console.log(`${index + 1}. [${tool.server}] ${tool.name}`);
      console.log(`   描述: ${tool.description.substring(0, 80)}...`);
    });
    
    console.log('\n✅ MCP管理器运行正常！');
    console.log('\n⏳ 按 Ctrl+C 退出...');
    
    // 保持运行
    process.on('SIGINT', () => {
      manager.stopAll();
      process.exit(0);
    });
    
    // 不要退出，保持运行
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ MCP管理器错误:', error);
    manager.stopAll();
    process.exit(1);
  }
}

// 如果直接运行
if (require.main === module) {
  main();
}

module.exports = MCPManager;