#!/bin/bash

# 设置每日AI文章自动发布定时任务

WORKSPACE="/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace"
DAILY_SCRIPT="$WORKSPACE/daily_ai_articles.sh"
CRON_LOG="$WORKSPACE/daily_cron.log"

echo "🚀 设置每日AI文章自动发布定时任务"
echo "=========================================="

# 检查脚本是否存在
if [ ! -f "$DAILY_SCRIPT" ]; then
    echo "❌ 每日发布脚本不存在: $DAILY_SCRIPT"
    exit 1
fi

echo "✅ 找到发布脚本: $DAILY_SCRIPT"

# 检查当前cron任务
echo "🔍 检查现有定时任务..."
EXISTING_CRON=$(crontab -l 2>/dev/null | grep -i "daily_ai_articles" || true)

if [ -n "$EXISTING_CRON" ]; then
    echo "⚠️  发现现有定时任务:"
    echo "$EXISTING_CRON"
    echo ""
    echo "是否删除现有任务? (y/N): "
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        crontab -l 2>/dev/null | grep -v "daily_ai_articles" | crontab -
        echo "✅ 已删除现有任务"
    fi
fi

# 设置新的定时任务
echo ""
echo "📅 选择发布时间:"
echo "1. 每天早上6点 (推荐)"
echo "2. 每天早上8点"
echo "3. 每天中午12点"
echo "4. 自定义时间"
echo ""
echo "请输入选择 (1-4): "
read -r choice

case $choice in
    1)
        CRON_TIME="0 6 * * *"
        ;;
    2)
        CRON_TIME="0 8 * * *"
        ;;
    3)
        CRON_TIME="0 12 * * *"
        ;;
    4)
        echo "请输入cron表达式 (例如: '0 9 * * *' 表示每天9点): "
        read -r CRON_TIME
        ;;
    *)
        echo "❌ 无效选择，使用默认时间 (早上6点)"
        CRON_TIME="0 6 * * *"
        ;;
esac

# 创建cron任务
CRON_JOB="$CRON_TIME cd $WORKSPACE && $DAILY_SCRIPT >> $CRON_LOG 2>&1"

echo ""
echo "📋 定时任务配置:"
echo "   时间: $CRON_TIME"
echo "   脚本: $DAILY_SCRIPT"
echo "   日志: $CRON_LOG"
echo "   命令: $CRON_JOB"
echo ""

echo "是否添加此定时任务? (y/N): "
read -r confirm

if [[ "$confirm" =~ ^[Yy]$ ]]; then
    # 添加定时任务
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    
    echo "✅ 定时任务添加成功!"
    echo ""
    echo "📊 当前所有定时任务:"
    crontab -l
    echo ""
    echo "🔍 测试运行 (可选):"
    echo "   是否立即测试运行一次? (y/N): "
    read -r test_run
    if [[ "$test_run" =~ ^[Yy]$ ]]; then
        echo "🚀 开始测试运行..."
        cd "$WORKSPACE" && "$DAILY_SCRIPT"
    fi
else
    echo "❌ 取消添加定时任务"
fi

echo ""
echo "📋 管理命令:"
echo "   查看定时任务: crontab -l"
echo "   编辑定时任务: crontab -e"
echo "   删除所有任务: crontab -r"
echo "   查看执行日志: tail -f $CRON_LOG"
echo "   手动执行: cd $WORKSPACE && ./daily_ai_articles.sh"
echo ""
echo "🎯 系统特点:"
echo "   ✅ 每天自动分析AI热点话题"
echo "   ✅ 生成2-3篇深度文章"
echo "   ✅ 自动发布到微信公众号"
echo "   ✅ 避免重复发布"
echo "   ✅ 完整日志记录"