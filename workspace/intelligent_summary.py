#!/usr/bin/env python3
"""
智能摘要系统 - 基础实现
第二阶段：智能摘要系统
"""

import os
import re
from datetime import datetime, timedelta
import json

class EventClassifier:
    """事件分类器"""
    
    def __init__(self):
        self.type_patterns = {
            'user_interaction': [
                r'用户.*询问', r'用户.*消息', r'老爸.*询问', r'user.*ask',
                r'用户.*要求', r'用户.*选择', r'用户.*命令'
            ],
            'system_error': [
                r'错误.*超时', r'失败.*连接', r'error.*timeout', r'failed.*connection',
                r'代理.*超时', r'api.*错误', r'连接.*失败'
            ],
            'project_update': [
                r'项目.*实施', r'阶段.*完成', r'系统.*实施', r'project.*implement',
                r'phase.*complete', r'系统.*开发', r'架构.*完成'
            ],
            'system_action': [
                r'操作.*检查', r'创建.*文件', r'修改.*文件', r'action.*check',
                r'create.*file', r'edit.*file', r'修复.*文件'
            ],
            'system_analysis': [
                r'分析.*系统', r'设计.*方案', r'架构.*设计', r'analysis.*system',
                r'design.*solution', r'改进.*设计', r'方案.*分析'
            ],
            'system_integration': [
                r'集成.*evomap', r'api.*集成', r'市场.*集成', r'integration.*evomap',
                r'api.*integration', r'资产.*获取', r'evomap.*市场'
            ],
            'system_maintenance': [
                r'修复.*格式', r'清理.*重复', r'维护.*系统', r'fix.*format',
                r'clean.*duplicate', r'maintenance.*system'
            ]
        }
    
    def classify_event(self, event_text):
        """基于规则的事件分类"""
        event_text_lower = event_text.lower()
        
        for event_type, patterns in self.type_patterns.items():
            for pattern in patterns:
                if re.search(pattern, event_text_lower, re.IGNORECASE):
                    return event_type
        
        return 'general_event'
    
    def calculate_importance(self, event_type, event_text):
        """基于规则的重要性评分"""
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
        
        # 基于关键词调整
        importance_boosters = [
            (r'重要|important|critical', 0.2),
            (r'成功|success|完成|complete', 0.1),
            (r'失败|失败|error|failed', 0.15),
            (r'紧急|urgent', 0.25),
            (r'✅|成功|完成', 0.1),
            (r'❌|失败|错误|超时', 0.15),
            (r'🚀|实施|开始|启动', 0.1),
            (r'🔧|修复|维护|解决', 0.1)
        ]
        
        for pattern, boost in importance_boosters:
            if re.search(pattern, event_text, re.IGNORECASE):
                base_importance += boost
        
        # 确保在0-1范围内
        return min(max(base_importance, 0.1), 1.0)

class EventParser:
    """事件解析器 - 解析RECENT_EVENTS.md文件"""
    
    def __init__(self, events_file_path):
        self.events_file_path = events_file_path
    
    def parse_events(self, hours=24):
        """解析最近指定小时的事件"""
        if not os.path.exists(self.events_file_path):
            return []
        
        with open(self.events_file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 解析事件
        events = []
        current_event = {}
        
        for line in content.split('\n'):
            # 检测事件开始
            if line.startswith('## ['):
                # 保存前一个事件
                if current_event:
                    events.append(current_event)
                    current_event = {}
                
                # 解析时间戳和标题
                match = re.match(r'## \[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] (.+)', line)
                if match:
                    current_event = {
                        'timestamp': match.group(1),
                        'title': match.group(2),
                        'content': '',
                        'metadata': {}
                    }
            
            # 解析元数据
            elif line.strip().startswith('- **'):
                match = re.match(r'- \*\*([^:]+):\*\* (.+)', line.strip())
                if match and current_event:
                    key = match.group(1).strip()
                    value = match.group(2).strip()
                    current_event['metadata'][key] = value
            
            # 累积内容
            elif current_event and line.strip() and not line.startswith('#') and not line.startswith('---'):
                if current_event['content']:
                    current_event['content'] += ' ' + line.strip()
                else:
                    current_event['content'] = line.strip()
        
        # 添加最后一个事件
        if current_event:
            events.append(current_event)
        
        # 过滤最近指定小时的事件
        cutoff_time = datetime.now() - timedelta(hours=hours)
        filtered_events = []
        
        for event in events:
            try:
                event_time = datetime.strptime(event['timestamp'], '%Y-%m-%d %H:%M:%S')
                if event_time >= cutoff_time:
                    filtered_events.append(event)
            except:
                # 如果时间解析失败，包含事件
                filtered_events.append(event)
        
        return filtered_events

class SummaryGenerator:
    """摘要生成器"""
    
    def __init__(self, classifier):
        self.classifier = classifier
    
    def generate_hourly_summary(self, events, hour=None):
        """生成每小时摘要"""
        if hour is None:
            hour = datetime.now().strftime('%H')
        
        # 过滤该小时的事件
        hourly_events = []
        for event in events:
            try:
                event_hour = datetime.strptime(event['timestamp'], '%Y-%m-%d %H:%M:%S').strftime('%H')
                if event_hour == hour:
                    hourly_events.append(event)
            except:
                pass
        
        if not hourly_events:
            return None
        
        # 分类和评分
        for event in hourly_events:
            event['type'] = self.classifier.classify_event(event['content'])
            event['importance'] = self.classifier.calculate_importance(event['type'], event['content'])
        
        # 生成摘要
        summary = f"# 每小时摘要\n\n"
        summary += f"**时间**: {datetime.now().strftime('%Y-%m-%d')} {hour}:00-{hour}:59\n"
        summary += f"**事件总数**: {len(hourly_events)}\n\n"
        
        # 按类型分组
        grouped = {}
        for event in hourly_events:
            event_type = event.get('type', 'unknown')
            grouped.setdefault(event_type, []).append(event)
        
        # 按重要性排序
        for event_type in grouped:
            grouped[event_type].sort(key=lambda x: x.get('importance', 0), reverse=True)
        
        # 生成摘要内容
        for event_type, type_events in sorted(grouped.items()):
            summary += f"## {event_type} ({len(type_events)}个)\n"
            
            for i, event in enumerate(type_events[:3]):  # 最多显示3个
                importance_str = f"[重要性: {event.get('importance', 0):.2f}]"
                content_preview = event.get('content', '')[:80]
                if len(event.get('content', '')) > 80:
                    content_preview += "..."
                
                summary += f"{i+1}. {importance_str} {content_preview}\n"
            
            if len(type_events) > 3:
                summary += f"   ...还有{len(type_events)-3}个事件\n"
            
            summary += "\n"
        
        # 添加统计信息
        avg_importance = sum(e.get('importance', 0) for e in hourly_events) / len(hourly_events)
        summary += f"**平均重要性**: {avg_importance:.2f}/1.0\n"
        
        return summary
    
    def generate_daily_summary(self, events, date=None):
        """生成每日摘要"""
        if date is None:
            date = datetime.now().strftime('%Y-%m-%d')
        
        # 过滤该日期的事件
        daily_events = []
        for event in events:
            try:
                event_date = datetime.strptime(event['timestamp'], '%Y-%m-%d %H:%M:%S').strftime('%Y-%m-%d')
                if event_date == date:
                    daily_events.append(event)
            except:
                pass
        
        if not daily_events:
            return None
        
        # 分类和评分
        for event in daily_events:
            event['type'] = self.classifier.classify_event(event['content'])
            event['importance'] = self.classifier.calculate_importance(event['type'], event['content'])
        
        # 生成摘要
        summary = f"# 每日摘要\n\n"
        summary += f"**日期**: {date}\n"
        summary += f"**事件总数**: {len(daily_events)}\n\n"
        
        # 统计信息
        event_types = {}
        importance_sum = 0
        
        for event in daily_events:
            event_type = event.get('type', 'unknown')
            event_types[event_type] = event_types.get(event_type, 0) + 1
            importance_sum += event.get('importance', 0)
        
        summary += "## 统计概览\n"
        if daily_events:
            summary += f"- **平均重要性**: {importance_sum/len(daily_events):.2f}/1.0\n"
        
        summary += "- **事件类型分布**:\n"
        for event_type, count in sorted(event_types.items(), key=lambda x: x[1], reverse=True):
            percentage = (count / len(daily_events)) * 100 if daily_events else 0
            summary += f"  - {event_type}: {count}个 ({percentage:.1f}%)\n"
        
        # 重要事件（重要性 > 0.7）
        important_events = [e for e in daily_events if e.get('importance', 0) > 0.7]
        if important_events:
            summary += "\n## 重要事件\n"
            important_events.sort(key=lambda x: x.get('importance', 0), reverse=True)
            
            for i, event in enumerate(important_events[:5]):  # 最多5个
                time_str = event['timestamp'][11:16]  # 只取时间部分
                importance_str = f"{event.get('importance', 0):.2f}"
                content_preview = event.get('content', '')[:100]
                if len(event.get('content', '')) > 100:
                    content_preview += "..."
                
                summary += f"{i+1}. **[{time_str}]** (重要性: {importance_str}) {content_preview}\n"
        
        # 趋势分析（简单版本）
        hourly_counts = {}
        for event in daily_events:
            try:
                hour = event['timestamp'][11:13]  # 获取小时
                hourly_counts[hour] = hourly_counts.get(hour, 0) + 1
            except:
                pass
        
        if hourly_counts:
            summary += "\n## 时间分布\n"
            for hour in sorted(hourly_counts.keys()):
                summary += f"- {hour}:00-{hour}:59: {hourly_counts[hour]}个事件\n"
        
        return summary

def main():
    """主函数"""
    # 配置文件路径
    workspace_dir = os.path.dirname(os.path.abspath(__file__))
    events_file = os.path.join(workspace_dir, 'memory', 'RECENT_EVENTS.md')
    
    # 初始化组件
    classifier = EventClassifier()
    parser = EventParser(events_file)
    generator = SummaryGenerator(classifier)
    
    # 解析最近24小时的事件
    print("正在解析事件...")
    events = parser.parse_events(hours=24)
    print(f"找到 {len(events)} 个事件")
    
    # 生成当前小时的摘要
    current_hour = datetime.now().strftime('%H')
    hourly_summary = generator.generate_hourly_summary(events, current_hour)
    
    if hourly_summary:
        # 保存每小时摘要
        hourly_dir = os.path.join(workspace_dir, 'memory', 'hourly')
        os.makedirs(hourly_dir, exist_ok=True)
        
        hourly_file = os.path.join(hourly_dir, f"{datetime.now().strftime('%Y-%m-%d_%H')}_summary.md")
        with open(hourly_file, 'w', encoding='utf-8') as f:
            f.write(hourly_summary)
        
        print(f"每小时摘要已保存到: {hourly_file}")
    
    # 生成今日摘要
    daily_summary = generator.generate_daily_summary(events)
    
    if daily_summary:
        # 保存每日摘要
        daily_dir = os.path.join(workspace_dir, 'memory', 'daily')
        os.makedirs(daily_dir, exist_ok=True)
        
        daily_file = os.path.join(daily_dir, f"{datetime.now().strftime('%Y-%m-%d')}_summary.md")
        with open(daily_file, 'w', encoding='utf-8') as f:
            f.write(daily_summary)
        
        print(f"每日摘要已保存到: {daily_file}")
    
    # 打印摘要预览
    print("\n" + "="*50)
    if hourly_summary:
        print("每小时摘要预览:")
        print(hourly_summary[:500] + "...")
    
    print("\n" + "="*50)
    if daily_summary:
        print("每日摘要预览:")
        print(daily_summary[:800] + "...")

if __name__ == "__main__":
    main()