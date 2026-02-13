#!/usr/bin/env python3
"""
高级截图脚本
支持定时截图、连续截图、应用程序截图等高级功能
"""

import subprocess
import time
import os
import sys
import argparse
import datetime
from typing import List, Optional

class ScreenshotManager:
    """截图管理器"""
    
    def __init__(self, output_base_dir="~/Desktop/Screenshots"):
        """
        初始化截图管理器
        
        Args:
            output_base_dir: 基础输出目录
        """
        self.output_base_dir = os.path.expanduser(output_base_dir)
        self.screenshot_count = 0
        self.session_id = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # 创建会话目录
        self.session_dir = os.path.join(self.output_base_dir, self.session_id)
        os.makedirs(self.session_dir, exist_ok=True)
        
        print(f"截图会话: {self.session_id}")
        print(f"输出目录: {self.session_dir}")
    
    def take_screenshot(self, screenshot_type="full", custom_name=None, delay=0) -> Optional[str]:
        """
        基础截图方法
        
        Args:
            screenshot_type: 截图类型 full/area/window/active_window/clipboard
            custom_name: 自定义文件名（不含扩展名）
            delay: 延迟秒数
        
        Returns:
            截图文件路径或"clipboard"
        """
        if delay > 0:
            print(f"等待 {delay} 秒...")
            time.sleep(delay)
        
        self.screenshot_count += 1
        
        # 生成文件名
        if custom_name:
            filename = f"{custom_name}.png"
        else:
            timestamp = datetime.datetime.now().strftime("%H%M%S")
            filename = f"screenshot_{self.screenshot_count:03d}_{timestamp}.png"
        
        output_path = os.path.join(self.session_dir, filename)
        
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
            print(f"截图 #{self.screenshot_count} 已保存到剪贴板")
            return "clipboard"
        
        # 添加输出路径
        cmd.append(output_path)
        
        # 执行命令
        try:
            print(f"截图 #{self.screenshot_count}: {screenshot_type}...")
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                print(f"截图失败: {result.stderr}")
                return None
            
            # 验证文件
            if os.path.exists(output_path):
                file_size = os.path.getsize(output_path) / 1024  # KB
                print(f"✓ 已保存: {filename} ({file_size:.1f} KB)")
                return output_path
            else:
                print(f"✗ 文件未创建: {output_path}")
                return None
                
        except Exception as e:
            print(f"截图出错: {e}")
            return None
    
    def timed_screenshot(self, delay_seconds=5, screenshot_type="full", custom_name=None) -> Optional[str]:
        """
        定时截图
        
        Args:
            delay_seconds: 延迟秒数
            screenshot_type: 截图类型
            custom_name: 自定义文件名
        
        Returns:
            截图文件路径
        """
        print(f"定时截图: {delay_seconds}秒后...")
        return self.take_screenshot(screenshot_type, custom_name, delay_seconds)
    
    def multiple_screenshots(self, count=3, interval=2, screenshot_type="full", 
                           base_name=None) -> List[str]:
        """
        连续多次截图
        
        Args:
            count: 截图次数
            interval: 间隔秒数
            screenshot_type: 截图类型
            base_name: 基础文件名
        
        Returns:
            截图文件路径列表
        """
        screenshots = []
        
        for i in range(count):
            print(f"\n截图 {i+1}/{count}:")
            
            if base_name:
                custom_name = f"{base_name}_{i+1:03d}"
            else:
                custom_name = None
            
            path = self.take_screenshot(screenshot_type, custom_name)
            if path:
                screenshots.append(path)
            
            # 如果不是最后一次，等待间隔
            if i < count - 1 and interval > 0:
                print(f"等待 {interval} 秒...")
                time.sleep(interval)
        
        print(f"\n完成! 共截图 {len(screenshots)} 张")
        return screenshots
    
    def screenshot_application(self, app_name, delay=2, screenshot_type="active_window") -> Optional[str]:
        """
        截图特定应用程序
        
        Args:
            app_name: 应用程序名称（如"Safari", "Chrome"）
            delay: 激活后的延迟秒数
            screenshot_type: 截图类型
        
        Returns:
            截图文件路径
        """
        print(f"激活应用程序: {app_name}...")
        
        # 激活应用程序
        activate_cmd = f"""
        osascript -e 'tell application "{app_name}" to activate'
        """
        
        try:
            subprocess.run(activate_cmd, shell=True, capture_output=True)
            print(f"等待 {delay} 秒让应用程序准备...")
            time.sleep(delay)
            
            # 截图
            custom_name = f"{app_name.lower()}_{datetime.datetime.now().strftime('%H%M%S')}"
            return self.take_screenshot(screenshot_type, custom_name)
            
        except Exception as e:
            print(f"激活应用程序失败: {e}")
            return None
    
    def screenshot_with_options(self, options=None) -> Optional[str]:
        """
        使用高级选项截图
        
        Args:
            options: 选项字典，可包含:
                - type: 截图类型
                - delay: 延迟秒数
                - no_shadow: 是否去掉阴影
                - silent: 是否静音
                - format: 输出格式
                - open_preview: 是否在预览中打开
        
        Returns:
            截图文件路径
        """
        if options is None:
            options = {}
        
        screenshot_type = options.get("type", "full")
        delay = options.get("delay", 0)
        custom_name = options.get("custom_name")
        
        # 如果有延迟，先等待
        if delay > 0:
            print(f"延迟 {delay} 秒...")
            time.sleep(delay)
        
        self.screenshot_count += 1
        
        # 生成文件名
        if custom_name:
            filename = f"{custom_name}.png"
        else:
            timestamp = datetime.datetime.now().strftime("%H%M%S")
            filename = f"advanced_{self.screenshot_count:03d}_{timestamp}.png"
        
        output_path = os.path.join(self.session_dir, filename)
        
        # 构建命令
        cmd = ["screencapture"]
        
        # 添加选项
        if options.get("no_shadow"):
            cmd.append("-o")
        
        if options.get("silent"):
            cmd.append("-x")
        
        if options.get("open_preview"):
            cmd.append("-P")
        
        # 截图类型
        if screenshot_type == "area":
            cmd.append("-i")
        elif screenshot_type == "window":
            cmd.append("-w")
        elif screenshot_type == "active_window":
            cmd.append("-W")
        
        # 输出格式
        output_format = options.get("format", "png")
        if output_format != "png":
            cmd.extend(["-t", output_format])
            # 更新文件扩展名
            output_path = os.path.splitext(output_path)[0] + f".{output_format}"
        
        # 添加输出路径
        cmd.append(output_path)
        
        # 执行命令
        try:
            print(f"高级截图 #{self.screenshot_count}...")
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                print(f"截图失败: {result.stderr}")
                return None
            
            if os.path.exists(output_path):
                file_size = os.path.getsize(output_path) / 1024
                print(f"✓ 高级截图已保存: {os.path.basename(output_path)} ({file_size:.1f} KB)")
                return output_path
            else:
                return None
                
        except Exception as e:
            print(f"高级截图出错: {e}")
            return None
    
    def get_session_info(self) -> dict:
        """获取会话信息"""
        session_files = []
        total_size = 0
        
        if os.path.exists(self.session_dir):
            for file in os.listdir(self.session_dir):
                filepath = os.path.join(self.session_dir, file)
                if os.path.isfile(filepath):
                    session_files.append(file)
                    total_size += os.path.getsize(filepath)
        
        return {
            "session_id": self.session_id,
            "session_dir": self.session_dir,
            "file_count": len(session_files),
            "total_size_kb": total_size / 1024,
            "files": session_files
        }

def main():
    """主函数"""
    parser = argparse.ArgumentParser(description="高级截图工具")
    parser.add_argument("--type", choices=["full", "area", "window", "active_window"], 
                       default="full", help="截图类型")
    parser.add_argument("--output-dir", default="~/Desktop/Screenshots", help="输出目录")
    parser.add_argument("--count", type=int, default=1, help="截图次数")
    parser.add_argument("--interval", type=int, default=2, help="截图间隔（秒）")
    parser.add_argument("--delay", type=int, default=0, help="首次延迟（秒）")
    parser.add_argument("--app", help="截图特定应用程序")
    parser.add_argument("--base-name", help="基础文件名")
    parser.add_argument("--info", action="store_true", help="显示会话信息")
    
    args = parser.parse_args()
    
    # 创建截图管理器
    manager = ScreenshotManager(args.output_dir)
    
    if args.info:
        info = manager.get_session_info()
        print(f"\n会话信息:")
        print(f"  会话ID: {info['session_id']}")
        print(f"  目录: {info['session_dir']}")
        print(f"  文件数: {info['file_count']}")
        print(f"  总大小: {info['total_size_kb']:.1f} KB")
        
        if info['files']:
            print(f"\n文件列表:")
            for file in info['files']:
                print(f"  - {file}")
        return
    
    # 截图特定应用程序
    if args.app:
        result = manager.screenshot_application(args.app, args.delay, args.type)
        if result:
            print(f"应用程序截图完成: {result}")
        else:
            print("应用程序截图失败")
        return
    
    # 多次截图
    if args.count > 1:
        screenshots = manager.multiple_screenshots(
            count=args.count,
            interval=args.interval,
            screenshot_type=args.type,
            base_name=args.base_name
        )
        
        if screenshots:
            print(f"\n完成! 共截图 {len(screenshots)} 张:")
            for i, path in enumerate(screenshots, 1):
                print(f"{i:2d}. {os.path.basename(path)}")
        else:
            print("截图失败")
    
    # 单次截图
    else:
        if args.delay > 0:
            result = manager.timed_screenshot(args.delay, args.type, args.base_name)
        else:
            result = manager.take_screenshot(args.type, args.base_name)
        
        if result:
            print(f"截图完成: {result}")
        else:
            print("截图失败")

if __name__ == "__main__":
    main()