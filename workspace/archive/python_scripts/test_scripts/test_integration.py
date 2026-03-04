#!/usr/bin/env python3
"""
测试智能摘要系统集成
"""

import os
import sys
import json
from datetime import datetime

def test_basic_integration():
    """测试基础集成功能"""
    print("=" * 60)
    print("测试智能摘要系统集成")
    print("=" * 60)
    
    # 1. 检查必要文件
    required_files = [
        'intelligent_summary.py',
        'RECENT_EVENTS.md',
        'enhanced_classifier.py',
        'priority_classifier.py'
    ]
    
    print("1. 检查必要文件:")
    for file in required_files:
        if os.path.exists(file):
            print(f"   ✅ {file}")
        else:
            print(f"   ❌ {file} - 文件不存在")
    
    # 2. 测试事件记录
    print("\n2. 测试事件记录:")
    events_file = 'RECENT_EVENTS.md'
    if os.path.exists(events_file):
        with open(events_file, 'r', encoding='utf-8') as f:
            content = f.read()
            event_count = content.count('## [')
            print(f"   ✅ RECENT_EVENTS.md 包含 {event_count} 个事件")
    else:
        print("   ❌ RECENT_EVENTS.md 文件不存在")
    
    # 3. 测试摘要生成
    print("\n3. 测试摘要生成:")
    try:
        # 导入智能摘要模块
        sys.path.append('.')
        from intelligent_summary import main as generate_summary
        
        # 生成测试摘要
        print("   ✅ 智能摘要模块可以导入")
        
        # 检查输出目录
        output_dirs = ['memory/hourly', 'memory/daily', 'memory/test']
        for dir_path in output_dirs:
            if os.path.exists(dir_path):
                print(f"   ✅ 输出目录存在: {dir_path}")
            else:
                print(f"   ⚠️  输出目录不存在: {dir_path}")
        
    except ImportError as e:
        print(f"   ❌ 无法导入智能摘要模块: {e}")
    
    # 4. 测试分类器
    print("\n4. 测试分类器:")
    try:
        from priority_classifier import PriorityEventClassifier
        classifier = PriorityEventClassifier()
        
        test_events = [
            "用户询问记忆连续性系统实施状态",
            "✅ 创建了智能摘要系统",
            "❌ API连接失败"
        ]
        
        for event in test_events:
            result = classifier.classify_event(event)
            importance = classifier.calculate_importance(result, event)
            print(f"   {event[:30]}... -> {result} ({importance:.2f})")
        
        print("   ✅ 分类器工作正常")
    except Exception as e:
        print(f"   ❌ 分类器测试失败: {e}")
    
    # 5. 集成建议
    print("\n" + "=" * 60)
    print("集成建议:")
    print("=" * 60)
    
    print("""
建议的集成步骤：

1. **创建技能目录**
   mkdir -p skills/intelligent-summary

2. **复制必要文件**
   cp intelligent_summary.py skills/intelligent-summary/
   cp enhanced_classifier.py skills/intelligent-summary/
   cp priority_classifier.py skills/intelligent-summary/

3. **创建技能配置文件**
   创建 skills/intelligent-summary/config.json

4. **创建技能主文件**
   创建 skills/intelligent-summary/index.ts

5. **测试技能**
   npm run test-skill intelligent-summary

6. **重启nanobot**
   npm run restart

集成后的使用方式：
  - summary today          # 生成今日摘要
  - summary last 6h        # 生成最近6小时摘要
  - summary show today     # 显示今日摘要
  - summary stats          # 显示统计信息
    """)
    
    # 6. 检查当前系统状态
    print("\n" + "=" * 60)
    print("当前系统状态:")
    print("=" * 60)
    
    # 检查nanobot目录结构
    nanobot_root = '/Users/chengyihua/Downloads/nanobot-main/nanobot-ts'
    skills_dir = os.path.join(nanobot_root, 'skills')
    
    if os.path.exists(skills_dir):
        skill_count = len([name for name in os.listdir(skills_dir) 
                          if os.path.isdir(os.path.join(skills_dir, name))])
        print(f"技能目录: {skills_dir}")
        print(f"现有技能数量: {skill_count}")
        
        # 列出现有技能
        print("现有技能:")
        for skill in os.listdir(skills_dir)[:10]:  # 只显示前10个
            skill_path = os.path.join(skills_dir, skill)
            if os.path.isdir(skill_path):
                print(f"  - {skill}")
    else:
        print(f"技能目录不存在: {skills_dir}")
    
    print("\n" + "=" * 60)
    print("测试完成！")
    print("=" * 60)

if __name__ == "__main__":
    test_basic_integration()