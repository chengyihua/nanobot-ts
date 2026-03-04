#!/bin/bash

# AI热点智能分析管理脚本

WORKSPACE="/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace"
CRON_SCRIPT="$WORKSPACE/ai_hotspot_workflow.sh"

case "$1" in
    start)
        echo "🚀 启动AI热点智能分析..."
        $CRON_SCRIPT
        ;;
    stop)
        echo "🛑 停止AI热点定时任务..."
        crontab -l 2>/dev/null | grep -v "ai_hotspot" | crontab -
        echo "✅ 定时任务已停止"
        ;;
    status)
        echo "📊 AI热点智能分析状态"
        echo ""
        echo "📅 定时任务:"
        if crontab -l 2>/dev/null | grep -q "ai_hotspot"; then
            crontab -l 2>/dev/null | grep "ai_hotspot"
        else
            echo "   ❌ 未设置定时任务"
        fi
        echo ""
        echo "📁 最新分析:"
        LATEST_ANALYSIS=$(ls -td $WORKSPACE/ai_hotspot_analysis_* 2>/dev/null | head -1)
        if [ -n "$LATEST_ANALYSIS" ]; then
            echo "   ✅ $LATEST_ANALYSIS"
            ls -la "$LATEST_ANALYSIS/" | head -5
        else
            echo "   ❌ 暂无分析结果"
        fi
        echo ""
        echo "📝 最新文章:"
        LATEST_ARTICLE=$(ls -td $WORKSPACE/ai_agent_news_* 2>/dev/null | head -1)
        if [ -n "$LATEST_ARTICLE" ]; then
            echo "   ✅ $LATEST_ARTICLE"
            if [ -f "$LATEST_ARTICLE/wechat_article.md" ]; then
                echo "   文章标题: $(head -1 "$LATEST_ARTICLE/wechat_article.md" | sed 's/# //')"
                echo "   文章长度: $(wc -c < "$LATEST_ARTICLE/wechat_article.md") 字符"
            fi
        else
            echo "   ❌ 暂无文章"
        fi
        ;;
    test)
        echo "🧪 测试AI热点分析..."
        $WORKSPACE/ai_hotspot_workflow.sh
        ;;
    logs)
        echo "📋 查看日志..."
        echo ""
        echo "工作流日志:"
        tail -20 $WORKSPACE/ai_hotspot_workflow.log 2>/dev/null || echo "暂无日志"
        echo ""
        echo "定时任务日志:"
        tail -20 $WORKSPACE/ai_hotspot_cron.log 2>/dev/null || echo "暂无日志"
        ;;
    help|*)
        echo "🤖 AI热点智能分析管理脚本"
        echo ""
        echo "用法: $0 {start|stop|status|test|logs|help}"
        echo ""
        echo "命令:"
        echo "  start   立即运行一次分析"
        echo "  stop    停止定时任务"
        echo "  status  查看状态"
        echo "  test    测试工作流"
        echo "  logs    查看日志"
        echo "  help    显示帮助"
        ;;
esac
