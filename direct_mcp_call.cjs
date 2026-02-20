#!/usr/bin/env node

/**
 * 直接调用MCP工具，绕过DeepSeek Executor的问题
 */

const { spawn } = require('child_process');
const readline = require('readline');

// 创建MCP服务器进程
const mcpServer = spawn('npx', ['12306-mcp'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// 监听MCP服务器输出
mcpServer.stdout.on('data', (data) => {
  console.log('MCP服务器输出:', data.toString());
});

mcpServer.stderr.on('data', (data) => {
  console.error('MCP服务器错误:', data.toString());
});

// 发送初始化请求
const initRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'Direct MCP Client',
      version: '1.0.0'
    }
  }
};

console.log('发送初始化请求...');
mcpServer.stdin.write(JSON.stringify(initRequest) + '\n');

// 发送工具列表请求
setTimeout(() => {
  const toolsRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list'
  };
  
  console.log('发送工具列表请求...');
  mcpServer.stdin.write(JSON.stringify(toolsRequest) + '\n');
}, 1000);

// 发送查询火车票请求
setTimeout(() => {
  // 获取明天的日期
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];
  
  const ticketsRequest = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'get-tickets',
      arguments: {
        from_station: '广州',
        to_station: '宜昌',
        date: dateStr
      }
    }
  };
  
  console.log(`发送查询火车票请求 (${dateStr} 广州->宜昌)...`);
  mcpServer.stdin.write(JSON.stringify(ticketsRequest) + '\n');
}, 2000);

// 10秒后退出
setTimeout(() => {
  console.log('退出...');
  mcpServer.kill();
  process.exit(0);
}, 10000);