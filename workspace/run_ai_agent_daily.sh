#!/bin/bash

# AI Agent每日热点追踪 - 主执行脚本
# 每天早上6点自动执行

echo "=========================================="
echo "🚀 AI Agent每日热点追踪开始 - $(date)"
echo "=========================================="

# 设置工作目录
cd /Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace

# 检查Python环境
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: python3 未安装"
    exit 1
fi

# 检查必要模块
if ! python3 -c "import requests" &> /dev/null; then
    echo "⚠️ 警告: requests模块未安装，尝试安装..."
    pip3 install requests --quiet
fi

# 执行Python脚本
echo "📝 执行AI Agent热点追踪..."
python3 ai_agent_daily_production.py

# 检查执行结果
if [ $? -eq 0 ]; then
    echo "✅ AI Agent每日热点追踪执行成功！"
    echo "📅 完成时间: $(date)"
    
    # 可以在这里添加通知发送逻辑
    # 例如：发送到微信、邮件等
    
else
    echo "❌ AI Agent每日热点追踪执行失败"
    echo "⏰ 失败时间: $(date)"
    
    # 发送错误通知
    ERROR_MSG="❌ AI Agent每日热点追踪任务执行失败\n时间: $(date)\n请检查日志文件: ai_agent_cron.log"
    echo "$ERROR_MSG"
fi

echo "=========================================="
echo "📋 日志文件: ai_agent_cron.log"
echo "📁 工作目录: $(pwd)"
echo "=========================================="

# 记录执行日志
echo "[$(date)] AI Agent每日热点追踪执行完成" >> ai_agent_cron.log
