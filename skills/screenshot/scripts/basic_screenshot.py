#!/usr/bin/env python3
"""
基础截图脚本
支持全屏、区域、窗口三种截图模式
"""

import subprocess
import datetime
import os
import sys
import argparse

def take_screenshot(screenshot_type="full", output_dir="~/Desktop", filename=None):
    """
    截图函数
    
    Args:
        screenshot_type: 截图类型，可选值：full(全屏), area(区域), window(窗口)
        output_dir: 输出目录，默认为桌面
        filename: 文件名，如果为None则自动生成时间戳文件名
    
    Returns:
        str: 截图文件的完整路径
    """
    # 展开用户目录
    output_dir = os.path.expanduser(output_dir)
    
    # 确保目录存在
    os.makedirs(output_dir, exist_ok=True)
    
    # 生成文件名
    if filename is None:
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"screenshot_{timestamp}.png"
    
    output_path = os.path.join(output_dir, filename)
    
    # 构建命令
    cmd = ["screencapture"]
    
    # 添加参数
    if screenshot_type == "area":
        cmd.append("-i")  # 交互式区域选择
    elif screenshot_type == "window":
        cmd.append("-w")  # 窗口截图
    elif screenshot_type == "active_window":
        cmd.append("-W")  # 当前活动窗口
    elif screenshot_type == "clipboard":
        cmd.append("-c")  # 截图到剪贴板
        print("截图已保存到剪贴板")
        return "clipboard"
    elif screenshot_type != "full":
        print(f"警告：未知的截图类型 '{screenshot_type}'，使用全屏截图")
    
    # 如果不是剪贴板模式，添加输出路径
    if screenshot_type != "clipboard":
        cmd.append(output_path)
    
    # 执行命令
    try:
        print(f"正在截图... 类型: {screenshot_type}")
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"截图失败: {result.stderr}")
            return None
        
        if screenshot_type != "clipboard":
            print(f"截图已保存: {output_path}")
            
            # 获取文件信息
            if os.path.exists(output_path):
                file_size = os.path.getsize(output_path) / 1024  # KB
                print(f"文件大小: {file_size:.1f} KB")
            
            return output_path
        else:
            return "clipboard"
            
    except Exception as e:
        print(f"截图出错: {e}")
        return None

def list_recent_screenshots(directory="~/Desktop", limit=10):
    """
    列出最近的截图文件
    
    Args:
        directory: 目录路径
        limit: 显示数量限制
    
    Returns:
        list: 截图文件列表
    """
    directory = os.path.expanduser(directory)
    
    if not os.path.exists(directory):
        print(f"目录不存在: {directory}")
        return []
    
    # 查找PNG、JPG、PDF文件
    screenshot_files = []
    for ext in ['*.png', '*.jpg', '*.jpeg', '*.pdf']:
        screenshot_files.extend(
            sorted(
                [os.path.join(directory, f) for f in os.listdir(directory) if f.lower().endswith(ext[1:])],
                key=os.path.getmtime,
                reverse=True
            )
        )
    
    # 限制数量
    screenshot_files = screenshot_files[:limit]
    
    if screenshot_files:
        print(f"\n最近 {len(screenshot_files)} 个截图文件:")
        for i, filepath in enumerate(screenshot_files, 1):
            filename = os.path.basename(filepath)
            mtime = datetime.datetime.fromtimestamp(os.path.getmtime(filepath))
            size = os.path.getsize(filepath) / 1024
            print(f"{i:2d}. {filename} ({mtime.strftime('%Y-%m-%d %H:%M:%S')}, {size:.1f} KB)")
    else:
        print("未找到截图文件")
    
    return screenshot_files

def main():
    """主函数"""
    parser = argparse.ArgumentParser(description="macOS截图工具")
    parser.add_argument("--type", choices=["full", "area", "window", "active_window", "clipboard"], 
                       default="full", help="截图类型")
    parser.add_argument("--output-dir", default="~/Desktop", help="输出目录")
    parser.add_argument("--filename", help="自定义文件名")
    parser.add_argument("--list", action="store_true", help="列出最近的截图")
    parser.add_argument("--list-dir", default="~/Desktop", help="列出指定目录的截图")
    parser.add_argument("--list-limit", type=int, default=10, help="列出数量限制")
    
    args = parser.parse_args()
    
    if args.list:
        list_recent_screenshots(args.list_dir, args.list_limit)
    else:
        result = take_screenshot(args.type, args.output_dir, args.filename)
        
        if result is None:
            sys.exit(1)
        elif result == "clipboard":
            print("✓ 截图已保存到剪贴板")
        else:
            print(f"✓ 截图成功: {result}")

if __name__ == "__main__":
    main()