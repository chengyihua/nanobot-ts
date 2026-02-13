#!/usr/bin/env python3
"""
获取页面内容脚本
提取网页指定元素的内容
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional
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
                
                # 等待元素加载
                try:
                    await page.wait_for_selector(selector, timeout=5000)
                except:
                    print(f"警告: 选择器 '{selector}' 未找到或超时")
                
                # 获取所有匹配元素
                elements = await page.query_selector_all(selector)
                
                if not elements:
                    result["error"] = f"未找到匹配选择器 '{selector}' 的元素"
                    print(result["error"])
                else:
                    print(f"找到 {len(elements)} 个匹配元素")
                    
                    # 提取元素内容
                    elements_data = []
                    for i, element in enumerate(elements, 1):
                        try:
                            # 根据格式提取内容
                            if format == "html":
                                content = await element.inner_html()
                            elif format == "text":
                                content = await element.text_content()
                            else:  # json格式包含更多信息
                                content = await element.text_content()
                                
                            # 获取元素属性
                            tag_name = await element.evaluate("element => element.tagName")
                            element_id = await element.get_attribute("id")
                            classes = await element.get_attribute("class")
                            
                            element_data = {
                                "index": i,
                                "tag": tag_name.lower(),
                                "content": content.strip() if content else "",
                            }
                            
                            if element_id:
                                element_data["id"] = element_id
                            if classes:
                                element_data["class"] = classes
                            
                            elements_data.append(element_data)
                            
                        except Exception as e:
                            print(f"提取元素 {i} 时出错: {e}")
                            continue
                    
                    result["elements"] = elements_data
                    
                    # 合并所有元素内容
                    if format == "text":
                        all_text = "\n\n".join([e["content"] for e in elements_data])
                        result["content"] = all_text
                    elif format == "html":
                        all_html = "\n\n".join([e["content"] for e in elements_data])
                        result["content"] = all_html
                    else:  # json
                        result["content"] = json.dumps(elements_data, ensure_ascii=False, indent=2)
            
            else:
                # 获取整个页面内容
                print("获取整个页面内容...")
                if format == "html":
                    result["content"] = await page.content()
                elif format == "text":
                    # 获取页面文本内容
                    result["content"] = await page.evaluate("""
                        () => {
                            // 移除脚本和样式
                            const scripts = document.querySelectorAll('script, style, noscript');
                            scripts.forEach(el => el.remove());
                            
                            // 获取文本内容
                            return document.body.innerText;
                        }
                    """)
                else:  # json格式的基本信息
                    page_info = {
                        "title": result["title"],
                        "url": result["url"],
                        "content_length": len(await page.content()),
                    }
                    result["content"] = json.dumps(page_info, ensure_ascii=False, indent=2)
            
            # 关闭浏览器
            await context.close()
            await browser.close()
            
            result["success"] = True
            print(f"成功获取内容，长度: {len(result['content'])} 字符")
            
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
    parser = argparse.ArgumentParser(description="获取网页内容")
    parser.add_argument("--url", required=True, help="要访问的URL")
    parser.add_argument("--selector", help="CSS选择器（可选）")
    parser.add_argument("--format", default="text", 
                       choices=["text", "html", "json"],
                       help="输出格式（默认: text）")
    parser.add_argument("--browser", default="chromium", 
                       choices=["chromium", "firefox", "webkit"],
                       help="浏览器类型（默认: chromium）")
    parser.add_argument("--headless", action="store_true", 
                       help="无头模式（不显示浏览器窗口）")
    parser.add_argument("--no-headless", dest="headless", action="store_false",
                       help="显示浏览器窗口")
    parser.add_argument("--wait", type=float, default=3.0,
                       help="等待时间（秒，默认: 3）")
    parser.add_argument("--timeout", type=int, default=30000,
                       help="超时时间（毫秒，默认: 30000）")
    parser.add_argument("--output", help="内容输出文件")
    
    # 设置默认值
    parser.set_defaults(headless=True)
    
    args = parser.parse_args()
    
    # 运行异步函数
    result = asyncio.run(
        get_content(
            url=args.url,
            selector=args.selector,
            browser_type=args.browser,
            headless=args.headless,
            wait_time=args.wait,
            timeout=args.timeout,
            format=args.format,
        )
    )
    
    # 输出结果
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