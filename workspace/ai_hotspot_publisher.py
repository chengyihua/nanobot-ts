#!/usr/bin/env python3
"""
AI热点深度分析文章发布器
将深度分析文章发布到微信公众号
"""

import os
import sys
import json
import datetime
import subprocess
from pathlib import Path

class AIHotspotPublisher:
    def __init__(self):
        self.date = datetime.datetime.now()
        self.date_str = self.date.strftime("%Y-%m-%d")
        self.workspace = Path("/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace")
        
        # 目录配置
        self.analysis_dir = self.workspace / f"ai_hotspot_analysis_{self.date_str}"
        self.wechat_dir = self.workspace / f"ai_agent_news_{self.date_str}"
        
        # 微信公众号配置
        self.app_id = "wx15d2fab24534d34b"
        self.app_secret = "6cb2b71ff8cc152814f407c58889e3e9"
        
    def check_dependencies(self):
        """检查依赖"""
        print("🔧 检查依赖...")
        
        # 检查必要的Python包
        try:
            import requests
            print("✅ requests 已安装")
        except ImportError:
            print("❌ requests 未安装，尝试安装...")
            subprocess.run([sys.executable, "-m", "pip", "install", "requests"], check=True)
            
        # 检查markdown包
        try:
            import markdown
            print("✅ markdown 已安装")
        except ImportError:
            print("❌ markdown 未安装，尝试安装...")
            subprocess.run([sys.executable, "-m", "pip", "install", "markdown"], check=True)
            
        return True
    
    def prepare_article(self):
        """准备文章"""
        print("📝 准备深度分析文章...")
        
        # 检查分析目录
        if not self.analysis_dir.exists():
            print(f"❌ 分析目录不存在: {self.analysis_dir}")
            return False
        
        # 检查文章文件
        article_file = self.analysis_dir / "deep_analysis_article.md"
        if not article_file.exists():
            print(f"❌ 文章文件不存在: {article_file}")
            return False
        
        # 创建微信公众号目录
        self.wechat_dir.mkdir(exist_ok=True)
        
        # 读取文章内容
        with open(article_file, 'r', encoding='utf-8') as f:
            article_content = f.read()
        
        # 保存到微信公众号目录
        wechat_article_file = self.wechat_dir / "wechat_article.md"
        with open(wechat_article_file, 'w', encoding='utf-8') as f:
            f.write(article_content)
        
        print(f"✅ 文章已保存: {wechat_article_file}")
        
        # 生成HTML版本
        self.generate_html(article_content)
        
        # 生成文章信息
        self.generate_article_info(article_content)
        
        return True
    
    def generate_html(self, article_content: str):
        """生成HTML版本"""
        print("🔄 生成HTML版本...")
        
        try:
            import markdown
            
            # 转换Markdown为HTML
            html_content = markdown.markdown(article_content, extensions=['extra'])
            
            # 添加HTML包装
            full_html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>AI热点深度分析 - {self.date_str}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }}
        h1 {{ color: #333; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px; }}
        h2 {{ color: #555; margin-top: 30px; border-left: 4px solid #007bff; padding-left: 10px; }}
        h3 {{ color: #777; }}
        p {{ margin: 15px 0; }}
        ul, ol {{ margin: 15px 0; padding-left: 20px; }}
        li {{ margin: 8px 0; }}
        blockquote {{ border-left: 4px solid #ddd; padding-left: 15px; margin: 20px 0; color: #666; font-style: italic; }}
        .highlight {{ background-color: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 4px solid #28a745; }}
        .metadata {{ background-color: #e9ecef; padding: 15px; border-radius: 5px; margin-bottom: 20px; }}
        code {{ background-color: #f8f9fa; padding: 2px 4px; border-radius: 3px; font-family: 'SFMono-Regular', Consolas, monospace; }}
        pre {{ background-color: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; }}
    </style>
</head>
<body>
    <div class="metadata">
        <strong>📅 分析日期:</strong> {self.date_str}<br>
        <strong>🎯 文章类型:</strong> AI热点深度分析<br>
        <strong>📊 数据来源:</strong> GitHub Trending, Hacker News, 技术社区<br>
        <strong>⚡ 生成方式:</strong> AI智能分析系统
    </div>
    {html_content}
</body>
</html>"""
            
            # 保存HTML文件
            html_file = self.wechat_dir / "wechat_article.html"
            with open(html_file, 'w', encoding='utf-8') as f:
                f.write(full_html)
            
            print(f"✅ HTML版本已生成: {html_file}")
            return True
            
        except Exception as e:
            print(f"❌ 生成HTML失败: {e}")
            return False
    
    def generate_article_info(self, article_content: str):
        """生成文章信息"""
        print("📋 生成文章信息...")
        
        # 提取标题
        title = "AI热点深度分析"
        lines = article_content.split('\n')
        for line in lines:
            if line.startswith('# '):
                title = line[2:].strip()
                break
        
        # 统计信息
        char_count = len(article_content)
        word_count = len(article_content.split())
        line_count = len(lines)
        
        # 创建文章信息
        article_info = {
            "date": self.date_str,
            "title": title,
            "char_count": char_count,
            "word_count": word_count,
            "line_count": line_count,
            "source": "AI热点智能分析系统",
            "analysis_type": "深度分析",
            "status": "ready_for_publish",
            "generated_at": datetime.datetime.now().isoformat()
        }
        
        # 保存文章信息
        info_file = self.wechat_dir / "article_info.json"
        with open(info_file, 'w', encoding='utf-8') as f:
            json.dump(article_info, f, ensure_ascii=False, indent=2)
        
        print(f"✅ 文章信息已保存: {info_file}")
        
        # 生成通知
        notification = f"""✅ AI热点深度分析文章准备完成！

📅 日期：{self.date_str}
🎯 标题：{title}
📊 统计：{char_count} 字符，{word_count} 词，{line_count} 行
📁 目录：{self.wechat_dir}

文章已准备好，可以发布到微信公众号。"""

        notification_file = self.wechat_dir / "notification.txt"
        with open(notification_file, 'w', encoding='utf-8') as f:
            f.write(notification)
        
        print(f"📨 通知已生成: {notification_file}")
        
        return article_info
    
    def publish_to_wechat(self):
        """发布到微信公众号"""
        print("🚀 准备发布到微信公众号...")
        
        # 检查文章文件
        article_file = self.wechat_dir / "wechat_article.md"
        if not article_file.exists():
            print(f"❌ 文章文件不存在: {article_file}")
            return False
        
        # 读取文章内容
        with open(article_file, 'r', encoding='utf-8') as f:
            article_content = f.read()
        
        # 提取标题和摘要
        title = "AI热点深度分析"
        summary = "AI行业最新热点深度分析报告"
        
        lines = article_content.split('\n')
        for line in lines:
            if line.startswith('# '):
                title = line[2:].strip()
            elif line.startswith('> '):
                summary = line[2:].strip()
                break
        
        print(f"📝 文章信息:")
        print(f"   标题: {title}")
        print(f"   摘要: {summary[:100]}...")
        print(f"   长度: {len(article_content)} 字符")
        
        # 这里可以集成实际的微信公众号API
        # 目前先模拟发布流程
        
        publish_info = {
            "date": self.date_str,
            "title": title,
            "summary": summary,
            "content_length": len(article_content),
            "publish_status": "draft_ready",
            "publish_time": datetime.datetime.now().isoformat(),
            "notes": "文章已准备好，需要手动发布到微信公众号后台"
        }
        
        # 保存发布信息
        publish_file = self.wechat_dir / "publish_info.json"
        with open(publish_file, 'w', encoding='utf-8') as f:
            json.dump(publish_info, f, ensure_ascii=False, indent=2)
        
        print(f"✅ 发布信息已保存: {publish_file}")
        print("\n🎯 下一步操作:")
        print("1. 登录微信公众号后台 (https://mp.weixin.qq.com)")
        print("2. 创建新文章")
        print("3. 复制文章内容")
        print("4. 添加封面图片")
        print("5. 发布到草稿箱或直接发布")
        
        return True
    
    def run(self):
        """执行发布流程"""
        try:
            print(f"🚀 AI热点文章发布器启动 - {self.date_str}")
            print("=" * 50)
            
            # 1. 检查依赖
            if not self.check_dependencies():
                return False
            
            # 2. 准备文章
            if not self.prepare_article():
                print("❌ 文章准备失败")
                return False
            
            # 3. 发布到微信公众号
            if not self.publish_to_wechat():
                print("❌ 发布准备失败")
                return False
            
            print("=" * 50)
            print("✅ AI热点文章发布流程完成!")
            print(f"📁 输出目录: {self.wechat_dir}")
            print(f"📝 文章文件: {self.wechat_dir}/wechat_article.md")
            print(f"🌐 HTML版本: {self.wechat_dir}/wechat_article.html")
            print(f"📋 文章信息: {self.wechat_dir}/article_info.json")
            
            return True
            
        except Exception as e:
            print(f"❌ 发布流程失败: {e}")
            import traceback
            traceback.print_exc()
            return False

def main():
    """主函数"""
    publisher = AIHotspotPublisher()
    success = publisher.run()
    
    if success:
        print("\n🎉 AI热点文章发布任务执行成功！")
        sys.exit(0)
    else:
        print("\n❌ AI热点文章发布任务执行失败")
        sys.exit(1)

if __name__ == "__main__":
    main()