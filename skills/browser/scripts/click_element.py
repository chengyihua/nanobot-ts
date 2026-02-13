#!/usr/bin/env python3
"""
点击元素脚本
点击网页上的指定元素
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Dict, Any, Optional

# 添加技能目录到Python路径
skill_dir = Path(__file__).parent.parent
sys.path.insert(0, str(skill_dir.parent.parent))

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("错误：未安装Playwright，请运行：pip install playwright")
    print("然后安装浏览器：playwright install chromium")
    sys.exit(1)


async def click_element(
    url: str,
    selector: str,
    browser_type: str = "chromium",
    headless: bool = True,
    wait_before: float = 1.0,
    wait_after: float = 3.0,
    timeout: int = 30000,
    screenshot: bool = True,
) -> Dict[str, Any]:
    """
    点击网页元素
    
    Args:
        url: 页面URL
        selector: 要点击的元素的CSS选择器
        browser_type: 浏览器类型
        headless: 是否无头模式
        wait_before: 点击前等待时间（秒）
        wait_after: 点击后等待时间（秒）
        timeout: 超时时间（毫秒）
        screenshot: 是否截图
    
    Returns:
        包含操作结果的字典
    """
    result = {
        "success": False,
        "url": url,
        "selector": selector,
        "clicked": False,
        "before_url": "",
        "after_url": "",
        "element_info": {},
        "error": None,
    }
    
    async with async_playwright() as p:
        try:
            # 启动浏览器
            browser = await p[browser_type].launch(headless=headless)
            context = await browser.new_context(
                viewport={"width": 1280, "height": 720}
            )
            page = await context.new_page()
            page.set_default_timeout(timeout)
            
            # 访问页面
            print(f"正在访问: {url}")
            response = await page.goto(url, wait_until="networkidle")
            
            if response and response.status >= 400:
                result["error"] = f"HTTP错误: {response.status}"
                print(f"警告: {result['error']}")
            
            # 点击前等待
            if wait_before > 0:
                print(f"点击前等待 {wait_before} 秒...")
                await asyncio.sleep(wait_before)
            
            # 记录点击前状态
            result["before_url"] = page.url
            result["before_title"] = await page.title()
            
            # 查找元素
            print(f"查找元素: {selector}")
            element = await page.query_selector(selector)
            
            if not element:
                result["error"] = f"未找到元素: {selector}"
                print(result["error"])
                
                # 尝试查找相似元素
                all_elements = await page.query_selector_all("*")
                similar = []
                for el in all_elements:
                    try:
                        text = await el.text_content()
                        if text and len(text.strip()) > 0:
                            tag = await el.evaluate("element => element.tagName")
                            similar.append(f"{tag.lower()}: {text.strip()[:50]}")
                    except:
                        pass
                
                if similar:
                    print(f"找到 {len(similar)} 个其他元素，前5个:")
                    for i, desc in enumerate(similar[:5], 1):
                        print(f"  {i}. {desc}")
                
                # 关闭浏览器
                await context.close()
                await browser.close()
                return result
            
            # 获取元素信息
            element_info = {}
            try:
                element_info["tag"] = await element.evaluate("element => element.tagName")
                element_info["text"] = await element.text_content()
                element_info["id"] = await element.get_attribute("id")
                element_info["class"] = await element.get_attribute("class")
                element_info["href"] = await element.get_attribute("href")  # 如果是链接
                element_info["type"] = await element.get_attribute("type")  # 如果是按钮
                
                # 获取位置和大小
                bounding_box = await element.bounding_box()
                if bounding_box:
                    element_info["position"] = {
                        "x": bounding_box["x"],
                        "y": bounding_box["y"],
                        "width": bounding_box["width"],
                        "height": bounding_box["height"],
                    }
                
            except Exception as e:
                print(f"获取元素信息时出错: {e}")
            
            result["element_info"] = element_info
            
            # 显示元素信息
            print(f"找到元素: {element_info.get('tag', '未知')}")
            if element_info.get("text"):
                print(f"元素文本: {element_info['text'].strip()[:100]}")
            if element_info.get("id"):
                print(f"元素ID: {element_info['id']}")
            if element_info.get("class"):
                print(f"元素类: {element_info['class']}")
            
            # 点击前截图
            if screenshot:
                before_screenshot = f"/tmp/click_before_{Path(url).name}.png"
                await page.screenshot(path=before_screenshot)
                result["before_screenshot"] = before_screenshot
                print(f"点击前截图: {before_screenshot}")
            
            # 点击元素
            print("正在点击元素...")
            try:
                await element.click()
                result["clicked"] = True
                print("点击成功")
                
                # 点击后等待
                if wait_after > 0:
                    print(f"点击后等待 {wait_after} 秒...")
                    await asyncio.sleep(wait_after)
                
                # 记录点击后状态
                result["after_url"] = page.url
                result["after_title"] = await page.title()
                
                # 检查是否跳转
                if result["before_url"] != result["after_url"]:
                    print(f"页面跳转: {result['before_url']} -> {result['after_url']}")
                    result["redirected"] = True
                else:
                    print("页面未跳转")
                    result["redirected"] = False
                
                # 点击后截图
                if screenshot:
                    after_screenshot = f"/tmp/click_after_{Path(url).name}.png"
                    await page.screenshot(path=after_screenshot)
                    result["after_screenshot"] = after_screenshot
                    print(f"点击后截图: {after_screenshot}")
                
            except Exception as e:
                result["error"] = f"点击元素时出错: {e}"
                print(f"错误: {e}")
                
                # 尝试其他点击方式
                print("尝试其他点击方式...")
                try:
                    await element.dispatch_event("click")
                    result["clicked"] = True
                    print("通过dispatch_event点击成功")
                except:
                    try:
                        await element.focus()
                        await page.keyboard.press("Enter")
                        result["clicked"] = True
                        print("通过键盘回车点击成功")
                    except:
                        pass
            
            # 关闭浏览器
            await context.close()
            await browser.close()
            
            result["success"] = True
            print("操作完成")
            
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
    parser = argparse.ArgumentParser(description="点击网页元素")
    parser.add_argument("--url", required=True, help="页面URL")
    parser.add_argument("--selector", required=True, help="要点击的元素的CSS选择器")
    parser.add_argument("--browser", default="chromium", 
                       choices=["chromium", "firefox", "webkit"],
                       help="浏览器类型（默认: chromium）")
    parser.add_argument("--headless", action="store_true", 
                       help="无头模式（不显示浏览器窗口）")
    parser.add_argument("--no-headless", dest="headless", action="store_false",
                       help="显示浏览器窗口")
    parser.add_argument("--wait-before", type=float, default=1.0,
                       help="点击前等待时间（秒，默认: 1）")
    parser.add_argument("--wait-after", type=float, default=3.0,
                       help="点击后等待时间（秒，默认: 3）")
    parser.add_argument("--timeout", type=int, default=30000,
                       help="超时时间（毫秒，默认: 30000）")
    parser.add_argument("--screenshot", action="store_true", 
                       help="截图（默认: 是）")
    parser.add_argument("--no-screenshot", dest="screenshot", action="store_false",
                       help="不截图")
    parser.add_argument("--output", help="结果输出文件（JSON格式）")
    
    # 设置默认值
    parser.set_defaults(headless=True, screenshot=True)
    
    args = parser.parse_args()
    
    # 运行异步函数
    result = asyncio.run(
        click_element(
            url=args.url,
            selector=args.selector,
            browser_type=args.browser,
            headless=args.headless,
            wait_before=args.wait_before,
            wait_after=args.wait_after,
            timeout=args.timeout,
            screenshot=args.screenshot,
        )
    )
    
    # 输出结果
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"结果已保存: {output_path}")
    
    # 显示结果摘要
    print("\n" + "="*60)
    print("元素点击结果:")
    print(f"  成功: {result['success']}")
    print(f"  页面: {result['url']}")
    print(f"  选择器: {result['selector']}")
    print(f"  点击成功: {'是' if result['clicked'] else '否'}")
    
    if result.get('element_info'):
        info = result['element_info']
        print(f"  元素信息:")
        if info.get('tag'):
            print(f"    标签: {info['tag']}")
        if info.get('text'):
            text = info['text'].strip()
            if len(text) > 50:
                text = text[:50] + "..."
            print(f"    文本: {text}")
        if info.get('id'):
            print(f"    ID: {info['id']}")
    
    print(f"  点击前URL: {result.get('before_url', '')}")
    print(f"  点击后URL: {result.get('after_url', '')}")
    
    if result.get('redirected'):
        print(f"  页面跳转: {'是' if result['redirected'] else '否'}")
    
    if result.get('before_screenshot'):
        print(f"  点击前截图: {result['before_screenshot']}")
    if result.get('after_screenshot'):
        print(f"  点击后截图: {result['after_screenshot']}")
    
    if result['error']:
        print(f"  错误: {result['error']}")
    
    print("="*60)
    
    # 返回退出码
    sys.exit(0 if result['success'] else 1)


if __name__ == "__main__":
    main()