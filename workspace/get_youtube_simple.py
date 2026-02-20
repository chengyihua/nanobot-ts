#!/usr/bin/env python3
"""
简单的YouTube信息获取脚本
尝试通过HTTP请求获取基本信息
"""

import json
import re
import subprocess
import sys

def get_via_curl(video_id):
    """使用curl尝试获取页面"""
    try:
        # 尝试获取页面
        cmd = ['curl', '-s', '-L', f'https://www.youtube.com/watch?v={video_id}']
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0 and result.stdout:
            # 尝试提取标题
            title_match = re.search(r'<title>(.*?)</title>', result.stdout)
            title = title_match.group(1).replace(' - YouTube', '').strip() if title_match else None
            
            # 尝试提取描述
            desc_match = re.search(r'<meta name="description" content="(.*?)"', result.stdout)
            description = desc_match.group(1) if desc_match else None
            
            return {
                'success': True,
                'title': title,
                'description': description,
                'html_length': len(result.stdout),
                'sample_html': result.stdout[:1000] if result.stdout else None
            }
        else:
            return {
                'success': False,
                'error': f'curl失败，返回码: {result.returncode}',
                'stderr': result.stderr[:500] if result.stderr else None
            }
            
    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'error': 'curl超时'
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def get_via_wget(video_id):
    """使用wget尝试获取页面"""
    try:
        cmd = ['wget', '-q', '-O', '-', f'https://www.youtube.com/watch?v={video_id}']
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0 and result.stdout:
            return {
                'success': True,
                'output_length': len(result.stdout),
                'sample': result.stdout[:1000] if result.stdout else None
            }
        else:
            return {
                'success': False,
                'error': f'wget失败，返回码: {result.returncode}',
                'stderr': result.stderr[:500] if result.stderr else None
            }
            
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def main():
    video_id = "KFBzCUtCktk"
    
    print(f"尝试获取YouTube视频 {video_id} 的信息")
    print("=" * 50)
    
    # 方法1: 使用curl
    print("\n1. 使用curl获取页面...")
    curl_result = get_via_curl(video_id)
    
    if curl_result['success']:
        print(f"   成功! 标题: {curl_result.get('title', '未获取到')}")
        print(f"   描述长度: {len(curl_result.get('description', '')) if curl_result.get('description') else 0} 字符")
        print(f"   HTML长度: {curl_result.get('html_length', 0)} 字符")
    else:
        print(f"   失败: {curl_result.get('error', '未知错误')}")
    
    # 方法2: 使用wget
    print("\n2. 使用wget获取页面...")
    wget_result = get_via_wget(video_id)
    
    if wget_result['success']:
        print(f"   成功! 获取到 {wget_result.get('output_length', 0)} 字符")
    else:
        print(f"   失败: {wget_result.get('error', '未知错误')}")
    
    # 保存结果
    result = {
        'video_id': video_id,
        'curl_result': curl_result,
        'wget_result': wget_result,
        'summary': {
            'title': curl_result.get('title') if curl_result.get('success') else None,
            'description': curl_result.get('description') if curl_result.get('success') else None,
            'has_data': curl_result.get('success') or wget_result.get('success')
        }
    }
    
    with open(f'youtube_{video_id}_simple.json', 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    
    print(f"\n结果已保存到 youtube_{video_id}_simple.json")
    
    # 显示获取到的信息
    if result['summary']['title']:
        print(f"\n获取到的视频标题: {result['summary']['title']}")
    
    if result['summary']['description']:
        desc = result['summary']['description']
        print(f"\n获取到的视频描述 (前200字符):")
        print(desc[:200] + ('...' if len(desc) > 200 else ''))

if __name__ == "__main__":
    main()