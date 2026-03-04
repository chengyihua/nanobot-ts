#!/usr/bin/env python3
"""
AI热点深度分析文章发布器（简化版）
将深度分析文章发布到微信公众号
"""

import os
import sys
import json
import datetime
from pathlib import Path

class AIHotspotPublisherSimple:
    def __init__(self):
        self.date = datetime.datetime.now()
        self.date_str = self.date.strftime("%Y-%m-%d")
        self.workspace = Path("/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace")
        
        # 目录配置
        self.analysis_dir = self.workspace / f"ai_hotspot_analysis_{self.date_str}"
        self.wechat_dir = self.workspace / f"ai_agent_news_{self.date_str}"
        
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
        
        # 生成简单的HTML版本
        self.generate_simple_html(article_content)
        
        # 生成文章信息
        self.generate_article_info(article_content)
        
        return True
    
    def generate_simple_html(self, article_content: str):
        """生成简单的HTML版本"""
        print("🔄 生成HTML版本...")
        
        # 简单的Markdown转HTML
        html_content = article_content
        
        # 替换标题
        html_content = html_content.replace('# ', '<h1>').replace('\n# ', '</h1>\n<h1>')
        html_content = html_content.replace('## ', '<h2>').replace('\n## ', '</h2>\n<h2>')
        html_content = html_content.replace('### ', '<h3>').replace('\n### ', '</h3>\n<h3>')
        
        # 替换引用
        html_content = html_content.replace('> ', '<blockquote>').replace('\n> ', '</blockquote>\n<blockquote>')
        
        # 替换加粗
        html_content = html_content.replace('**', '<strong>').replace('**', '</strong>')
        
        # 替换列表
        html_content = html_content.replace('- ', '<li>').replace('\n- ', '</li>\n<li>')
        
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
    
    def create_publish_instructions(self):
        """创建发布说明"""
        print("📋 创建发布说明...")
        
        instructions = f"""# AI热点深度分析文章发布指南

## 文章信息
- **日期**: {self.date_str}
- **目录**: {self.wechat_dir}
- **文件**: 
  - `wechat_article.md` - Markdown格式文章
  - `wechat_article.html` - HTML格式文章
  - `article_info.json` - 文章信息
  - `notification.txt` - 通知内容

## 发布步骤

### 方法1：手动发布（推荐）
1. 登录微信公众号后台 (https://mp.weixin.qq.com)
2. 点击"新建图文"
3. 复制 `wechat_article.md` 的内容到编辑器
4. 添加封面图片（可以使用之前的封面或生成新封面）
5. 设置摘要（从文章中提取）
6. 选择"群发"或"发布到草稿箱"

### 方法2：使用API发布（需要配置）
1. 确保微信公众号API权限已开通
2. 配置API密钥
3. 运行API发布脚本

### 方法3：使用浏览器自动化
1. 安装必要的浏览器自动化工具
2. 配置登录信息
3. 运行自动化发布脚本

## 文章特点
- ✅ 深度分析，不是简单汇总
- ✅ 基于实际热点数据
- ✅ 提供行动建议
- ✅ 适合技术读者

## 注意事项
1. 发布前检查文章内容
2. 确保封面图片合适
3. 设置正确的发布时间
4. 检查文章格式

## 后续操作
1. 监控文章阅读量
2. 收集读者反馈
3. 优化分析算法
4. 扩展数据源

---
*生成时间: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""
        
        instructions_file = self.wechat_dir / "PUBLISH_INSTRUCTIONS.md"
        with open(instructions_file, 'w', encoding='utf-8') as f:
            f.write(instructions)
        
        print(f"✅ 发布说明已生成: {instructions_file}")
        return True
    
    def run(self):
        """执行发布流程"""
        try:
            print(f"🚀 AI热点文章发布器启动 - {self.date_str}")
            print("=" * 50)
            
            # 1. 准备文章
            if not self.prepare_article():
                print("❌ 文章准备失败")
                return False
            
            # 2. 创建发布说明
            if not self.create_publish_instructions():
                print("❌ 发布说明创建失败")
                return False
            
            print("=" * 50)
            print("✅ AI热点文章发布流程完成!")
            print(f"📁 输出目录: {self.wechat_dir}")
            print(f"📝 文章文件: {self.wechat_dir}/wechat_article.md")
            print(f"🌐 HTML版本: {self.wechat_dir}/wechat_article.html")
            print(f"📋 文章信息: {self.wechat_dir}/article_info.json")
            print(f"📖 发布说明: {self.wechat_dir}/PUBLISH_INSTRUCTIONS.md")
            
            # 显示文章摘要
            article_file = self.wechat_dir / "wechat_article.md"
            with open(article_file, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.split('\n')
                print("\n📄 文章摘要:")
                for i, line in enumerate(lines[:10]):
                    if line.strip():
                        print(f"   {line}")
            
            return True
            
        except Exception as e:
            print(f"❌ 发布流程失败: {e}")
            import traceback
            traceback.print_exc()
            return False

def main():
    """主函数"""
    publisher = AIHotspotPublisherSimple()
    success = publisher.run()
    
    if success:
        print("\n🎉 AI热点文章发布任务执行成功！")
        print("\n🎯 下一步:")
        print("1. 查看生成的文章: cat workspace/ai_agent_news_2026-02-28/wechat_article.md")
        print("2. 登录微信公众号后台手动发布")
        print("3. 或使用自动化工具发布")
        sys.exit(0)
    else:
        print("\n❌ AI热点文章发布任务执行失败")
        sys.exit(1)

if __name__ == "__main__":
    main()