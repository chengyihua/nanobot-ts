#!/usr/bin/env python3
"""
智能MCP服务自动安装器
功能：根据提供的MCP服务器地址自动安装和配置MCP服务
"""

import os
import sys
import json
import subprocess
import requests
from pathlib import Path
from urllib.parse import urlparse

class MCPAutoInstaller:
    def __init__(self):
        self.home_dir = Path.home()
        self.nanobot_dir = self.home_dir / "Downloads" / "nanobot-main" / "nanobot-ts"
        self.skills_dir = self.nanobot_dir / "skills" / "mcp"
        self.scripts_dir = self.skills_dir / "scripts"
        self.workspace_dir = self.nanobot_dir / "workspace"
        
        # 支持的MCP服务器类型
        self.supported_servers = {
            "filesystem": {
                "name": "文件系统MCP服务器",
                "npm_package": "@modelcontextprotocol/server-filesystem",
                "command": "mcp-server-filesystem",
                "description": "访问本地文件系统"
            },
            "sqlite": {
                "name": "SQLite数据库MCP服务器",
                "npm_package": "@modelcontextprotocol/server-sqlite",
                "command": "mcp-server-sqlite",
                "description": "访问SQLite数据库"
            },
            "http": {
                "name": "HTTP MCP服务器",
                "npm_package": "@modelcontextprotocol/server-http",
                "command": "mcp-server-http",
                "description": "HTTP API访问"
            },
            "github": {
                "name": "GitHub MCP服务器",
                "npm_package": "@modelcontextprotocol/server-github",
                "command": "mcp-server-github",
                "description": "GitHub API访问"
            },
            "notion": {
                "name": "Notion MCP服务器",
                "npm_package": "@modelcontextprotocol/server-notion",
                "command": "mcp-server-notion",
                "description": "Notion API访问"
            },
            "postgres": {
                "name": "PostgreSQL MCP服务器",
                "npm_package": "@modelcontextprotocol/server-postgres",
                "command": "mcp-server-postgres",
                "description": "PostgreSQL数据库访问"
            },
            "supabase": {
                "name": "Supabase MCP服务器",
                "npm_package": "@modelcontextprotocol/server-supabase",
                "command": "mcp-server-supabase",
                "description": "Supabase数据库访问"
            }
        }
    
    def detect_server_type(self, url_or_name):
        """检测MCP服务器类型"""
        url_or_name = url_or_name.lower()
        
        # 检查是否是URL
        if url_or_name.startswith(('http://', 'https://', 'ftp://', 'file://')):
            parsed = urlparse(url_or_name)
            # 根据URL路径判断类型
            if 'github.com' in parsed.netloc:
                return 'github'
            elif 'supabase' in parsed.netloc:
                return 'supabase'
            elif parsed.path.endswith('.db') or 'sqlite' in parsed.path:
                return 'sqlite'
            elif 'postgres' in parsed.netloc or parsed.path:
                return 'postgres'
            else:
                return 'http'
        
        # 检查是否是已知的服务器类型
        for server_type, info in self.supported_servers.items():
            if server_type in url_or_name:
                return server_type
        
        # 默认返回http类型
        return 'http'
    
    def install_mcp_server(self, server_type, config=None):
        """安装MCP服务器"""
        if server_type not in self.supported_servers:
            print(f"❌ 不支持的MCP服务器类型: {server_type}")
            print(f"✅ 支持的服务器类型: {', '.join(self.supported_servers.keys())}")
            return False
        
        server_info = self.supported_servers[server_type]
        print(f"🔧 开始安装 {server_info['name']}...")
        
        try:
            # 1. 安装npm包
            print(f"📦 安装 {server_info['npm_package']}...")
            result = subprocess.run(
                ['npm', 'install', '-g', server_info['npm_package']],
                capture_output=True,
                text=True
            )
            
            if result.returncode != 0:
                print(f"❌ 安装失败: {result.stderr}")
                return False
            
            print(f"✅ {server_info['name']} 安装成功!")
            
            # 2. 验证安装
            print(f"🔍 验证安装...")
            result = subprocess.run(
                ['which', server_info['command']],
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                print(f"✅ {server_info['command']} 已安装到: {result.stdout.strip()}")
            else:
                print(f"⚠️  命令 {server_info['command']} 未找到，但npm包已安装")
            
            # 3. 创建配置文件
            self.create_config_file(server_type, config)
            
            # 4. 创建启动脚本
            self.create_startup_script(server_type, config)
            
            return True
            
        except Exception as e:
            print(f"❌ 安装过程中出错: {str(e)}")
            return False
    
    def create_config_file(self, server_type, config):
        """创建配置文件"""
        config_dir = self.scripts_dir / "configs"
        config_dir.mkdir(exist_ok=True)
        
        config_file = config_dir / f"{server_type}_config.json"
        
        default_config = {
            "server_type": server_type,
            "name": self.supported_servers[server_type]["name"],
            "description": self.supported_servers[server_type]["description"],
            "installed": True,
            "timestamp": subprocess.run(['date', '+%Y-%m-%d %H:%M:%S'], capture_output=True, text=True).stdout.strip()
        }
        
        if config:
            default_config.update(config)
        
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(default_config, f, indent=2, ensure_ascii=False)
        
        print(f"📄 配置文件已创建: {config_file}")
    
    def create_startup_script(self, server_type, config):
        """创建启动脚本"""
        scripts_dir = self.scripts_dir
        script_file = scripts_dir / f"start_{server_type}.sh"
        
        # 根据服务器类型生成不同的启动命令
        startup_commands = {
            "filesystem": """#!/bin/bash
# 启动文件系统MCP服务器
echo "🚀 启动文件系统MCP服务器..."
mcp-server-filesystem \\
  --directory "$HOME/Documents" \\
  --directory "$HOME/Downloads" \\
  --directory "/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace" \\
  --port 3000
""",
            "sqlite": """#!/bin/bash
# 启动SQLite MCP服务器
echo "🚀 启动SQLite MCP服务器..."
DB_PATH="${1:-/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace/mcp.db}"
mcp-server-sqlite "$DB_PATH" --port 3001
""",
            "http": """#!/bin/bash
# 启动HTTP MCP服务器
echo "🚀 启动HTTP MCP服务器..."
API_URL="${1:-http://localhost:8080}"
mcp-server-http --base-url "$API_URL" --port 3002
""",
            "github": """#!/bin/bash
# 启动GitHub MCP服务器
echo "🚀 启动GitHub MCP服务器..."
if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ 请设置 GITHUB_TOKEN 环境变量"
    exit 1
fi
mcp-server-github --token "$GITHUB_TOKEN" --port 3003
""",
            "supabase": """#!/bin/bash
# 启动Supabase MCP服务器
echo "🚀 启动Supabase MCP服务器..."
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
    echo "❌ 请设置 SUPABASE_URL 和 SUPABASE_KEY 环境变量"
    exit 1
fi
mcp-server-supabase --url "$SUPABASE_URL" --key "$SUPABASE_KEY" --port 3004
"""
        }
        
        if server_type in startup_commands:
            with open(script_file, 'w', encoding='utf-8') as f:
                f.write(startup_commands[server_type])
            
            # 设置执行权限
            subprocess.run(['chmod', '+x', str(script_file)])
            print(f"📜 启动脚本已创建: {script_file}")
    
    def update_nanobot_config(self, server_type, port):
        """更新nanobot配置"""
        config_file = self.nanobot_dir / ".env"
        
        if not config_file.exists():
            print(f"⚠️  nanobot配置文件不存在: {config_file}")
            return
        
        # 读取现有配置
        with open(config_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        # 添加或更新MCP配置
        mcp_config = f"\n# MCP {server_type} 服务器配置\n"
        mcp_config += f"MCP_{server_type.upper()}_ENABLED=true\n"
        mcp_config += f"MCP_{server_type.upper()}_PORT={port}\n"
        
        # 检查是否已存在配置
        config_key = f"MCP_{server_type.upper()}_ENABLED"
        config_found = False
        
        for i, line in enumerate(lines):
            if line.startswith(config_key):
                lines[i] = f"{config_key}=true\n"
                config_found = True
        
        if not config_found:
            lines.append(mcp_config)
        
        # 写回文件
        with open(config_file, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        
        print(f"✅ nanobot配置已更新: {config_file}")
    
    def install_from_url(self, url):
        """从URL安装MCP服务器"""
        print(f"🌐 从URL安装MCP服务器: {url}")
        
        # 检测服务器类型
        server_type = self.detect_server_type(url)
        print(f"🔍 检测到服务器类型: {server_type}")
        
        # 安装服务器
        config = {
            "source_url": url,
            "auto_detected": True
        }
        
        success = self.install_mcp_server(server_type, config)
        
        if success:
            # 更新nanobot配置
            port = 3000 + list(self.supported_servers.keys()).index(server_type)
            self.update_nanobot_config(server_type, port)
            
            print(f"\n🎉 {self.supported_servers[server_type]['name']} 安装完成!")
            print(f"📊 服务器类型: {server_type}")
            print(f"🔗 源地址: {url}")
            print(f"🚪 端口号: {port}")
            print(f"⚡ 启动命令: ./skills/mcp/scripts/start_{server_type}.sh")
            
            return True
        else:
            print(f"❌ 安装失败")
            return False
    
    def install_from_name(self, name):
        """从名称安装MCP服务器"""
        print(f"📛 从名称安装MCP服务器: {name}")
        
        if name not in self.supported_servers:
            print(f"❌ 不支持的MCP服务器: {name}")
            print(f"✅ 支持的服务器: {', '.join(self.supported_servers.keys())}")
            return False
        
        success = self.install_mcp_server(name)
        
        if success:
            port = 3000 + list(self.supported_servers.keys()).index(name)
            self.update_nanobot_config(name, port)
            
            print(f"\n🎉 {self.supported_servers[name]['name']} 安装完成!")
            print(f"⚡ 启动命令: ./skills/mcp/scripts/start_{name}.sh")
            
            return True
        else:
            return False
    
    def list_installed_servers(self):
        """列出已安装的MCP服务器"""
        print("📋 已安装的MCP服务器:")
        print("-" * 50)
        
        config_dir = self.scripts_dir / "configs"
        
        if not config_dir.exists():
            print("❌ 没有找到已安装的MCP服务器")
            return
        
        for config_file in config_dir.glob("*_config.json"):
            with open(config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)
            
            server_type = config.get('server_type', 'unknown')
            server_name = config.get('name', '未知服务器')
            
            print(f"🔸 {server_name}")
            print(f"   类型: {server_type}")
            print(f"   描述: {config.get('description', '无描述')}")
            print(f"   安装时间: {config.get('timestamp', '未知')}")
            
            if 'source_url' in config:
                print(f"   源地址: {config['source_url']}")
            
            print()
    
    def run(self):
        """主运行函数"""
        print("🤖 MCP智能安装器")
        print("=" * 50)
        
        if len(sys.argv) < 2:
            print("使用方法:")
            print("  python auto_install_mcp.py <URL或服务器名称>")
            print("  python auto_install_mcp.py --list")
            print("\n示例:")
            print("  python auto_install_mcp.py https://github.com/user/repo")
            print("  python auto_install_mcp.py filesystem")
            print("  python auto_install_mcp.py sqlite")
            print("\n支持的服务器类型:")
            for server_type, info in self.supported_servers.items():
                print(f"  {server_type}: {info['description']}")
            return
        
        arg = sys.argv[1]
        
        if arg == "--list":
            self.list_installed_servers()
        elif arg.startswith(('http://', 'https://', 'ftp://', 'file://')):
            self.install_from_url(arg)
        else:
            self.install_from_name(arg)

if __name__ == "__main__":
    installer = MCPAutoInstaller()
    installer.run()