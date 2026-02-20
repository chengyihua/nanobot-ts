# Nanobot-TS Optimization and Enhancement Plan

This document outlines proposed improvements for the Nanobot-TS project to enhance its architecture, scalability, and feature set.

## 1. Architectural Improvements

### 1.1 Modularize Agent Loop
The `AgentLoop` class is currently handling multiple responsibilities: message processing, tool execution, history sanitization, and session management.
- **Proposal**: Extract logic into dedicated classes:
  - `StepExecutor`: Handle a single turn of LLM interaction and tool execution.
  - `ContextManager`: Manage conversation history and token limits.
  - `ResponseHandler`: Format and dispatch responses to different channels.
- **Benefit**: Improved testability and maintainability.

### 1.2 Enhanced Event Bus
The current `MessageBus` supports in-memory and has a basic Redis implementation.
- **Proposal**: 
  - Formalize the `TransportAdapter` interface.
  - Implement a robust `RedisTransportAdapter` with pub/sub support for multi-instance deployments.
  - Add dead-letter queues for failed messages.
- **Benefit**: Scalability and reliability for distributed deployments.

## 2. Feature Enhancements

### 2.1 Model Context Protocol (MCP) Support
Currently, plugins are loaded from local files.
- **Proposal**: Implement an `MCPClient` to consume external tools via the Model Context Protocol.
- **Benefit**: Access to a standardized ecosystem of tools without code changes.

### 2.2 Subagent Streaming
Subagents currently return a single final result.
- **Proposal**: Update `SubagentManager` to support streaming intermediate thoughts or partial results back to the main agent via the Event Bus.
- **Benefit**: Better user experience for long-running tasks.

### 2.3 Observability & Metrics
Basic logging exists, but metrics are limited.
- **Proposal**: 
  - Enhance `MetricsService` to track token usage, latency, tool error rates, and active sessions.
  - Expose a `/metrics` endpoint (Prometheus format) in the Gateway.
- **Benefit**: Real-time monitoring of agent health and costs.

## 3. Robustness & Security

### 3.1 Sandbox for File Operations
The `fs` tool has broad access.
- **Proposal**: Implement a `FileSystemSandbox` wrapper that strictly enforces read/write permissions within a specific workspace directory, preventing path traversal attacks.
- **Benefit**: Improved security when running untrusted instructions.

### 3.2 Circuit Breakers
External API calls (LLM, WeCom, etc.) can fail or hang.
- **Proposal**: Wrap external calls with a Circuit Breaker pattern (e.g., using `opossum` or custom logic) to fail fast and recover gracefully.
- **Benefit**: System stability under load or network issues.

## 4. Developer Experience

### 4.1 CLI Improvements
- **Proposal**: Enhance the CLI to support interactive chat mode with full tool support, mimicking the WeCom experience locally.
- **Benefit**: Faster development and debugging cycles.

### 4.2 Documentation
- **Proposal**: Generate API documentation for tools and internal modules using TypeDoc.
- **Benefit**: Easier onboarding for new contributors.

## 5. Implementation Roadmap

1.  **Phase 1 (Core Refactor)**: Modularize Agent Loop and enhance Event Bus.
2.  **Phase 2 (Features)**: Implement MCP Client and Subagent Streaming.
3.  **Phase 3 (Ops)**: Add Metrics, Circuit Breakers, and Docker optimizations.
