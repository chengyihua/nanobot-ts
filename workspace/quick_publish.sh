#!/bin/bash

# 快速发布脚本
# 打开微信公众号后台并显示文章内容

echo "🚀 微信公众号文章快速发布助手"
echo "=========================================="

# 工作目录
WORKSPACE="/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace"
ARTICLE_DIR="$WORKSPACE/ai_agent_news_2026-02-28"

# 检查目录
if [ ! -d "$ARTICLE_DIR" ]; then
    echo "❌ 文章目录不存在: $ARTICLE_DIR"
    exit 1
fi

# 显示文章信息
echo "📝 文章信息:"
echo "   标题: OpenAI千亿融资背后的AI军备竞赛"
echo "   日期: 2026年2月28日"
echo "   字数: 约2400字"
echo "   类型: AI热点深度分析"
echo ""

# 显示文章前几行
echo "📄 文章预览:"
head -20 "$ARTICLE_DIR/wechat_article.md"
echo "..."
echo ""

# 打开微信公众号后台
echo "🌐 打开微信公众号后台..."
open "https://mp.weixin.qq.com"

# 显示发布步骤
echo ""
echo "🎯 发布步骤:"
echo "1. 使用微信扫码登录"
echo "2. 点击'新建图文'"
echo "3. 复制以下文章内容:"
echo ""
echo "📋 复制命令:"
echo "   cat $ARTICLE_DIR/wechat_article.md | pbcopy"
echo ""
echo "4. 粘贴到编辑器"
echo "5. 添加封面图片: $ARTICLE_DIR/cover.jpg"
echo "6. 设置摘要和选项"
echo "7. 保存或发布"
echo ""

# 提供复制命令
echo "📋 一键复制文章内容:"
echo "   cat \"$ARTICLE_DIR/wechat_article.md\" | pbcopy"
echo ""

# 提供查看命令
echo "🔍 查看文章:"
echo "   cat \"$ARTICLE_DIR/wechat_article.md\""
echo ""

# 提供打开文件命令
echo "📁 打开文件:"
echo "   open \"$ARTICLE_DIR/wechat_article.html\""
echo "   open \"$ARTICLE_DIR/cover.jpg\""
echo ""

# 创建快捷命令
echo "⚡ 快捷命令:"
cat > "$WORKSPACE/publish_commands.txt" << EOF
# 复制文章内容
cat "$ARTICLE_DIR/wechat_article.md" | pbcopy

# 查看文章
cat "$ARTICLE_DIR/wechat_article.md"

# 打开HTML版本
open "$ARTICLE_DIR/wechat_article.html"

# 打开封面图片
open "$ARTICLE_DIR/cover.jpg"

# 打开微信公众号后台
open https://mp.weixin.qq.com
EOF

echo "📝 快捷命令已保存到: $WORKSPACE/publish_commands.txt"
echo ""

# 执行复制命令
echo "📋 正在复制文章内容到剪贴板..."
cat "$ARTICLE_DIR/wechat_article.md" | pbcopy
if [ $? -eq 0 ]; then
    echo "✅ 文章内容已复制到剪贴板！"
else
    echo "⚠️  复制到剪贴板失败，请手动复制"
fi

echo ""
echo "=========================================="
echo "🎉 准备完成！请按以下步骤操作："
echo "1. 已打开微信公众号后台"
echo "2. 文章内容已复制到剪贴板"
echo "3. 登录后直接粘贴即可"
echo "=========================================="

# 保持脚本运行，显示提示
echo ""
echo "💡 提示：按 Ctrl+C 退出此脚本"
echo "📋 文章内容已在剪贴板中，可以直接粘贴"
echo ""

# 显示倒计时
for i in {10..1}; do
    echo -ne "⏰ 将在 $i 秒后显示完整文章内容...\r"
    sleep 1
done

echo ""
echo ""
echo "📄 完整文章内容:"
echo "=========================================="
cat "$ARTICLE_DIR/wechat_article.md"
echo "=========================================="
echo ""
echo "🎯 发布完成！文章已准备好发布到微信公众号。"