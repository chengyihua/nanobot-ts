#!/bin/bash

# 微信公众号发布测试脚本

echo "🚀 开始微信公众号发布测试"
echo "=========================="

WORKSPACE="/Users/chengyihua/Downloads/nanobot-main/nanobot-ts"
SKILL_DIR="$WORKSPACE/skills/baoyu-post-to-wechat"
ARTICLE_FILE="$WORKSPACE/workspace/test_image_article.md"
TEST_IMAGES_DIR="$WORKSPACE/workspace/test_images"

# 检查必要文件
if [ ! -f "$ARTICLE_FILE" ]; then
    echo "❌ 文章文件不存在: $ARTICLE_FILE"
    exit 1
fi

if [ ! -d "$TEST_IMAGES_DIR" ]; then
    echo "❌ 图片目录不存在: $TEST_IMAGES_DIR"
    exit 1
fi

# 选择测试模式
echo ""
echo "请选择测试模式:"
echo "1. 图片文章测试（浏览器模式）"
echo "2. 普通文章测试（浏览器模式）"
echo "3. API模式测试（需要凭证）"
echo "4. 退出"
echo ""
read -p "请输入选择 (1-4): " choice

case $choice in
    1)
        echo "📸 选择图片文章测试..."
        COMMAND="npx -y bun $SKILL_DIR/scripts/wechat-browser.ts --markdown $ARTICLE_FILE --images $TEST_IMAGES_DIR"
        ;;
    2)
        echo "📄 选择普通文章测试..."
        COMMAND="npx -y bun $SKILL_DIR/scripts/wechat-article.ts --markdown $ARTICLE_FILE"
        ;;
    3)
        echo "🔌 选择API模式测试..."
        read -p "请输入WECHAT_APP_ID: " app_id
        read -s -p "请输入WECHAT_APP_SECRET: " app_secret
        echo ""
        export WECHAT_APP_ID="$app_id"
        export WECHAT_APP_SECRET="$app_secret"
        COMMAND="npx -y bun $SKILL_DIR/scripts/wechat-api.ts --markdown $ARTICLE_FILE"
        ;;
    4)
        echo "退出测试"
        exit 0
        ;;
    *)
        echo "❌ 无效选择"
        exit 1
        ;;
esac

echo ""
echo "🚀 执行命令:"
echo "$COMMAND"
echo ""
echo "⚠️  注意:"
echo "- 第一次运行会打开Chrome浏览器"
echo "- 需要扫码登录微信公众号"
echo "- 测试期间请勿关闭浏览器"
echo "- 按Ctrl+C可以中断测试"
echo ""
read -p "是否继续？(y/n): " confirm

if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
    echo ""
    echo "开始执行..."
    cd "$WORKSPACE" && eval "$COMMAND"
else
    echo "取消测试"
    exit 0
fi

echo ""
echo "🎯 测试完成！"
echo "💡 提示: 检查微信公众号后台草稿箱查看结果"
