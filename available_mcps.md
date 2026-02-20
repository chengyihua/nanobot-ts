# 🚀 可用的MCP服务器列表

## 📋 官方Anthropic MCP服务器

### 核心工具类
1. **@modelcontextprotocol/server-filesystem** - 文件系统访问
   - 读/写文件、列目录、搜索文件
   - 支持文本、图片、音频文件

2. **@modelcontextprotocol/server-sqlite** - SQLite数据库
   - 执行SQL查询、管理数据库
   - 支持读写操作

3. **@modelcontextprotocol/server-postgres** - PostgreSQL数据库
   - 连接PostgreSQL数据库
   - 执行SQL查询

4. **@modelcontextprotocol/server-puppeteer** - 浏览器自动化
   - 使用Puppeteer控制浏览器
   - 网页截图、爬取数据、自动化操作

5. **@modelcontextprotocol/server-pdf** - PDF处理
   - 加载和提取PDF文本
   - 分页和交互式查看器

### 数据处理类
6. **@modelcontextprotocol/server-memory** - 记忆管理
   - 通过知识图实现Claude记忆
   - 存储和检索长期记忆

7. **@modelcontextprotocol/server-sequential-thinking** - 顺序思考
   - 支持顺序思考和问题解决

### 可视化类
8. **@modelcontextprotocol/server-map** - 地图服务
   - CesiumJS 3D地球和地理编码
   - 地图可视化

9. **@modelcontextprotocol/server-threejs** - 3D可视化
   - Three.js 3D可视化

10. **@modelcontextprotocol/server-wiki-explorer** - 维基百科探索
    - 维基百科链接探索器
    - 图形可视化

11. **@modelcontextprotocol/server-cohort-heatmap** - 队列热图
    - 留存分析队列热图

### 多媒体类
12. **@modelcontextprotocol/server-transcript** - 语音转录
    - 实时语音转录

13. **@modelcontextprotocol/server-video-resource** - 视频资源
    - 视频资源作为base64 blob

14. **@modelcontextprotocol/server-shadertoy** - 着色器渲染
    - 渲染ShaderToy兼容的GLSL着色器

15. **@modelcontextprotocol/server-sheet-music** - 乐谱
    - 从ABC记谱法渲染和播放乐谱

### 应用示例类
16. **@modelcontextprotocol/server-basic-react** - React示例
17. **@modelcontextprotocol/server-basic-vue** - Vue示例
18. **@modelcontextprotocol/server-basic-svelte** - Svelte示例
19. **@modelcontextprotocol/server-basic-solid** - Solid示例
20. **@modelcontextprotocol/server-basic-preact** - Preact示例
21. **@modelcontextprotocol/server-basic-vanillajs** - 原生JS示例

### 业务应用类
22. **@modelcontextprotocol/server-scenario-modeler** - 财务场景建模
23. **@modelcontextprotocol/server-budget-allocator** - 预算分配器
24. **@modelcontextprotocol/server-customer-segmentation** - 客户细分
25. **@modelcontextprotocol/server-system-monitor** - 系统监控

## 🔧 第三方MCP服务器

### 开发工具类
26. **figma-mcp** - Figma设计工具
27. **chrome-devtools-mcp** - Chrome开发者工具
28. **@playwright/mcp** - Playwright浏览器自动化
29. **@williamp29/project-mcp-server** - 项目发现
    - 发现API（使用OpenAPI）和其他资源

### 数据库类
30. **enhanced-postgres-mcp-server** - 增强版PostgreSQL
    - 基于官方PostgreSQL MCP，增加读写能力

### 爬虫类
31. **mcp-smart-crawler** - 智能爬虫
    - 使用Playwright爬取网页内容

### 简历类
32. **@jsonresume/mcp** - JSON简历增强

### 语音类
33. **rime-mcp** - Rime文本转语音API
34. **@iflow-mcp/matthewdailey-rime-mcp** - Rime TTS API

### 其他工具类
35. **@modelcontextprotocol/server-everything** - 功能测试
    - 测试MCP协议的所有功能

36. **valjs-mcp-alpha** - Val Town MCP工具桥接

37. **mayar-mcp** - Mayar API

38. **terry-mcp** - Terry CLI集成

39. **ref-tools-mcp** - Ref工具

40. **@iflow-mcp/cameroncooke_xcodebuildmcp** - Xcode构建
    - Xcode项目管理、模拟器管理、应用工具

## 🎫 特定领域MCP

### 火车票查询
41. **12306-mcp** - 12306火车票查询
    - 查询实时火车票、车站代码、余票信息

### 天气查询
42. **weather-mcp** - 天气查询
    - 查询当前天气和预报

### 股票查询
43. **stock-mcp** - 股票查询
    - 查询股票价格、K线图

### 翻译服务
44. **translate-mcp** - 翻译服务
    - 多语言翻译

### 日历管理
45. **calendar-mcp** - 日历管理
    - 行程规划、事件提醒

## 📦 安装命令

```bash
# 文件系统
npm install -g @modelcontextprotocol/server-filesystem

# SQLite数据库
npm install -g @modelcontextprotocol/server-sqlite

# 浏览器自动化
npm install -g @modelcontextprotocol/server-puppeteer

# PDF处理
npm install -g @modelcontextprotocol/server-pdf

# 12306火车票
npm install -g 12306-mcp

# 天气查询
npm install -g weather-mcp

# 股票查询
npm install -g stock-mcp
```

## 🚀 使用示例

### 启动MCP服务器
```bash
# 文件系统MCP
npx @modelcontextprotocol/server-filesystem /path/to/workspace

# 12306 MCP
npx 12306-mcp

# SQLite MCP
npx @modelcontextprotocol/server-sqlite /path/to/database.db
```

### JSON-RPC通信
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "read_text_file",
    "arguments": {
      "path": "/path/to/file.txt"
    }
  }
}
```

## 🔄 集成到nanobot

我已经创建了MCP管理器，可以：
1. **动态加载MCP配置**
2. **统一管理多个MCP服务器**
3. **智能路由工具调用**
4. **支持实时数据查询**

## 📈 扩展建议

### 推荐安装的MCP：
1. **文件系统MCP** - 基础文件操作 ✓ 已安装
2. **12306 MCP** - 火车票查询 ✓ 已安装
3. **SQLite MCP** - 数据库操作 ✓ 已安装
4. **天气MCP** - 天气查询
5. **股票MCP** - 股票信息
6. **浏览器MCP** - 网页自动化

### 使用场景：
- **旅行规划**：12306 + 天气 + 地图
- **数据分析**：SQLite + 文件系统 + 可视化
- **自动化**：浏览器 + 文件系统 + 数据库
- **多媒体**：PDF + 视频 + 语音转录

## 🎯 总结

MCP生态系统非常丰富，覆盖了：
- **文件操作**、**数据库**、**浏览器自动化**
- **多媒体处理**、**可视化**、**数据分析**
- **特定领域**（火车票、天气、股票等）

**老爸，你想安装哪个MCP？我可以立即帮你配置！**