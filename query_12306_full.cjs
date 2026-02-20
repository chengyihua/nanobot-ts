#!/usr/bin/env node

/**
 * 完整的12306查询流程
 */

const { spawn } = require('child_process');

console.log('🚄 开始查询12306火车票...\n');

// 创建MCP服务器进程
const mcpServer = spawn('npx', ['12306-mcp'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let requestId = 1;
const responses = {};

// 发送JSON-RPC请求
function sendRequest(method, params = {}) {
  const id = requestId++;
  const request = {
    jsonrpc: '2.0',
    id,
    method,
    params
  };
  
  mcpServer.stdin.write(JSON.stringify(request) + '\n');
  return id;
}

// 监听MCP服务器输出
mcpServer.stdout.on('data', (data) => {
  const lines = data.toString().split('\n');
  
  for (const line of lines) {
    if (line.trim() === '') continue;
    
    try {
      const response = JSON.parse(line);
      
      if (response.id === 1) {
        console.log('✅ MCP服务器初始化成功');
        // 获取当前日期
        setTimeout(() => {
          console.log('📅 获取当前日期...');
          sendRequest('tools/call', {
            name: 'get-current-date',
            arguments: {}
          });
        }, 500);
      }
      
      if (response.id === 2) {
        console.log('✅ 获取当前日期成功');
        const currentDate = response.result.content[0].text;
        console.log(`当前日期: ${currentDate}`);
        
        // 计算明天日期
        const today = new Date(currentDate);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        console.log(`明天日期: ${tomorrowStr}`);
        
        // 获取广州车站代码
        setTimeout(() => {
          console.log('📍 获取广州车站代码...');
          sendRequest('tools/call', {
            name: 'get-station-code-of-citys',
            arguments: {
              citys: '广州'
            }
          });
        }, 500);
      }
      
      if (response.id === 3) {
        console.log('✅ 获取广州车站代码成功');
        const guangzhouCode = response.result.content[0].text;
        console.log(`广州车站代码: ${guangzhouCode}`);
        
        // 获取宜昌车站代码
        setTimeout(() => {
          console.log('📍 获取宜昌车站代码...');
          sendRequest('tools/call', {
            name: 'get-station-code-of-citys',
            arguments: {
              citys: '宜昌'
            }
          });
        }, 500);
      }
      
      if (response.id === 4) {
        console.log('✅ 获取宜昌车站代码成功');
        const yichangCode = response.result.content[0].text;
        console.log(`宜昌车站代码: ${yichangCode}`);
        
        // 查询火车票
        setTimeout(() => {
          console.log('🎫 查询明天广州到宜昌的高铁票...');
          
          // 计算明天日期
          const today = new Date();
          const tomorrow = new Date(today);
          tomorrow.setDate(today.getDate() + 1);
          const tomorrowStr = tomorrow.toISOString().split('T')[0];
          
          sendRequest('tools/call', {
            name: 'get-tickets',
            arguments: {
              date: tomorrowStr,
              fromStation: 'GZQ', // 广州站代码
              toStation: 'YCN',   // 宜昌站代码
              trainFilterFlags: 'G', // 只查询高铁
              format: 'text'
            }
          });
        }, 500);
      }
      
      if (response.id === 5) {
        console.log('\n' + '='.repeat(60));
        console.log('🚄 查询结果：');
        console.log('='.repeat(60));
        
        if (response.result && response.result.content) {
          const resultText = response.result.content[0].text;
          console.log(resultText);
        } else {
          console.log('❌ 查询失败:', JSON.stringify(response, null, 2));
        }
        
        console.log('='.repeat(60));
        
        // 退出
        setTimeout(() => {
          console.log('\n✅ 查询完成！');
          mcpServer.kill();
          process.exit(0);
        }, 1000);
      }
      
    } catch (error) {
      // 忽略JSON解析错误
    }
  }
});

mcpServer.stderr.on('data', (data) => {
  // 忽略错误输出
});

// 发送初始化请求
console.log('🔄 初始化MCP服务器...');
sendRequest('initialize', {
  protocolVersion: '2024-11-05',
  capabilities: {},
  clientInfo: {
    name: '12306查询客户端',
    version: '1.0.0'
  }
});

// 超时处理
setTimeout(() => {
  console.log('\n⏰ 查询超时，退出...');
  mcpServer.kill();
  process.exit(1);
}, 30000);