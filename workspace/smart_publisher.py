#!/usr/bin/env python3
"""
智能文章发布系统
解决重复发布问题，确保每篇文章只发布一次
"""

import os
import sys
import json
import hashlib
import subprocess
from datetime import datetime
from pathlib import Path

class SmartPublisher:
    def __init__(self, workspace_path):
        self.workspace = Path(workspace_path)
        self.publish_log = self.workspace / "publish_history.json"
        self.skill_dir = Path("/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/skills/baoyu-post-to-wechat")
        self.api_script = self.skill_dir / "scripts" / "wechat-api.ts"
        
        # 初始化发布历史
        self.history = self.load_history()
    
    def load_history(self):
        """加载发布历史"""
        if self.publish_log.exists():
            try:
                with open(self.publish_log, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                return {"articles": [], "last_publish": None}
        return {"articles": [], "last_publish": None}
    
    def save_history(self):
        """保存发布历史"""
        with open(self.publish_log, 'w', encoding='utf-8') as f:
            json.dump(self.history, f, ensure_ascii=False, indent=2)
    
    def calculate_hash(self, file_path):
        """计算文件内容的哈希值"""
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return hashlib.md5(content.encode('utf-8')).hexdigest()
    
    def is_already_published(self, file_path, title):
        """检查文章是否已经发布过"""
        file_hash = self.calculate_hash(file_path)
        
        for article in self.history["articles"]:
            if article.get("hash") == file_hash:
                return True, article.get("media_id")
            if article.get("title") == title:
                return True, article.get("media_id")
        
        return False, None
    
    def publish_article(self, markdown_file, title, cover_image=None, author=None, summary=None):
        """智能发布文章"""
        markdown_path = Path(markdown_file)
        
        if not markdown_path.exists():
            print(f"❌ 文件不存在: {markdown_file}")
            return False
        
        # 检查是否已经发布过
        already_published, media_id = self.is_already_published(markdown_path, title)
        if already_published:
            print(f"⚠️  文章已发布过，Media ID: {media_id}")
            print(f"   跳过重复发布: {title}")
            return True
        
        print(f"🚀 开始发布文章: {title}")
        print(f"📄 源文件: {markdown_path}")
        
        # 构建发布命令
        cmd = [
            "npx", "-y", "bun", str(self.api_script),
            str(markdown_path),
            "--title", title
        ]
        
        if cover_image and Path(cover_image).exists():
            cmd.extend(["--cover", cover_image])
        
        if author:
            cmd.extend(["--author", author])
        
        if summary:
            cmd.extend(["--summary", summary])
        
        print(f"📋 执行命令: {' '.join(cmd)}")
        
        try:
            # 执行发布命令
            result = subprocess.run(
                cmd,
                cwd=str(self.workspace),
                capture_output=True,
                text=True,
                encoding='utf-8'
            )
            
            if result.returncode == 0:
                # 解析输出
                output_lines = result.stdout.strip().split('\n')
                json_output = None
                
                for line in output_lines:
                    if line.strip().startswith('{'):
                        try:
                            json_output = json.loads(line.strip())
                            break
                        except:
                            continue
                
                if json_output and json_output.get("success"):
                    media_id = json_output.get("media_id")
                    
                    # 记录发布历史
                    article_info = {
                        "title": title,
                        "file": str(markdown_path),
                        "hash": self.calculate_hash(markdown_path),
                        "media_id": media_id,
                        "publish_time": datetime.now().isoformat(),
                        "author": author,
                        "cover": cover_image
                    }
                    
                    self.history["articles"].append(article_info)
                    self.history["last_publish"] = datetime.now().isoformat()
                    self.save_history()
                    
                    print(f"✅ 发布成功!")
                    print(f"📋 Media ID: {media_id}")
                    print(f"📅 发布时间: {article_info['publish_time']}")
                    
                    # 输出详细信息
                    print("\n📊 发布详情:")
                    print(f"   标题: {title}")
                    print(f"   作者: {author or '未指定'}")
                    print(f"   封面: {cover_image or '未指定'}")
                    print(f"   文件: {markdown_path}")
                    
                    return True
                else:
                    print(f"❌ 发布失败，无法解析输出")
                    print(f"输出: {result.stdout}")
                    print(f"错误: {result.stderr}")
                    return False
            else:
                print(f"❌ 发布失败，返回码: {result.returncode}")
                print(f"输出: {result.stdout}")
                print(f"错误: {result.stderr}")
                return False
                
        except Exception as e:
            print(f"❌ 发布过程中出现异常: {str(e)}")
            return False
    
    def list_published_articles(self):
        """列出已发布的文章"""
        if not self.history["articles"]:
            print("📭 暂无发布记录")
            return
        
        print(f"📚 已发布文章 ({len(self.history['articles'])}篇)")
        print("=" * 60)
        
        for i, article in enumerate(self.history["articles"], 1):
            print(f"{i}. {article['title']}")
            print(f"   Media ID: {article['media_id']}")
            print(f"   发布时间: {article['publish_time']}")
            print(f"   文件: {article['file']}")
            print()
    
    def check_duplicates(self):
        """检查重复发布"""
        titles = {}
        hashes = {}
        duplicates = []
        
        for article in self.history["articles"]:
            title = article["title"]
            file_hash = article["hash"]
            
            if title in titles:
                duplicates.append(f"重复标题: {title}")
            else:
                titles[title] = article
            
            if file_hash in hashes:
                duplicates.append(f"重复内容: {title}")
            else:
                hashes[file_hash] = article
        
        if duplicates:
            print("⚠️  发现重复发布:")
            for dup in duplicates:
                print(f"   - {dup}")
            return False
        else:
            print("✅ 无重复发布")
            return True

def main():
    """主函数"""
    workspace = "/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace"
    publisher = SmartPublisher(workspace)
    
    # 检查命令行参数
    if len(sys.argv) < 3:
        print("使用方法:")
        print(f"  {sys.argv[0]} publish <markdown文件> <标题> [封面图片] [作者] [摘要]")
        print(f"  {sys.argv[0]} list")
        print(f"  {sys.argv[0]} check")
        print()
        print("示例:")
        print(f"  {sys.argv[0]} publish article_1.md 'AI框架大战' cover.jpg '技术架构师' '深度分析...'")
        return
    
    action = sys.argv[1]
    
    if action == "publish":
        if len(sys.argv) < 4:
            print("❌ 缺少参数: publish <文件> <标题>")
            return
        
        markdown_file = sys.argv[2]
        title = sys.argv[3]
        cover = sys.argv[4] if len(sys.argv) > 4 else None
        author = sys.argv[5] if len(sys.argv) > 5 else None
        summary = sys.argv[6] if len(sys.argv) > 6 else None
        
        # 使用默认封面
        if not cover:
            default_cover = os.path.join(workspace, "ai_agent_news_2026-02-28", "cover.jpg")
            if os.path.exists(default_cover):
                cover = default_cover
        
        success = publisher.publish_article(markdown_file, title, cover, author, summary)
        sys.exit(0 if success else 1)
    
    elif action == "list":
        publisher.list_published_articles()
    
    elif action == "check":
        publisher.check_duplicates()
    
    else:
        print(f"❌ 未知操作: {action}")

if __name__ == "__main__":
    main()