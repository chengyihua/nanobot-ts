#!/usr/bin/env python3
import requests
import json
from datetime import datetime, timedelta

def query_tickets():
    # 获取明天日期
    tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
    print(f"查询日期: {tomorrow}")
    
    # 广州南站到宜昌东站
    from_station = "GZS"  # 广州南站
    to_station = "YCO"    # 宜昌东站
    
    # 12306查询API（这是一个示例，实际API可能不同）
    url = f"https://kyfw.12306.cn/otn/leftTicket/query"
    
    params = {
        'leftTicketDTO.train_date': tomorrow,
        'leftTicketDTO.from_station': from_station,
        'leftTicketDTO.to_station': to_station,
        'purpose_codes': 'ADULT'
    }
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://kyfw.12306.cn/otn/leftTicket/init'
    }
    
    try:
        print(f"查询 {from_station} -> {to_station} 的车票...")
        response = requests.get(url, params=params, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('status') and data.get('data'):
                trains = data['data']['result']
                print(f"找到 {len(trains)} 趟列车:")
                
                for train in trains[:10]:  # 只显示前10趟
                    info = train.split('|')
                    if len(info) > 30:
                        train_no = info[3]  # 车次
                        from_time = info[8]  # 出发时间
                        to_time = info[9]    # 到达时间
                        duration = info[10]  # 历时
                        
                        # 座位信息
                        business_seat = info[32] or '--'  # 商务座
                        first_seat = info[31] or '--'     # 一等座
                        second_seat = info[30] or '--'    # 二等座
                        
                        print(f"{train_no}: {from_time} → {to_time} ({duration}) | 商务:{business_seat} 一等:{first_seat} 二等:{second_seat}")
            else:
                print("未找到车次信息")
        else:
            print(f"查询失败，状态码: {response.status_code}")
            
    except Exception as e:
        print(f"查询出错: {e}")
        print("\n由于12306 API需要验证，建议您:")
        print("1. 直接访问12306官网: https://www.12306.cn")
        print("2. 使用12306官方APP")
        print("3. 或使用已配置的12306-mcp工具（需要Claude Desktop）")

if __name__ == "__main__":
    query_tickets()