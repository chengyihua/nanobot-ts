#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 测试路径
console.log('当前目录:', __dirname);
console.log('向上4级:', path.join(__dirname, '../../../../'));
console.log('向上5级:', path.join(__dirname, '../../../../../'));

// 检查MCP配置文件
const mcpConfigPath1 = path.join(__dirname, '../../../../.claude/.mcp.json');
const mcpConfigPath2 = path.join(__dirname, '../../../../../.claude/.mcp.json');
const mcpConfigPath3 = path.join(__dirname, '../../../../../../.claude/.mcp.json');

console.log('\n检查路径1:', mcpConfigPath1, '存在:', fs.existsSync(mcpConfigPath1));
console.log('检查路径2:', mcpConfigPath2, '存在:', fs.existsSync(mcpConfigPath2));
console.log('检查路径3:', mcpConfigPath3, '存在:', fs.existsSync(mcpConfigPath3));

// 找到正确的路径
let correctPath = null;
if (fs.existsSync(mcpConfigPath1)) correctPath = mcpConfigPath1;
if (fs.existsSync(mcpConfigPath2)) correctPath = mcpConfigPath2;
if (fs.existsSync(mcpConfigPath3)) correctPath = mcpConfigPath3;

if (correctPath) {
  console.log('\n找到MCP配置文件:', correctPath);
  const mcpConfig = JSON.parse(fs.readFileSync(correctPath, 'utf8'));
  console.log('MCP服务器:', Object.keys(mcpConfig.mcpServers));
} else {
  console.log('\n未找到MCP配置文件');
}