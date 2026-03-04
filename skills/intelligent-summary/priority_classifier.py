#!/usr/bin/env python3
"""
优先级事件分类器
解决规则冲突问题
"""

import re
from typing import Dict, List, Tuple

class PriorityEventClassifier:
    """优先级事件分类器"""
    
    def __init__(self):
        # 定义事件类型优先级（从高到低）
        self.type_priority = [
            'system_error',      # 最高优先级：系统错误需要立即关注
            'user_interaction',  # 用户交互很重要
            'system_integration', # 系统集成
            'project_update',    # 项目更新
            'system_analysis',   # 系统分析
            'system_action',     # 系统操作
            'system_maintenance', # 系统维护
            'general_event'      # 最低优先级：一般事件
        ]
        
        # 每个类型的匹配规则（按优先级顺序检查）
        self.type_rules = {
            'system_error': [
                # 规则1：包含错误表情符号
                lambda text: '❌' in text,
                # 规则2：包含错误关键词组合
                lambda text: any(all(kw in text.lower() for kw in combo) 
                               for combo in [['错误', '超时'], ['失败', '连接'], ['error', 'timeout']]),
                # 规则3：包含单个错误关键词
                lambda text: any(kw in text.lower() for kw in ['错误', '失败', '超时', 'error', 'failed'])
            ],
            'user_interaction': [
                lambda text: any(all(kw in text.lower() for kw in combo)
                               for combo in [['用户', '询问'], ['老爸', '消息'], ['user', 'ask']]),
                lambda text: any(kw in text.lower() for kw in ['用户', '老爸', 'user', '询问'])
            ],
            'system_integration': [
                lambda text: 'evomap' in text.lower() or 'api' in text.lower(),
                lambda text: any(kw in text.lower() for kw in ['集成', 'integration', '市场', '资产'])
            ],
            'project_update': [
                lambda text: '✅' in text and any(kw in text.lower() for kw in ['创建', '完成', '实施']),
                lambda text: any(all(kw in text.lower() for kw in combo)
                               for combo in [['项目', '实施'], ['阶段', '完成'], ['系统', '开发']]),
                lambda text: any(kw in text.lower() for kw in ['项目', '阶段', '实施', '完成'])
            ],
            'system_analysis': [
                lambda text: any(all(kw in text.lower() for kw in combo)
                               for combo in [['分析', '系统'], ['设计', '方案'], ['架构', '改进']]),
                lambda text: any(kw in text.lower() for kw in ['分析', '设计', '方案', '架构'])
            ],
            'system_action': [
                lambda text: any(all(kw in text.lower() for kw in combo)
                               for combo in [['操作', '检查'], ['创建', '文件'], ['修改', '文件']]),
                lambda text: any(kw in text.lower() for kw in ['操作', '检查', '创建', '修改'])
            ],
            'system_maintenance': [
                lambda text: '🔧' in text,
                lambda text: any(all(kw in text.lower() for kw in combo)
                               for combo in [['修复', '格式'], ['清理', '重复'], ['维护', '系统']]),
                lambda text: any(kw in text.lower() for kw in ['修复', '清理', '维护'])
            ]
        }
    
    def classify_event(self, event_text: str) -> str:
        """按优先级顺序分类事件"""
        # 按优先级顺序检查每个类型
        for event_type in self.type_priority:
            if event_type == 'general_event':
                return 'general_event'  # 默认类型
            
            rules = self.type_rules.get(event_type, [])
            for rule in rules:
                if rule(event_text):
                    return event_type
        
        return 'general_event'
    
    def calculate_importance(self, event_type: str, event_text: str) -> float:
        """基于优先级的重要性评分"""
        # 基础重要性基于优先级
        priority_index = self.type_priority.index(event_type) if event_type in self.type_priority else len(self.type_priority)
        base_importance = 1.0 - (priority_index * 0.1)  # 优先级越高，重要性越高
        
        # 表情符号调整
        emoji_scores = {
            '❌': 0.3, '⚠️': 0.25, '✅': 0.2, '🚀': 0.15,
            '🔧': 0.1, '🎉': 0.1, '📊': 0.05, '🔍': 0.05
        }
        
        for emoji, boost in emoji_scores.items():
            if emoji in event_text:
                base_importance += boost
        
        # 关键词调整
        keyword_boosters = [
            (r'重要|紧急|critical|urgent', 0.2),
            (r'成功|完成|success|complete', 0.15),
            (r'失败|错误|error|failed', 0.2),
            (r'开始|启动|实施|begin', 0.1),
            (r'修复|解决|fix|resolve', 0.1)
        ]
        
        for pattern, boost in keyword_boosters:
            if re.search(pattern, event_text, re.IGNORECASE):
                base_importance += boost
        
        # 确保在0.1-1.0范围内
        return min(max(base_importance, 0.1), 1.0)
    
    def get_classification_details(self, event_text: str) -> Dict:
        """获取详细的分类信息"""
        result = {
            'text': event_text,
            'classification': self.classify_event(event_text),
            'importance': self.calculate_importance(self.classify_event(event_text), event_text),
            'matched_rules': [],
            'priority_score': 0
        }
        
        # 检查匹配了哪些规则
        for event_type in self.type_priority:
            if event_type == 'general_event':
                continue
                
            rules = self.type_rules.get(event_type, [])
            for i, rule in enumerate(rules):
                if rule(event_text):
                    result['matched_rules'].append(f"{event_type}_rule{i+1}")
        
        # 计算优先级分数
        if result['classification'] in self.type_priority:
            result['priority_score'] = len(self.type_priority) - self.type_priority.index(result['classification'])
        
        return result

def test_priority_classifier():
    """测试优先级分类器"""
    print("=" * 60)
    print("测试优先级事件分类器")
    print("=" * 60)
    
    classifier = PriorityEventClassifier()
    
    test_cases = [
        ("分析当前记忆系统架构，设计改进方案", "system_analysis"),
        ("EvoMap AI代理协作进化市场集成", "system_integration"),
        ("用户询问记忆连续性系统实施状态", "user_interaction"),
        ("OpenAI API连接超时错误", "system_error"),
        ("记忆连续性系统第一阶段实施", "project_update"),
        ("修复事件文件格式错误", "system_maintenance"),
        ("检查RECENT_EVENTS.md文件", "system_action"),
        ("创建智能摘要系统架构", "project_update"),
        ("测试EvoMap API集成", "system_integration"),
        ("设计三层记忆架构", "system_analysis"),
        ("✅ 创建了memory_continuity_system.md设计文档", "project_update"),
        ("❌ 发布遇到技术障碍", "system_error"),
        ("🚀 开始实施智能摘要系统", "project_update"),
        ("🔧 修复文件格式问题", "system_maintenance"),
        ("⚠️ 重要：需要立即处理", "system_error")
    ]
    
    correct_count = 0
    total_count = len(test_cases)
    
    for text, expected in test_cases:
        details = classifier.get_classification_details(text)
        result = details['classification']
        importance = details['importance']
        
        status = "✅" if result == expected else "❌"
        if result == expected:
            correct_count += 1
        
        print(f"{status} '{text[:30]}...'")
        print(f"    分类: {result} (预期: {expected})")
        print(f"    重要性: {importance:.2f}")
        print(f"    优先级分数: {details['priority_score']}")
        if details['matched_rules']:
            print(f"    匹配规则: {', '.join(details['matched_rules'])}")
        print()
    
    accuracy = correct_count / total_count * 100
    print(f"准确率: {correct_count}/{total_count} ({accuracy:.1f}%)")
    
    # 测试实际事件
    print("\n" + "=" * 60)
    print("测试实际事件分类")
    print("=" * 60)
    
    actual_events = [
        "1. **EvoMap集成成功** - 获取了10个顶级解决方案，可以立即实施改进",
        "2. **记忆系统分析完成** - 识别了当前系统的局限性",
        "3. **改进方案设计完成** - 基于EvoMap最佳实践设计了三层记忆架构",
        "4. **用户询问记忆连续性系统实施状态**",
        "5. **✅ 创建了`memory_continuity_system.md`设计文档**",
        "6. **✅ 创建了`RECENT_EVENTS.md`文件**",
        "7. **✅ 实现了24小时滚动窗口的事件记录**",
        "8. **❌ 发布遇到技术障碍** - 需要解决技术问题",
        "9. **🔧 修复事件文件格式错误**",
        "10. **🚀 开始实施智能摘要系统**"
    ]
    
    for event in actual_events:
        result = classifier.classify_event(event)
        importance = classifier.calculate_importance(result, event)
        print(f"{result:20} ({importance:.2f}) | {event[:50]}...")

if __name__ == "__main__":
    test_priority_classifier()