#!/bin/bash

# MCP自动安装脚本（修复版）
# 用法: ./install_mcp_fixed.sh [options]
# 选项:
#   --all: 安装所有MCP服务器
#   --basic: 只安装基础服务器
#   --node: 安装Node.js（如果未安装）

set -e

echo "========================================"
echo "MCP（Model Context Protocol）自动安装脚本"
echo "========================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 参数解析
INSTALL_ALL=false
INSTALL_BASIC=false
INSTALL_NODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --all)
            INSTALL_ALL=true
            shift
            ;;
        --basic)
            INSTALL_BASIC=true
            shift
            ;;
        --node)
            INSTALL_NODE=true
            shift
            ;;
        *)
            echo "未知参数: $1"
            exit 1
            ;;
    esac
done

# 默认安装基础包
if [ "$INSTALL_ALL" = false ] && [ "$INSTALL_BASIC" = false ]; then
    INSTALL_BASIC=true
fi

# 检查系统
echo -e "${BLUE}[1/6] 检查系统环境...${NC}"
OS=$(uname -s)
ARCH=$(uname -m)
echo "操作系统: $OS"
echo "架构: $ARCH"

# 检查Node.js
echo -e "${BLUE}[2/6] 检查Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js未安装${NC}"
    
    if [ "$INSTALL_NODE" = true ]; then
        echo "安装Node.js..."
        
        if [ "$OS" = "Darwin" ]; then
            # macOS
            if command -v brew &> /dev/null; then
                brew install node
            else
                echo -e "${RED}请先安装Homebrew: https://brew.sh/${NC}"
                exit 1
            fi
        elif [ "$OS" = "Linux" ]; then
            # Linux
            if command -v apt &> /dev/null; then
                curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
                sudo apt-get install -y nodejs
            elif command -v yum &> /dev/null; then
                curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
                sudo yum install -y nodejs
            else
                echo -e "${RED}不支持的包管理器${NC}"
                exit 1
            fi
        else
            echo -e "${RED}不支持的操作系统: $OS${NC}"
            exit 1
        fi
    else
        echo -e "${RED}请使用 --node 参数安装Node.js${NC}"
        exit 1
    fi
else
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}Node.js已安装: $NODE_VERSION${NC}"
    echo -e "${GREEN}npm已安装: $NPM_VERSION${NC}"
fi

# 安装MCP SDK
echo -e "${BLUE}[3/6] 安装MCP SDK...${NC}"
echo "安装@modelcontextprotocol/sdk..."
npm install -g @modelcontextprotocol/sdk

# 安装基础服务器
if [ "$INSTALL_BASIC" = true ] || [ "$INSTALL_ALL" = true ]; then
    echo -e "${BLUE}[4/6] 安装基础MCP服务器...${NC}"
    
    echo "安装文件系统服务器..."
    npm install -g @modelcontextprotocol/server-filesystem
    
    echo "安装SQLite服务器..."
    npm install -g @modelcontextprotocol/server-sqlite
    
    echo "安装HTTP服务器..."
    npm install -g @modelcontextprotocol/server-http
fi

# 安装高级服务器
if [ "$INSTALL_ALL" = true ]; then
    echo -e "${BLUE}[5/6] 安装高级MCP服务器...${NC}"
    
    echo "安装PostgreSQL服务器..."
    npm install -g @modelcontextprotocol/server-postgres
    
    echo "安装GitHub服务器..."
    npm install -g @modelcontextprotocol/server-github
    
    echo "安装Brave搜索服务器..."
    npm install -g @modelcontextprotocol/server-brave-search
    
    echo "安装天气服务器..."
    npm install -g @modelcontextprotocol/server-weather
    
    echo "安装时钟服务器..."
    npm install -g @modelcontextprotocol/server-clock
fi

# 验证安装
echo -e "${BLUE}[6/6] 验证安装...${NC}"
if npm list -g @modelcontextprotocol/sdk &> /dev/null; then
    echo -e "${GREEN}MCP SDK已安装${NC}"
    
    # 检查是否有mcp-server命令
    if command -v mcp-server &> /dev/null; then
        echo -e "${GREEN}mcp-server命令可用${NC}"
    else
        echo -e "${YELLOW}注意: mcp-server命令可能不可用，但SDK已安装${NC}"
        echo "您可以通过以下方式使用MCP:"
        echo "  node -e \"const { Client } = require('@modelcontextprotocol/sdk');\""
    fi
    
    echo ""
    echo -e "${GREEN}✅ MCP安装完成！${NC}"
    echo ""
    echo "可用命令:"
    echo "  npm list -g @modelcontextprotocol/sdk  # 查看SDK版本"
    echo ""
    echo "启动MCP服务器示例:"
    echo "  npx @modelcontextprotocol/server-filesystem --directory ~/Documents"
    echo "  npx @modelcontextprotocol/server-sqlite --database /tmp/test.db"
    echo "  npx @modelcontextprotocol/server-http --port 8080"
    
    # 创建快捷启动脚本
    cat > ~/start_mcp.sh << 'EOF'
#!/bin/bash
echo "启动MCP服务器..."
echo "1. 文件系统服务器 (端口: 3000)"
npx @modelcontextprotocol/server-filesystem --directory ~/Documents --port 3000 &
echo "2. HTTP服务器 (端口: 8080)"
npx @modelcontextprotocol/server-http --port 8080 &
echo "3. SQLite服务器 (端口: 3001)"
npx @modelcontextprotocol/server-sqlite --database /tmp/test.db --port 3001 &
echo ""
echo "MCP服务器已启动"
echo "文件系统: http://localhost:3000"
echo "HTTP API: http://localhost:8080"
echo "SQLite: http://localhost:3001"
EOF
    
    chmod +x ~/start_mcp.sh
    echo -e "${YELLOW}快捷启动脚本已创建: ~/start_mcp.sh${NC}"
    
else
    echo -e "${RED}MCP SDK安装失败${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}下一步:${NC}"
echo "1. 运行 ~/start_mcp.sh 启动MCP服务器"
echo "2. 配置nanobot使用MCP"
echo "3. 测试MCP连接"
echo ""
echo -e "${GREEN}安装完成！${NC}"