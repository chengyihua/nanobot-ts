#!/bin/bash

# 简单的微信公众号发布测试

echo "🚀 开始微信公众号发布测试"
echo "================================"

# 配置
WORKSPACE="/Users/chengyihua/Downloads/nanobot-main/nanobot-ts"
SKILL_DIR="$WORKSPACE/skills/baoyu-post-to-wechat"
ARTICLE_FILE="$WORKSPACE/workspace/test_image_article.md"

# 检查文件
echo "📁 检查文件..."
if [ ! -f "$ARTICLE_FILE" ]; then
    echo "❌ 测试文章不存在: $ARTICLE_FILE"
    exit 1
fi
echo "✅ 测试文章存在: $ARTICLE_FILE"

# 检查技能
echo "🔧 检查技能..."
if [ ! -d "$SKILL_DIR" ]; then
    echo "❌ 技能目录不存在: $SKILL_DIR"
    exit 1
fi
echo "✅ 技能目录存在: $SKILL_DIR"

# 检查技能脚本
SCRIPTS=("wechat-browser.ts" "wechat-article.ts" "wechat-api.ts")
for script in "${SCRIPTS[@]}"; do
    if [ -f "$SKILL_DIR/scripts/$script" ]; then
        echo "✅ $script 存在"
    else
        echo "❌ $script 不存在"
    fi
done

# 显示测试文章信息
echo ""
echo "📄 测试文章信息:"
echo "标题: $(grep -m1 '^title:' "$ARTICLE_FILE" | sed 's/title: //' | tr -d '\"')"
echo "作者: $(grep -m1 '^author:' "$ARTICLE_FILE" | sed 's/author: //' | tr -d '\"')"
echo "图片数量: $(grep -c '!\[.*\](http' "$ARTICLE_FILE")"

# 生成测试命令
echo ""
echo "🚀 测试命令:"

echo ""
echo "1. 预览模式（不提交）:"
echo "npx -y bun $SKILL_DIR/scripts/wechat-browser.ts \\"
echo "  --markdown $ARTICLE_FILE \\"
echo "  --images $WORKSPACE/workspace/test_images"

echo ""
echo "2. 提交为草稿:"
echo "npx -y bun $SKILL_DIR/scripts/wechat-browser.ts \\"
echo "  --markdown $ARTICLE_FILE \\"
echo "  --images $WORKSPACE/workspace/test_images \\"
echo "  --submit"

echo ""
echo "3. 普通文章模式:"
echo "npx -y bun $SKILL_DIR/scripts/wechat-article.ts \\"
echo "  --markdown $ARTICLE_FILE"

echo ""
echo "💡 提示:"
echo "- 第一次运行会打开Chrome浏览器，需要扫码登录微信公众号"
echo "- 建议先使用预览模式测试"
echo "- 确保网络连接正常"
echo "- 如果遇到权限问题，可能需要授权Chrome访问"

# 创建测试图片目录
TEST_IMAGES_DIR="$WORKSPACE/workspace/test_images"
if [ ! -d "$TEST_IMAGES_DIR" ]; then
    echo ""
    echo "📁 创建测试图片目录: $TEST_IMAGES_DIR"
    mkdir -p "$TEST_IMAGES_DIR"
    
    # 创建示例图片说明
    cat > "$TEST_IMAGES_DIR/README.md" << 'EOF'
# 测试图片目录

## 图片要求
- 格式: JPG或PNG
- 尺寸: 建议900x500（封面图），800x450（正文图）
- 命名: 按顺序命名，如 01-cover.jpg, 02-content.jpg

## 测试图片示例
1. 封面图: 展示AI技术概念
2. 技术架构图: 展示分层架构
3. 应用场景图: 展示企业应用
4. 趋势图: 展示未来发展

## 获取测试图片
您可以从以下网站下载免费测试图片:
- Unsplash: https://unsplash.com
- Pexels: https://pexels.com
- Pixabay: https://pixabay.com

## 使用示例
```bash
# 下载示例图片（需要curl）
curl -o "$TEST_IMAGES_DIR/01-cover.jpg" "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=900&h=500&fit=crop"
curl -o "$TEST_IMAGES_DIR/02-content.jpg" "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&h=450&fit=crop"
```
EOF
    
    echo "✅ 测试图片目录已创建"
    echo "📝 请查看 $TEST_IMAGES_DIR/README.md 获取更多信息"
fi

echo ""
echo "🎯 测试步骤:"
echo "1. 准备测试图片（可选）"
echo "2. 运行上述测试命令"
echo "3. 观察Chrome浏览器行为"
echo "4. 检查微信公众号后台"

echo ""
echo "⚠️  注意事项:"
echo "- 测试期间请勿关闭Chrome浏览器"
echo "- 确保微信公众号已登录"
echo "- 测试数据不会实际发布，只会保存为草稿"

echo ""
echo "========================================"
echo "测试准备完成！可以开始测试了 🚀"