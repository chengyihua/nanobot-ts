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
