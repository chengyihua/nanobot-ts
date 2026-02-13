#!/usr/bin/env python3
"""
打开网页脚本
使用Playwright打开指定URL，支持截图和内容提取
"""

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Optional, Dict, Any
try:
    from .browser_utils import launch_browser
except ImportError:
    # 兼容直接运行脚本
    sys.path.append(os.path.dirname(__file__))
    from browser_utils import launch_browser

# 添加技能目录到Python路径
skill_dir = Path(__file__).parent.parent
sys.path.insert(0, str(skill_dir.parent.parent))

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("错误：未安装Playwright，请运行：pip install playwright")
    print("然后安装浏览器：playwright install chromium")
    sys.exit(1)


async def open_url(
    url: str,
    browser_type: str = "chromium",
    headless: bool = True,
    screenshot: Optional[str] = None,
    wait_time: float = 3.0,
    viewport: Optional[Dict[str, int]] = None,
    user_agent: Optional[str] = None,
    timeout: int = 30000,
) -> Dict[str, Any]:
    """
    打开网页并执行操作
    
    Args:
        url: 要访问的URL
        browser_type: 浏览器类型（chromium, firefox, webkit）
        headless: 是否无头模式
        screenshot: 截图保存路径（可选）
        wait_time: 等待时间（秒）
        viewport: 视口大小，如{"width": 1280, "height": 720}
        user_agent: 用户代理字符串
        timeout: 超时时间（毫秒）
    
    Returns:
        包含操作结果的字典
    """
    result = {
        "success": False,
        "url": url,
        "title": "",
        "screenshot": screenshot if screenshot else None,
        "error": None,
    }
    
    async with async_playwright() as p:
        try:
            # 启动浏览器
            browser = await launch_browser(p, browser_type, headless)
            
            # 创建上下文
            context_options = {"viewport": viewport or {"width": 1280, "height": 720}}
            if user_agent:
                context_options["user_agent"] = user_agent
            
            context = await browser.new_context(**context_options)
            
            # 创建页面
            page = await context.new_page()
            page.set_default_timeout(timeout)
            
            # 访问URL
            print(f"正在访问: {url}")
            response = await page.goto(url, wait_until="networkidle")
            
            if response and response.status >= 400:
                result["error"] = f"HTTP错误: {response.status}"
                print(f"警告: {result['error']}")
            
            # 等待指定时间
            if wait_time > 0:
                await asyncio.sleep(wait_time)
            
            # 获取页面信息
            result["title"] = await page.title()
            result["url"] = page.url  # 实际URL（可能重定向）
            
            # 截图
            if screenshot:
                screenshot_path = Path(screenshot)
                screenshot_path.parent.mkdir(parents=True, exist_ok=True)
                await page.screenshot(path=str(screenshot_path), full_page=True)
                print(f"截图已保存: {screenshot_path}")
            
            # 获取页面内容（前1000字符）
            content = await page.content()
            result["content_preview"] = content[:1000] + "..." if len(content) > 1000 else content
            
            # 关闭浏览器
            await context.close()
            await browser.close()
            
            result["success"] = True
            print(f"成功访问: {result['title']}")
            
        except Exception as e:
            result["error"] = str(e)
            print(f"错误: {e}")
            
            # 确保浏览器关闭
            try:
                if 'browser' in locals():
                    await browser.close()
            except:
                pass
    
    return result


def main():
    """命令行入口点"""
    parser = argparse.ArgumentParser(description="打开网页并执行操作")
    parser.add_argument("--url", required=True, help="要访问的URL")
    parser.add_argument("--browser", default="chromium", 
                       choices=["chromium", "firefox", "webkit"],
                       help="浏览器类型（默认: chromium）")
    parser.add_argument("--headless", action="store_true", 
                       help="无头模式（不显示浏览器窗口）")
    parser.add_argument("--no-headless", dest="headless", action="store_false",
                       help="显示浏览器窗口")
    parser.add_argument("--screenshot", help="截图保存路径（可选）")
    parser.add_argument("--wait", type=float, default=3.0,
                       help="等待时间（秒，默认: 3）")
    parser.add_argument("--width", type=int, default=1280,
                       help="视口宽度（默认: 1280）")
    parser.add_argument("--height", type=int, default=720,
                       help="视口高度（默认: 720）")
    parser.add_argument("--timeout", type=int, default=30000,
                       help="超时时间（毫秒，默认: 30000）")
    parser.add_argument("--output", help="结果输出文件（JSON格式）")
    
    # 设置默认值
    parser.set_defaults(headless=True)
    
    args = parser.parse_args()
    
    # 准备参数
    viewport = {"width": args.width, "height": args.height}
    
    # 运行异步函数
    result = asyncio.run(
        open_url(
            url=args.url,
            browser_type=args.browser,
            headless=args.headless,
            screenshot=args.screenshot,
            wait_time=args.wait,
            viewport=viewport,
            timeout=args.timeout,
        )
    )
    
    # 输出结果
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"结果已保存: {output_path}")
    else:
        print("\n" + "="*50)
        print("操作结果:")
        print(f"  成功: {result['success']}")
        print(f"  标题: {result['title']}")
        print(f"  URL: {result['url']}")
        if result['screenshot']:
            print(f"  截图: {result['screenshot']}")
        if result.get('content_preview'):
            print(f"  内容预览: {result['content_preview'][:200]}...")
        if result['error']:
            print(f"  错误: {result['error']}")
        print("="*50)
    
    # 返回退出码
    sys.exit(0 if result['success'] else 1)


if __name__ == "__main__":
    main()