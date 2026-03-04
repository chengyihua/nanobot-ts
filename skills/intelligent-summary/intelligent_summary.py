#!/usr/bin/env python3
"""
智能摘要系统
基于RECENT_EVENTS.md文件生成每小时和每日摘要
"""

import os
import re
import json
from datetime import datetime, timedelta
from collections import defaultdict

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
                match = re.match(r'- \*\*([^:]+)\*\*: (.+)', line.strip())
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

class EventClassifier:
    """事件分类器 - 基于规则的事件分类和重要性评分"""
    
    def __init__(self):
        # 事件类型模式
        self.type_patterns = {
            'user_interaction': [
                r'用户', r'询问', r'确认', r'体验', r'要求', r'提问'
            ],
            'project_update': [
                r'完成', r'成功', r'就绪', r'集成', r'架构', r'测试通过', r'实施'
            ],
            'system_error': [
                r'错误', r'失败', r'问题', r'bug', r'异常', r'超时', r'连接失败'
            ],
            'system_maintenance': [
                r'修复', r'清理', r'优化', r'维护', r'调整', r'更新'
            ],
            'system_action': [
                r'生成', r'保存', r'执行', r'运行', r'创建', r'添加'
            ],
            'system_analysis': [
                r'分析', r'统计', r'报告', r'总结', r'评估', r'检查'
            ],
            'system_integration': [
                r'集成', r'连接', r'接入', r'整合', r'对接'
            ]
        }
        
        # 重要性关键词
        self.importance_keywords = {
            'high': [r'重要', r'紧急', r'关键', r'必须', r'立即', r'⚠️', r'🚨'],
            'medium': [r'建议', r'考虑', r'优化', r'改进', r'🔧', r'📊'],
            'low': [r'普通', r'常规', r'日常', r'📋', r'📝']
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
        event_text_lower = event_text.lower()
        
        # 基础重要性
        base_importance = {
            'system_error': 0.8,
            'user_interaction': 0.7,
            'project_update': 0.6,
            'system_integration': 0.6,
            'system_analysis': 0.5,
            'system_action': 0.4,
            'system_maintenance': 0.4,
            'general_event': 0.3
        }.get(event_type, 0.3)
        
        # 关键词调整
        for level, keywords in self.importance_keywords.items():
            for keyword in keywords:
                if re.search(keyword, event_text_lower, re.IGNORECASE):
                    if level == 'high':
                        return min(1.0, base_importance + 0.3)
                    elif level == 'medium':
                        return min(1.0, base_importance + 0.15)
                    elif level == 'low':
                        return max(0.1, base_importance - 0.1)
        
        return base_importance

class SummaryGenerator:
    """摘要生成器 - 生成每小时和每日摘要"""
    
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
            event_text = f"{event['title']} {event.get('content', '')}"
            event['type'] = self.classifier.classify_event(event_text)
            
            # 优先使用元数据中的重要性
            metadata = event.get('metadata', {})
            if '重要性' in metadata:
                try:
                    event['importance'] = float(metadata['重要性'])
                except:
                    event['importance'] = self.classifier.calculate_importance(event['type'], event_text)
            else:
                event['importance'] = self.classifier.calculate_importance(event['type'], event_text)
        
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
                title_preview = event.get('title', '')[:60]
                if len(event.get('title', '')) > 60:
                    title_preview += "..."
                
                summary += f"{i+1}. {importance_str} {title_preview}\n"
            
            if len(type_events) > 3:
                summary += f"   ...还有{len(type_events)-3}个事件\n"
            
            summary += "\n"
        
        # 添加统计信息
        avg_importance = sum(e.get('importance', 0) for e in hourly_events) / len(hourly_events)
        summary += f"**平均重要性**: {avg_importance:.2f}/1.0\n"
        
        return summary
    
    def generate_daily_summary(self, events):
        """生成每日摘要"""
        if not events:
            return None
        
        # 按日期分组
        daily_events = defaultdict(list)
        for event in events:
            try:
                event_date = datetime.strptime(event['timestamp'], '%Y-%m-%d %H:%M:%S').strftime('%Y-%m-%d')
                daily_events[event_date].append(event)
            except:
                pass
        
        # 生成摘要
        summary = f"# 每日摘要\n\n"
        
        for date, date_events in sorted(daily_events.items()):
            summary += f"## {date}\n"
            summary += f"**事件总数**: {len(date_events)}\n\n"
            
            # 分类和评分
            for event in date_events:
                event_text = f"{event['title']} {event.get('content', '')}"
                event['type'] = self.classifier.classify_event(event_text)
                
                # 优先使用元数据中的重要性
                metadata = event.get('metadata', {})
                if '重要性' in metadata:
                    try:
                        event['importance'] = float(metadata['重要性'])
                    except:
                        event['importance'] = self.classifier.calculate_importance(event['type'], event_text)
                else:
                    event['importance'] = self.classifier.calculate_importance(event['type'], event_text)
            
            # 按类型分组
            grouped = {}
            for event in date_events:
                event_type = event.get('type', 'unknown')
                grouped.setdefault(event_type, []).append(event)
            
            # 按重要性排序
            for event_type in grouped:
                grouped[event_type].sort(key=lambda x: x.get('importance', 0), reverse=True)
            
            # 生成摘要内容
            for event_type, type_events in sorted(grouped.items()):
                summary += f"### {event_type} ({len(type_events)}个)\n"
                
                for i, event in enumerate(type_events[:5]):  # 最多显示5个
                    importance_str = f"[重要性: {event.get('importance', 0):.2f}]"
                    title_preview = event.get('title', '')[:50]
                    if len(event.get('title', '')) > 50:
                        title_preview += "..."
                    
                    summary += f"{i+1}. {importance_str} {title_preview}\n"
                
                if len(type_events) > 5:
                    summary += f"   ...还有{len(type_events)-5}个事件\n"
                
                summary += "\n"
            
            # 添加统计信息
            avg_importance = sum(e.get('importance', 0) for e in date_events) / len(date_events)
            summary += f"**平均重要性**: {avg_importance:.2f}/1.0\n\n"
        
        return summary

def main():
    """主函数"""
    print("正在解析事件...")
    
    # 事件文件路径
    events_file = os.path.join(os.path.dirname(__file__), '..', '..', 'workspace', 'RECENT_EVENTS.md')
    
    # 创建解析器
    parser = EventParser(events_file)
    events = parser.parse_events(hours=24)
    
    print(f"找到 {len(events)} 个事件")
    
    if events:
        # 创建分类器
        classifier = EventClassifier()
        
        # 创建摘要生成器
        generator = SummaryGenerator(classifier)
        
        # 生成每小时摘要
        current_hour = datetime.now().strftime('%H')
        hourly_summary = generator.generate_hourly_summary(events, current_hour)
        
        if hourly_summary:
            print("\n" + "="*50 + "\n")
            print(hourly_summary)
            
            # 保存每小时摘要
            hourly_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'workspace', 'memory', 'hourly')
            os.makedirs(hourly_dir, exist_ok=True)
            
            hourly_filename = f"{datetime.now().strftime('%Y-%m-%d_%H')}_summary.md"
            hourly_path = os.path.join(hourly_dir, hourly_filename)
            
            with open(hourly_path, 'w', encoding='utf-8') as f:
                f.write(hourly_summary)
            
            print(f"\n每小时摘要已保存到: {hourly_path}")
        
        # 如果是0点，生成每日摘要
        if datetime.now().hour == 0:
            daily_summary = generator.generate_daily_summary(events)
            
            if daily_summary:
                print("\n" + "="*50 + "\n")
                print(daily_summary)
                
                # 保存每日摘要
                daily_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'workspace', 'memory', 'daily')
                os.makedirs(daily_dir, exist_ok=True)
                
                daily_filename = f"{datetime.now().strftime('%Y-%m-%d')}_summary.md"
                daily_path = os.path.join(daily_dir, daily_filename)
                
                with open(daily_path, 'w', encoding='utf-8') as f:
                    f.write(daily_summary)
                
                print(f"\n每日摘要已保存到: {daily_path}")
    else:
        print("没有找到事件")

if __name__ == "__main__":
    main()