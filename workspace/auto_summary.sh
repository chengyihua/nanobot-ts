#!/bin/bash

# 智能摘要自动生成脚本
# 每小时和每日自动生成摘要

WORKSPACE="/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace"
cd "$WORKSPACE"

# 获取当前时间
CURRENT_HOUR=$(date +%H)
CURRENT_DATE=$(date +%Y-%m-%d)
LOG_FILE="logs/summary_${CURRENT_DATE}.log"

# 创建日志目录
mkdir -p logs

echo "==========================================" >> "$LOG_FILE"
echo "智能摘要生成 - $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
echo "==========================================" >> "$LOG_FILE"

# 检查事件文件是否存在
if [ ! -f "RECENT_EVENTS.md" ]; then
    echo "❌ 错误: RECENT_EVENTS.md 文件不存在" >> "$LOG_FILE"
    exit 1
fi

# 统计事件数量
EVENT_COUNT=$(grep -c "^## \[" RECENT_EVENTS.md)
echo "📊 事件统计: 找到 $EVENT_COUNT 个事件" >> "$LOG_FILE"

# 每小时摘要 (每小时执行)
echo "🕐 生成每小时摘要..." >> "$LOG_FILE"
python3 intelligent_summary.py hourly >> "$LOG_FILE" 2>&1

# 每日摘要 (只在0点执行)
if [ "$CURRENT_HOUR" = "00" ]; then
    echo "📅 生成每日摘要..." >> "$LOG_FILE"
    python3 intelligent_summary.py daily >> "$LOG_FILE" 2>&1
    
    # 清理旧的事件文件 (保留最近24小时)
    echo "🧹 清理旧事件..." >> "$LOG_FILE"
    # 这里可以添加清理逻辑
fi

# 检查生成的文件
echo "📁 检查生成的文件:" >> "$LOG_FILE"
ls -la memory/hourly/ 2>/dev/null | tail -5 >> "$LOG_FILE"
ls -la memory/daily/ 2>/dev/null | tail -5 >> "$LOG_FILE"

echo "✅ 智能摘要生成完成" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"