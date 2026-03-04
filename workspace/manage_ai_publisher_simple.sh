#!/bin/bash

# AI文章智能发布系统管理脚本（简化版）

WORKSPACE="/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace"
PUBLISHER="$WORKSPACE/final_ai_publisher.sh"
AUTO_PUBLISH="$WORKSPACE/auto_publish_system.sh"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                AI文章智能发布系统管理                  ║"
echo "║      智能选题 · 深度写作 · 智能配图 · 自动发布         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

if [ $# -eq 0 ]; then
    echo "使用方法: ./manage_ai_publisher_simple.sh [命令]"
    echo ""
    echo "命令:"
    echo "  run        立即运行一次发布系统"
    echo "  status     查看系统状态"
    echo "  list       查看发布历史"
    echo "  check      检查重复发布"
    echo "  cron       查看定时任务"
    echo "  logs       查看日志文件"
    echo "  help       显示此帮助"
    echo ""
    exit 0
fi

case "$1" in
    "run")
        echo "🚀 立即运行AI文章发布系统..."
        echo ""
        if [ -f "$PUBLISHER" ]; then
            "$PUBLISHER"
        else
            echo "❌ 发布系统不存在: $PUBLISHER"
            exit 1
        fi
        ;;
        
    "status")
        echo "🔧 检查系统状态..."
        echo ""
        
        # 检查核心组件
        echo "核心组件:"
        if [ -f "$PUBLISHER" ]; then
            echo "✅ 发布系统: $(basename "$PUBLISHER")"
        else
            echo "❌ 发布系统: 文件不存在"
        fi
        
        if [ -f "$AUTO_PUBLISH" ]; then
            echo "✅ 自动发布: $(basename "$AUTO_PUBLISH")"
        else
            echo "❌ 自动发布: 文件不存在"
        fi
        
        echo ""
        
        # 检查定时任务
        echo "📅 定时任务状态:"
        if crontab -l 2>/dev/null | grep -q "final_ai_publisher.sh"; then
            echo "✅ 定时任务已设置 (每天早上6点)"
            crontab -l | grep "final_ai_publisher.sh"
        else
            echo "⚠️  定时任务未设置"
        fi
        
        echo ""
        
        # 检查发布历史
        echo "📊 发布历史:"
        if [ -f "$WORKSPACE/publish_history.txt" ]; then
            count=$(wc -l < "$WORKSPACE/publish_history.txt")
            echo "✅ 发布历史文件存在 (${count}条记录)"
            echo "最近3条记录:"
            tail -3 "$WORKSPACE/publish_history.txt" | while read line; do
                echo "  📝 $line"
            done
        else
            echo "⚠️  无发布历史"
        fi
        
        echo ""
        
        # 检查今日文章
        today=$(date '+%Y-%m-%d')
        today_dir="$WORKSPACE/final_articles_${today}"
        if [ -d "$today_dir" ]; then
            count=$(find "$today_dir" -name "*.md" 2>/dev/null | wc -l)
            echo "✅ 今日文章: ${count}篇 (目录: final_articles_${today})"
        else
            echo "⚠️  今日无文章生成"
        fi
        ;;
        
    "list")
        echo "📋 发布历史记录:"
        echo ""
        
        if [ -f "$WORKSPACE/publish_history.txt" ]; then
            echo "总记录数: $(wc -l < "$WORKSPACE/publish_history.txt")"
            echo ""
            echo "最近10条记录:"
            echo "══════════════════════════════════════════════════════════"
            tail -10 "$WORKSPACE/publish_history.txt" | while read line; do
                echo "📝 $line"
            done
        else
            echo "⚠️ 无发布历史记录"
        fi
        ;;
        
    "check")
        echo "🔍 检查重复发布..."
        echo ""
        
        if [ -f "$AUTO_PUBLISH" ]; then
            "$AUTO_PUBLISH" check
        else
            echo "❌ 自动发布系统不存在"
        fi
        ;;
        
    "cron")
        echo "📅 当前定时任务:"
        echo ""
        
        if crontab -l 2>/dev/null; then
            echo "定时任务列表:"
            crontab -l
            echo ""
            echo "定时任务说明:"
            echo "  0 6 * * * - 每天早上6点运行"
            echo "  final_ai_publisher.sh - AI文章发布系统"
            echo "  daily_publish.log - 日志文件"
        else
            echo "⚠️ 无定时任务"
        fi
        ;;
        
    "logs")
        echo "📄 日志文件:"
        echo ""
        
        # 查找所有日志文件
        logs=$(find "$WORKSPACE" -name "*.log" 2>/dev/null | sort -r)
        
        if [ -n "$logs" ]; then
            echo "可用的日志文件:"
            for log in $logs; do
                size=$(du -h "$log" 2>/dev/null | cut -f1)
                modified=$(stat -f "%Sm" "$log" 2>/dev/null || date -r "$log" '+%Y-%m-%d %H:%M:%S')
                echo "  📄 $(basename "$log") (${size}, 修改: ${modified})"
            done
            
            echo ""
            echo "查看最新日志:"
            latest_log=$(echo "$logs" | head -1)
            if [ -n "$latest_log" ]; then
                echo "文件: $(basename "$latest_log")"
                echo "══════════════════════════════════════════════════════════"
                tail -20 "$latest_log"
            fi
        else
            echo "⚠️ 无日志文件"
        fi
        ;;
        
    "help"|"-h"|"--help")
        echo "使用方法: ./manage_ai_publisher_simple.sh [命令]"
        echo ""
        echo "命令:"
        echo "  run        立即运行一次发布系统"
        echo "  status     查看系统状态"
        echo "  list       查看发布历史"
        echo "  check      检查重复发布"
        echo "  cron       查看定时任务"
        echo "  logs       查看日志文件"
        echo "  help       显示此帮助"
        echo ""
        echo "示例:"
        echo "  ./manage_ai_publisher_simple.sh run      # 立即发布文章"
        echo "  ./manage_ai_publisher_simple.sh status   # 查看系统状态"
        echo "  ./manage_ai_publisher_simple.sh list     # 查看发布历史"
        echo ""
        ;;
        
    *)
        echo "❌ 未知命令: $1"
        echo ""
        echo "使用方法: ./manage_ai_publisher_simple.sh [命令]"
        echo "使用 'help' 查看可用命令"
        exit 1
        ;;
esac