#!/usr/bin/env python3
"""
微信公众号文章发布脚本
使用baoyu-post-to-wechat技能发布文章
"""

import os
import sys
import json
import subprocess
from pathlib import Path

def publish_article():
    """发布文章到微信公众号"""
    
    # 工作目录
    workspace = Path("/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace")
    article_dir = workspace / "ai_agent_news_2026-02-28"
    
    # 检查目录
    if not article_dir.exists():
        print(f"❌ 文章目录不存在: {article_dir}")
        return False
    
    # 文章文件
    article_file = article_dir / "wechat_article.md"
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
    
    # 创建临时文件用于技能调用
    temp_file = workspace / "temp_wechat_article.md"
    with open(temp_file, 'w', encoding='utf-8') as f:
        f.write(article_content)
    
    print(f"📄 临时文件已创建: {temp_file}")
    
    # 尝试使用baoyu-post-to-wechat技能
    print("🚀 尝试使用微信公众号发布技能...")
    
    # 方法1: 直接调用技能
    try:
        # 切换到技能目录
        skill_dir = Path("/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/skills/baoyu-post-to-wechat")
        
        # 检查技能是否存在
        if not skill_dir.exists():
            print(f"❌ 技能目录不存在: {skill_dir}")
            return False
        
        # 读取技能配置
        skill_config = skill_dir / "SKILL.md"
        if skill_config.exists():
            with open(skill_config, 'r', encoding='utf-8') as f:
                print("📋 技能配置:")
                print(f.read()[:500])
        
        # 尝试执行技能
        print("🎯 执行微信公众号发布...")
        
        # 创建技能调用命令
        # 注意：这里需要根据实际的技能调用方式调整
        cmd = [
            "node",
            str(skill_dir / "index.js"),
            "--title", title,
            "--content", str(temp_file),
            "--type", "article"
        ]
        
        print(f"🔧 执行命令: {' '.join(cmd)}")
        
        # 执行命令
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=skill_dir)
        
        print(f"📊 执行结果:")
        print(f"   退出码: {result.returncode}")
        print(f"   标准输出: {result.stdout[:500]}")
        if result.stderr:
            print(f"   标准错误: {result.stderr[:500]}")
        
        if result.returncode == 0:
            print("✅ 文章发布成功！")
            
            # 保存发布信息
            publish_info = {
                "title": title,
                "date": "2026-02-28",
                "status": "published",
                "method": "baoyu-post-to-wechat",
                "timestamp": "2026-02-28T08:35:00"
            }
            
            publish_file = article_dir / "publish_result.json"
            with open(publish_file, 'w', encoding='utf-8') as f:
                json.dump(publish_info, f, ensure_ascii=False, indent=2)
            
            print(f"📋 发布信息已保存: {publish_file}")
            return True
        else:
            print("❌ 技能执行失败")
            return False
            
    except Exception as e:
        print(f"❌ 技能调用异常: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        # 清理临时文件
        if temp_file.exists():
            temp_file.unlink()
            print(f"🧹 临时文件已清理: {temp_file}")

def main():
    """主函数"""
    print("🚀 微信公众号文章发布开始")
    print("=" * 50)
    
    success = publish_article()
    
    print("=" * 50)
    if success:
        print("🎉 文章发布流程完成！")
        print("\n📋 下一步:")
        print("1. 登录微信公众号后台确认文章已发布")
        print("2. 检查文章格式和内容")
        print("3. 分享到朋友圈或群组")
        sys.exit(0)
    else:
        print("❌ 文章发布失败")
        print("\n🔧 备选方案:")
        print("1. 手动复制文章内容到微信公众号后台")
        print("2. 使用其他发布工具")
        print("3. 检查技能配置")
        sys.exit(1)

if __name__ == "__main__":
    main()