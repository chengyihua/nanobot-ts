#!/bin/bash

echo "🧪 测试微信公众号浏览器模式发布"
echo "=================================="

cd /Users/chengyihua/Downloads/nanobot-main/nanobot-ts

echo "📁 检查测试文件..."
if [ -f "workspace/test_article.md" ]; then
    echo "✅ 测试文章存在: workspace/test_article.md"
else
    echo "❌ 测试文章不存在"
    exit 1
fi

echo "🖼️ 检查测试图片目录..."
if [ -d "workspace/test_images" ]; then
    echo "✅ 测试图片目录存在"
    IMAGE_COUNT=$(ls workspace/test_images/*.png workspace/test_images/*.jpg 2>/dev/null | wc -l)
    echo "   图片数量: $IMAGE_COUNT"
else
    echo "⚠️  测试图片目录不存在，创建中..."
    mkdir -p workspace/test_images
    echo "✅ 测试图片目录已创建"
fi

echo "🚀 开始浏览器模式测试..."
echo "注意：这将打开Chrome浏览器，请按照提示操作"

# 运行浏览器模式测试（预览模式，不提交）
bun skills/baoyu-post-to-wechat/scripts/wechat-browser.ts \
  --markdown workspace/test_article.md \
  --images workspace/test_images

echo "✅ 测试完成！"
echo ""
echo "💡 如果测试成功，您将看到："
echo "1. Chrome浏览器自动打开"
echo "2. 导航到微信公众号后台"
echo "3. 自动填写文章内容"
echo "4. 显示预览页面"
echo ""
echo "🔧 要实际发布，请添加 --submit 参数："