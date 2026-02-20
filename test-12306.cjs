const { spawn } = require('child_process');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function test12306() {
  console.log('启动12306-mcp服务器...');
  
  // 启动12306-mcp服务器
  const serverProcess = spawn('12306-mcp', [], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // 创建MCP客户端
  const transport = new StdioClientTransport({
    command: '12306-mcp',
    args: []
  });

  const client = new Client(
    {
      name: 'test-client',
      version: '1.0.0'
    },
    {
      capabilities: {}
    }
  );

  try {
    console.log('连接MCP服务器...');
    await client.connect(transport);
    
    console.log('获取工具列表...');
    const tools = await client.listTools();
    console.log('可用工具:', tools.tools.map(t => t.name));
    
    // 测试获取当前日期
    console.log('获取当前日期...');
    const dateResult = await client.callTool({
      name: 'get-current-date',
      arguments: {}
    });
    console.log('当前日期:', dateResult.content[0].text);
    
    // 测试获取广州车站代码
    console.log('获取广州车站代码...');
    const stationResult = await client.callTool({
      name: 'get-station-code-of-citys',
      arguments: { citys: '广州' }
    });
    console.log('广州车站代码:', stationResult.content[0].text);
    
    await client.close();
    serverProcess.kill();
    
  } catch (error) {
    console.error('错误:', error);
    serverProcess.kill();
  }
}

test12306();