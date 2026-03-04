#!/bin/bash

# 微信公众号API配置脚本

echo "🚀 微信公众号API配置"
echo "=========================================="

# 工作目录
WORKSPACE="/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace"
SKILL_DIR="/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/skills/baoyu-post-to-wechat"

# 检查是否已有配置
echo "🔍 检查现有配置..."

# 检查环境变量
if [ -n "$WECHAT_APP_ID" ] && [ -n "$WECHAT_APP_SECRET" ]; then
    echo "✅ 环境变量已配置"
    echo "   App ID: $WECHAT_APP_ID"
    echo "   App Secret: [已隐藏]"
    exit 0
fi

# 检查配置文件
CONFIG_DIR="$WORKSPACE/.baoyu-skills"
if [ -f "$CONFIG_DIR/.env" ]; then
    echo "✅ 配置文件存在: $CONFIG_DIR/.env"
    source "$CONFIG_DIR/.env"
    if [ -n "$WECHAT_APP_ID" ] && [ -n "$WECHAT_APP_SECRET" ]; then
        echo "✅ 配置文件中的API凭证有效"
        exit 0
    fi
fi

# 检查用户目录
USER_CONFIG="$HOME/.baoyu-skills/.env"
if [ -f "$USER_CONFIG" ]; then
    echo "✅ 用户配置文件存在: $USER_CONFIG"
    source "$USER_CONFIG"
    if [ -n "$WECHAT_APP_ID" ] && [ -n "$WECHAT_APP_SECRET" ]; then
        echo "✅ 用户配置文件中的API凭证有效"
        exit 0
    fi
fi

echo "❌ 未找到有效的API配置"
echo ""
echo "📋 需要配置微信公众号API凭证："
echo ""
echo "1. 登录微信公众号后台：https://mp.weixin.qq.com"
echo "2. 进入「设置与开发」→「基本配置」"
echo "3. 获取以下信息："
echo "   - App ID (应用ID)"
echo "   - App Secret (应用密钥)"
echo ""
echo "4. 选择配置方式："
echo "   A) 设置环境变量"
echo "   B) 创建配置文件"
echo ""
echo "请输入您的选择 (A/B): "
read -r choice

case $choice in
    A|a)
        echo ""
        echo "📝 设置环境变量："
        echo "请将以下命令添加到您的shell配置文件 (~/.zshrc, ~/.bashrc):"
        echo ""
        echo "export WECHAT_APP_ID=\"您的App ID\""
        echo "export WECHAT_APP_SECRET=\"您的App Secret\""
        echo ""
        echo "然后执行: source ~/.zshrc (或 ~/.bashrc)"
        ;;
    B|b)
        echo ""
        echo "📝 创建配置文件："
        echo "请输入您的App ID: "
        read -r app_id
        echo "请输入您的App Secret: "
        read -r app_secret
        
        # 创建配置目录
        mkdir -p "$CONFIG_DIR"
        
        # 创建配置文件
        cat > "$CONFIG_DIR/.env" << EOF
WECHAT_APP_ID=$app_id
WECHAT_APP_SECRET=$app_secret
EOF
        
        echo "✅ 配置文件已创建: $CONFIG_DIR/.env"
        echo "📋 文件内容:"
        cat "$CONFIG_DIR/.env"
        ;;
    *)
        echo "❌ 无效选择"
        exit 1
        ;;
esac

echo ""
echo "🎯 配置完成后，请重新运行发布命令："
echo "   cd $WORKSPACE && npx -y bun $SKILL_DIR/scripts/wechat-api.ts ai_agent_news_2026-02-28/wechat_article.md"
echo ""
echo "📋 或者使用完整命令："
echo "   WECHAT_APP_ID=\"您的ID\" WECHAT_APP_SECRET=\"您的密钥\" npx -y bun $SKILL_DIR/scripts/wechat-api.ts ai_agent_news_2026-02-28/wechat_article.md --title \"OpenAI千亿融资背后的AI军备竞赛\" --cover ai_agent_news_2026-02-28/cover.jpg"