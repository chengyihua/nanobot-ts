#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 直接调用MCP工具的函数
function callMCPToolDirectly(serverName, toolName, args = {}) {
  console.log(`调用MCP工具: ${serverName}/${toolName}`);
  console.log(`参数: ${JSON.stringify(args)}`);
  
  try {
    // 使用execSync直接调用
    const argsStr = JSON.stringify(args);
    const command = `npx tsx cli.ts call-tool "${serverName}" "${toolName}" '${argsStr}'`;
    
    console.log(`执行命令: ${command}`);
    
    const output = execSync(command, {
      cwd: __dirname,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    console.log(`工具执行成功: ${output.substring(0, 500)}...`);
    return output;
  } catch (error) {
    console.error(`工具执行失败: ${error.message}`);
    if (error.stderr) {
      console.error(`错误输出: ${error.stderr.substring(0, 1000)}`);
    }
    throw error;
  }
}

// 查询北京到上海火车票的完整流程
async function queryBeijingToShanghaiTickets() {
  console.log('=== 查询北京到上海火车票 ===\n');
  
  try {
    // 1. 获取当前日期
    console.log('1. 获取当前日期...');
    const currentDate = callMCPToolDirectly('12306-mcp', 'get-current-date', {});
    console.log(`当前日期: ${currentDate}`);
    
    // 解析日期，计算明天
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    console.log(`明天日期: ${tomorrowStr}`);
    
    // 2. 获取北京车站代码
    console.log('\n2. 获取北京车站代码...');
    const beijingStations = callMCPToolDirectly('12306-mcp', 'get-station-code-of-citys', { citys: '北京' });
    console.log(`北京车站代码: ${beijingStations.substring(0, 200)}...`);
    
    // 解析北京车站代码（假设第一个）
    let beijingCode = 'BJP'; // 默认北京站
    try {
      const stations = JSON.parse(beijingStations);
      if (stations && stations.length > 0) {
        beijingCode = stations[0].station_code;
      }
    } catch (e) {
      console.log('无法解析车站代码，使用默认值');
    }
    
    // 3. 获取上海车站代码
    console.log('\n3. 获取上海车站代码...');
    const shanghaiStations = callMCPToolDirectly('12306-mcp', 'get-station-code-of-citys', { citys: '上海' });
    console.log(`上海车站代码: ${shanghaiStations.substring(0, 200)}...`);
    
    // 解析上海车站代码（假设第一个）
    let shanghaiCode = 'SHH'; // 默认上海站
    try {
      const stations = JSON.parse(shanghaiStations);
      if (stations && stations.length > 0) {
        shanghaiCode = stations[0].station_code;
      }
    } catch (e) {
      console.log('无法解析车站代码，使用默认值');
    }
    
    // 4. 查询火车票
    console.log('\n4. 查询火车票...');
    console.log(`参数: 日期=${tomorrowStr}, 出发=${beijingCode}, 到达=${shanghaiCode}`);
    
    const tickets = callMCPToolDirectly('12306-mcp', 'get-tickets', {
      date: tomorrowStr,
      fromStation: beijingCode,
      toStation: shanghaiCode,
      trainFilterFlags: 'GDF', // 高铁、动车、复兴号
      format: 'text'
    });
    
    console.log('\n=== 查询结果 ===');
    console.log(tickets.substring(0, 1000) + '...');
    
    return tickets;
  } catch (error) {
    console.error('查询失败:', error.message);
    return null;
  }
}

// 测试简单工具调用
async function testSimpleTool() {
  console.log('=== 测试简单MCP工具调用 ===\n');
  
  try {
    // 测试get-current-date工具
    console.log('测试 get-current-date 工具...');
    const result = callMCPToolDirectly('12306-mcp', 'get-current-date', {});
    console.log(`结果: ${result}`);
    return true;
  } catch (error) {
    console.error('测试失败:', error.message);
    return false;
  }
}

// 主函数
async function main() {
  const action = process.argv[2] || 'test';
  
  if (action === 'query') {
    await queryBeijingToShanghaiTickets();
  } else if (action === 'test') {
    await testSimpleTool();
  } else {
    console.log('使用方法:');
    console.log('  node simple-mcp-client.cjs test    - 测试简单工具调用');
    console.log('  node simple-mcp-client.cjs query   - 查询北京到上海火车票');
    console.log('\n示例:');
    console.log('  node simple-mcp-client.cjs test');
    console.log('  node simple-mcp-client.cjs query');
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(error => {
    console.error('程序执行失败:', error);
    process.exit(1);
  });
}

module.exports = {
  callMCPToolDirectly,
  queryBeijingToShanghaiTickets,
  testSimpleTool
};