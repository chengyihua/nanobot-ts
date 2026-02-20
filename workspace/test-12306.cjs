#!/usr/bin/env node

const { spawn } = require('child_process');
const readline = require('readline');

// 创建12306-mcp进程
const mcpServer = spawn('npx', ['12306-mcp'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// 设置读取行接口
const rl = readline.createInterface({
  input: mcpServer.stdout,
  output: process.stdout,
  terminal: false
});

// 监听输出
rl.on('line', (line) => {
  console.log('MCP Server:', line);
  
  // 检查服务器是否已启动
  if (line.includes('running') || line.includes('ready')) {
    console.log('Server appears to be running');
  }
});

// 监听错误
mcpServer.stderr.on('data', (data) => {
  console.error('MCP Server Error:', data.toString());
});

// 监听退出
mcpServer.on('close', (code) => {
  console.log(`MCP Server exited with code ${code}`);
});

// 发送初始化消息
setTimeout(() => {
  const initMessage = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "test-client",
        version: "1.0.0"
      }
    }
  });
  
  console.log('Sending initialize message:', initMessage);
  mcpServer.stdin.write(initMessage + '\n');
}, 1000);

// 发送工具列表请求
setTimeout(() => {
  const toolsMessage = JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list"
  });
  
  console.log('Sending tools/list message:', toolsMessage);
  mcpServer.stdin.write(toolsMessage + '\n');
}, 2000);

// 10秒后退出
setTimeout(() => {
  console.log('Test complete, exiting...');
  mcpServer.kill();
  process.exit(0);
}, 10000);