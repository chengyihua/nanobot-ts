# nanobot 文档索引

## 📋 核心文档（始终加载）
AGENTS|/workspace/AGENTS.md|核心操作规则和决策流程
SOUL|/workspace/SOUL.md|人格设定和价值观
USER|/workspace/USER.md|用户偏好和基本信息

## 🛠️ 工具文档（按需索引）
TOOLS_BASIC|/workspace/TOOLS.md#基础工具|文件操作、命令执行等基础工具
TOOLS_WEB|/workspace/TOOLS.md#网络访问|网页搜索、内容获取
TOOLS_COMM|/workspace/TOOLS.md#通信功能|消息发送、文件传输
TOOLS_CRON|/workspace/TOOLS.md#定时任务|定时提醒和周期性任务
TOOLS_VOICE|/workspace/TOOLS.md#语音功能|语音生成和发送

## 🎯 技能索引（Skills）
BROWSER|skills/browser/SKILL.md|浏览器自动化技能
MAIL|skills/mail/SKILL.md|邮件管理技能
SCREENSHOT|skills/screenshot/SKILL.md|桌面截图技能
GITHUB|skills/github/SKILL.md|GitHub操作技能
WEATHER|skills/weather/SKILL.md|天气查询技能
YOUTUBE_SUMMARY|skills/youtube-summarizer/SKILL.md|YouTube视频总结
CRON|skills/cron/SKILL.md|定时任务管理
MCP|skills/mcp/SKILL.md|MCP协议集成

## 🎨 创意技能（宝瑜系列）
ARTICLE_ILLUSTRATOR|skills/baoyu-article-illustrator/SKILL.md|文章配图生成
COMIC_CREATOR|skills/baoyu-comic/SKILL.md|知识漫画制作
COVER_IMAGE|skills/baoyu-cover-image/SKILL.md|封面图片生成
IMAGE_GEN|skills/baoyu-image-gen/SKILL.md|AI图像生成
INFOGRAPHIC|skills/baoyu-infographic/SKILL.md|信息图制作
SLIDE_DECK|skills/baoyu-slide-deck/SKILL.md|幻灯片生成
XHS_IMAGES|skills/baoyu-xhs-images/SKILL.md|小红书图片制作
POST_TO_WECHAT|skills/baoyu-post-to-wechat/SKILL.md|微信公众号发布
POST_TO_X|skills/baoyu-post-to-x/SKILL.md|X/Twitter内容发布

## 📊 数据服务
12306_TICKETS|MCP:12306-mcp|火车票查询服务
SQLITE|MCP:sqlite|SQLite数据库操作
FILESYSTEM|MCP:filesystem|文件系统操作

## 📝 使用说明

### 索引格式
```
关键词|文件路径|简要描述
```

### 如何查找文档
当需要特定信息时：
1. 在索引中搜索关键词
2. 使用 `readFile` 读取对应文件
3. 只加载需要的部分内容

### 示例
```
用户问："如何发送语音消息？"
→ 搜索索引找到 "TOOLS_VOICE"
→ 读取 /workspace/TOOLS.md#语音功能 部分
→ 获取具体操作步骤
```

## 🔄 更新机制
- 新增技能时更新此索引
- 文档变更时更新对应条目
- 定期检查索引完整性

## 📏 压缩效果
- 完整文档：~22KB
- 索引文件：~2KB（减少90%）
- 按需加载：只读取需要的部分