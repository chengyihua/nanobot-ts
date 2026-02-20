#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 获取DeepSeek API Key
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-f41baabff2a144468f186c1b4c729994';

// 工具发现缓存
let cachedTools = null;

async function discoverMCPTools() {
  if (cachedTools) {
    return cachedTools;
  }
  
  try {
    // 检查是否有缓存的工具文件
    const toolsJsonPath = path.join(__dirname, '../assets/tools.json');
    if (fs.existsSync(toolsJsonPath)) {
      const toolsJson = fs.readFileSync(toolsJsonPath, 'utf8');
      cachedTools = JSON.parse(toolsJson);
      console.log('从缓存加载MCP工具');
      return cachedTools;
    }
  } catch (error) {
    console.log('无法读取缓存工具文件，重新发现工具...');
  }
  
  // 运行工具发现脚本
  console.log('正在发现MCP工具...');
  try {
    execSync('npx tsx cli.ts list-tools', {
      cwd: __dirname,
      stdio: 'inherit'
    });
    
    const toolsJsonPath = path.join(__dirname, '../assets/tools.json');
    const toolsJson = fs.readFileSync(toolsJsonPath, 'utf8');
    cachedTools = JSON.parse(toolsJson);
    console.log(`发现 ${cachedTools.length} 个MCP工具`);
    return cachedTools;
  } catch (error) {
    console.error('工具发现失败:', error.message);
    return [];
  }
}

// 修复MCP工具调用函数
function callMCPTool(serverName, toolName, args) {
  try {
    console.log(`调用MCP工具: ${serverName}/${toolName}`);
    console.log(`参数: ${JSON.stringify(args)}`);
    
    // 构建命令 - 使用正确的参数格式
    const argsStr = JSON.stringify(args);
    const command = `npx tsx cli.ts call-tool "${serverName}" "${toolName}" '${argsStr}'`;
    
    console.log(`执行命令: ${command}`);
    
    const output = execSync(command, {
      cwd: __dirname,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'] // 捕获所有输出
    });
    
    console.log(`工具执行成功: ${output.substring(0, 200)}...`);
    return output;
  } catch (error) {
    console.error(`工具执行失败: ${error.message}`);
    console.error(`错误输出: ${error.stderr ? error.stderr.substring(0, 500) : '无'}`);
    throw error;
  }
}

async function executeWithDeepSeek(prompt) {
  console.log(`执行提示: ${prompt}`);
  
  // 1. 发现MCP工具
  const tools = await discoverMCPTools();
  
  if (tools.length === 0) {
    console.error('没有找到MCP工具');
    return { content: '错误：没有可用的MCP工具' };
  }
  
  // 2. 构建DeepSeek请求 - 使用正确的工具调用格式
  const request = {
    model: 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content: `你是一个MCP工具执行器。以下是可用的MCP工具列表：

${tools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')}

请分析用户请求，选择适当的工具并执行。如果你认为不需要使用任何工具，直接回答用户的问题。

重要：当调用工具时，请确保参数格式正确。`
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    tools: tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema || { type: 'object', properties: {} }
      }
    })),
    temperature: 0.1,
    max_tokens: 2000
  };
  
  console.log('调用DeepSeek API...');
  
  try {
    // 3. 调用DeepSeek API
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify(request)
    });
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const message = data.choices[0].message;
    
    console.log('DeepSeek响应接收成功');
    console.log('响应结构:', JSON.stringify(message, null, 2).substring(0, 500) + '...');
    
    // 4. 检查是否有工具调用
    if (message.tool_calls && message.tool_calls.length > 0) {
      console.log(`需要执行 ${message.tool_calls.length} 个工具调用`);
      
      const results = [];
      for (const toolCall of message.tool_calls) {
        // 获取工具名称 - 兼容两种格式
        const toolName = toolCall.function?.name || toolCall.name;
        console.log(`执行工具: ${toolName}`);
        
        if (!toolName) {
          results.push('错误：工具名称未定义');
          continue;
        }
        
        try {
          // 查找工具对应的服务器
          const toolInfo = tools.find(t => t.name === toolName);
          if (!toolInfo) {
            results.push(`错误：找不到工具 ${toolName}`);
            continue;
          }
          
          // 获取参数 - 处理字符串格式的参数
          let args = {};
          if (toolCall.function?.arguments) {
            if (typeof toolCall.function.arguments === 'string') {
              try {
                args = JSON.parse(toolCall.function.arguments);
              } catch (e) {
                console.error(`无法解析参数: ${toolCall.function.arguments}`);
                args = {};
              }
            } else {
              args = toolCall.function.arguments;
            }
          } else if (toolCall.arguments) {
            if (typeof toolCall.arguments === 'string') {
              try {
                args = JSON.parse(toolCall.arguments);
              } catch (e) {
                console.error(`无法解析参数: ${toolCall.arguments}`);
                args = {};
              }
            } else {
              args = toolCall.arguments;
            }
          }
          
          // 执行工具
          const server = toolInfo.serverName || 'unknown';
          const output = callMCPTool(server, toolName, args);
          results.push(`工具 ${toolName} 执行结果: ${output}`);
        } catch (error) {
          results.push(`工具 ${toolName} 执行失败: ${error.message}`);
        }
      }
      
      // 5. 将结果发送回DeepSeek进行总结
      const followUpRequest = {
        model: 'deepseek-chat',
        messages: [
          ...request.messages,
          message,
          {
            role: 'user',
            content: `工具执行结果:\n${results.join('\n')}\n\n请总结结果并回答用户的问题。`
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      };
      
      const followUpResponse = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify(followUpRequest)
      });
      
      const followUpData = await followUpResponse.json();
      return followUpData.choices[0].message;
    }
    
    // 如果没有工具调用，直接返回响应
    return message;
  } catch (error) {
    console.error('DeepSeek API调用失败:', error);
    return {
      content: `错误：无法调用DeepSeek API - ${error.message}`,
      isError: true
    };
  }
}

// 主函数
async function main() {
  const prompt = process.argv.slice(2).join(' ');
  
  if (!prompt) {
    console.error('使用方法: node deepseek-mcp-executor-fixed-v2.cjs "<提示文本>"');
    console.error('示例: node deepseek-mcp-executor-fixed-v2.cjs "查询北京到上海的火车票"');
    process.exit(1);
  }
  
  console.log('=== DeepSeek MCP执行器 (修复版v2) ===');
  console.log(`API Key: ${DEEPSEEK_API_KEY.substring(0, 10)}...`);
  console.log('');
  
  const result = await executeWithDeepSeek(prompt);
  
  console.log('\n=== 执行结果 ===');
  console.log(result.content);
  
  if (result.isError) {
    process.exit(1);
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
  discoverMCPTools,
  executeWithDeepSeek,
  callMCPTool
};