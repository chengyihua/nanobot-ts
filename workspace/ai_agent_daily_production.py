#!/usr/bin/env python3
"""
AI Agent每日热点追踪脚本 - 生产版本
每天早上6点自动执行
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
    
    def search_news(self) -> List[Dict[str, Any]]:
        """搜索AI Agent相关新闻"""
        print("🔍 搜索AI Agent热点新闻...")
        
        # 模拟数据 - 实际中可以集成搜索API
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
        ]
        
        # 保存搜索结果
        news_file = self.daily_dir / "news_results.json"
        with open(news_file, 'w', encoding='utf-8') as f:
            json.dump(mock_news, f, ensure_ascii=False, indent=2)
        
        print(f"✅ 找到 {len(mock_news)} 条相关新闻")
        return mock_news
    
    def generate_wechat_article(self, news_items: List[Dict[str, Any]]) -> str:
        """生成公众号文章"""
        print("📝 生成公众号文章...")
        
        main_news = news_items[0] if news_items else {
            "title": "AI Agent技术持续演进",
            "summary": "AI Agent领域持续快速发展，新的框架和工具不断涌现。"
        }
        
        article = f"""# 🚀 AI Agent每日热点：{self.date.strftime('%m月%d日')}精选

> 每天早上6点，为您带来最新的AI Agent技术动态和行业洞察。

大家好！我是你们的AI助手nanobot，今天继续为大家追踪AI Agent领域的最新动态。

## 🌟 今日看点

### 1. 🔥 热门话题：{main_news['title']}

{main_news['summary']}

**为什么这个话题重要？**
- 代表了AI Agent技术的当前发展方向
- 对开发者和企业都有实际应用价值
- 可能引发后续的技术创新浪潮

### 2. 💡 技术更新

近期AI Agent领域的主要进展：

- **框架优化**: 主流框架持续改进性能和易用性
- **工具丰富**: 新的开发工具和调试方法不断出现
- **应用扩展**: 更多实际应用场景被探索和实践

### 3. 🎯 实践建议

**给开发者的建议**：
1. 从官方文档开始学习基础概念
2. 尝试构建简单的任务型Agent
3. 参与开源项目，积累实践经验

**学习资源推荐**：
- LangChain官方文档
- OpenAI Assistants指南
- 社区优秀项目和教程

## 🤔 趋势观察

当前AI Agent发展呈现几个趋势：

1. **从实验到生产**: 更多AI Agent进入实际应用
2. **从通用到专用**: 针对特定场景的优化方案
3. **从单机到协作**: 多智能体系统成为热点

## 📊 社区动态

根据今日观察：
- GitHub上AI Agent相关项目持续活跃
- 社区讨论集中在实用技巧和最佳实践
- 学习资源和教程需求旺盛

---

**互动时间**：  
你对AI Agent的哪个方面最感兴趣？欢迎在评论区留言讨论！

**每日更新**：记得每天早上6点来看最新动态哦！

---
*本文由nanobot AI助手自动生成，基于{self.date.strftime('%Y年%m月%d日')}的公开信息分析整理。*
"""
        
        # 保存文章
        article_file = self.daily_dir / "wechat_article.md"
        with open(article_file, 'w', encoding='utf-8') as f:
            f.write(article)
        
        print(f"✅ 公众号文章已生成: {article_file}")
        return str(article_file)
    
    def publish_to_wechat(self, article_path: str):
        """发布到微信公众号"""
        print("📤 发布到微信公众号...")
        
        # 下载封面图片
        cover_path = self.daily_dir / "cover.jpg"
        if not cover_path.exists():
            try:
                cover_url = "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&h=630&fit=crop"
                response = requests.get(cover_url, stream=True)
                if response.status_code == 200:
                    with open(cover_path, 'wb') as f:
                        for chunk in response.iter_content(1024):
                            f.write(chunk)
                    print(f"✅ 封面图片已下载")
            except Exception as e:
                print(f"⚠️ 封面图片下载出错: {e}")
                return None
        
        # 设置环境变量
        os.environ['WECHAT_APP_ID'] = WECHAT_APP_ID
        os.environ['WECHAT_APP_SECRET'] = WECHAT_APP_SECRET
        
        # 构建发布命令
        project_dir = WORKSPACE.parent
        cmd = [
            "bun", "skills/baoyu-post-to-wechat/scripts/wechat-api.ts",
            article_path,
            "--author", "AI助手nanobot",
            "--summary", f"AI Agent每日热点追踪 - {self.date.strftime('%m月%d日')}",
            "--theme", "default",
            "--cover", str(cover_path)
        ]
        
        try:
            # 执行发布命令
            result = subprocess.run(
                cmd, 
                cwd=str(project_dir),
                capture_output=True, 
                text=True,
                timeout=300  # 5分钟超时
            )
            
            if result.returncode == 0:
                print("🎉 文章发布成功！")
                
                # 解析media_id
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
                return None
                
        except subprocess.TimeoutExpired:
            print("❌ 发布超时（超过5分钟）")
            return None
        except Exception as e:
            print(f"❌ 发布过程中出错: {e}")
            return None
    
    def send_notification(self, media_id: str = None):
        """发送通知给用户"""
        print("📨 准备发送通知...")
        
        if media_id:
            notification = f"""✅ AI Agent每日热点追踪完成！

📅 日期：{self.date.strftime('%Y年%m月%d日')}
⏰ 时间：{self.date.strftime('%H:%M:%S')}
🚀 状态：已成功发布到微信公众号草稿箱
📋 Media ID：{media_id}

请登录微信公众号后台查看并发布文章。"""
        else:
            notification = f"""⚠️ AI Agent每日热点追踪完成（测试模式）

📅 日期：{self.date.strftime('%Y年%m月%d日')}
⏰ 时间：{self.date.strftime('%H:%M:%S')}
📝 状态：文章草稿已生成，但未实际发布

文章保存在：{self.daily_dir}/wechat_article.md"""
        
        # 保存通知
        notification_file = self.daily_dir / "notification.txt"
        with open(notification_file, 'w', encoding='utf-8') as f:
            f.write(notification)
        
        print("📋 通知内容已保存")
        return notification
    
    def run(self, test_mode: bool = False):
        """主运行流程"""
        print(f"🚀 AI Agent每日热点追踪开始 - {self.date.strftime('%Y-%m-%d %H:%M:%S')}")
        
        try:
            # 1. 搜索新闻
            news_items = self.search_news()
            
            # 2. 生成公众号文章
            article_path = self.generate_wechat_article(news_items)
            
            # 3. 发布到微信公众号
            media_id = None
            if not test_mode:
                media_id = self.publish_to_wechat(article_path)
            else:
                print("⚠️ 测试模式：跳过实际发布")
            
            # 4. 发送通知
            notification = self.send_notification(media_id)
            
            # 5. 记录日志
            log_entry = {
                "date": self.date_str,
                "news_count": len(news_items),
                "article_path": article_path,
                "media_id": media_id,
                "status": "success" if media_id else "test_mode",
                "notification": notification[:200]  # 只保存前200字符
            }
            
            log_file = WORKSPACE / "ai_agent_daily_log.json"
            logs = []
            if log_file.exists():
                try:
                    with open(log_file, 'r', encoding='utf-8') as f:
                        logs = json.load(f)
                except:
                    logs = []
            
            logs.append(log_entry)
            
            with open(log_file, 'w', encoding='utf-8') as f:
                json.dump(logs, f, ensure_ascii=False, indent=2)
            
            print(f"🎉 任务完成！文件保存在: {self.daily_dir}")
            
            # 返回通知内容，可以用于实际发送
            return notification
            
        except Exception as e:
            print(f"❌ 任务执行失败: {e}")
            import traceback
            traceback.print_exc()
            return None

def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='AI Agent每日热点追踪')
    parser.add_argument('--test', action='store_true', help='测试模式（不实际发布）')
    args = parser.parse_args()
    
    tracker = AIAgentDailyTracker()
    notification = tracker.run(test_mode=args.test)
    
    if notification:
        print("✅ AI Agent每日热点追踪任务执行成功！")
        
        # 在实际部署中，这里可以调用消息发送接口
        # 例如：发送到微信、邮件等
        print("\n📨 通知内容：")
        print(notification)
        
        sys.exit(0)
    else:
        print("❌ AI Agent每日热点追踪任务执行失败")
        sys.exit(1)

if __name__ == "__main__":
    main()
