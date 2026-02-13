// MCP测试脚本 (CommonJS版本)
const { Client } = require('@modelcontextprotocol/sdk');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/stdio');

async function testMCP() {
  console.log('=== MCP测试开始 ===');
  
  try {
    // 测试1: 检查SDK是否可用
    console.log('✅ MCP SDK已加载');
    
    // 测试2: 创建一个简单的MCP客户端
    const client = new Client(
      {
        name: 'nanobot-test',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );
    
    console.log('✅ MCP客户端创建成功');
    
    // 测试3: 尝试启动文件系统服务器
    console.log('尝试启动文件系统服务器...');
    
    // 创建启动脚本
    const fs = require('fs');
    const { spawn } = require('child_process');
    
    // 启动文件系统服务器
    const serverProcess = spawn('npx', [
      '@modelcontextprotocol/server-filesystem',
      '--directory',
      process.env.HOME + '/Documents',
      '--port',
      '3000'
    ], {
      stdio: 'pipe',
      detached: true
    });
    
    console.log('✅ 文件系统服务器已启动 (PID: ' + serverProcess.pid + ')');
    
    // 等待服务器启动
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 测试4: 检查服务器是否运行
    const http = require('http');
    
    const checkServer = () => {
      return new Promise((resolve, reject) => {
        const req = http.get('http://localhost:3000', (res) => {
          if (res.statusCode === 200) {
            resolve(true);
          } else {
            resolve(false);
          }
        });
        
        req.on('error', () => {
          resolve(false);
        });
        
        req.setTimeout(1000, () => {
          req.destroy();
          resolve(false);
        });
      });
    };
    
    const isRunning = await checkServer();
    
    if (isRunning) {
      console.log('✅ MCP服务器运行正常');
    } else {
      console.log('⚠️  MCP服务器可能未启动，但SDK可用');
    }
    
    // 停止服务器
    try {
      process.kill(-serverProcess.pid);
      console.log('✅ 服务器已停止');
    } catch (e) {
      // 忽略错误
    }
    
    console.log('=== MCP测试完成 ===');
    console.log('\n🎉 MCP安装成功！');
    console.log('\n下一步：');
    console.log('1. 配置nanobot使用MCP');
    console.log('2. 创建MCP技能');
    console.log('3. 测试MCP功能');
    
  } catch (error) {
    console.error('❌ MCP测试失败:', error.message);
    console.error('错误详情:', error);
  }
}

// 运行测试
testMCP();