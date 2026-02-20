#!/usr/bin/env node

/**
 * MCP统一管理演示
 * 展示如何调用不同MCP服务器的工具
 */

const { spawn } = require('child_process');

console.log('🚀 MCP统一管理演示\n');

// 启动12306 MCP服务器
const mcp12306 = spawn('npx', ['12306-mcp'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let requestId = 1;

// 发送JSON-RPC请求
function sendRequest(mcp, method, params = {}) {
  const id = requestId++;
  const request = {
    jsonrpc: '2.0',
    id,
    method,
    params
  };
  
  mcp.stdin.write(JSON.stringify(request) + '\n');
  return id;
}

// 监听输出
mcp12306.stdout.on('data', (data) => {
  const lines = data.toString().split('\n');
  
  for (const line of lines) {
    if (line.trim() === '') continue;
    
    try {
      const response = JSON.parse(line);
      
      if (response.id === 1) {
        console.log('✅ 12306 MCP初始化成功');
        
        // 演示1：获取当前日期
        setTimeout(() => {
          console.log('\n📅 演示1：获取当前日期');
          sendRequest(mcp12306, 'tools/call', {
            name: 'get-current-date',
            arguments: {}
          });
        }, 500);
      }
      
      if (response.id === 2) {
        const currentDate = response.result.content[0].text;
        console.log(`当前日期: ${currentDate}`);
        
        // 演示2：获取车站代码
        setTimeout(() => {
          console.log('\n📍 演示2：获取车站代码');
          sendRequest(mcp12306, 'tools/call', {
            name: 'get-station-code-of-citys',
            arguments: { citys: '北京|上海' }
          });
        }, 500);
      }
      
      if (response.id === 3) {
        const stationCodes = response.result.content[0].text;
        console.log(`北京上海车站代码: ${stationCodes}`);
        
        // 演示3：查询火车票
        setTimeout(() => {
          console.log('\n🎫 演示3：查询火车票（北京->上海）');
          
          // 明天日期
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowStr = tomorrow.toISOString().split('T')[0];
          
          sendRequest(mcp12306, 'tools/call', {
            name: 'get-tickets',
            arguments: {
              date: tomorrowStr,
              fromStation: 'BJP', // 北京
              toStation: 'SHH',   // 上海
              trainFilterFlags: 'G', // 高铁
              format: 'text'
            }
          });
        }, 500);
      }
      
      if (response.id === 4) {
        console.log('\n' + '='.repeat(60));
        console.log('🚄 火车票查询结果：');
        console.log('='.repeat(60));
        
        if (response.result && response.result.content) {
          const resultText = response.result.content[0].text;
          console.log(resultText);
        }
        
        console.log('='.repeat(60));
        
        // 启动文件系统MCP
        setTimeout(() => {
          console.log('\n📁 演示4：启动文件系统MCP');
          startFilesystemMCP();
        }, 1000);
      }
      
    } catch (error) {
      // 忽略解析错误
    }
  }
});

// 启动文件系统MCP
function startFilesystemMCP() {
  const mcpFs = spawn('npx', ['-y', '@modelcontextprotocol/server-filesystem', 
    '/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace',
    '/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/skills'
  ], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let fsRequestId = 100;
  
  // 发送初始化请求
  const initRequest = {
    jsonrpc: '2.0',
    id: fsRequestId++,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'MCP演示客户端',
        version: '1.0.0'
      }
    }
  };
  
  mcpFs.stdin.write(JSON.stringify(initRequest) + '\n');
  
  // 监听输出
  mcpFs.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    
    for (const line of lines) {
      if (line.trim() === '') continue;
      
      try {
        const response = JSON.parse(line);
        
        if (response.id === 100) {
          console.log('✅ 文件系统MCP初始化成功');
          
          // 获取工具列表
          setTimeout(() => {
            const toolsRequest = {
              jsonrpc: '2.0',
              id: fsRequestId++,
              method: 'tools/list'
            };
            mcpFs.stdin.write(JSON.stringify(toolsRequest) + '\n');
          }, 500);
        }
        
        if (response.id === 101) {
          console.log(`📋 文件系统MCP有 ${response.result.tools.length} 个工具`);
          
          // 演示：读取文件
          setTimeout(() => {
            console.log('\n📄 演示5：读取文件');
            const readRequest = {
              jsonrpc: '2.0',
              id: fsRequestId++,
              method: 'tools/call',
              params: {
                name: 'read_text_file',
                arguments: {
                  path: '/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace/MEMORY.md',
                  head: 10  // 只读取前10行
                }
              }
            };
            mcpFs.stdin.write(JSON.stringify(readRequest) + '\n');
          }, 500);
        }
        
        if (response.id === 102) {
          console.log('\n📝 文件内容（前10行）：');
          if (response.result && response.result.content) {
            console.log(response.result.content);
          }
          
          // 演示：列目录
          setTimeout(() => {
            console.log('\n📂 演示6：列目录');
            const listRequest = {
              jsonrpc: '2.0',
              id: fsRequestId++,
              method: 'tools/call',
              params: {
                name: 'list_directory',
                arguments: {
                  path: '/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace'
                }
              }
            };
            mcpFs.stdin.write(JSON.stringify(listRequest) + '\n');
          }, 500);
        }
        
        if (response.id === 103) {
          console.log('\n📁 工作空间目录列表：');
          if (response.result && response.result.content) {
            console.log(response.result.content);
          }
          
          console.log('\n' + '='.repeat(60));
          console.log('✅ MCP统一管理演示完成！');
          console.log('='.repeat(60));
          
          // 退出
          setTimeout(() => {
            mcp12306.kill();
            mcpFs.kill();
            process.exit(0);
          }, 2000);
        }
        
      } catch (error) {
        // 忽略解析错误
      }
    }
  });
}

// 初始化12306 MCP
console.log('🔄 初始化12306 MCP...');
sendRequest(mcp12306, 'initialize', {
  protocolVersion: '2024-11-05',
  capabilities: {},
  clientInfo: {
    name: '12306演示客户端',
    version: '1.0.0'
  }
});

// 超时处理
setTimeout(() => {
  console.log('\n⏰ 演示超时，退出...');
  mcp12306.kill();
  process.exit(0);
}, 30000);