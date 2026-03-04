# 智能摘要系统 - 第二阶段

## 系统概述

基于第一阶段的基础架构（RECENT_EVENTS.md），实现智能摘要生成、事件分类、趋势分析和提醒生成功能。

## 核心功能

### 1. 自动摘要生成
- **定期摘要**：每小时/每天自动生成事件摘要
- **事件聚类**：将相似事件分组
- **重要性排序**：基于重要性评分排序事件
- **摘要格式**：结构化、易读的摘要

### 2. 事件智能分类
- **事件类型识别**：自动识别事件类型
- **重要性评分**：基于规则计算重要性
- **标签生成**：自动生成相关标签
- **关联分析**：识别事件间的关联

### 3. 趋势分析
- **频率分析**：识别高频事件类型
- **时间模式**：发现事件的时间分布模式
- **相关性分析**：分析事件间的相关性
- **异常检测**：检测异常事件模式

### 4. 提醒生成
- **重要事件提醒**：基于重要性生成提醒
- **趋势提醒**：基于趋势变化生成提醒
- **周期性提醒**：定期提醒重要事项
- **用户偏好提醒**：基于用户历史行为生成提醒

## 系统架构

### 文件结构
```
memory/
├── RECENT_EVENTS.md          # 24小时滚动窗口（第一阶段）
├── MEMORY.md                 # 长期记忆（第一阶段）
├── daily/                    # 每日摘要
│   ├── 2026-02-20_summary.md
│   ├── 2026-02-19_summary.md
│   └── ...
├── hourly/                   # 每小时摘要
│   ├── 2026-02-20_10_summary.md
│   ├── 2026-02-20_11_summary.md
│   └── ...
├── trends/                   # 趋势分析
│   ├── weekly_trends.md
│   ├── event_frequency.md
│   └── ...
└── alerts/                   # 提醒记录
    ├── important_alerts.md
    ├── trend_alerts.md
    └── ...
```

### 数据流
```
事件记录 → 事件分类 → 重要性评分 → 存储到RECENT_EVENTS.md
     ↓
定期扫描 → 摘要生成 → 存储到摘要文件
     ↓
趋势分析 → 提醒生成 → 用户通知
```

## 实现方案

### 1. 事件分类器
```python
class EventClassifier:
    def classify_event(self, event_text):
        # 基于规则的事件分类
        if "user" in event_text.lower():
            return "user_interaction"
        elif "error" in event_text.lower():
            return "system_error"
        elif "project" in event_text.lower():
            return "project_update"
        else:
            return "general_event"
    
    def calculate_importance(self, event_type, event_text):
        # 基于规则的重要性评分
        importance_rules = {
            "user_interaction": 0.7,
            "system_error": 0.8,
            "project_update": 0.6,
            "general_event": 0.4
        }
        return importance_rules.get(event_type, 0.5)
```

### 2. 摘要生成器
```python
class SummaryGenerator:
    def generate_hourly_summary(self, events):
        # 生成每小时摘要
        summary = "# 每小时摘要\n\n"
        summary += f"**时间范围**: 最近1小时\n"
        summary += f"**事件总数**: {len(events)}\n\n"
        
        # 按类型分组
        grouped = {}
        for event in events:
            event_type = event.get('type', 'unknown')
            grouped.setdefault(event_type, []).append(event)
        
        # 生成摘要
        for event_type, type_events in grouped.items():
            summary += f"## {event_type} ({len(type_events)}个)\n"
            for event in type_events[:3]:  # 最多显示3个
                summary += f"- {event.get('content', '')[:100]}...\n"
            if len(type_events) > 3:
                summary += f"- ...还有{len(type_events)-3}个事件\n"
            summary += "\n"
        
        return summary
    
    def generate_daily_summary(self, events):
        # 生成每日摘要
        summary = "# 每日摘要\n\n"
        summary += f"**日期**: {datetime.now().strftime('%Y-%m-%d')}\n"
        summary += f"**事件总数**: {len(events)}\n\n"
        
        # 统计信息
        event_types = {}
        importance_sum = 0
        
        for event in events:
            event_type = event.get('type', 'unknown')
            event_types[event_type] = event_types.get(event_type, 0) + 1
            importance_sum += event.get('importance', 0.5)
        
        summary += "## 统计概览\n"
        summary += f"- **平均重要性**: {importance_sum/len(events):.2f}/1.0\n"
        summary += "- **事件类型分布**:\n"
        for event_type, count in sorted(event_types.items(), key=lambda x: x[1], reverse=True):
            percentage = (count / len(events)) * 100
            summary += f"  - {event_type}: {count}个 ({percentage:.1f}%)\n"
        
        return summary
```

### 3. 趋势分析器
```python
class TrendAnalyzer:
    def analyze_event_frequency(self, events):
        # 分析事件频率
        hourly_counts = {}
        for event in events:
            hour = event['timestamp'][:13]  # 获取小时
            hourly_counts[hour] = hourly_counts.get(hour, 0) + 1
        
        return hourly_counts
    
    def detect_anomalies(self, events):
        # 检测异常事件
        anomalies = []
        importance_threshold = 0.8
        
        for event in events:
            if event.get('importance', 0) > importance_threshold:
                anomalies.append({
                    'timestamp': event['timestamp'],
                    'type': event['type'],
                    'importance': event['importance'],
                    'content': event['content'][:200]
                })
        
        return anomalies
```

### 4. 提醒生成器
```python
class AlertGenerator:
    def generate_important_alerts(self, events):
        # 生成重要事件提醒
        alerts = []
        importance_threshold = 0.7
        
        for event in events:
            if event.get('importance', 0) > importance_threshold:
                alert = {
                    'timestamp': event['timestamp'],
                    'type': 'important_event',
                    'message': f"重要事件: {event.get('content', '')[:100]}...",
                    'importance': event['importance']
                }
                alerts.append(alert)
        
        return alerts
    
    def generate_trend_alerts(self, trend_data):
        # 生成趋势提醒
        alerts = []
        
        # 检测频率异常
        if 'frequency_spike' in trend_data:
            alerts.append({
                'timestamp': datetime.now().isoformat(),
                'type': 'frequency_alert',
                'message': f"检测到事件频率异常: {trend_data['frequency_spike']}",
                'importance': 0.6
            })
        
        return alerts
```

## 实施步骤

### 阶段2.1：基础摘要系统
1. **创建摘要目录结构**
2. **实现事件分类器**
3. **实现基础摘要生成器**
4. **测试摘要生成功能**

### 阶段2.2：智能分析
1. **实现趋势分析器**
2. **实现异常检测**
3. **实现关联分析**
4. **测试分析功能**

### 阶段2.3：提醒系统
1. **实现提醒生成器**
2. **集成到通知系统**
3. **实现用户偏好设置**
4. **测试提醒功能**

### 阶段2.4：优化和集成
1. **性能优化**
2. **集成到现有系统**
3. **用户界面改进**
4. **完整测试**

## 技术实现

### 依赖项
- **Python 3.8+**：主要实现语言
- **正则表达式**：事件文本分析
- **日期时间处理**：时间分析
- **文件系统操作**：摘要文件管理

### 文件格式

#### 每小时摘要示例
```markdown
# 每小时摘要

**时间范围**: 2026-02-20 22:00-23:00
**事件总数**: 15

## user_interaction (8个)
- 用户询问记忆连续性系统状态...
- 用户要求开始第二阶段实施...
- 用户选择选项A继续开发...

## system_error (3个)
- OpenAI API连接超时错误...
- 代理服务器连接失败...

## project_update (4个)
- 开始记忆连续性系统第二阶段...
- 设计智能摘要系统架构...
```

#### 每日摘要示例
```markdown
# 每日摘要

**日期**: 2026-02-20
**事件总数**: 127

## 统计概览
- **平均重要性**: 0.65/1.0
- **事件类型分布**:
  - user_interaction: 58个 (45.7%)
  - project_update: 42个 (33.1%)
  - system_error: 15个 (11.8%)
  - general_event: 12个 (9.4%)

## 重要事件
1. **EvoMap集成成功** (重要性: 0.9)
   - 时间: 22:40
   - 内容: 成功获取10个顶级解决方案

2. **记忆系统改进设计** (重要性: 0.8)
   - 时间: 22:45
   - 内容: 设计了三层记忆架构

## 趋势分析
- **用户交互高峰**: 10:00-12:00, 20:00-22:00
- **系统错误减少**: 比昨天减少30%
- **项目进展稳定**: 平均每天3个重要更新
```

## 预期效果

### 改进前 vs 改进后

| 指标 | 改进前 | 改进后 |
|------|--------|--------|
| **摘要质量** | ❌ 手动、不一致 | ✅ 自动、高质量 |
| **分析深度** | ❌ 表面分析 | ✅ 深度趋势分析 |
| **提醒及时性** | ❌ 手动提醒 | ✅ 自动智能提醒 |
| **用户洞察** | ❌ 有限洞察 | ✅ 深度用户洞察 |

### 具体收益
1. **效率提升** - 自动生成摘要，节省时间
2. **洞察提升** - 深度分析事件模式和趋势
3. **及时性提升** - 自动提醒重要事件
4. **一致性提升** - 标准化的摘要格式

## 下一步行动

### 立即行动
1. ✅ 设计智能摘要系统架构
2. 🚀 开始实施阶段2.1
3. 🔧 创建基础目录结构

### 短期目标
1. 实现基础摘要生成
2. 测试摘要系统
3. 集成到现有记忆系统

### 长期目标
1. 实现完整的智能分析
2. 集成到所有会话中
3. 提供用户自定义配置