#!/usr/bin/env python3
"""
增强版事件分类器
使用多级匹配和上下文分析
"""

import re
from typing import Dict, List, Tuple

class EnhancedEventClassifier:
    """增强版事件分类器"""
    
    def __init__(self):
        # 第一级：精确匹配模式（必须包含完整短语）
        self.exact_patterns = {
            'user_interaction': [
                r'用户.*询问.*状态', r'用户.*要求.*开始', r'用户.*选择.*选项',
                r'老爸.*询问.*实施', r'user.*ask.*status', r'用户.*命令.*阶段'
            ],
            'system_error': [
                r'错误.*超时.*连接', r'失败.*api.*调用', r'error.*timeout.*connection',
                r'代理.*服务器.*未运行', r'连接.*失败.*openai'
            ],
            'project_update': [
                r'项目.*实施.*完成', r'阶段.*完成.*基础', r'系统.*实施.*成功',
                r'project.*implement.*complete', r'phase.*complete.*basic'
            ],
            'system_action': [
                r'操作.*检查.*文件', r'创建.*文件.*成功', r'修改.*文件.*格式',
                r'action.*check.*file', r'create.*file.*success'
            ],
            'system_analysis': [
                r'分析.*系统.*架构', r'设计.*方案.*改进', r'架构.*设计.*三层',
                r'analysis.*system.*architecture', r'design.*solution.*improvement'
            ],
            'system_integration': [
                r'集成.*evomap.*成功', r'api.*集成.*测试', r'市场.*集成.*完成',
                r'integration.*evomap.*success', r'api.*integration.*test'
            ],
            'system_maintenance': [
                r'修复.*文件.*格式', r'清理.*重复.*事件', r'维护.*系统.*运行',
                r'fix.*file.*format', r'clean.*duplicate.*events'
            ]
        }
        
        # 第二级：关键词组合匹配（包含多个关键词）
        self.keyword_combinations = {
            'user_interaction': [['用户', '询问'], ['老爸', '消息'], ['user', 'ask']],
            'system_error': [['错误', '超时'], ['失败', '连接'], ['error', 'timeout']],
            'project_update': [['项目', '实施'], ['阶段', '完成'], ['系统', '开发']],
            'system_action': [['操作', '检查'], ['创建', '文件'], ['修复', '格式']],
            'system_analysis': [['分析', '系统'], ['设计', '方案'], ['架构', '改进']],
            'system_integration': [['集成', 'evomap'], ['api', '测试'], ['市场', '资产']],
            'system_maintenance': [['修复', '格式'], ['清理', '重复'], ['维护', '系统']]
        }
        
        # 第三级：单个关键词匹配（最后备选）
        self.single_keywords = {
            'user_interaction': ['用户', '老爸', 'user', '询问', '要求', '选择', '消息'],
            'system_error': ['错误', '失败', '超时', 'error', 'failed', 'timeout', '代理'],
            'project_update': ['项目', '阶段', '实施', '系统', '架构', '开发', '完成'],
            'system_action': ['操作', '检查', '创建', '修改', '修复', 'action', 'check'],
            'system_analysis': ['分析', '设计', '方案', '架构', '改进', 'analysis', 'design'],
            'system_integration': ['集成', 'api', 'evomap', '市场', '资产', 'integration'],
            'system_maintenance': ['修复', '清理', '维护', 'fix', 'clean', 'maintenance']
        }
    
    def classify_event(self, event_text: str) -> str:
        """三级分类策略"""
        event_text_lower = event_text.lower()
        
        # 第一级：精确匹配
        for event_type, patterns in self.exact_patterns.items():
            for pattern in patterns:
                if re.search(pattern, event_text_lower, re.IGNORECASE):
                    return event_type
        
        # 第二级：关键词组合匹配
        for event_type, combinations in self.keyword_combinations.items():
            for combo in combinations:
                # 检查是否包含所有关键词
                if all(keyword in event_text_lower for keyword in combo):
                    return event_type
        
        # 第三级：单个关键词匹配
        for event_type, keywords in self.single_keywords.items():
            for keyword in keywords:
                if keyword in event_text_lower:
                    return event_type
        
        return 'general_event'
    
    def calculate_importance(self, event_type: str, event_text: str) -> float:
        """增强版重要性评分"""
        # 基础重要性
        base_importance = {
            'user_interaction': 0.7,
            'system_error': 0.8,
            'project_update': 0.6,
            'system_action': 0.5,
            'system_analysis': 0.6,
            'system_integration': 0.7,
            'system_maintenance': 0.4,
            'general_event': 0.3
        }.get(event_type, 0.5)
        
        # 基于表情符号调整
        emoji_boosters = {
            '✅': 0.2, '❌': 0.3, '🚀': 0.15, '🔧': 0.1,
            '⚠️': 0.25, '🎉': 0.1, '📊': 0.05, '🔍': 0.05
        }
        
        for emoji, boost in emoji_boosters.items():
            if emoji in event_text:
                base_importance += boost
        
        # 基于关键词调整
        importance_boosters = [
            (r'重要|important|critical|紧急', 0.25),
            (r'成功|success|完成|complete|✅', 0.15),
            (r'失败|失败|error|failed|❌', 0.2),
            (r'开始|启动|实施|🚀', 0.1),
            (r'修复|解决|维护|🔧', 0.1),
            (r'警告|注意|⚠️', 0.2),
            (r'庆祝|完成|🎉', 0.1),
            (r'分析|统计|📊', 0.05),
            (r'检查|诊断|🔍', 0.05)
        ]
        
        for pattern, boost in importance_boosters:
            if re.search(pattern, event_text, re.IGNORECASE):
                base_importance += boost
        
        # 基于长度调整（长事件通常更详细）
        if len(event_text) > 100:
            base_importance += 0.1
        
        # 确保在0.1-1.0范围内
        return min(max(base_importance, 0.1), 1.0)
    
    def extract_key_phrases(self, event_text: str) -> List[str]:
        """提取关键短语"""
        key_phrases = []
        
        # 提取带表情符号的短语
        emoji_patterns = [
            (r'✅.*?[。！？]', '成功完成'),
            (r'❌.*?[。！？]', '失败错误'),
            (r'🚀.*?[。！？]', '开始实施'),
            (r'🔧.*?[。！？]', '修复维护'),
            (r'⚠️.*?[。！？]', '警告注意')
        ]
        
        for pattern, category in emoji_patterns:
            matches = re.findall(pattern, event_text)
            key_phrases.extend([f"{category}: {match}" for match in matches])
        
        # 提取数字相关短语
        number_patterns = [
            r'\d+个.*?(?:事件|文件|项目)',
            r'第\d+阶段',
            r'\d+\.\d+分',
            r'\d+小时.*?滚动'
        ]
        
        for pattern in number_patterns:
            matches = re.findall(pattern, event_text)
            key_phrases.extend(matches)
        
        # 提取项目名称
        project_patterns = [
            r'[A-Z][a-z]+系统',
            r'[A-Z][a-z]+集成',
            r'[A-Z][a-z]+架构',
            r'EvoMap.*?市场',
            r'记忆.*?系统'
        ]
        
        for pattern in project_patterns:
            matches = re.findall(pattern, event_text)
            key_phrases.extend(matches)
        
        return key_phrases[:5]  # 最多返回5个关键短语

def test_enhanced_classifier():
    """测试增强版分类器"""
    print("=" * 60)
    print("测试增强版事件分类器")
    print("=" * 60)
    
    classifier = EnhancedEventClassifier()
    
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
        ("⚠️ 重要：需要立即处理", "general_event")
    ]
    
    for text, expected in test_cases:
        result = classifier.classify_event(text)
        importance = classifier.calculate_importance(result, text)
        key_phrases = classifier.extract_key_phrases(text)
        
        status = "✅" if result == expected else "❌"
        print(f"{status} '{text[:30]}...'")
        print(f"    分类: {result} (预期: {expected})")
        print(f"    重要性: {importance:.2f}")
        if key_phrases:
            print(f"    关键短语: {', '.join(key_phrases)}")
        print()

if __name__ == "__main__":
    test_enhanced_classifier()