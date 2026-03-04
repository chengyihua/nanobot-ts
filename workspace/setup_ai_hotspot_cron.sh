#!/bin/bash

# 设置AI热点智能分析定时任务

echo "=========================================="
echo "🚀 设置AI热点智能分析定时任务"
echo "=========================================="

# 工作目录
WORKSPACE="/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace"
CRON_SCRIPT="$WORKSPACE/ai_hotspot_workflow.sh"
LOG_FILE="$WORKSPACE/ai_hotspot_cron.log"

# 检查脚本是否存在
if [ ! -f "$CRON_SCRIPT" ]; then
    echo "❌ 工作流脚本不存在: $CRON_SCRIPT"
    exit 1
fi

# 确保脚本可执行
chmod +x "$CRON_SCRIPT"

echo "✅ 工作流脚本: $CRON_SCRIPT"
echo "✅ 日志文件: $LOG_FILE"

# 创建crontab条目
CRON_ENTRY="0 6 * * * $CRON_SCRIPT >> $LOG_FILE 2>&1"

echo ""
echo "📋 定时任务配置:"
echo "   时间: 每天早上6点"
echo "   命令: $CRON_SCRIPT"
echo "   日志: $LOG_FILE"
echo ""
echo "📝 Crontab条目:"
echo "   $CRON_ENTRY"
echo ""

# 检查现有的crontab
echo "🔍 检查现有crontab..."
if crontab -l 2>/dev/null | grep -q "ai_hotspot"; then
    echo "⚠️  发现现有的AI热点定时任务，将更新..."
    # 删除现有的AI热点任务
    crontab -l 2>/dev/null | grep -v "ai_hotspot" | crontab -
fi

# 添加新的定时任务
echo "➕ 添加新的定时任务..."
(crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -

# 验证添加
echo "✅ 验证定时任务..."
if crontab -l 2>/dev/null | grep -q "ai_hotspot"; then
    echo "🎉 定时任务设置成功！"
    echo ""
    echo "📅 当前crontab:"
    crontab -l 2>/dev/null | grep -A2 -B2 "ai_hotspot"
else
    echo "❌ 定时任务设置失败"
    exit 1
fi

# 创建测试任务（立即运行一次）
echo ""
echo "🧪 创建测试任务（5分钟后运行）..."
TEST_CRON="*/5 * * * * $CRON_SCRIPT >> $WORKSPACE/ai_hotspot_test.log 2>&1"
(crontab -l 2>/dev/null; echo "$TEST_CRON") | crontab -

echo "✅ 测试任务已添加（每5分钟运行一次）"
echo "📊 测试日志: $WORKSPACE/ai_hotspot_test.log"

# 创建管理脚本
echo ""
echo "📝 创建管理脚本..."

cat > "$WORKSPACE/manage_ai_hotspot.sh" << 'EOF'
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
EOF

chmod +x "$WORKSPACE/manage_ai_hotspot.sh"

echo "✅ 管理脚本已创建: $WORKSPACE/manage_ai_hotspot.sh"

# 创建README
cat > "$WORKSPACE/AI_HOTSPOT_README.md" << 'EOF'
# AI热点智能分析系统

## 系统概述

这是一个自动化的AI热点智能发现与深度分析系统，能够：
1. **主动发现**AI领域的热点话题
2. **深度分析**趋势和影响
3. **生成原创**深度分析文章
4. **自动准备**公众号发布材料

## 文件结构

```
workspace/
├── ai_hotspot_analyzer.py          # 智能热点分析器
├── ai_hotspot_publisher_simple.py  # 文章发布器
├── ai_hotspot_workflow.sh          # 完整工作流
├── manage_ai_hotspot.sh            # 管理脚本
├── ai_hotspot_analysis_YYYY-MM-DD/ # 每日分析结果
├── ai_agent_news_YYYY-MM-DD/       # 公众号文章
├── ai_hotspot_workflow.log         # 工作流日志
└── ai_hotspot_cron.log             # 定时任务日志
```

## 定时任务

系统每天早上6点自动运行：
- **6:00** 执行智能热点分析
- **6:05** 生成深度分析文章
- **6:10** 准备公众号发布材料

## 使用方法

### 1. 手动运行
```bash
cd workspace
./manage_ai_hotspot.sh start
```

### 2. 查看状态
```bash
./manage_ai_hotspot.sh status
```

### 3. 测试系统
```bash
./manage_ai_hotspot.sh test
```

### 4. 查看日志
```bash
./manage_ai_hotspot.sh logs
```

### 5. 停止定时任务
```bash
./manage_ai_hotspot.sh stop
```

## 生成内容

### 分析结果
- `ai_hotspot_analysis_YYYY-MM-DD/`
  - `deep_analysis_article.md` - 深度分析文章
  - `trend_analysis.json` - 趋势分析数据
  - `article_info.json` - 文章信息

### 公众号材料
- `ai_agent_news_YYYY-MM-DD/`
  - `wechat_article.md` - Markdown格式文章
  - `wechat_article.html` - HTML格式文章
  - `PUBLISH_INSTRUCTIONS.md` - 发布指南

## 发布到微信公众号

### 方法1：手动发布
1. 登录微信公众号后台
2. 创建新文章
3. 复制 `wechat_article.md` 内容
4. 添加封面图片
5. 发布

### 方法2：自动化发布
（需要配置微信公众号API）

## 配置说明

### 修改分析参数
编辑 `ai_hotspot_analyzer.py`：
- 调整数据源权重
- 修改热点分类
- 优化分析算法

### 修改定时任务
```bash
crontab -e
# 修改时间设置
```

## 故障排除

### 1. 分析失败
- 检查Python环境
- 检查网络连接
- 查看日志文件

### 2. 定时任务不运行
```bash
crontab -l
systemctl status cron
```

### 3. 文章格式问题
- 检查Markdown语法
- 验证HTML生成
- 调整CSS样式

## 扩展功能

### 1. 添加数据源
- Reddit r/MachineLearning
- Twitter AI话题
- 中文技术社区
- arXiv最新论文

### 2. 优化分析算法
- 机器学习分类
- 情感分析
- 趋势预测

### 3. 增强发布功能
- 自动封面生成
- 多平台发布
- 数据分析报告

## 联系方式

如有问题，请联系系统管理员。

---
*系统版本: 1.0*
*最后更新: 2026-02-28*
EOF

echo "✅ README已创建: $WORKSPACE/AI_HOTSPOT_README.md"

echo ""
echo "=========================================="
echo "🎉 AI热点智能分析系统设置完成！"
echo "=========================================="
echo ""
echo "📋 系统信息:"
echo "   工作流脚本: $CRON_SCRIPT"
echo "   管理脚本: $WORKSPACE/manage_ai_hotspot.sh"
echo "   定时任务: 每天早上6点"
echo "   日志文件: $LOG_FILE"
echo ""
echo "🚀 使用方法:"
echo "   1. 查看状态: ./manage_ai_hotspot.sh status"
echo "   2. 测试系统: ./manage_ai_hotspot.sh test"
echo "   3. 立即运行: ./manage_ai_hotspot.sh start"
echo "   4. 查看文档: cat AI_HOTSPOT_README.md"
echo ""
echo "📅 系统将在每天早上6点自动运行，生成AI热点深度分析文章！"