#!/usr/bin/env python3
"""
搜索脚本
使用浏览器在指定搜索引擎搜索内容
"""

import argparse
import asyncio
import json
import os
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


# 搜索引擎配置
SEARCH_ENGINES = {
    "baidu": {
        "url": "https://www.baidu.com/s?wd={query}",
        "result_selector": "div.result h3 a",
        "title_selector": "h3",
        "link_selector": "a",
        "snippet_selector": "div.c-abstract",
        "next_page_selector": "a.n",
    },
    "google": {
        "url": "https://www.google.com/search?q={query}",
        "result_selector": "div.g",
        "title_selector": "h3",
        "link_selector": "a",
        "snippet_selector": "div.VwiC3b",
        "next_page_selector": "a#pnnext",
    },
    "bing": {
        "url": "https://www.bing.com/search?q={query}",
        "result_selector": "li.b_algo",
        "title_selector": "h2 a",
        "link_selector": "a",
        "snippet_selector": "div.b_caption p",
        "next_page_selector": "a.sb_pagN",
    },
}


async def search(
    query: str,
    engine: str = "baidu",
    limit: int = 10,
    browser_type: str = "chromium",
    headless: bool = True,
    timeout: int = 30000,
) -> Dict[str, Any]:
    """
    在指定搜索引擎搜索内容
    
    Args:
        query: 搜索关键词
        engine: 搜索引擎（baidu, google, bing）
        limit: 最大结果数量
        browser_type: 浏览器类型
        headless: 是否无头模式
        timeout: 超时时间（毫秒）
    
    Returns:
        包含搜索结果的字典
    """
    if engine not in SEARCH_ENGINES:
        return {
            "success": False,
            "error": f"不支持的搜索引擎: {engine}，支持: {', '.join(SEARCH_ENGINES.keys())}",
            "results": [],
        }
    
    config = SEARCH_ENGINES[engine]
    search_url = config["url"].format(query=query)
    
    result = {
        "success": False,
        "engine": engine,
        "query": query,
        "url": search_url,
        "results": [],
        "error": None,
    }
    
    async with async_playwright() as p:
        try:
            # 启动浏览器
            browser = await launch_browser(p, browser_type, headless)
            context = await browser.new_context(
                viewport={"width": 1280, "height": 720},
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
            )
            page = await context.new_page()
            page.set_default_timeout(timeout)
            
            # 访问搜索页面
            print(f"正在搜索: {query} (使用{engine})")
            await page.goto(search_url, wait_until="networkidle")
            
            # 等待结果加载
            await page.wait_for_selector(config["result_selector"], timeout=5000)
            
            # 提取搜索结果
            results = []
            page_num = 1
            
            while len(results) < limit:
                print(f"正在提取第{page_num}页结果...")
                
                # 获取当前页结果
                result_elements = await page.query_selector_all(config["result_selector"])
                
                for element in result_elements:
                    if len(results) >= limit:
                        break
                    
                    try:
                        # 提取标题
                        title_element = await element.query_selector(config["title_selector"])
                        title = await title_element.text_content() if title_element else ""
                        
                        # 提取链接
                        link_element = await element.query_selector(config["link_selector"])
                        link = await link_element.get_attribute("href") if link_element else ""
                        
                        # 提取摘要
                        snippet_element = await element.query_selector(config["snippet_selector"])
                        snippet = await snippet_element.text_content() if snippet_element else ""
                        
                        # 处理相对链接
                        if link and not link.startswith(("http://", "https://")):
                            if engine == "baidu":
                                # 百度需要提取真实链接
                                real_link = await page.evaluate("""
                                    (element) => {
                                        const a = element.querySelector('a');
                                        return a ? a.getAttribute('href') : '';
                                    }
                                """, element)
                                link = real_link if real_link else link
                        
                        if title and link:
                            results.append({
                                "title": title.strip(),
                                "url": link.strip(),
                                "snippet": snippet.strip() if snippet else "",
                                "rank": len(results) + 1,
                            })
                            
                    except Exception as e:
                        print(f"提取结果时出错: {e}")
                        continue
                
                # 检查是否需要翻页
                if len(results) < limit:
                    next_page = await page.query_selector(config["next_page_selector"])
                    if next_page:
                        print("翻到下一页...")
                        await next_page.click()
                        await page.wait_for_load_state("networkidle")
                        page_num += 1
                    else:
                        print("没有更多结果")
                        break
                else:
                    print(f"已达到限制数量: {limit}")
                    break
            
            # 关闭浏览器
            await context.close()
            await browser.close()
            
            result["success"] = True
            result["results"] = results[:limit]
            print(f"搜索完成，找到{len(result['results'])}个结果")
            
        except Exception as e:
            result["error"] = str(e)
            print(f"搜索时出错: {e}")
            
            # 确保浏览器关闭
            try:
                if 'browser' in locals():
                    await browser.close()
            except:
                pass
    
    return result


def main():
    """命令行入口点"""
    parser = argparse.ArgumentParser(description="在搜索引擎搜索内容")
    parser.add_argument("--query", required=True, help="搜索关键词")
    parser.add_argument("--engine", default="baidu", 
                       choices=["baidu", "google", "bing"],
                       help="搜索引擎（默认: baidu）")
    parser.add_argument("--limit", type=int, default=10,
                       help="最大结果数量（默认: 10）")
    parser.add_argument("--browser", default="chromium", 
                       choices=["chromium", "firefox", "webkit"],
                       help="浏览器类型（默认: chromium）")
    parser.add_argument("--headless", action="store_true", 
                       help="无头模式（不显示浏览器窗口）")
    parser.add_argument("--no-headless", dest="headless", action="store_false",
                       help="显示浏览器窗口")
    parser.add_argument("--timeout", type=int, default=30000,
                       help="超时时间（毫秒，默认: 30000）")
    parser.add_argument("--output", help="结果输出文件（JSON格式）")
    
    # 设置默认值
    parser.set_defaults(headless=True)
    
    args = parser.parse_args()
    
    # 运行异步函数
    result = asyncio.run(
        search(
            query=args.query,
            engine=args.engine,
            limit=args.limit,
            browser_type=args.browser,
            headless=args.headless,
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
        print("\n" + "="*60)
        print(f"搜索 '{args.query}' 的结果 ({args.engine}):")
        print("="*60)
        
        if result["success"]:
            for i, item in enumerate(result["results"], 1):
                print(f"\n{i}. {item['title']}")
                print(f"   链接: {item['url']}")
                if item['snippet']:
                    print(f"   摘要: {item['snippet'][:100]}...")
            print(f"\n共找到 {len(result['results'])} 个结果")
        else:
            print(f"错误: {result['error']}")
        print("="*60)
    
    # 返回退出码
    sys.exit(0 if result['success'] else 1)


if __name__ == "__main__":
    main()