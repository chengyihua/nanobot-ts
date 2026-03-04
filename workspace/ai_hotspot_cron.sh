#!/bin/bash

# AI热点智能发现与深度分析定时任务
# 每天早上6点执行

echo "=========================================="
echo "🚀 AI热点智能分析开始 - $(date)"
echo "=========================================="

# 进入工作目录
cd /Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace

# 1. 运行智能热点分析
echo "🔍 执行智能热点分析..."
python3 ai_hotspot_analyzer.py

# 2. 检查分析结果
ANALYSIS_DIR="ai_hotspot_analysis_$(date +%Y-%m-%d)"
if [ -d "$ANALYSIS_DIR" ]; then
    echo "✅ 分析完成，目录: $ANALYSIS_DIR"
    
    # 3. 复制文章到公众号目录
    ARTICLE_FILE="$ANALYSIS_DIR/deep_analysis_article.md"
    if [ -f "$ARTICLE_FILE" ]; then
        echo "📝 复制深度分析文章..."
        
        # 创建公众号目录
        WECHAT_DIR="ai_agent_news_$(date +%Y-%m-%d)"
        mkdir -p "$WECHAT_DIR"
        
        # 复制文章
        cp "$ARTICLE_FILE" "$WECHAT_DIR/wechat_article.md"
        
        # 生成HTML版本
        echo "🔄 生成HTML版本..."
        python3 -c "
import markdown
import sys

with open('$ARTICLE_FILE', 'r', encoding='utf-8') as f:
    content = f.read()

# 简单的Markdown转HTML
html_content = f'''<!DOCTYPE html>
<html>
<head>
    <meta charset=\"utf-8\">
    <title>AI热点深度分析 - $(date +%Y-%m-%d)</title>
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }}
        h1 {{ color: #333; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px; }}
        h2 {{ color: #555; margin-top: 30px; border-left: 4px solid #007bff; padding-left: 10px; }}
        p {{ margin: 15px 0; }}
        blockquote {{ border-left: 4px solid #ddd; padding-left: 15px; margin: 20px 0; color: #666; }}
        .highlight {{ background-color: #f8f9fa; padding: 15px; border-radius: 5px; }}
    </style>
</head>
<body>
{markdown.markdown(content)}
</body>
</html>'''

with open('$WECHAT_DIR/wechat_article.html', 'w', encoding='utf-8') as f:
    f.write(html_content)
        "
        
        echo "✅ 文章已准备: $WECHAT_DIR/wechat_article.md"
        
        # 4. 生成通知
        NOTIFICATION="✅ AI热点智能分析完成！

📅 日期：$(date +%Y年%m月%d日)
⏰ 时间：$(date +%H:%M:%S)
🎯 主题：OpenAI千亿融资背后的AI军备竞赛
📊 分析：基于GitHub Trending和Hacker News数据
📝 文章：已生成深度分析文章
📁 位置：$ANALYSIS_DIR

文章已准备好，可以发布到公众号。"
        
        echo "$NOTIFICATION" > "$WECHAT_DIR/notification.txt"
        echo "📨 通知已生成"
        
    else
        echo "❌ 文章文件不存在: $ARTICLE_FILE"
    fi
else
    echo "❌ 分析目录不存在: $ANALYSIS_DIR"
fi

echo "=========================================="
echo "✅ AI热点智能分析完成 - $(date)"
echo "=========================================="

# 记录执行日志
echo "[$(date)] AI热点智能分析执行完成" >> ai_hotspot_cron.log