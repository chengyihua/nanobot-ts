#!/usr/bin/env node

/**
 * 查询武汉到宜昌的高铁票
 */

const { spawn } = require('child_process');

console.log('🚄 查询武汉到宜昌高铁票\n');

// 启动12306 MCP服务器
const mcp12306 = spawn('npx', ['12306-mcp'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let requestId = 1;
let results = [];

// 发送JSON-RPC请求
function sendRequest(method, params = {}) {
  const id = requestId++;
  const request = {
    jsonrpc: '2.0',
    id,
    method,
    params
  };
  
  mcp12306.stdin.write(JSON.stringify(request) + '\n');
  return id;
}

// 监听输出
mcp12306.stdout.on('data', (data) => {
  const lines = data.toString().split('\n');
  
  for (const line of lines) {
    if (line.trim() === '') continue;
    
    try {
      const response = JSON.parse(line);
      
      // 定义变量
      let wuhanStation = 'WHN';
      let yichangStation = 'YCN';
      
      // 定义变量
      let wuhanStation = 'WHN';
      let yichangStation = 'YCN';
      
      // 处理初始化响应
      if (response.id === 1) {
        console.log('✅ 12306 MCP初始化成功');
        
        // 步骤1：获取当前日期
        setTimeout(() => {
          console.log('📅 获取当前日期...');
          sendRequest('tools/call', {
            name: 'get-current-date',
            arguments: {}
          });
        }, 500);
      }
      
      // 获取当前日期结果
      if (response.id === 2) {
        const currentDate = response.result.content[0].text;
        console.log(`当前日期: ${currentDate}`);
        
        // 步骤2：获取武汉车站代码
        setTimeout(() => {
          console.log('📍 获取武汉车站代码...');
          sendRequest('tools/call', {
            name: 'get-station-code-of-citys',
            arguments: { citys: '武汉' }
          });
        }, 500);
      }
      
      // 获取武汉车站代码结果
      if (response.id === 3) {
        const wuhanCodes = response.result.content[0].text;
        console.log(`武汉车站代码: ${wuhanCodes}`);
        
        // 解析武汉车站代码
        try {
          const codes = JSON.parse(wuhanCodes);
          if (codes['武汉']) {
            wuhanStation = codes['武汉'].station_code;
            console.log(`使用车站代码: ${wuhanStation} (${codes['武汉'].station_name})`);
          }
        } catch (e) {
          console.log('使用默认车站代码: WHN (武汉站)');
        }
        
        // 步骤3：获取宜昌车站代码
        setTimeout(() => {
          console.log('📍 获取宜昌车站代码...');
          sendRequest('tools/call', {
            name: 'get-station-code-of-citys',
            arguments: { citys: '宜昌' }
          });
        }, 500);
      }
      
      // 获取宜昌车站代码结果
      if (response.id === 4) {
        const yichangCodes = response.result.content[0].text;
        console.log(`宜昌车站代码: ${yichangCodes}`);
        
        // 解析宜昌车站代码
        let yichangStation = 'YCN'; // 默认宜昌站
        
        try {
          const codes = JSON.parse(yichangCodes);
          if (codes['宜昌']) {
            yichangStation = codes['宜昌'].station_code;
            console.log(`使用车站代码: ${yichangStation} (${codes['宜昌'].station_name})`);
          }
        } catch (e) {
          console.log('使用默认车站代码: YCN (宜昌站)');
        }
        
        // 步骤4：查询明天的高铁票
        setTimeout(() => {
          console.log('\n🎫 查询明天武汉到宜昌的高铁票...');
          
          // 明天日期
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowStr = tomorrow.toISOString().split('T')[0];
          
          console.log(`查询日期: ${tomorrowStr}`);
          console.log(`路线: 武汉(${wuhanStation}) → 宜昌(${yichangStation})`);
          console.log(`筛选: 高铁(G字头)`);
          
          sendRequest('tools/call', {
            name: 'get-tickets',
            arguments: {
              date: tomorrowStr,
              fromStation: wuhanStation,
              toStation: yichangStation,
              trainFilterFlags: 'G', // 高铁
              format: 'text'
            }
          });
        }, 500);
      }
      
      // 查询结果
      if (response.id === 5) {
        console.log('\n' + '='.repeat(70));
        console.log('🚄 武汉 → 宜昌 高铁票查询结果');
        console.log('='.repeat(70));
        
        if (response.result && response.result.content) {
          const resultText = response.result.content[0].text;
          console.log(resultText);
          
          // 保存结果
          results.push(resultText);
        } else {
          console.log('❌ 未获取到查询结果');
        }
        
        console.log('='.repeat(70));
        
        // 尝试查询动车票（D字头）
        setTimeout(() => {
          console.log('\n🚅 同时查询动车票（D字头）...');
          
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowStr = tomorrow.toISOString().split('T')[0];
          
          sendRequest('tools/call', {
            name: 'get-tickets',
            arguments: {
              date: tomorrowStr,
              fromStation: 'WHN',
              toStation: 'YCN',
              trainFilterFlags: 'D', // 动车
              format: 'text'
            }
          });
        }, 1000);
      }
      
      // 动车查询结果
      if (response.id === 6) {
        console.log('\n' + '='.repeat(70));
        console.log('🚅 武汉 → 宜昌 动车票查询结果');
        console.log('='.repeat(70));
        
        if (response.result && response.result.content) {
          const resultText = response.result.content[0].text;
          console.log(resultText);
          
          // 保存结果
          results.push(resultText);
        }
        
        console.log('='.repeat(70));
        
        // 总结
        setTimeout(() => {
          console.log('\n📊 查询总结:');
          console.log('1. 已查询明天武汉到宜昌的高铁票');
          console.log('2. 已查询明天武汉到宜昌的动车票');
          console.log('3. 查询完成！');
          
          // 退出
          mcp12306.kill();
          process.exit(0);
        }, 1000);
      }
      
    } catch (error) {
      // 忽略解析错误
    }
  }
});

// 错误处理
mcp12306.stderr.on('data', (data) => {
  console.error('MCP错误:', data.toString());
});

// 超时处理
setTimeout(() => {
  console.log('\n⏰ 查询超时，退出...');
  mcp12306.kill();
  process.exit(0);
}, 20000);

// 初始化12306 MCP
console.log('🔄 初始化12306 MCP...');
sendRequest('initialize', {
  protocolVersion: '2024-11-05',
  capabilities: {},
  clientInfo: {
    name: '武汉宜昌查询客户端',
    version: '1.0.0'
  }
});