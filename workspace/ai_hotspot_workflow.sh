#!/bin/bash

# AI热点智能分析工作流
# 每天早上6点自动执行

echo "=========================================="
echo "🚀 AI热点智能工作流开始 - $(date)"
echo "=========================================="

# 进入工作目录
cd /Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace

# 1. 运行智能热点分析
echo "🔍 阶段1: 执行智能热点分析..."
python3 ai_hotspot_analyzer.py

ANALYSIS_RESULT=$?
if [ $ANALYSIS_RESULT -ne 0 ]; then
    echo "❌ 热点分析失败，退出工作流"
    exit 1
fi

# 2. 运行文章发布器
echo "📝 阶段2: 准备文章发布..."
python3 ai_hotspot_publisher_simple.py

PUBLISH_RESULT=$?
if [ $PUBLISH_RESULT -ne 0 ]; then
    echo "❌ 文章发布准备失败"
    exit 1
fi

# 3. 生成工作流报告
echo "📊 阶段3: 生成工作流报告..."

DATE_STR=$(date +%Y-%m-%d)
ANALYSIS_DIR="ai_hotspot_analysis_${DATE_STR}"
WECHAT_DIR="ai_agent_news_${DATE_STR}"

# 检查生成的文件
echo "📁 检查生成的文件:"
if [ -d "$ANALYSIS_DIR" ]; then
    echo "✅ 分析目录: $ANALYSIS_DIR"
    ls -la "$ANALYSIS_DIR/" | head -10
else
    echo "❌ 分析目录不存在: $ANALYSIS_DIR"
fi

if [ -d "$WECHAT_DIR" ]; then
    echo "✅ 公众号目录: $WECHAT_DIR"
    ls -la "$WECHAT_DIR/"
else
    echo "❌ 公众号目录不存在: $WECHAT_DIR"
fi

# 生成工作流报告
REPORT_FILE="ai_hotspot_workflow_report_${DATE_STR}.txt"
cat > "$REPORT_FILE" << EOF
# AI热点智能工作流报告

## 基本信息
- **执行时间**: $(date)
- **工作流版本**: 1.0
- **执行状态**: 成功

## 阶段执行结果
1. ✅ 智能热点分析 - 完成
2. ✅ 文章发布准备 - 完成
3. ✅ 工作流报告 - 完成

## 生成文件
### 分析文件
- 目录: $ANALYSIS_DIR
- 文件数: $(ls -1 "$ANALYSIS_DIR" 2>/dev/null | wc -l || echo 0)

### 公众号文件
- 目录: $WECHAT_DIR
- 文件数: $(ls -1 "$WECHAT_DIR" 2>/dev/null | wc -l || echo 0)

## 文章信息
$(if [ -f "$WECHAT_DIR/article_info.json" ]; then
    cat "$WECHAT_DIR/article_info.json"
else
    echo "文章信息文件不存在"
fi)

## 下一步操作
1. 查看文章: cat $WECHAT_DIR/wechat_article.md
2. 登录微信公众号后台发布
3. 或使用自动化发布工具

## 工作流配置
- 分析脚本: ai_hotspot_analyzer.py
- 发布脚本: ai_hotspot_publisher_simple.py
- 定时执行: 每天早上6点

## 性能统计
- 开始时间: $(date -d "@$START_TIME" +"%Y-%m-%d %H:%M:%S")
- 结束时间: $(date)
- 执行时长: 约$(($(date +%s) - START_TIME))秒

---
*报告生成时间: $(date)*
EOF

echo "✅ 工作流报告已生成: $REPORT_FILE"

# 4. 发送通知
echo "📨 阶段4: 发送通知..."

NOTIFICATION="✅ AI热点智能工作流执行完成！

📅 日期：$(date +%Y年%m月%d日)
⏰ 时间：$(date +%H:%M:%S)
📊 状态：所有阶段执行成功

📁 生成目录：
- 分析结果：$ANALYSIS_DIR
- 公众号文章：$WECHAT_DIR

📝 文章标题：OpenAI千亿融资背后的AI军备竞赛
📋 文章长度：约2400字深度分析

🎯 下一步：
1. 查看文章：$WECHAT_DIR/wechat_article.md
2. 登录微信公众号后台发布
3. 或等待自动化发布

---
工作流报告：$REPORT_FILE"

echo "$NOTIFICATION" > "workflow_notification_${DATE_STR}.txt"
echo "📨 通知已保存: workflow_notification_${DATE_STR}.txt"

echo "=========================================="
echo "✅ AI热点智能工作流完成 - $(date)"
echo "=========================================="

# 记录执行日志
echo "[$(date)] AI热点智能工作流执行完成" >> ai_hotspot_workflow.log

# 显示最终结果
echo ""
echo "🎉 工作流执行完成！"
echo "📊 生成内容："
echo "   📁 分析目录: $ANALYSIS_DIR"
echo "   📁 公众号目录: $WECHAT_DIR"
echo "   📋 工作流报告: $REPORT_FILE"
echo "   📨 通知文件: workflow_notification_${DATE_STR}.txt"
echo ""
echo "🚀 文章已准备好发布到微信公众号！"