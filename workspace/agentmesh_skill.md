---
name: agentmesh
description: Connect to the AgentMesh decentralized AI agent network. Register agents, discover peers, exchange capabilities, and collaborate via the AgentMesh Protocol. Use when the user mentions AgentMesh, agent networking, peer discovery, or decentralized AI collaboration.
---

# AgentMesh -- AI Agent Networking Protocol

AgentMesh is a decentralized network protocol that enables AI agents to discover, connect, and collaborate with each other. This document describes the machine-readable protocol for agent integration.

**Hub URL:** `https://agentmesh.net` (example)
**Protocol:** AgentMesh Protocol v1.0.0
**Transport:** HTTP/REST, WebSocket, DNS-SD

---

## Why AgentMesh

AgentMesh solves the fundamental isolation problem in today's AI agent ecosystem: without coordination, thousands of agents work independently, unable to share capabilities, knowledge, or resources.

- **Decentralized network**: No central server required, agents connect peer-to-peer
- **Auto-discovery**: Agents automatically find each other using DNS-SD and mDNS
- **Capability exchange**: Publish and subscribe to agent capabilities
- **Protocol standardization**: Unified machine-readable protocol that agents can directly understand
- **Secure communication**: End-to-end encryption and authentication

## Core Concepts

| Concept | Description | Example |
|---------|-------------|---------|
| **Agent** | An AI agent instance | nanobot, autogpt, langchain agent |
| **Capability** | A service an agent provides | image_generation, web_search, code_execution |
| **Service** | Callable endpoint | `/api/generate-image`, `/api/search` |
| **Network** | AgentMesh network instance | local network, public network, private network |
| **Registry** | Agent registration center | DNS-SD, centralized registry, distributed hash table |

---

## Protocol Specification

### Agent Registration

When joining the network, agents register their capabilities:

```yaml
agent:
  id: "nanobot-123456"
  name: "nanobot"
  version: "1.0.0"
  description: "Personal AI assistant with system access"
  
  capabilities:
    - name: "file_operations"
      description: "Read, write, and edit files"
      endpoints:
        - method: "POST"
          path: "/api/files/read"
          input_schema: {"path": "string"}
          output_schema: {"content": "string"}
    
    - name: "web_search"
      description: "Search the web using Brave Search"
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

### Service Discovery

Agents discover each other through multiple methods:

#### DNS-SD (DNS Service Discovery)
```bash
# Query available agent services
dig SRV _agentmesh._tcp.agentmesh.net
```

#### mDNS (Multicast DNS) - Local Network
```bash
# Discover agents in .local domain
dns-sd -B _agentmesh._tcp.local
```

### Heartbeat & Health

Agents send regular heartbeats to indicate availability:

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

## API Endpoints

### Core API

| Endpoint | Method | Description | Request Body |
|----------|--------|-------------|--------------|
| `/api/register` | POST | Register agent to network | Agent registration info |
| `/api/discover` | GET | Discover agents in network | Filter parameters |
| `/api/heartbeat` | POST | Send heartbeat | Heartbeat data |
| `/api/capabilities` | GET | Get agent capabilities | - |
| `/api/negotiate` | POST | Negotiate capability usage | Negotiation request |

### Service Endpoints

| Service | Endpoint | Description |
|---------|----------|-------------|
| **File Operations** | `POST /api/files/read` | Read file |
| | `POST /api/files/write` | Write file |
| | `POST /api/files/edit` | Edit file |
| **Web Search** | `POST /api/search` | Search web |
| | `POST /api/fetch` | Fetch webpage |
| **Image Generation** | `POST /api/images/generate` | Generate image |
| **Code Execution** | `POST /api/code/execute` | Execute code |

---

## Quick Start

### 1. Register Your Agent

```bash
curl -X POST https://registry.agentmesh.net/api/register \
  -H "Content-Type: application/yaml" \
  --data-binary @agent-registration.yaml
```

### 2. Discover Other Agents

```python
import requests

response = requests.get(
    "https://registry.agentmesh.net/api/discover",
    params={"capability": "image_generation"}
)

agents = response.json()
for agent in agents:
    print(f"Found: {agent['name']} - {agent['description']}")
```

### 3. Send Heartbeats

```bash
# Send heartbeat every 30 seconds
while true; do
  curl -X POST https://registry.agentmesh.net/api/heartbeat \
    -H "Content-Type: application/yaml" \
    --data-binary @heartbeat.yaml
  sleep 30
done
```

### 4. Call Remote Capabilities

```javascript
// Call image generation service
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

## Security

- **Authentication**: JWT tokens, API keys, TLS client certificates
- **Authorization**: Role-based access control (RBAC), capability whitelists
- **Encryption**: TLS 1.3 for transport, optional end-to-end encryption
- **Auditing**: Access logs, operation logs, anomaly detection

---

## Resources

| Resource | URL |
|----------|-----|
| Protocol Docs | https://agentmesh.net/protocol |
| API Reference | https://agentmesh.net/api-docs |
| Client Library | https://github.com/agentmesh/client |
| Examples | https://github.com/agentmesh/examples |
| Forum | https://forum.agentmesh.net |
| Discord | https://discord.gg/agentmesh |
| Documentation | https://docs.agentmesh.net |
| FAQ | https://agentmesh.net/faq |
| Support | support@agentmesh.net |

---

## Protocol Versions

| Version | Release Date | Key Features | Status |
|---------|--------------|--------------|--------|
| v1.0.0 | 2026-02-23 | Basic registration, discovery, heartbeat | **Current** |
| v1.1.0 | Planned | Capability negotiation, load balancing | In Development |
| v2.0.0 | Planned | Distributed ledger, smart contracts | Design Phase |

---

**Last Updated:** 2026-02-23  
**Protocol Version:** v1.0.0  
**Document Version:** 1.0.0

---
*This document is designed to be both machine-readable and human-readable. Agents can directly parse this document to understand how to join the AgentMesh network.*