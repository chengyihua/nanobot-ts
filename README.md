# Nanobot TS 🐈

[中文说明](#nanobot-ts-%E4%B8%AD%E6%96%87%E8%AF%B4%E6%98%8E)

An ultra-lightweight, extensible personal AI assistant framework built with TypeScript. Nanobot TS is designed to be your personal companion, capable of handling complex tasks through a robust agent loop, memory system, and tool integration.

## 🌟 Features

- **🧠 Advanced Agent Core**: Powered by Vercel AI SDK, supporting multiple LLM providers (OpenAI, Anthropic, DeepSeek, etc.).
- **💾 Intelligent Memory**:
  - **Long-term Memory**: Persists conversations and daily notes.
  - **Session Management**: Built-in **LRU Cache** for efficient session retrieval and performance optimization.
  - **Context Awareness**: Automatically searches and retrieves relevant history.
- **🔌 Plugin System**:
  - **Modular Tools**: Dynamic tool loading from the `plugins/` directory.
  - **Extensible**: Easily add new capabilities (Skills) without modifying the core.
- **⚡ Asynchronous Architecture**:
  - **Message Bus**: Decoupled communication for multi-channel support (CLI, WeCom, etc.).
  - **Cron Jobs**: Built-in scheduler for recurring tasks and reminders.
- **🛡️ Robust & Reliable**:
  - **Type-Safe**: Written in TypeScript with strict type checking.
  - **Tested**: Comprehensive Unit and E2E tests (including Mock LLM scenarios).
  - **Constants Management**: Centralized configuration for easier maintenance.

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- pnpm (recommended) or npm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/nanobot-ts.git
   cd nanobot-ts
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

### Configuration

1. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` to configure your LLM provider and other settings:
   ```env
   # LLM Provider Settings
   OPENAI_API_KEY=your_key
   # OR
   ANTHROPIC_API_KEY=your_key
   
   # Agent Defaults
   NANOBOT__AGENTS__DEFAULTS__MODEL=claude-3-5-sonnet-20240620
   
   # Web Search (Optional)
   NANOBOT__TOOLS__WEB__SEARCH__API_KEY=your_brave_key
   ```

3. (Optional) Advanced configuration in `src/core/config.ts` or via `config.json`.

## 📖 Usage

### Interactive CLI Mode
Start the agent in your terminal to chat directly:
```bash
pnpm dev
```

### Production Build
Build the project for production:
```bash
pnpm build
pnpm start
```

### WeCom Integration
Enable WeCom in `.env` to connect the bot to Enterprise WeChat.

## 🛠️ Development

### Project Structure
- `src/core/`: Core logic (Agent Loop, Session Manager, Memory, Config).
- `src/tools/`: Tool definitions and Plugin loader.
- `src/channels/`: Communication interfaces (CLI, WeCom).
- `src/plugins/`: Directory for external plugins.

### Testing
Run the test suite to ensure stability:

```bash
# Run all tests
npm test

# Run specific tests
npx tsx src/core/session.test.ts
npx tsx src/core/e2e.test.ts
```

## 📄 License

MIT

---

# Nanobot TS 中文说明 🐈

一个基于 TypeScript 构建的超轻量级、可扩展的个人 AI 助手框架。Nanobot TS 旨在成为您的个人伴侣，通过强大的 Agent 循环、记忆系统和工具集成来处理复杂任务。

## 🌟 核心特性

- **🧠 先进的 Agent 核心**: 基于 Vercel AI SDK 构建，支持多种 LLM 提供商（OpenAI, Anthropic, DeepSeek 等）。
- **💾 智能记忆系统**:
  - **长期记忆**: 持久化保存对话和每日笔记。
  - **会话管理**: 内置 **LRU 缓存** (LRU Cache)，实现高效的会话检索和性能优化。
  - **上下文感知**: 自动搜索并检索相关的历史记录。
- **🔌 插件系统**:
  - **模块化工具**: 支持从 `plugins/` 目录动态加载工具。
  - **可扩展性**: 无需修改核心代码即可轻松添加新能力（Skills）。
- **⚡ 异步架构**:
  - **消息总线**: 解耦的通信机制，支持多渠道（CLI, 企业微信等）。
  - **定时任务**: 内置 Cron 调度器，用于处理重复任务和提醒。
- **🛡️ 健壮可靠**:
  - **类型安全**: 使用 TypeScript 编写，具有严格的类型检查。
  - **测试覆盖**: 包含全面的单元测试和端到端（E2E）测试（含 Mock LLM 场景）。
  - **常量管理**: 统一的常量管理，易于维护。

## 🚀 快速开始

### 前置要求

- Node.js (v18 或更高版本)
- pnpm (推荐) 或 npm

### 安装步骤

1. 克隆仓库:
   ```bash
   git clone https://github.com/yourusername/nanobot-ts.git
   cd nanobot-ts
   ```

2. 安装依赖:
   ```bash
   pnpm install
   ```

### 配置指南

1. 设置环境变量:
   ```bash
   cp .env.example .env
   ```

2. 编辑 `.env` 配置您的 LLM 提供商和其他设置:
   ```env
   # LLM 提供商设置
   OPENAI_API_KEY=your_key
   # 或者
   ANTHROPIC_API_KEY=your_key
   
   # Agent 默认设置
   NANOBOT__AGENTS__DEFAULTS__MODEL=claude-3-5-sonnet-20240620
   
   # 网页搜索 (可选)
   NANOBOT__TOOLS__WEB__SEARCH__API_KEY=your_brave_key
   ```

3. (可选) 可在 `src/core/config.ts` 或通过 `config.json` 进行高级配置。

## 📖 使用说明

### 交互式 CLI 模式
在终端启动 Agent 直接对话:
```bash
pnpm dev
```

### 生产环境构建
编译项目用于生产环境:
```bash
pnpm build
pnpm start
```

### 企业微信集成
在 `.env` 中启用 WeCom 配置，即可将机器人连接到企业微信。

## 🛠️ 开发指南

### 项目结构
- `src/core/`: 核心逻辑 (Agent 循环, 会话管理, 记忆系统, 配置)。
- `src/tools/`: 工具定义和插件加载器。
- `src/channels/`: 通信接口 (CLI, WeCom)。
- `src/plugins/`: 外部插件目录。

### 测试
运行测试套件以确保稳定性:

```bash
# 运行所有测试
npm test

# 运行特定测试
npx tsx src/core/session.test.ts
npx tsx src/core/e2e.test.ts
```

## 📄 许可证

MIT
