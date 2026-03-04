#!/usr/bin/env python3
"""
智能摘要定时任务脚本
每小时和每日自动生成摘要
"""

import os
import sys
import subprocess
from datetime import datetime

def run_summary(mode="hourly"):
    """运行摘要生成"""
    workspace = "/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace"
    os.chdir(workspace)
    
    # 创建日志目录
    log_dir = "logs"
    os.makedirs(log_dir, exist_ok=True)
    
    today = datetime.now().strftime("%Y-%m-%d")
    log_file = os.path.join(log_dir, f"summary_{today}.log")
    
    with open(log_file, "a", encoding="utf-8") as log:
        log.write(f"\n{'='*50}\n")
        log.write(f"智能摘要生成 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        log.write(f"模式: {mode}\n")
        log.write(f"{'='*50}\n")
        
        try:
            # 检查事件文件
            if not os.path.exists("RECENT_EVENTS.md"):
                log.write("❌ 错误: RECENT_EVENTS.md 文件不存在\n")
                return False
            
            # 统计事件数量
            with open("RECENT_EVENTS.md", "r", encoding="utf-8") as f:
                content = f.read()
                event_count = content.count("## [")
            
            log.write(f"📊 事件统计: 找到 {event_count} 个事件\n")
            
            # 运行智能摘要脚本
            cmd = ["python3", "intelligent_summary.py"]
            if mode == "daily":
                cmd.append("daily")
            
            result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
            
            log.write("📝 脚本输出:\n")
            log.write(result.stdout)
            if result.stderr:
                log.write("⚠️ 错误输出:\n")
                log.write(result.stderr)
            
            # 检查生成的文件
            log.write("\n📁 生成的文件:\n")
            
            # 检查每小时目录
            hourly_dir = "memory/hourly"
            if os.path.exists(hourly_dir):
                files = os.listdir(hourly_dir)
                if files:
                    latest_hourly = sorted(files)[-1]
                    log.write(f"  每小时摘要: {hourly_dir}/{latest_hourly}\n")
            
            # 检查每日目录
            daily_dir = "memory/daily"
            if os.path.exists(daily_dir):
                files = os.listdir(daily_dir)
                if files:
                    latest_daily = sorted(files)[-1]
                    log.write(f"  每日摘要: {daily_dir}/{latest_daily}\n")
            
            log.write(f"✅ {mode}摘要生成完成\n")
            return True
            
        except Exception as e:
            log.write(f"❌ 异常错误: {str(e)}\n")
            return False

def main():
    """主函数"""
    current_hour = datetime.now().hour
    
    # 每小时都生成每小时摘要
    print(f"🕐 生成每小时摘要 (时间: {current_hour}:00)")
    run_summary("hourly")
    
    # 如果是0点，生成每日摘要
    if current_hour == 0:
        print("📅 生成每日摘要")
        run_summary("daily")
    
    print("✅ 定时任务执行完成")

if __name__ == "__main__":
    main()