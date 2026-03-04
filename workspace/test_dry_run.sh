#!/bin/bash

# 微信公众号发布干测试（不实际执行）

echo "🧪 微信公众号发布干测试"
echo "========================"

WORKSPACE="/Users/chengyihua/Downloads/nanobot-main/nanobot-ts"
SKILL_DIR="$WORKSPACE/skills/baoyu-post-to-wechat"
ARTICLE_FILE="$WORKSPACE/workspace/test_image_article.md"

# 创建测试图片目录和示例图片
TEST_IMAGES_DIR="$WORKSPACE/workspace/test_images"
mkdir -p "$TEST_IMAGES_DIR"

echo ""
echo "📁 创建测试环境..."
echo "工作目录: $WORKSPACE"
echo "技能目录: $SKILL_DIR"
echo "文章文件: $ARTICLE_FILE"
echo "图片目录: $TEST_IMAGES_DIR"

# 创建示例图片（使用base64编码的小图片）
echo ""
echo "🖼️ 创建示例测试图片..."
for i in {1..3}; do
    IMAGE_FILE="$TEST_IMAGES_DIR/test_$i.png"
    if [ ! -f "$IMAGE_FILE" ]; then
        # 创建一个简单的PNG图片（1x1像素透明）
        echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" | base64 -d > "$IMAGE_FILE"
        echo "✅ 创建测试图片: $IMAGE_FILE ($(wc -c < "$IMAGE_FILE") 字节)"
    fi
done

# 显示测试配置
echo ""
echo "⚙️ 测试配置:"
echo "文章标题: $(grep -m1 '^title:' "$ARTICLE_FILE" | sed 's/title: //' | tr -d '\"')"
echo "文章作者: $(grep -m1 '^author:' "$ARTICLE_FILE" | sed 's/author: //' | tr -d '\"')"
echo "图片数量: $(ls -1 "$TEST_IMAGES_DIR"/*.png 2>/dev/null | wc -l)"

# 生成测试命令
echo ""
echo "🚀 生成的测试命令:"

echo ""
echo "1. 图片文章测试（预览模式）:"
echo "cd $WORKSPACE && \\"
echo "npx -y bun $SKILL_DIR/scripts/wechat-browser.ts \\"
echo "  --markdown $ARTICLE_FILE \\"
echo "  --images $TEST_IMAGES_DIR \\"
echo "  --dry-run"

echo ""
echo "2. 普通文章测试（预览模式）:"
echo "cd $WORKSPACE && \\"
echo "npx -y bun $SKILL_DIR/scripts/wechat-article.ts \\"
echo "  --markdown $ARTICLE_FILE \\"
echo "  --dry-run"

echo ""
echo "3. API模式测试（需要凭证）:"
echo "cd $WORKSPACE && \\"
echo "export WECHAT_APP_ID=\"你的AppID\" && \\"
echo "export WECHAT_APP_SECRET=\"你的AppSecret\" && \\"
echo "npx -y bun $SKILL_DIR/scripts/wechat-api.ts \\"
echo "  --markdown $ARTICLE_FILE \\"
echo "  --dry-run"

# 检查技能脚本是否支持dry-run参数
echo ""
echo "🔍 检查技能脚本参数支持..."
for script in "wechat-browser.ts" "wechat-article.ts" "wechat-api.ts"; do
    echo ""
    echo "检查 $script:"
    if grep -q "dry-run\|dryRun\|test" "$SKILL_DIR/scripts/$script"; then
        echo "  ✅ 可能支持测试模式"
    else
        echo "  ⚠️  未找到测试模式参数"
    fi
    
    # 显示脚本帮助信息（如果有）
    if head -20 "$SKILL_DIR/scripts/$script" | grep -q "usage\|help\|Options"; then
        echo "  📖 脚本有使用说明"
    fi
done

# 创建实际测试脚本
echo ""
echo "📝 创建实际测试脚本..."
TEST_SCRIPT="$WORKSPACE/workspace/run_wechat_test.sh"

cat > "$TEST_SCRIPT" << 'EOF'
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
EOF

chmod +x "$TEST_SCRIPT"
echo "✅ 测试脚本已创建: $TEST_SCRIPT"

echo ""
echo "🎯 测试准备完成！"
echo ""
echo "使用方法:"
echo "1. 运行测试脚本: ./run_wechat_test.sh"
echo "2. 选择测试模式"
echo "3. 按照提示操作"
echo ""
echo "💡 建议:"
echo "- 先使用模式1或2进行浏览器测试"
echo "- 确保Chrome浏览器已安装"
echo "- 准备好微信公众号登录二维码"
echo ""
echo "========================================"