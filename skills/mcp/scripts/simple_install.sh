#!/bin/bash

echo "========================================"
echo "MCP简化安装脚本"
echo "========================================"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}[1/4] 检查系统环境...${NC}"
OS=$(uname -s)
ARCH=$(uname -m)
echo "操作系统: $OS"
echo "架构: $ARCH"

echo -e "${BLUE}[2/4] 检查Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js未安装，请先安装Node.js${NC}"
    exit 1
fi

NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
echo -e "${GREEN}Node.js已安装: $NODE_VERSION${NC}"
echo -e "${GREEN}npm已安装: $NPM_VERSION${NC}"

echo -e "${BLUE}[3/4] 安装MCP核心包...${NC}"
echo "安装@modelcontextprotocol/sdk..."
npm install -g @modelcontextprotocol/sdk

echo "安装文件系统服务器..."
npm install -g @modelcontextprotocol/server-filesystem

echo -e "${YELLOW}注意：其他官方服务器包可能不存在${NC}"
echo -e "${YELLOW}您可以使用以下替代方案：${NC}"
echo "1. 使用文件系统服务器访问本地文件"
echo "2. 使用第三方MCP服务器"
echo "3. 自己开发MCP服务器"

echo -e "${BLUE}[4/4] 验证安装...${NC}"
if npm list -g @modelcontextprotocol/sdk &> /dev/null; then
    echo -e "${GREEN}MCP SDK安装成功${NC}"
else
    echo -e "${RED}MCP SDK安装失败${NC}"
    exit 1
fi

if npm list -g @modelcontextprotocol/server-filesystem &> /dev/null; then
    echo -e "${GREEN}文件系统服务器安装成功${NC}"
else
    echo -e "${RED}文件系统服务器安装失败${NC}"
fi

echo ""
echo -e "${GREEN}✅ MCP基础安装完成！${NC}"
echo ""
echo "可用命令："
echo "  mcp-server --version          # 查看版本"
echo "  mcp-server --help             # 查看帮助"
echo ""
echo "启动文件系统服务器："
echo "  mcp-server filesystem --directory ~/Documents --port 3000"
echo ""
echo "测试连接："
echo "  1. 启动服务器：mcp-server filesystem --directory ~/Documents"
echo "  2. 在另一个终端测试：curl http://localhost:3000/health"
echo ""
echo -e "${BLUE}下一步：${NC}"
echo "1. 启动MCP服务器"
echo "2. 配置nanobot使用MCP"
echo "3. 测试MCP连接"