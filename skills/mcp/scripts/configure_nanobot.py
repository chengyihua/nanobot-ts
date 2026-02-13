#!/usr/bin/env python3
"""
nanobot MCP配置脚本
自动配置nanobot使用MCP服务器
"""

import os
import json
import subprocess
import sys
from pathlib import Path

def check_mcp_installation():
    """检查MCP是否已安装"""
    print("检查MCP安装状态...")
    
    try:
        # 检查mcp-server命令
        result = subprocess.run(["mcp-server", "--version"], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ MCP已安装: {result.stdout.strip()}")
            return True
        else:
            print("❌ MCP未安装或安装不完整")
            return False
    except FileNotFoundError:
        print("❌ mcp-server命令未找到")
        return False

def get_nanobot_config_path():
    """获取nanobot配置文件路径"""
    # 尝试多个可能的路径
    possible_paths = [
        "/Users/chengyihua/Downloads/nanobot-main/nanobot-ts",
        os.path.expanduser("~/Downloads/nanobot-main/nanobot-ts"),
        os.path.expanduser("~/nanobot-ts"),
        os.getcwd()
    ]
    
    for path in possible_paths:
        config_file = os.path.join(path, "src", "config", "agent.ts")
        if os.path.exists(config_file):
            print(f"✅ 找到nanobot配置: {config_file}")
            return path, config_file
    
    print("❌ 未找到nanobot配置文件")
    return None, None

def create_mcp_config(nanobot_path):
    """创建MCP配置文件"""
    config_dir = os.path.join(nanobot_path, "src", "config")
    os.makedirs(config_dir, exist_ok=True)
    
    mcp_config = {
        "mcp": {
            "enabled": True,
            "servers": [
                {
                    "name": "filesystem",
                    "transport": "stdio",
                    "command": "mcp-server",
                    "args": ["filesystem", "--directory", os.path.expanduser("~/Documents")]
                },
                {
                    "name": "http",
                    "transport": "stdio",
                    "command": "mcp-server",
                    "args": ["http", "--port", "8080"]
                }
            ],
            "client": {
                "timeout": 30000,
                "maxRetries": 3
            }
        }
    }
    
    config_file = os.path.join(config_dir, "mcp.json")
    with open(config_file, "w") as f:
        json.dump(mcp_config, f, indent=2)
    
    print(f"✅ 创建MCP配置文件: {config_file}")
    return config_file

def update_agent_config(nanobot_path, agent_config_file):
    """更新agent配置以支持MCP"""
    print(f"更新agent配置: {agent_config_file}")
    
    # 读取现有配置
    with open(agent_config_file, "r") as f:
        content = f.read()
    
    # 检查是否已包含MCP配置
    if "mcp" in content.lower():
        print("✅ agent配置已包含MCP支持")
        return True
    
    # 添加MCP导入和配置
    mcp_import = """
// MCP相关导入
import { createMCPClient } from '@ai-sdk/openai';
import mcpConfig from './config/mcp.json';
"""
    
    mcp_setup = """
// MCP客户端设置
const mcpClients = {};
if (mcpConfig.enabled) {
    for (const server of mcpConfig.servers) {
        try {
            mcpClients[server.name] = createMCPClient({
                transport: server.transport,
                command: server.command,
                args: server.args
            });
            console.log(`✅ MCP服务器连接成功: ${server.name}`);
        } catch (error) {
            console.error(`❌ MCP服务器连接失败: ${server.name}`, error);
        }
    }
}
"""
    
    mcp_tools = """
// MCP工具注册
if (mcpConfig.enabled) {
    for (const [name, client] of Object.entries(mcpClients)) {
        try {
            const tools = await client.listTools();
            for (const tool of tools) {
                // 注册MCP工具到agent
                agent.registerTool({
                    name: `${name}.${tool.name}`,
                    description: tool.description,
                    parameters: tool.inputSchema,
                    execute: async (args) => {
                        return await client.callTool(tool.name, args);
                    }
                });
            }
            console.log(`✅ 注册MCP工具: ${name} (${tools.length}个工具)`);
        } catch (error) {
            console.error(`❌ 注册MCP工具失败: ${name}`, error);
        }
    }
}
"""
    
    # 在合适的位置插入代码
    lines = content.split('\n')
    new_lines = []
    
    # 找到import部分
    import_end = 0
    for i, line in enumerate(lines):
        new_lines.append(line)
        if line.strip().startswith("import") and (i+1 >= len(lines) or not lines[i+1].strip().startswith("import")):
            import_end = i + 1
            new_lines.append(mcp_import)
            break
    
    # 添加剩余的行
    for i in range(import_end, len(lines)):
        new_lines.append(lines[i])
    
    # 转换为字符串并插入MCP设置
    new_content = '\n'.join(new_lines)
    
    # 在agent创建后插入MCP设置
    agent_create_pattern = "const agent = createAgent({"
    if agent_create_pattern in new_content:
        parts = new_content.split(agent_create_pattern)
        new_content = parts[0] + mcp_setup + agent_create_pattern + parts[1]
    
    # 在工具注册部分插入MCP工具
    tool_register_pattern = "// 注册工具"
    if tool_register_pattern in new_content:
        parts = new_content.split(tool_register_pattern)
        new_content = parts[0] + tool_register_pattern + mcp_tools + parts[1]
    
    # 写入更新后的配置
    backup_file = agent_config_file + ".backup"
    with open(backup_file, "w") as f:
        f.write(content)
    
    with open(agent_config_file, "w") as f:
        f.write(new_content)
    
    print(f"✅ agent配置更新完成")
    print(f"✅ 原始配置已备份到: {backup_file}")
    return True

def install_npm_packages(nanobot_path):
    """安装必要的npm包"""
    print("安装MCP相关npm包...")
    
    packages = [
        "@modelcontextprotocol/sdk",
        "@modelcontextprotocol/sdk-server",
        "@ai-sdk/openai"
    ]
    
    package_file = os.path.join(nanobot_path, "package.json")
    if not os.path.exists(package_file):
        print("❌ 未找到package.json")
        return False
    
    # 检查是否已安装
    with open(package_file, "r") as f:
        package_data = json.load(f)
    
    dependencies = package_data.get("dependencies", {})
    needs_install = []
    
    for package in packages:
        if package not in dependencies:
            needs_install.append(package)
    
    if needs_install:
        print(f"需要安装的包: {', '.join(needs_install)}")
        
        # 使用pnpm或npm安装
        if os.path.exists(os.path.join(nanobot_path, "pnpm-lock.yaml")):
            cmd = "pnpm"
        else:
            cmd = "npm"
        
        install_cmd = [cmd, "install"] + needs_install
        print(f"执行命令: {' '.join(install_cmd)}")
        
        try:
            subprocess.run(install_cmd, cwd=nanobot_path, check=True)
            print("✅ npm包安装完成")
        except subprocess.CalledProcessError as e:
            print(f"❌ npm包安装失败: {e}")
            return False
    else:
        print("✅ 所有必要的npm包已安装")
    
    return True

def create_test_script(nanobot_path):
    """创建测试脚本"""
    test_script = os.path.join(nanobot_path, "test_mcp.js")
    
    test_code = """
// MCP测试脚本
const { createMCPClient } = require('@ai-sdk/openai');

async function testMCP() {
    console.log('测试MCP连接...');
    
    try {
        // 测试文件系统服务器
        const fsClient = createMCPClient({
            transport: 'stdio',
            command: 'mcp-server',
            args: ['filesystem', '--directory', process.env.HOME || '/tmp']
        });
        
        console.log('✅ 文件系统MCP客户端创建成功');
        
        // 测试列出文件
        const files = await fsClient.callTool('list', {
            path: process.env.HOME || '/tmp'
        });
        
        console.log(`✅ 文件列表获取成功 (${files.length}个文件/文件夹)`);
        
        // 测试HTTP服务器
        const httpClient = createMCPClient({
            transport: 'stdio',
            command: 'mcp-server',
            args: ['http', '--port', '8080']
        });
        
        console.log('✅ HTTP MCP客户端创建成功');
        
        console.log('🎉 MCP测试通过！');
        return true;
        
    } catch (error) {
        console.error('❌ MCP测试失败:', error.message);
        return false;
    }
}

// 运行测试
if (require.main === module) {
    testMCP().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { testMCP };
"""
    
    with open(test_script, "w") as f:
        f.write(test_code)
    
    print(f"✅ 创建测试脚本: {test_script}")
    return test_script

def main():
    """主函数"""
    print("=" * 60)
    print("nanobot MCP配置工具")
    print("=" * 60)
    
    # 检查MCP安装
    if not check_mcp_installation():
        print("\n请先安装MCP:")
        print("1. 运行: npm install -g @modelcontextprotocol/server")
        print("2. 运行: npm install -g @modelcontextprotocol/server-filesystem")
        print("3. 运行: npm install -g @modelcontextprotocol/server-http")
        return 1
    
    # 查找nanobot路径
    nanobot_path, agent_config_file = get_nanobot_config_path()
    if not nanobot_path:
        return 1
    
    print(f"\nnanobot路径: {nanobot_path}")
    
    # 安装npm包
    if not install_npm_packages(nanobot_path):
        return 1
    
    # 创建MCP配置
    mcp_config_file = create_mcp_config(nanobot_path)
    
    # 更新agent配置
    if agent_config_file:
        if not update_agent_config(nanobot_path, agent_config_file):
            return 1
    
    # 创建测试脚本
    test_script = create_test_script(nanobot_path)
    
    print("\n" + "=" * 60)
    print("配置完成！")
    print("=" * 60)
    print("\n下一步操作:")
    print(f"1. 启动MCP服务器: mcp-server filesystem --directory ~/Documents")
    print(f"2. 测试MCP连接: node {test_script}")
    print(f"3. 重启nanobot: cd {nanobot_path} && npm run dev")
    print("\n验证MCP是否工作:")
    print("  在nanobot中尝试: '列出我的文档文件夹内容'")
    print("  如果MCP配置正确，nanobot应该能通过MCP访问文件系统")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())