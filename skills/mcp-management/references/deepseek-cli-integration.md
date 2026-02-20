# DeepSeek CLI Integration Guide

## Overview

DeepSeek CLI provides automatic MCP tool discovery and execution via natural language prompts. This is the recommended primary method for executing MCP tools using DeepSeek API.

## Installation

```bash
# 安装DeepSeek CLI（如果可用）
# 注意：目前可能没有官方的DeepSeek CLI，我们可以使用curl替代

# 或者使用现有的DeepSeek技能
# 您已经安装了DeepSeek技能，可以直接使用
```

## Configuration

### MCP服务器配置

确保您的`.claude/.mcp.json`配置了DeepSeek MCP服务器：

```json
{
  "mcpServers": {
    "deepseek-mcp": {
      "command": "node",
      "args": ["/path/to/deepseek-mcp-server.cjs"],
      "env": {
        "DEEPSEEK_API_KEY": "sk-f41baabff2a144468f186c1b4c729994"
      }
    }
  }
}
```

### 使用DeepSeek API直接调用

由于没有官方的DeepSeek CLI，我们可以使用curl直接调用DeepSeek API：

```bash
# 基本调用
bash -c 'curl -s "https://api.deepseek.com/chat/completions" -X POST -H "Content-Type: application/json" -H "Authorization: Bearer ${DEEPSEEK_API_KEY}" -d "{\"model\": \"deepseek-chat\", \"messages\": [{\"role\": \"user\", \"content\": \"<prompt>\"}]}"'

# 使用MCP工具
bash -c 'curl -s "https://api.deepseek.com/chat/completions" -X POST -H "Content-Type: application/json" -H "Authorization: Bearer ${DEEPSEEK_API_KEY}" -d "{\"model\": \"deepseek-chat\", \"messages\": [{\"role\": \"user\", \"content\": \"使用MCP工具执行任务：<task>\"}], \"tools\": [...]}"'
```

## 使用方法

### 基本语法

```bash
# 使用DeepSeek API调用MCP工具
DEEPSEEK_API_KEY=sk-f41baabff2a144468f186c1b4c729994 node scripts/deepseek-mcp-executor.js "<prompt>"
```

### 示例

**截图捕获**：
```bash
# 通过DeepSeek调用MCP截图工具
bash -c 'curl -s "https://api.deepseek.com/chat/completions" -X POST -H "Content-Type: application/json" -H "Authorization: Bearer ${DEEPSEEK_API_KEY}" -d "{\"model\": \"deepseek-chat\", \"messages\": [{\"role\": \"user\", \"content\": \"使用MCP工具截图https://www.google.com.vn\"}]}"'
```

**内存操作**：
```bash
bash -c 'curl -s "https://api.deepseek.com/chat/completions" -X POST -H "Content-Type: application/json" -H "Authorization: Bearer ${DEEPSEEK_API_KEY}" -d "{\"model\": \"deepseek-chat\", \"messages\": [{\"role\": \"user\", \"content\": \"使用MCP内存工具记住Alice是React开发人员\"}]}"'
```

**Web研究**：
```bash
bash -c 'curl -s "https://api.deepseek.com/chat/completions" -X POST -H "Content-Type: application/json" -H "Authorization: Bearer ${DEEPSEEK_API_KEY}" -d "{\"model\": \"deepseek-chat\", \"messages\": [{\"role\": \"user\", \"content\": \"使用MCP搜索工具查找Next.js 15最新功能\"}]}"'
```

## 工作原理

1. **配置加载**：读取`.claude/.mcp.json`中的MCP服务器配置
2. **工具发现**：使用脚本列出所有可用的MCP工具
3. **提示分析**：DeepSeek模型分析用户提示
4. **工具选择**：自动选择相关的MCP工具
5. **执行**：通过MCP协议调用工具
6. **结果合成**：将工具输出组合成连贯的响应

## 创建DeepSeek MCP执行器

创建一个简单的Node.js脚本来集成DeepSeek和MCP：

```javascript
// scripts/deepseek-mcp-executor.js
const { execSync } = require('child_process');
const fs = require('fs');

// 读取MCP配置
const mcpConfig = JSON.parse(fs.readFileSync('.claude/.mcp.json', 'utf8'));

// 获取DeepSeek API Key
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-f41baabff2a144468f186c1b4c729994';

async function executeWithDeepSeek(prompt) {
  // 1. 首先发现MCP工具
  const tools = discoverMCPTools();
  
  // 2. 构建DeepSeek请求
  const request = {
    model: 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content: `你是一个MCP工具执行器。以下是可用的MCP工具：\n${JSON.stringify(tools, null, 2)}\n\n请分析用户请求，选择适当的工具并执行。`
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
        parameters: tool.inputSchema
      }
    }))
  };
  
  // 3. 调用DeepSeek API
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify(request)
  });
  
  const data = await response.json();
  return data.choices[0].message;
}

function discoverMCPTools() {
  // 这里应该实现MCP工具发现逻辑
  // 可以使用现有的mcp-management脚本
  try {
    const toolsJson = fs.readFileSync('assets/tools.json', 'utf8');
    return JSON.parse(toolsJson);
  } catch (error) {
    // 如果工具文件不存在，运行发现脚本
    execSync('npx tsx scripts/cli.ts list-tools', { stdio: 'inherit' });
    const toolsJson = fs.readFileSync('assets/tools.json', 'utf8');
    return JSON.parse(toolsJson);
  }
}

// 主函数
const prompt = process.argv[2];
if (!prompt) {
  console.error('请提供提示文本');
  process.exit(1);
}

executeWithDeepSeek(prompt)
  .then(result => {
    console.log('DeepSeek响应:', result.content);
    
    // 检查是否有工具调用
    if (result.tool_calls && result.tool_calls.length > 0) {
      console.log('需要执行的工具:', result.tool_calls);
      // 这里应该实现工具执行逻辑
    }
  })
  .catch(error => {
    console.error('执行失败:', error);
  });
```

## 修改mcp-management技能

需要更新SKILL.md文件，将Gemini CLI替换为DeepSeek集成：

1. **更新技能描述**：将Gemini CLI相关描述改为DeepSeek
2. **修改执行优先级**：
   - 主要：DeepSeek API + MCP执行器
   - 次要：直接脚本执行
   - 备用：mcp-manager子代理

3. **更新示例代码**：将所有Gemini CLI示例改为DeepSeek API调用

## 优势

1. **成本效益**：DeepSeek API比Gemini更便宜
2. **性能**：DeepSeek模型响应速度快
3. **兼容性**：OpenAI兼容的API接口
4. **灵活性**：可以轻松集成到现有系统中

## 注意事项

1. **API Key安全**：确保API Key不泄露
2. **错误处理**：需要完善的错误处理机制
3. **工具发现**：定期更新MCP工具列表
4. **成本控制**：监控API使用量，避免意外费用

## 快速开始

```bash
# 1. 设置环境变量
export DEEPSEEK_API_KEY=sk-f41baabff2a144468f186c1b4c729994

# 2. 发现MCP工具
npx tsx scripts/cli.ts list-tools

# 3. 使用DeepSeek执行MCP任务
node scripts/deepseek-mcp-executor.js "截图https://www.google.com.vn"
```

通过这种方式，您可以将mcp-management技能从Gemini CLI迁移到DeepSeek API，享受更经济高效的MCP工具管理体验。