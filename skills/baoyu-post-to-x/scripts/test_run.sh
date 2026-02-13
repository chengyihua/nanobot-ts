#!/bin/bash
echo "测试x.com发布脚本..."

# 读取帖子内容
POST_TEXT="测试通过nanobot自动发布到x.com 🐈

这是一个自动化测试帖子，展示AI助手如何简化社交媒体发布流程。

#AI #Automation #Testing"

# 图片路径
IMAGE_PATH="/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace/test_x_image.png"

echo "帖子内容:"
echo "$POST_TEXT"
echo ""
echo "图片路径: $IMAGE_PATH"
echo ""

# 检查图片是否存在
if [ ! -f "$IMAGE_PATH" ]; then
    echo "错误: 图片不存在: $IMAGE_PATH"
    exit 1
fi

echo "准备运行x.com发布脚本..."
echo "注意：首次运行需要登录x.com账户"
echo ""

# 尝试运行脚本
echo "运行命令: npx tsx x-browser.ts \"$POST_TEXT\" --image \"$IMAGE_PATH\""
echo ""

# 运行脚本（超时30秒）
timeout 30 npx tsx x-browser.ts "$POST_TEXT" --image "$IMAGE_PATH" 2>&1 | head -100

echo ""
echo "脚本执行完成"
