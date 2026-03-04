#!/usr/bin/env python3
"""
简化版获取页面内容脚本
"""

import asyncio
import sys
import os

# 添加当前目录到Python路径
sys.path.append(os.path.dirname(__file__))

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("错误：未安装Playwright，请运行：pip install playwright")
    print("然后安装浏览器：playwright install chromium")
    sys.exit(1)


async def get_page_content(url: str):
    """获取网页内容"""
    async with async_playwright() as p:
        try:
            # 启动浏览器
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport={"width": 1280, "height": 720}
            )
            page = await context.new_page()
            page.set_default_timeout(30000)
            
            # 访问URL
            print(f"正在访问: {url}")
            response = await page.goto(url, wait_until="networkidle")
            
            if response and response.status >= 400:
                print(f"警告: HTTP错误: {response.status}")
            
            # 等待3秒
            await asyncio.sleep(3)
            
            # 获取页面信息
            title = await page.title()
            current_url = page.url
            
            # 获取页面内容
            content = await page.evaluate("() => document.body.innerText")
            
            # 关闭浏览器
            await browser.close()
            
            return {
                "success": True,
                "title": title,
                "url": current_url,
                "content": content or "",
                "error": None
            }
            
        except Exception as e:
            print(f"错误: {e}")
            try:
                if 'browser' in locals():
                    await browser.close()
            except:
                pass
            
            return {
                "success": False,
                "title": "",
                "url": url,
                "content": "",
                "error": str(e)
            }


def main():
    if len(sys.argv) < 2:
        print("用法: python get_content_simple.py <URL>")
        sys.exit(1)
    
    url = sys.argv[1]
    result = asyncio.run(get_page_content(url))
    
    print("\n" + "="*60)
    print(f"页面内容提取结果:")
    print(f"  成功: {result['success']}")
    print(f"  标题: {result['title']}")
    print(f"  URL: {result['url']}")
    print(f"  内容长度: {len(result['content'])} 字符")
    
    if result['error']:
        print(f"  错误: {result['error']}")
    
    # 显示内容预览
    if result['content']:
        print("\n内容预览:")
        print("-" * 40)
        preview = result['content'][:500]
        if len(result['content']) > 500:
            preview += "..."
        print(preview)
        print("-" * 40)
    
    print("="*60)


if __name__ == "__main__":
    main()