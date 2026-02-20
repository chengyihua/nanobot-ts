---
name: mcp-management
description: Standalone toolset for managing and executing Model Context Protocol (MCP) tools using DeepSeek as the reasoning engine. Does not require Nanobot core integration.
---

# MCP Management (Standalone)

Standalone toolset for managing and interacting with Model Context Protocol (MCP) servers using DeepSeek API.

## Overview

This skill provides a set of **independent scripts** to discover and execute MCP capabilities. It is designed to run separately from the main Nanobot process, allowing you to use MCP tools without polluting the main agent's context or requiring complex plugin integration.

**Key Features**:
- **Standalone Execution**: Runs directly via Node.js scripts.
- **DeepSeek Integration**: Uses DeepSeek's API for intelligent tool selection and execution.
- **Project Agnostic**: Can be used with any project that has a `.claude/.mcp.json` configuration.
- **Zero Overhead**: Does not load into the main Nanobot runtime.

## Prerequisites

1.  **Node.js**: Ensure Node.js is installed.
2.  **DeepSeek API Key**: You need a valid DeepSeek API key.
3.  **MCP Configuration**: A `.nanobot/.mcp.json` file in your home directory or project root.

## Quick Start

### 1. Setup

First, install the necessary dependencies for the scripts:

```bash
cd skills/mcp-management/scripts
npm install
cd ../../..  # Return to project root
```

### 2. Configure DeepSeek API Key

Set your API key as an environment variable:

```bash
export DEEPSEEK_API_KEY=<YOUR_DEEPSEEK_API_KEY>
```

### 3. Execute MCP Tasks

Use the `deepseek-mcp-executor.cjs` script to perform tasks using natural language. Run this from the project root:

```bash
node skills/mcp-management/scripts/deepseek-mcp-executor.cjs "Check train tickets from Beijing to Shanghai tomorrow"
```

## Detailed Usage

### DeepSeek MCP Executor (Recommended)

This script uses the DeepSeek API to understand your prompt, select the appropriate MCP tool from your configured servers, and execute it.

**Command:**
```bash
node skills/mcp-management/scripts/deepseek-mcp-executor.cjs "<your prompt>"
```

**How it works:**
1.  Reads MCP config from `~/.nanobot/.mcp.json`.
2.  Connects to configured MCP servers (e.g., `12306-mcp`).
3.  Sends available tools and your prompt to DeepSeek API.
4.  DeepSeek selects the tool and arguments.
5.  Script executes the tool locally via MCP protocol.
6.  Returns the result.

### CLI Tools (Manual)

You can also manually list and call tools using the CLI script.

**List all available tools:**
```bash
npx tsx skills/mcp-management/scripts/cli.ts list-tools
```
*Output is saved to `skills/mcp-management/assets/tools.json`.*

**Call a specific tool:**
```bash
npx tsx skills/mcp-management/scripts/cli.ts call-tool <server_name> <tool_name> '<json_arguments>'
```

Example:
```bash
npx tsx skills/mcp-management/scripts/cli.ts call-tool 12306-mcp get_ticket '{"from": "Beijing", "to": "Shanghai", "date": "2024-05-01"}'
```

## Configuration

The scripts look for an MCP configuration file in the following order:
1.  Path specified via `MCP_CONFIG_PATH` env var.
2.  `~/.nanobot/.mcp.json` (Standard Claude Desktop config location).

**Example `.nanobot/.mcp.json`:**
```json
{
  "mcpServers": {
    "12306-mcp": {
      "command": "12306-mcp",
      "args": [],
      "env": {}
    }
  }
}
```

## Troubleshooting

-   **"Error: Cannot find module..."**: Ensure you ran `npm install` in `skills/mcp-management/scripts`.
-   **"Tool not found"**: Run `list-tools` to see what tools are detected. Check your `.mcp.json` config.
-   **DeepSeek API Errors**: Verify your `DEEPSEEK_API_KEY` is correct and has quota.

## Resources

-   [DeepSeek API Documentation](https://api-docs.deepseek.com/)
-   [Model Context Protocol](https://modelcontextprotocol.io/)
