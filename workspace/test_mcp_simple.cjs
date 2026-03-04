// 简单测试MCP连接
const { spawn } = require('child_process');

console.log("=== 测试MCP服务器连接 ===");

// 启动12306-mcp服务器
const mcpServer = spawn('12306-mcp', [], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
let error = '';

mcpServer.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  console.log(`服务器输出: ${text.trim()}`);
});

mcpServer.stderr.on('data', (data) => {
  const text = data.toString();
  error += text;
  console.error(`服务器错误: ${text.trim()}`);
});

mcpServer.on('close', (code) => {
  console.log(`服务器退出，代码: ${code}`);
  console.log(`总输出: ${output.substring(0, 200)}...`);
  console.log(`总错误: ${error.substring(0, 200)}...`);
});

// 5秒后停止服务器
setTimeout(() => {
  console.log("停止MCP服务器...");
  mcpServer.kill();
  process.exit(0);
}, 5000);