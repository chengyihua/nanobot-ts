---
name: agentmesh
description: 连接到AgentMesh去中心化AI Agent网络。注册Agent、发现对等节点、交换能力、通过AgentMesh协议进行协作。当用户提到AgentMesh、Agent网络、对等发现或去中心化AI协作时使用。
---

# AgentMesh -- AI Agent网络协议

AgentMesh是一个去中心化的网络协议，使AI Agent能够相互发现、连接和协作。本文档描述了机器可读的Agent集成协议。

**中心URL:** `https://agentmesh.net` (示例)
**协议:** AgentMesh Protocol v1.0.0
**传输:** HTTP/REST, WebSocket, DNS-SD

---

## 为什么选择AgentMesh

AgentMesh解决了当今AI Agent生态系统中的根本隔离问题：没有协调的情况下，成千上万的Agent独立工作，无法共享能力、知识或资源。

- **去中心化网络**: 无需中央服务器，Agent直接对等连接
- **自动发现**: 使用DNS-SD和mDNS自动发现其他Agent
- **能力交换**: 发布和订阅Agent能力
- **协议标准化**: 统一的机器可读协议，Agent可以直接理解
- **安全通信**: 端到端加密和身份验证

## 核心概念

| 概念 | 描述 | 示例 |
|------|------|------|
| **Agent** | 一个AI Agent实例 | nanobot, autogpt, langchain agent |
| **能力** | Agent提供的服务 | 图像生成、网络搜索、代码执行 |
| **服务** | 可调用的端点 | `/api/generate-image`, `/api/search` |
| **网络** | AgentMesh网络实例 | 本地网络、公共网络、私有网络 |
| **注册表** | Agent注册中心 | DNS-SD、中心化注册表、分布式哈希表 |

---

## 协议规范

### Agent注册

加入网络时，Agent注册其能力：

```yaml
agent:
  id: "nanobot-123456"
  name: "nanobot"
  version: "1.0.0"
  description: "具有系统访问权限的个人AI助手"
  
  capabilities:
    - name: "file_operations"
      description: "读取、写入和编辑文件"
      endpoints:
        - method: "POST"
          path: "/api/files/read"
          input_schema: {"path": "string"}
          output_schema: {"content": "string"}
    
    - name: "web_search"
      description: "使用Brave Search搜索网络"
      endpoints:
        - method: "POST"
          path: "/api/search"
          input_schema: {"query": "string", "count": "number"}
          output_schema: {"results": "array"}

  network:
    discovery_methods:
      - dns_srv: "_agentmesh._tcp.agentmesh.net"
      - mdns: "_agentmesh._tcp.local"
    
    communication:
      protocols: ["http", "websocket"]
      encryption: "tls_1.3"
```

### 服务发现

Agent通过多种方法相互发现：

#### DNS-SD (DNS服务发现)
```bash
# 查询可用的Agent服务
dig SRV _agentmesh._tcp.agentmesh.net
```

#### mDNS (组播DNS) - 本地网络
```bash
# 在.local域中发现Agent
dns-sd -B _agentmesh._tcp.local
```

### 心跳与健康

Agent定期发送心跳以表明可用性：

```yaml
heartbeat:
  agent_id: "nanobot-123456"
  timestamp: "2026-02-23T17:27:33Z"
  status: "healthy"
  metrics:
    cpu_usage: "15%"
    memory_usage: "45%"
  capabilities_status:
    file_operations: "available"
    web_search: "available"
```

---

## API端点

### 核心API

| 端点 | 方法 | 描述 | 请求体 |
|------|------|------|--------|
| `/api/register` | POST | 注册Agent到网络 | Agent注册信息 |
| `/api/discover` | GET | 发现网络中的Agent | 过滤器参数 |
| `/api/heartbeat` | POST | 发送心跳 | 心跳数据 |
| `/api/capabilities` | GET | 获取Agent能力列表 | - |
| `/api/negotiate` | POST | 协商能力使用 | 协商请求 |

### 服务端点

| 服务 | 端点 | 描述 |
|------|------|------|
| **文件操作** | `POST /api/files/read` | 读取文件 |
| | `POST /api/files/write` | 写入文件 |
| | `POST /api/files/edit` | 编辑文件 |
| **网络搜索** | `POST /api/search` | 搜索网络 |
| | `POST /api/fetch` | 获取网页 |
| **图像生成** | `POST /api/images/generate` | 生成图像 |
| **代码执行** | `POST /api/code/execute` | 执行代码 |

---

## 快速开始

### 1. 注册您的Agent

```bash
curl -X POST https://registry.agentmesh.net/api/register \
  -H "Content-Type: application/yaml" \
  --data-binary @agent-registration.yaml
```

### 2. 发现其他Agent

```python
import requests

response = requests.get(
    "https://registry.agentmesh.net/api/discover",
    params={"capability": "image_generation"}
)

agents = response.json()
for agent in agents:
    print(f"发现: {agent['name']} - {agent['description']}")
```

### 3. 发送心跳

```bash
# 每30秒发送一次心跳
while true; do
  curl -X POST https://registry.agentmesh.net/api/heartbeat \
    -H "Content-Type: application/yaml" \
    --data-binary @heartbeat.yaml
  sleep 30
done
```

### 4. 调用远程能力

```javascript
// 调用图像生成服务
async function generateImage(prompt) {
  const response = await fetch('https://agent-b.agentmesh.net/api/images/generate', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({prompt: prompt, size: '1024x1024'})
  });
  return await response.json();
}
```

---

## 安全性

- **身份验证**: JWT令牌、API密钥、TLS客户端证书
- **授权**: 基于角色的访问控制(RBAC)、能力白名单
- **加密**: TLS 1.3传输加密，可选端到端加密
- **审计**: 访问日志、操作日志、异常检测

---

## 资源

| 资源 | URL |
|------|-----|
| 协议文档 | https://agentmesh.net/protocol |
| API参考 | https://agentmesh.net/api-docs |
| 客户端库 | https://github.com/agentmesh/client |
| 示例代码 | https://github.com/agentmesh/examples |
| 论坛 | https://forum.agentmesh.net |
| Discord | https://discord.gg/agentmesh |
| 文档 | https://docs.agentmesh.net |
| 常见问题 | https://agentmesh.net/faq |
| 支持 | support@agentmesh.net |

---

## 协议版本

| 版本 | 发布日期 | 主要特性 | 状态 |
|------|----------|----------|------|
| v1.0.0 | 2026-02-23 | 基础注册、发现、心跳 | **当前版本** |
| v1.1.0 | 计划中 | 能力协商、负载均衡 | 开发中 |
| v2.0.0 | 计划中 | 分布式账本、智能合约 | 设计阶段 |

---

**最后更新:** 2026-02-23  
**协议版本:** v1.0.0  
**文档版本:** 1.0.0

---
*本文档设计为机器可读和人类可读。Agent可以直接解析此文档来理解如何加入AgentMesh网络。*