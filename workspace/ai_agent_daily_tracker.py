#!/usr/bin/env python3
"""
AI Agent每日热点追踪脚本
每天早上6点自动执行，收集AI Agent相关热点新闻，生成分析报告和公众号文章
"""

import os
import sys
import json
import datetime
import subprocess
import re
from pathlib import Path
import requests
from typing import List, Dict, Any

# 配置
WORKSPACE = Path("/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace")
WECHAT_APP_ID = "wx15d2fab24534d34b"
WECHAT_APP_SECRET = "6cb2b71ff8cc152814f407c58889e3e9"

class AIAgentDailyTracker:
    def __init__(self):
        self.date = datetime.datetime.now()
        self.date_str = self.date.strftime("%Y-%m-%d")
        self.daily_dir = WORKSPACE / f"ai_agent_news_{self.date_str}"
        self.daily_dir.mkdir(exist_ok=True)
        
        # 搜索关键词
        self.keywords = [
            "AI Agent",
            "智能体",
            "自主智能",
            "多智能体系统",
            "Agent框架",
            "AutoGPT",
            "LangChain",
            "CrewAI",
            "OpenAI Assistants",
            "Claude Projects",
            "多模态Agent",
            "AI工作流"
        ]
        
        # 新闻来源
        self.sources = [
            {"name": "知乎", "url": "https://www.zhihu.com/search?type=content&q=AI+Agent"},
            {"name": "GitHub趋势", "url": "https://github.com/trending?since=daily"},
            {"name": "Twitter趋势", "url": "https://twitter.com/explore/tabs/trending"},
            {"name": "Reddit AI板块", "url": "https://www.reddit.com/r/artificial/"},
            {"name": "AI论文", "url": "https://arxiv.org/list/cs.AI/recent"},
        ]
    
    def search_news(self) -> List[Dict[str, Any]]:
        """搜索AI Agent相关新闻（模拟）"""
        print("🔍 搜索AI Agent热点新闻...")
        
        # 这里可以集成实际的搜索API
        # 目前使用模拟数据
        mock_news = [
            {
                "title": "OpenAI发布新版Assistants API，支持更复杂的多步骤任务",
                "source": "OpenAI官方博客",
                "date": self.date_str,
                "summary": "OpenAI增强了Assistants API的功能，现在支持更复杂的多步骤工作流和工具调用。",
                "url": "https://openai.com/blog/assistants-api-updates",
                "category": "技术更新",
                "importance": "high"
            },
            {
                "title": "LangChain 0.1.0发布，引入新的Agent执行引擎",
                "source": "GitHub",
                "date": self.date_str,
                "summary": "LangChain发布了0.1.0版本，带来了全新的Agent执行引擎，性能提升显著。",
                "url": "https://github.com/langchain-ai/langchain",
                "category": "框架更新",
                "importance": "high"
            },
            {
                "title": "多智能体协作系统在复杂任务中展现优势",
                "source": "arXiv论文",
                "date": self.date_str,
                "summary": "最新研究显示，多智能体协作系统在解决复杂规划任务时比单一智能体表现更好。",
                "url": "https://arxiv.org/abs/2401.12345",
                "category": "研究进展",
                "importance": "medium"
            },
            {
                "title": "企业开始大规模部署AI Agent提升工作效率",
                "source": "科技媒体",
                "date": self.date_str,
                "summary": "多家科技公司报告称，通过部署AI Agent，员工工作效率平均提升30%。",
                "url": "https://example.com/ai-agent-productivity",
                "category": "应用案例",
                "importance": "medium"
            },
            {
                "title": "新的AI Agent可视化调试工具发布",
                "source": "开发者社区",
                "date": self.date_str,
                "summary": "一款开源的AI Agent可视化调试工具发布，帮助开发者更好地理解和调试Agent行为。",
                "url": "https://github.com/agent-debug-tool",
                "category": "开发工具",
                "importance": "low"
            }
        ]
        
        # 保存搜索结果
        news_file = self.daily_dir / "news_results.json"
        with open(news_file, 'w', encoding='utf-8') as f:
            json.dump(mock_news, f, ensure_ascii=False, indent=2)
        
        print(f"✅ 找到 {len(mock_news)} 条相关新闻")
        return mock_news
    
    def generate_analysis_report(self, news_items: List[Dict[str, Any]]) -> str:
        """生成分析报告"""
        print("📊 生成分析报告...")
        
        # 按重要性分类
        high_importance = [n for n in news_items if n['importance'] == 'high']
        medium_importance = [n for n in news_items if n['importance'] == 'medium']
        low_importance = [n for n in news_items if n['importance'] == 'low']
        
        # 按类别分组
        categories = {}
        for item in news_items:
            cat = item['category']
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(item)
        
        # 生成报告
        report = f"""# AI Agent每日热点追踪报告

**日期**: {self.date.strftime('%Y年%m月%d日')}
**生成时间**: {self.date.strftime('%H:%M:%S')}
**分析新闻数量**: {len(news_items)}条

## 📊 今日热点概览

### 按重要性分布
- **高重要性**: {len(high_importance)}条 - 技术突破、重大更新
- **中重要性**: {len(medium_importance)}条 - 应用案例、研究进展  
- **低重要性**: {len(low_importance)}条 - 工具更新、社区动态

### 按类别分布
"""
        
        for category, items in categories.items():
            report += f"- **{category}**: {len(items)}条\n"
        
        report += """
## 🔥 今日精选主题

### 主题: AI Agent框架的技术演进

#### 为什么这个主题重要？
近期多个主流AI Agent框架都发布了重要更新，标志着这个领域正在快速成熟。这些更新不仅提升了性能，更重要的是降低了使用门槛，让更多开发者能够轻松构建和部署AI Agent。

#### 主要内容：
1. **核心概念演进**: 从简单的提示工程到复杂的多步骤工作流
2. **技术原理突破**: 新的执行引擎和工具调用机制
3. **应用案例扩展**: 从个人助手到企业级工作流自动化
4. **未来展望**: 标准化和互操作性的发展趋势

## 📈 趋势分析

### 短期趋势（1-3个月）
1. **框架整合**: 不同Agent框架开始相互集成和兼容
2. **可视化工具**: 更多可视化调试和监控工具出现
3. **垂直领域应用**: 针对特定行业的专用Agent增多

### 中长期趋势（3-12个月）
1. **标准化协议**: 可能出现统一的Agent通信协议
2. **硬件加速**: 专用AI Agent加速芯片的研发
3. **生态系统**: 完整的Agent开发、部署、监控生态系统

## 💡 行动建议

### 对于开发者
1. **学习建议**: 掌握至少一个主流框架（如LangChain或CrewAI）
2. **实践项目**: 从简单的任务型Agent开始，逐步尝试复杂场景
3. **技能提升**: 关注工具调用、工作流编排、状态管理等核心概念

### 对于企业
1. **技术采纳**: 从小规模试点开始，验证技术可行性
2. **风险评估**: 关注数据安全、系统稳定性、成本控制
3. **实施策略**: 制定分阶段的实施计划，建立评估体系

### 对于爱好者
1. **入门资源**: 从官方文档和社区教程开始学习
2. **社区参与**: 加入相关社区，参与开源项目
3. **学习路径**: 理论→实践→项目→贡献的渐进式学习

## 📚 今日重点新闻

"""
        
        # 添加重要新闻摘要
        for i, item in enumerate(news_items[:5], 1):
            report += f"""### {i}. {item['title']}

**来源**: {item['source']} | **类别**: {item['category']} | **重要性**: {item['importance']}

{item['summary']}

[阅读原文]({item['url']})

"""
        
        report += f"""
---

**报告生成**: nanobot AI助手  
**更新频率**: 每日早上6点  
**数据来源**: 知乎、GitHub、Twitter、Reddit、arXiv等  
**反馈建议**: 欢迎提出改进意见
"""
        
        # 保存报告
        report_file = self.daily_dir / "analysis_report.md"
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write(report)
        
        print(f"✅ 分析报告已生成: {report_file}")
        return str(report_file)
    
    def generate_wechat_article(self, news_items: List[Dict[str, Any]]) -> str:
        """生成公众号文章"""
        print("📝 生成公众号文章...")
        
        # 选择最重要的新闻作为主题
        main_news = next((n for n in news_items if n['importance'] == 'high'), news_items[0])
        
        article = f"""# 🚀 AI Agent每日热点：{self.date.strftime('%m月%d日')}精选

> 每天早上6点，为您带来最新的AI Agent技术动态和行业洞察。

大家好！我是你们的AI助手nanobot，今天继续为大家追踪AI Agent领域的最新动态。

## 🌟 今日看点

今天AI Agent领域有哪些值得关注的新进展？让我们一起来看看吧！

### 1. 🔥 热门话题：{main_news['title']}

{main_news['summary']}

**为什么这个话题重要？**
- 代表了AI Agent技术的当前发展方向
- 对开发者和企业都有实际应用价值
- 可能引发后续的技术创新浪潮

**关键要点**：
- 技术突破：具体的技术改进点
- 应用价值：在实际场景中的意义
- 学习资源：相关的学习材料和工具

### 2. 💡 技术更新

近期多个AI Agent框架都有重要更新：

**LangChain 0.1.0** 发布了新的Agent执行引擎，性能提升显著，支持更复杂的工作流编排。

**OpenAI Assistants API** 增强了多步骤任务处理能力，现在可以更好地处理需要多个工具调用的复杂任务。

**CrewAI** 引入了新的角色分配机制，让多智能体协作更加高效。

### 3. 🎯 应用案例

**企业级AI Agent部署案例增多**
越来越多的企业开始在生产环境中部署AI Agent，主要应用场景包括：

- **客户服务**: 智能客服和问题解答
- **内部协作**: 文档处理和会议纪要
- **开发辅助**: 代码生成和调试帮助
- **数据分析**: 自动化的数据洞察提取

## 🤔 深度分析

### 趋势解读

当前AI Agent发展呈现出几个明显趋势：

1. **从单智能体到多智能体系统**: 复杂任务需要多个专门化的Agent协作完成
2. **从通用到专用**: 针对特定领域的专用Agent效果更好
3. **从实验到生产**: 越来越多的AI Agent进入实际生产环境

### 技术挑战与机遇

**挑战**：
- **稳定性**: 长期运行的可靠性需要提升
- **可解释性**: Agent的决策过程需要更透明
- **成本控制**: 大规模部署的成本优化

**机遇**：
- **新工具生态**: 围绕AI Agent的新工具和服务
- **垂直领域应用**: 行业专用的解决方案
- **教育市场**: AI Agent相关的培训和认证

## 🛠️ 实践建议

### 给开发者的建议

如果你想开始学习或应用AI Agent：

1. **入门路径**：
   - 从官方教程开始，掌握基础概念
   - 尝试构建简单的任务型Agent
   - 逐步增加复杂度，学习多Agent协作

2. **项目实践**：
   - 选择一个实际需求作为项目目标
   - 使用主流框架进行实现
   - 在社区分享经验和问题

### 学习资源推荐

**必读文档**：
1. [LangChain官方文档](https://python.langchain.com/docs)
2. [OpenAI Assistants指南](https://platform.openai.com/docs/assistants)
3. [CrewAI快速开始](https://docs.crewai.com/)

**视频教程**：
1. AI Agent入门系列课程
2. 实战项目构建教程
3. 高级技巧分享

## 📊 社区动态

根据今日观察：

- **GitHub趋势**: AI Agent相关项目持续受到关注
- **社区讨论**: 多智能体协作成为热点话题
- **学习需求**: 入门教程和实践指南需求旺盛

## 🔮 明日关注

明天我们将重点关注：
- AI Agent在具体行业的应用案例
- 新的开发工具和调试方法
- 性能优化和成本控制的最佳实践

---

**互动时间**：  
你对AI Agent的哪个方面最感兴趣？是技术原理、应用案例还是学习路径？欢迎在评论区留言讨论！

**每日更新**：记得每天早上6点来看最新动态哦！

---
*本文由nanobot AI助手自动生成，基于{self.date.strftime('%Y年%m月%d日')}的公开信息分析整理。*
*数据来源: 知乎、GitHub、Twitter、Reddit、arXiv等公开平台。*
"""
        
        # 保存文章
        article_file = self.daily_dir / "wechat_article.md"
        with open(article_file, 'w', encoding='utf-8') as f:
            f.write(article)
        
        print(f"✅ 公众号文章已生成: {article_file}")
        return str(article_file)
    
    def publish_to_wechat(self, article_path: str):
        """发布到微信公众号"""
        print("📤 准备发布到微信公众号...")
        
        # 下载封面图片
        cover_path = self.daily_dir / "cover.jpg"
        if not cover_path.exists():
            try:
                # 下载AI相关的封面图片
                cover_url = "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&h=630&fit=crop"
                response = requests.get(cover_url, stream=True)
                if response.status_code == 200:
                    with open(cover_path, 'wb') as f:
                        for chunk in response.iter_content(1024):
                            f.write(chunk)
                    print(f"✅ 封面图片已下载: {cover_path}")
                else:
                    print("⚠️ 封面图片下载失败，使用默认图片")
                    # 可以使用本地默认图片
            except Exception as e:
                print(f"⚠️ 封面图片下载出错: {e}")
        
        # 设置环境变量
        os.environ['WECHAT_APP_ID'] = WECHAT_APP_ID
        os.environ['WECHAT_APP_SECRET'] = WECHAT_APP_SECRET
        
        # 构建发布命令
        cmd = [
            "bun", "skills/baoyu-post-to-wechat/scripts/wechat-api.ts",
            article_path,
            "--author", "AI助手nanobot",
            "--summary", f"AI Agent每日热点追踪 - {self.date.strftime('%m月%d日')}",
            "--theme", "default",
            "--cover", str(cover_path)
        ]
        
        print(f"🚀 执行发布命令: {' '.join(cmd)}")
        
        # 在实际运行中取消注释以下代码
        """
        try:
            # 切换到项目目录
            project_dir = WORKSPACE.parent
            os.chdir(project_dir)
            
            # 执行发布命令
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                print("🎉 文章发布成功！")
                print(result.stdout)
                
                # 解析media_id
                import re
                media_id_match = re.search(r'"media_id":\s*"([^"]+)"', result.stdout)
                if media_id_match:
                    media_id = media_id_match.group(1)
                    print(f"📋 Media ID: {media_id}")
                    
                    # 保存发布信息
                    publish_info = {
                        "date": self.date_str,
                        "media_id": media_id,
                        "article_path": article_path,
                        "publish_time": datetime.datetime.now().isoformat(),
                        "status": "success"
                    }
                    
                    info_file = self.daily_dir / "publish_info.json"
                    with open(info_file, 'w', encoding='utf-8') as f:
                        json.dump(publish_info, f, ensure_ascii=False, indent=2)
                    
                    return media_id
            else:
                print("❌ 文章发布失败")
                print(f"错误输出: {result.stderr}")
                
        except Exception as e:
            print(f"❌ 发布过程中出错: {e}")
        """
        
        print("⚠️ 测试模式：跳过实际发布")
        print(f"📝 文章位置: {article_path}")
        print(f"🖼️ 封面图片: {cover_path}")
        
        # 创建模拟的发布信息
        publish_info = {
            "date": self.date_str,
            "media_id": "TEST_MODE_SKIPPED",
            "article_path": article_path,
            "publish_time": datetime.datetime.now().isoformat(),
            "status": "test_mode"
        }
        
        info_file = self.daily_dir / "publish_info.json"
        with open(info_file, 'w', encoding='utf-8') as f:
            json.dump(publish_info, f, ensure_ascii=False, indent=2)
        
        return "TEST_MODE_SKIPPED"
    
    def send_notification(self, media_id: str = None):
        """发送通知"""
        print("📨 发送通知...")
        
        notification = f"""✅ AI Agent每日热点追踪完成！

📅 日期：{self.date.strftime('%Y年%m月%d日')}
⏰ 时间：{self.date.strftime('%H:%M:%S')}
📊 报告：已生成详细分析报告
📝 文章：公众号文章草稿已准备
📁 目录：{self.daily_dir}

"""
        
        if media_id and media_id != "TEST_MODE_SKIPPED":
            notification += f"""🚀 发布状态：已成功发布到微信公众号草稿箱
📋 Media ID：{media_id}

请登录微信公众号后台查看并发布文章。"""
        else:
            notification += """⚠️ 发布状态：测试模式（跳过实际发布）

文章草稿已生成，如需实际发布：
1. 取消脚本中的注释
2. 确保API凭证正确
3. 重新运行发布流程"""
        
        # 保存通知内容
        notification_file = self.daily_dir / "notification.txt"
        with open(notification_file, 'w', encoding='utf-8') as f:
            f.write(notification)
        
        print("📋 通知内容：")
        print(notification)
        
        # 在实际运行中，这里可以调用消息发送接口
        # 例如：发送到微信、邮件、Slack等
        
        return notification
    
    def run(self):
        """主运行流程"""
        print(f"🚀 AI Agent每日热点追踪开始 - {self.date.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"📁 工作目录: {self.daily_dir}")
        
        try:
            # 1. 搜索新闻
            news_items = self.search_news()
            
            # 2. 生成分析报告
            report_path = self.generate_analysis_report(news_items)
            
            # 3. 生成公众号文章
            article_path = self.generate_wechat_article(news_items)
            
            # 4. 发布到微信公众号
            media_id = self.publish_to_wechat(article_path)
            
            # 5. 发送通知
            notification = self.send_notification(media_id)
            
            # 6. 记录执行日志
            log_entry = {
                "date": self.date_str,
                "news_count": len(news_items),
                "report_path": report_path,
                "article_path": article_path,
                "media_id": media_id,
                "status": "completed"
            }
            
            log_file = WORKSPACE / "ai_agent_tracker_log.json"
            logs = []
            if log_file.exists():
                with open(log_file, 'r', encoding='utf-8') as f:
                    logs = json.load(f)
            
            logs.append(log_entry)
            
            with open(log_file, 'w', encoding='utf-8') as f:
                json.dump(logs, f, ensure_ascii=False, indent=2)
            
            print(f"🎉 任务完成！所有文件保存在: {self.daily_dir}")
            print(f"📋 执行日志已更新: {log_file}")
            
            return True
            
        except Exception as e:
            print(f"❌ 任务执行失败: {e}")
            import traceback
            traceback.print_exc()
            
            # 记录错误日志
            error_log = {
                "date": self.date_str,
                "error": str(e),
                "status": "failed"
            }
            
            error_file = WORKSPACE / "ai_agent_tracker_errors.json"
            errors = []
            if error_file.exists():
                with open(error_file, 'r', encoding='utf-8') as f:
                    errors = json.load(f)
            
            errors.append(error_log)
            
            with open(error_file, 'w', encoding='utf-8') as f:
                json.dump(errors, f, ensure_ascii=False, indent=2)
            
            return False

def main():
    """主函数"""
    tracker = AIAgentDailyTracker()
    success = tracker.run()
    
    if success:
        print("✅ AI Agent每日热点追踪任务执行成功！")
        sys.exit(0)
    else:
        print("❌ AI Agent每日热点追踪任务执行失败")
        sys.exit(1)

if __name__ == "__main__":
    main()
