#!/usr/bin/env python3
"""
获取页面内容脚本
提取网页指定元素的内容
"""

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional

# 添加当前目录到Python路径
sys.path.append(os.path.dirname(__file__))

try:
    from browser_utils import launch_browser
except ImportError:
    print("错误：无法导入browser_utils，请确保browser_utils.py在同一目录")
    sys.exit(1)

# 添加技能目录到Python路径
skill_dir = Path(__file__).parent.parent
sys.path.insert(0, str(skill_dir.parent.parent))

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("错误：未安装Playwright，请运行：pip install playwright")
    print("然后安装浏览器：playwright install chromium")
    sys.exit(1)


async def get_content(
    url: str,
    selector: Optional[str] = None,
    browser_type: str = "chromium",
    headless: bool = True,
    wait_time: float = 3.0,
    timeout: int = 30000,
    format: str = "text",
) -> Dict[str, Any]:
    """
    获取网页内容
    
    Args:
        url: 要访问的URL
        selector: CSS选择器（可选，如不指定则获取整个页面）
        browser_type: 浏览器类型
        headless: 是否无头模式
        wait_time: 等待时间（秒）
        timeout: 超时时间（毫秒）
        format: 输出格式（text, html, json）
    
    Returns:
        包含页面内容的字典
    """
    result = {
        "success": False,
        "url": url,
        "title": "",
        "selector": selector,
        "content": "",
        "elements": [],
        "error": None,
    }
    
    async with async_playwright() as p:
        try:
            # 启动浏览器
            browser = await launch_browser(p, browser_type, headless)
            context = await browser.new_context(
                viewport={"width": 1280, "height": 720}
            )
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
            result["url"] = page.url  # 实际URL
            
            # 根据选择器获取内容
            if selector:
                print(f"使用选择器: {selector}")
                elements = await page.query_selector_all(selector)
                
                if not elements:
                    result["error"] = f"未找到匹配选择器 '{selector}' 的元素"
                    print(f"警告: {result['error']}")
                else:
                    result["elements"] = []
                    for i, element in enumerate(elements):
                        element_data = {
                            "index": i,
                            "text": await element.text_content() or "",
                            "html": await element.inner_html() or "",
                        }
                        result["elements"].append(element_data)
                    
                    # 将所有元素的文本合并
                    all_text = []
                    for element_data in result["elements"]:
                        if element_data["text"].strip():
                            all_text.append(element_data["text"].strip())
                    
                    result["content"] = "\n\n".join(all_text)
                    result["success"] = True
            else:
                # 获取整个页面内容
                if format == "html":
                    result["content"] = await page.content()
                else:
                    # 获取文本内容
                    result["content"] = await page.evaluate("() => document.body.textContent") or ""
                
                result["success"] = True
            
            # 关闭浏览器
            await browser.close()
            
        except Exception as e:
            result["error"] = str(e)
            print(f"错误: {result['error']}")
            try:
                if 'browser' in locals():
                    await browser.close()
            except:
                pass
    
    return result


def main():
    parser = argparse.ArgumentParser(description="获取网页内容")
    parser.add_argument("--url", required=True, help="要访问的URL")
    parser.add_argument("--selector", help="CSS选择器（可选）")
    parser.add_argument("--format", choices=["text", "html", "json"], default="text", help="输出格式")
    parser.add_argument("--output", help="输出文件路径（可选）")
    parser.add_argument("--headless", action="store_true", default=True, help="无头模式（默认）")
    parser.add_argument("--no-headless", dest="headless", action="store_false", help="非无头模式")
    parser.add_argument("--wait", type=float, default=3.0, help="等待时间（秒）")
    parser.add_argument("--timeout", type=int, default=30000, help="超时时间（毫秒）")
    
    args = parser.parse_args()
    
    # 运行异步函数
    result = asyncio.run(get_content(
        url=args.url,
        selector=args.selector,
        headless=args.headless,
        wait_time=args.wait,
        timeout=args.timeout,
        format=args.format,
    ))
    
    # 保存到文件
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        if args.format == "json":
            # 保存完整结果
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
        else:
            # 只保存内容
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(result["content"])
        
        print(f"内容已保存: {output_path}")
    
    # 显示摘要
    print("\n" + "="*60)
    print(f"页面内容提取结果:")
    print(f"  成功: {result['success']}")
    print(f"  标题: {result['title']}")
    print(f"  URL: {result['url']}")
    
    if args.selector:
        print(f"  选择器: {args.selector}")
        print(f"  找到元素: {len(result['elements'])} 个")
    
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
    
    # 返回退出码
    sys.exit(0 if result['success'] else 1)


if __name__ == "__main__":
    main()