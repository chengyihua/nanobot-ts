#!/usr/bin/env python3
"""
测试智能摘要系统
"""

import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from intelligent_summary import EventClassifier, EventParser, SummaryGenerator

def test_classifier():
    """测试事件分类器"""
    print("=" * 60)
    print("测试事件分类器")
    print("=" * 60)
    
    classifier = EventClassifier()
    
    test_cases = [
        ("分析当前记忆系统架构，设计改进方案", "system_analysis"),
        ("EvoMap AI代理协作进化市场集成", "system_integration"),
        ("用户询问记忆连续性系统实施状态", "user_interaction"),
        ("OpenAI API连接超时错误", "system_error"),
        ("记忆连续性系统第一阶段实施", "project_update"),
        ("修复事件文件格式错误", "system_action"),
        ("检查RECENT_EVENTS.md文件", "system_action"),
        ("创建智能摘要系统架构", "project_update"),
        ("测试EvoMap API集成", "system_integration"),
        ("设计三层记忆架构", "system_analysis"),
    ]
    
    for text, expected in test_cases:
        result = classifier.classify_event(text)
        importance = classifier.calculate_importance(result, text)
        status = "✅" if result == expected else "❌"
        print(f"{status} '{text[:30]}...' -> {result} (预期: {expected}) 重要性: {importance:.2f}")
    
    print()

def test_parser():
    """测试事件解析器"""
    print("=" * 60)
    print("测试事件解析器")
    print("=" * 60)
    
    events_file = os.path.join(os.path.dirname(__file__), 'memory', 'RECENT_EVENTS.md')
    parser = EventParser(events_file)
    
    # 测试解析最近24小时事件
    events = parser.parse_events(hours=24)
    print(f"找到 {len(events)} 个事件")
    
    if events:
        print("\n前3个事件:")
        for i, event in enumerate(events[:3]):
            print(f"{i+1}. [{event.get('timestamp', 'N/A')}] {event.get('title', 'N/A')[:50]}...")
            print(f"   内容: {event.get('content', 'N/A')[:80]}...")
            print()
    
    print()

def test_summary_generator():
    """测试摘要生成器"""
    print("=" * 60)
    print("测试摘要生成器")
    print("=" * 60)
    
    # 创建测试事件
    test_events = [
        {
            'timestamp': '2026-02-20 22:45:00',
            'title': '分析当前记忆系统',
            'content': '分析当前记忆系统架构，设计改进方案',
            'metadata': {'事件类型': 'system_analysis', '重要性': '0.8'}
        },
        {
            'timestamp': '2026-02-20 22:40:00',
            'title': 'EvoMap集成总结',
            'content': 'EvoMap AI代理协作进化市场集成，成功获取趋势资产',
            'metadata': {'事件类型': 'system_integration', '重要性': '0.9'}
        },
        {
            'timestamp': '2026-02-20 22:30:00',
            'title': '用户询问记忆连续性',
            'content': '用户询问记忆连续性系统实施状态',
            'metadata': {'事件类型': 'user_interaction', '重要性': '0.7'}
        },
        {
            'timestamp': '2026-02-20 22:20:00',
            'title': 'EvoMap API测试',
            'content': '测试EvoMap API集成，遇到技术障碍',
            'metadata': {'事件类型': 'system_integration', '重要性': '0.6'}
        },
        {
            'timestamp': '2026-02-20 22:10:00',
            'title': '记忆连续性改进设计开始',
            'content': '开始设计记忆连续性改进方案',
            'metadata': {'事件类型': 'system_analysis', '重要性': '0.8'}
        }
    ]
    
    classifier = EventClassifier()
    generator = SummaryGenerator(classifier)
    
    # 测试每小时摘要
    print("测试每小时摘要生成:")
    hourly_summary = generator.generate_hourly_summary(test_events, '22')
    if hourly_summary:
        print(hourly_summary[:300] + "...")
    else:
        print("无每小时摘要")
    
    print("\n" + "-" * 40 + "\n")
    
    # 测试每日摘要
    print("测试每日摘要生成:")
    daily_summary = generator.generate_daily_summary(test_events, '2026-02-20')
    if daily_summary:
        print(daily_summary[:400] + "...")
    else:
        print("无每日摘要")
    
    print()

def test_full_system():
    """测试完整系统"""
    print("=" * 60)
    print("测试完整智能摘要系统")
    print("=" * 60)
    
    # 初始化组件
    events_file = os.path.join(os.path.dirname(__file__), 'memory', 'RECENT_EVENTS.md')
    classifier = EventClassifier()
    parser = EventParser(events_file)
    generator = SummaryGenerator(classifier)
    
    # 解析事件
    events = parser.parse_events(hours=24)
    print(f"解析到 {len(events)} 个事件")
    
    if not events:
        print("没有找到事件，跳过摘要生成")
        return
    
    # 分类和评分
    classified_events = []
    for event in events:
        event_type = classifier.classify_event(event.get('content', ''))
        importance = classifier.calculate_importance(event_type, event.get('content', ''))
        
        classified_event = event.copy()
        classified_event['type'] = event_type
        classified_event['importance'] = importance
        classified_events.append(classified_event)
    
    # 显示分类结果
    print("\n事件分类结果:")
    type_counts = {}
    for event in classified_events:
        event_type = event.get('type', 'unknown')
        type_counts[event_type] = type_counts.get(event_type, 0) + 1
    
    for event_type, count in sorted(type_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"  {event_type}: {count}个")
    
    # 生成摘要
    print("\n生成摘要...")
    daily_summary = generator.generate_daily_summary(classified_events)
    
    if daily_summary:
        # 保存测试摘要
        test_dir = os.path.join(os.path.dirname(__file__), 'memory', 'test')
        os.makedirs(test_dir, exist_ok=True)
        
        test_file = os.path.join(test_dir, 'test_summary.md')
        with open(test_file, 'w', encoding='utf-8') as f:
            f.write(daily_summary)
        
        print(f"测试摘要已保存到: {test_file}")
        print("\n摘要预览:")
        print(daily_summary[:500] + "...")
    else:
        print("无法生成摘要")

def main():
    """主测试函数"""
    print("智能摘要系统测试")
    print("=" * 60)
    
    # 运行所有测试
    test_classifier()
    test_parser()
    test_summary_generator()
    test_full_system()
    
    print("=" * 60)
    print("测试完成！")

if __name__ == "__main__":
    main()