#!/usr/bin/env python3
"""
YouTube视频信息获取脚本
尝试获取视频标题、描述、评论和章节信息
"""

import json
import subprocess
import sys
import os

def get_youtube_info(video_id):
    """
    尝试使用youtube-dl获取YouTube视频信息
    """
    try:
        # 尝试使用youtube-dl获取视频信息
        cmd = [
            'youtube-dl',
            '--skip-download',
            '--write-info-json',
            '--write-description',
            '--write-thumbnail',
            '--get-title',
            '--get-description',
            '--get-duration',
            '--get-format',
            f'https://www.youtube.com/watch?v={video_id}'
        ]
        
        print(f"尝试获取视频信息: {video_id}")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            print("成功获取视频信息")
            print("标题:", result.stdout.split('\n')[0] if result.stdout else "未获取到")
            return {
                'success': True,
                'title': result.stdout.split('\n')[0] if result.stdout else None,
                'output': result.stdout,
                'error': None
            }
        else:
            print(f"youtube-dl失败: {result.stderr}")
            return {
                'success': False,
                'error': result.stderr,
                'output': result.stdout
            }
            
    except subprocess.TimeoutExpired:
        print("获取视频信息超时")
        return {
            'success': False,
            'error': 'Timeout expired',
            'output': None
        }
    except Exception as e:
        print(f"获取视频信息时出错: {e}")
        return {
            'success': False,
            'error': str(e),
            'output': None
        }

def check_tools():
    """检查必要的工具是否可用"""
    tools = ['youtube-dl', 'curl', 'wget']
    available = {}
    
    for tool in tools:
        try:
            subprocess.run([tool, '--version'], capture_output=True, timeout=5)
            available[tool] = True
        except:
            available[tool] = False
            
    return available

def main():
    video_id = "KFBzCUtCktk"
    
    print("检查可用工具...")
    tools = check_tools()
    print("工具状态:", json.dumps(tools, indent=2))
    
    print(f"\n尝试获取视频 {video_id} 的信息...")
    info = get_youtube_info(video_id)
    
    print(f"\n结果:")
    print(json.dumps(info, indent=2, ensure_ascii=False))
    
    # 保存结果到文件
    with open(f'youtube_{video_id}_info.json', 'w', encoding='utf-8') as f:
        json.dump(info, f, indent=2, ensure_ascii=False)
    
    print(f"\n信息已保存到 youtube_{video_id}_info.json")

if __name__ == "__main__":
    main()