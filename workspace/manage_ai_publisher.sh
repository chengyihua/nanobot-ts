#!/bin/bash

# AI文章智能发布系统管理脚本

WORKSPACE="/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace"
PUBLISHER="$WORKSPACE/final_ai_publisher.sh"
AUTO_PUBLISH="$WORKSPACE/auto_publish_system.sh"

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# 显示横幅
show_banner() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║                AI文章智能发布系统管理                  ║"
    echo "║      智能选题 · 深度写作 · 智能配图 · 自动发布         ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo ""
}

# 显示帮助
show_help() {
    echo "使用方法: ./manage_ai_publisher.sh [命令]"
    echo ""
    echo "命令:"
    echo "  run        立即运行一次发布系统"
    echo "  status     查看系统状态"
    echo "  list       查看发布历史"
    echo "  check      检查重复发布"
    echo "  cron       查看定时任务"
    echo "  logs       查看日志文件"
    echo "  clean      清理旧文件"
    echo "  help       显示此帮助"
    echo ""
    echo "示例:"
    echo "  ./manage_ai_publisher.sh run      # 立即发布文章"
    echo "  ./manage_ai_publisher.sh status   # 查看系统状态"
    echo "  ./manage_ai_publisher.sh list     # 查看发布历史"
    echo ""
}

# 检查系统状态
check_status() {
    echo "🔧 检查系统状态..."
    echo ""
    
    # 检查核心组件
    echo "核心组件:"
    if [ -f "$PUBLISHER" ]; then
        echo -e "${GREEN}✅${NC} 发布系统: $(basename "$PUBLISHER")"
    else
        echo -e "${RED}❌${NC} 发布系统: 文件不存在"
    fi
    
    if [ -f "$AUTO_PUBLISH" ]; then
        echo -e "${GREEN}✅${NC} 自动发布: $(basename "$AUTO_PUBLISH")"
    else
        echo -e "${RED}❌${NC} 自动发布: 文件不存在"
    fi
    
    echo ""
    
    # 检查定时任务
    echo "📅 定时任务状态:"
    if crontab -l 2>/dev/null | grep -q "final_ai_publisher.sh"; then
        echo -e "${GREEN}✅${NC} 定时任务已设置 (每天早上6点)"
        crontab -l | grep "final_ai_publisher.sh"
    else
        echo -e "${YELLOW}⚠️ ${NC} 定时任务未设置"
    fi
    
    echo ""
    
    # 检查日志文件
    echo "📋 日志文件:"
    log_files=$(find "$WORKSPACE" -name "*.log" -o -name "daily_publish.log" 2>/dev/null | head -5)
    if [ -n "$log_files" ]; then
        for log in $log_files; do
            size=$(du -h "$log" 2>/dev/null | cut -f1)
            lines=$(wc -l "$log" 2>/dev/null | awk '{print $1}')
            echo -e "${CYAN}📄${NC} $(basename "$log") (大小: ${size:-0}, 行数: ${lines:-0})"
        done
    else
        echo -e "${YELLOW}⚠️ ${NC} 无日志文件"
    fi
    
    echo ""
    
    # 检查发布历史
    echo "📊 发布历史:"
    if [ -f "$WORKSPACE/publish_history.txt" ]; then
        count=$(wc -l < "$WORKSPACE/publish_history.txt")
        echo -e "${GREEN}✅${NC} 发布历史文件存在 (${count}条记录)"
        echo "最近3条记录:"
        tail -3 "$WORKSPACE/publish_history.txt" | while read line; do
            echo "  📝 $line"
        done
    else
        echo -e "${YELLOW}⚠️ ${NC} 无发布历史"
    fi
    
    echo ""
    
    # 检查今日文章
    today=$(date '+%Y-%m-%d')
    today_dir="$WORKSPACE/final_articles_${today}"
    if [ -d "$today_dir" ]; then
        count=$(find "$today_dir" -name "*.md" 2>/dev/null | wc -l)
        echo -e "${GREEN}✅${NC} 今日文章: ${count}篇 (目录: final_articles_${today})"
    else
        echo -e "${YELLOW}⚠️ ${NC} 今日无文章生成"
    fi
}

# 立即运行
run_now() {
    echo "🚀 立即运行AI文章发布系统..."
    echo ""
    
    if [ -f "$PUBLISHER" ]; then
        "$PUBLISHER"
    else
        echo -e "${RED}❌ 发布系统不存在: $PUBLISHER${NC}"
        exit 1
    fi
}

# 查看发布历史
list_history() {
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
        echo -e "${YELLOW}⚠️ 无发布历史记录${NC}"
    fi
}

# 检查重复发布
check_duplicates() {
    echo "🔍 检查重复发布..."
    echo ""
    
    if [ -f "$AUTO_PUBLISH" ]; then
        "$AUTO_PUBLISH" check
    else
        echo -e "${RED}❌ 自动发布系统不存在${NC}"
    fi
}

# 查看定时任务
show_cron() {
    echo "📅 当前定时任务:"
    echo ""
    
    if crontab -l 2>/dev/null; then
        echo ""
        echo "定时任务说明:"
        echo "  0 6 * * * - 每天早上6点运行"
        echo "  final_ai_publisher.sh - AI文章发布系统"
        echo "  daily_publish.log - 日志文件"
    else
        echo -e "${YELLOW}⚠️ 无定时任务${NC}"
    fi
}

# 查看日志
show_logs() {
    echo "📄 日志文件:"
    echo ""
    
    # 查找所有日志文件
    logs=$(find "$WORKSPACE" -name "*.log" 2>/dev/null | sort -r)
    
    if [ -n "$logs" ]; then
        echo "可用的日志文件:"
        for log in $logs; do
            size=$(du -h "$log" 2>/dev/null | cut -f1)
            modified=$(stat -f "%Sm" "$log" 2>/dev/null || date -r "$log" '+%Y-%m-%d %H:%M:%S')
            echo -e "  ${CYAN}$(basename "$log")${NC} (${size}, 修改: ${modified})"
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
        echo -e "${YELLOW}⚠️ 无日志文件${NC}"
    fi
}

# 清理旧文件
clean_old_files() {
    echo "🧹 清理旧文件..."
    echo ""
    
    # 询问保留天数
    read -p "保留最近多少天的文件? (默认: 7天): " days
    days=${days:-7}
    
    echo "将清理 $days 天前的文件..."
    echo ""
    
    # 清理旧文章目录
    echo "清理文章目录:"
    find "$WORKSPACE" -type d -name "final_articles_*" -mtime +$days 2>/dev/null | while read dir; do
        echo "  🗑️  删除: $(basename "$dir")"
        rm -rf "$dir"
    done
    
    # 清理旧图片目录
    echo "清理图片目录:"
    find "$WORKSPACE" -type d -name "final_images_*" -mtime +$days 2>/dev/null | while read dir; do
        echo "  🗑️  删除: $(basename "$dir")"
        rm -rf "$dir"
    done
    
    # 清理旧日志
    echo "清理日志文件:"
    find "$WORKSPACE" -name "*.log" -mtime +$days 2>/dev/null | while read file; do
        echo "  🗑️  删除: $(basename "$file")"
        rm -f "$file"
    done
    
    echo ""
    echo -e "${GREEN}✅ 清理完成${NC}"
}

# 主函数
main() {
    show_banner
    
    if [ $# -eq 0 ]; then
        show_help
        exit 0
    fi
    
    case "$1" in
        "run")
            run_now
            ;;
        "status")
            check_status
            ;;
        "list")
            list_history
            ;;
        "check")
            check_duplicates
            ;;
        "cron")
            show_cron
            ;;
        "logs")
            show_logs
            ;;
        "clean")
            clean_old_files
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            echo -e "${RED}❌ 未知命令: $1${NC}"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"