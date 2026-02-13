# MCP快速开始指南

## 5分钟快速上手

### 步骤1：安装MCP
```bash
# 一键安装所有MCP组件
chmod +x scripts/install_mcp.sh
./scripts/install_mcp.sh --all --node
```

### 步骤2：启动MCP服务器
```bash
# 启动文件系统服务器（访问本地文件）
mcp-server filesystem --directory ~/Documents --port 3000

# 启动HTTP服务器（提供API服务）
mcp-server http --port 8080

# 启动SQLite服务器（访问数据库）
mcp-server sqlite --database /tmp/test.db --port 3001
```

### 步骤3：配置nanobot
```bash
# 运行配置脚本
python3 scripts/configure_nanobot.py
```

### 步骤4：测试MCP
```bash
# 测试MCP连接
node test_mcp.js
```

## 常用命令速查

### MCP服务器管理
```bash
# 查看MCP版本
mcp-server --version

# 查看帮助
mcp-server --help

# 列出可用服务器
mcp-server list

# 启动特定服务器
mcp-server <server-name> [options]
```

### 文件系统服务器
```bash
# 访问Home目录
mcp-server filesystem --directory ~

# 指定端口
mcp-server filesystem --directory /path --port 3000

# 启用认证
mcp-server filesystem --directory /path --token SECRET_KEY
```

### HTTP服务器
```bash
# 启动HTTP服务器
mcp-server http --port 8080

# 启用HTTPS
mcp-server http --port 8443 --ssl-cert cert.pem --ssl-key key.pem

# 限制访问IP
mcp-server http --port 8080 --allowed-ips 192.168.1.0/24
```

### SQLite服务器
```bash
# 连接SQLite数据库
mcp-server sqlite --database data.db

# 内存数据库
mcp-server sqlite --database :memory:

# 只读模式
mcp-server sqlite --database data.db --readonly
```

## 在nanobot中使用MCP

### 基本用法
```javascript
// 通过MCP读取文件
const files = await mcpClient.callTool('filesystem.list', {
  path: '/Users/chengyihua/Documents'
});

// 通过MCP执行SQL查询
const results = await mcpClient.callTool('sqlite.query', {
  sql: 'SELECT * FROM users WHERE active = 1'
});

// 通过MCP调用API
const response = await mcpClient.callTool('http.fetch', {
  url: 'https://api.example.com/data',
  method: 'GET'
});
```

### 实际示例

#### 示例1：读取并处理文件
```javascript
// 读取JSON配置文件
const config = await mcpClient.callTool('filesystem.read', {
  path: '/path/to/config.json'
});

// 解析JSON
const configData = JSON.parse(config.content);

// 使用配置数据
console.log(`应用名称: ${configData.appName}`);
```

#### 示例2：数据库操作
```javascript
// 创建表
await mcpClient.callTool('sqlite.execute', {
  sql: `CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    price REAL,
    stock INTEGER
  )`
});

// 插入数据
await mcpClient.callTool('sqlite.execute', {
  sql: 'INSERT INTO products (name, price, stock) VALUES (?, ?, ?)',
  params: ['商品A', 99.99, 100]
});

// 查询数据
const products = await mcpClient.callTool('sqlite.query', {
  sql: 'SELECT * FROM products WHERE price > 50 ORDER BY name'
});
```

#### 示例3：调用外部API
```javascript
// 获取天气信息
const weather = await mcpClient.callTool('http.fetch', {
  url: 'https://api.weather.com/v1/current',
  method: 'GET',
  params: {
    city: 'Beijing',
    units: 'metric'
  }
});

// 处理API响应
const weatherData = JSON.parse(weather.body);
console.log(`当前温度: ${weatherData.temperature}°C`);
```

## 故障排除

### 常见问题

#### 1. "命令未找到: mcp-server"
```bash
# 检查Node.js和npm安装
node --version
npm --version

# 重新安装MCP
npm install -g @modelcontextprotocol/server
```

#### 2. "连接被拒绝"
```bash
# 检查端口占用
lsof -i :3000

# 检查防火墙
sudo ufw status

# 尝试不同端口
mcp-server filesystem --directory ~/Documents --port 3001
```

#### 3. "权限被拒绝"
```bash
# 检查文件权限
ls -la /path/to/directory

# 使用有权限的目录
mcp-server filesystem --directory ~/Documents

# 或修改权限
sudo chmod 755 /path/to/directory
```

#### 4. nanobot无法连接MCP
```bash
# 检查MCP服务器是否运行
ps aux | grep mcp-server

# 测试MCP连接
curl http://localhost:3000/health

# 检查nanobot配置
cat src/config/mcp.json
```

### 调试技巧

#### 启用详细日志
```bash
# MCP服务器详细日志
DEBUG=mcp:* mcp-server filesystem --directory ~/Documents

# nanobot调试模式
DEBUG=nanobot:* npm run dev
```

#### 测试连接
```bash
# 使用curl测试MCP API
curl -X POST http://localhost:3000/tools/list \
  -H "Content-Type: application/json" \
  -d '{"path": "/tmp"}'

# 测试工具可用性
curl http://localhost:3000/tools
```

## 性能优化

### 1. 连接池
```javascript
// 重用MCP客户端连接
const mcpClients = new Map();

async function getMCPClient(serverName) {
  if (!mcpClients.has(serverName)) {
    const client = createMCPClient({
      transport: 'stdio',
      command: 'mcp-server',
      args: [serverName, '--directory', '/data']
    });
    mcpClients.set(serverName, client);
  }
  return mcpClients.get(serverName);
}
```

### 2. 批量操作
```javascript
// 批量读取文件
async function batchReadFiles(filePaths) {
  const promises = filePaths.map(path =>
    mcpClient.callTool('filesystem.read', { path })
  );
  return Promise.all(promises);
}
```

### 3. 缓存结果
```javascript
// 简单的内存缓存
const cache = new Map();

async function cachedMCPCall(tool, args, ttl = 60000) {
  const cacheKey = JSON.stringify({ tool, args });
  
  if (cache.has(cacheKey)) {
    const { data, timestamp } = cache.get(cacheKey);
    if (Date.now() - timestamp < ttl) {
      return data;
    }
  }
  
  const result = await mcpClient.callTool(tool, args);
  cache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}
```

## 安全建议

### 1. 生产环境配置
```bash
# 使用认证令牌
mcp-server filesystem --directory /data --token $(cat /run/secrets/mcp-token)

# 限制网络访问
mcp-server http --port 8080 --allowed-ips 10.0.0.0/8

# 启用HTTPS
mcp-server http --port 8443 --ssl-cert fullchain.pem --ssl-key privkey.pem
```

### 2. 访问控制
```json
{
  "mcp": {
    "servers": [
      {
        "name": "restricted-fs",
        "command": "mcp-server",
        "args": [
          "filesystem",
          "--directory", "/var/data",
          "--readonly",
          "--allowed-paths", "/var/data/public"
        ]
      }
    ]
  }
}
```

### 3. 监控和日志
```bash
# 启用访问日志
mcp-server filesystem --directory /data --log-file /var/log/mcp-access.log

# 监控MCP服务器
watch -n 5 "ps aux | grep mcp-server | grep -v grep"
```

## 下一步学习

### 深入学习
1. **官方文档**: https://modelcontextprotocol.io
2. **GitHub仓库**: https://github.com/modelcontextprotocol
3. **示例项目**: https://github.com/modelcontextprotocol/examples

### 扩展功能
1. **自定义MCP服务器**: 创建自己的MCP服务器
2. **集成更多数据源**: 连接MySQL、MongoDB、Redis等
3. **构建MCP工具链**: 创建完整的MCP工作流

### 社区资源
1. **MCP Discord**: 加入社区讨论
2. **博客文章**: 阅读MCP实战案例
3. **视频教程**: 观看MCP使用演示