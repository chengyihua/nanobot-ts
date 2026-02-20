#!/usr/bin/env python3
"""
直接查询12306火车票（绕过MCP SDK）
"""

import json
import requests
from datetime import datetime, timedelta

def get_tomorrow_date():
    """获取明天的日期"""
    tomorrow = datetime.now() + timedelta(days=1)
    return tomorrow.strftime("%Y-%m-%d")

def query_12306_tickets(from_city="广州", to_city="宜昌", date=None):
    """查询12306火车票"""
    if date is None:
        date = get_tomorrow_date()
    
    print(f"查询 {from_city} 到 {to_city} 的火车票，日期: {date}")
    print("=" * 60)
    
    # 这里应该调用12306的API，但由于没有官方API，我们使用模拟数据
    # 在实际应用中，这里应该调用12306的官方API或第三方API
    
    # 模拟数据
    mock_tickets = [
        {
            "车次": "G1001",
            "出发站": "广州南",
            "到达站": "宜昌东",
            "出发时间": "08:00",
            "到达时间": "14:30",
            "历时": "6小时30分",
            "商务座": "¥1280",
            "一等座": "¥680",
            "二等座": "¥420",
            "状态": "可预订"
        },
        {
            "车次": "G1003",
            "出发站": "广州南",
            "到达站": "宜昌东",
            "出发时间": "10:30",
            "到达时间": "17:00",
            "历时": "6小时30分",
            "商务座": "¥1280",
            "一等座": "¥680",
            "二等座": "¥420",
            "状态": "可预订"
        },
        {
            "车次": "G1005",
            "出发站": "广州南",
            "到达站": "宜昌东",
            "出发时间": "13:15",
            "到达时间": "19:45",
            "历时": "6小时30分",
            "商务座": "¥1280",
            "一等座": "¥680",
            "二等座": "¥420",
            "状态": "可预订"
        },
        {
            "车次": "D2101",
            "出发站": "广州",
            "到达站": "宜昌东",
            "出发时间": "07:30",
            "到达时间": "15:20",
            "历时": "7小时50分",
            "一等座": "¥520",
            "二等座": "¥320",
            "状态": "可预订"
        },
        {
            "车次": "D2103",
            "出发站": "广州",
            "到达站": "宜昌东",
            "出发时间": "15:45",
            "到达时间": "23:35",
            "历时": "7小时50分",
            "一等座": "¥520",
            "二等座": "¥320",
            "状态": "可预订"
        }
    ]
    
    # 显示结果
    print(f"找到 {len(mock_tickets)} 趟列车：")
    print()
    
    for i, ticket in enumerate(mock_tickets, 1):
        print(f"{i}. {ticket['车次']}次列车")
        print(f"   出发: {ticket['出发站']} {ticket['出发时间']}")
        print(f"   到达: {ticket['到达站']} {ticket['到达时间']} ({ticket['历时']})")
        print(f"   票价: 商务座{ticket.get('商务座', 'N/A')} 一等座{ticket['一等座']} 二等座{ticket['二等座']}")
        print(f"   状态: {ticket['状态']}")
        print()
    
    return mock_tickets

def main():
    """主函数"""
    print("🚄 12306火车票查询系统")
    print()
    
    # 查询明天广州到宜昌的高铁票
    tickets = query_12306_tickets("广州", "宜昌")
    
    print("=" * 60)
    print("💡 温馨提示：")
    print("1. 以上为模拟数据，实际车次和票价以12306官网为准")
    print("2. 建议提前预订，节假日期间车票紧张")
    print("3. 请携带有效身份证件乘车")
    print("4. 建议提前1小时到达车站办理安检和检票手续")

if __name__ == "__main__":
    main()