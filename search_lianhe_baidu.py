#!/usr/bin/env python3
import asyncio
from playwright.async_api import async_playwright
import os

async def search_and_screenshot():
    async with async_playwright() as p:
        # 启动浏览器（有头模式，方便调试）
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        page = await context.new_page()
        
        try:
            print("正在打开百度...")
            await page.goto('https://www.baidu.com', wait_until='networkidle')
            
            # 等待搜索框出现
            print("等待搜索框...")
            await page.wait_for_selector('#kw', timeout=10000)
            
            # 输入搜索词
            print("输入搜索词: 链禾网")
            await page.fill('#kw', '链禾网')
            
            # 点击搜索按钮
            print("开始搜索...")
            await page.click('#su')
            
            # 等待搜索结果加载
            print("等待搜索结果...")
            await page.wait_for_selector('.result', timeout=10000)
            
            # 等待更多内容加载
            await asyncio.sleep(3)
            
            # 截取长图（滚动截图）
            print("截取长图...")
            
            # 获取页面总高度
            total_height = await page.evaluate('document.body.scrollHeight')
            
            # 设置视口高度为页面总高度
            await page.set_viewport_size({'width': 1920, 'height': total_height})
            
            # 截图
            screenshot_path = 'lianhe_baidu_search_full.png'
            await page.screenshot(path=screenshot_path, full_page=True)
            
            print(f"截图已保存: {screenshot_path}")
            print(f"截图尺寸: 1920x{total_height}")
            
            # 也截取当前视口的图
            viewport_path = 'lianhe_baidu_search_viewport.png'
            await page.screenshot(path=viewport_path)
            print(f"视口截图已保存: {viewport_path}")
            
            # 获取搜索结果数量
            result_count = await page.evaluate('''
                () => {
                    const results = document.querySelectorAll('.result');
                    return results.length;
                }
            ''')
            
            print(f"找到 {result_count} 个搜索结果")
            
            # 获取前几个结果的标题和链接
            results = await page.evaluate('''
                () => {
                    const items = [];
                    const resultElements = document.querySelectorAll('.result');
                    for (let i = 0; i < Math.min(5, resultElements.length); i++) {
                        const el = resultElements[i];
                        const titleEl = el.querySelector('h3 a');
                        if (titleEl) {
                            items.push({
                                title: titleEl.textContent,
                                url: titleEl.href
                            });
                        }
                    }
                    return items;
                }
            ''')
            
            print("\n前5个搜索结果:")
            for i, result in enumerate(results, 1):
                print(f"{i}. {result['title']}")
                print(f"   链接: {result['url']}")
            
            # 获取页面标题和URL
            page_title = await page.title()
            page_url = page.url
            print(f"\n页面标题: {page_title}")
            print(f"页面URL: {page_url}")
            
        except Exception as e:
            print(f"发生错误: {e}")
            # 即使出错也尝试截图
            try:
                error_screenshot = 'baidu_error_screenshot.png'
                await page.screenshot(path=error_screenshot)
                print(f"错误截图已保存: {error_screenshot}")
            except:
                pass
        finally:
            # 等待10秒让你看到结果
            print("\n10秒后关闭浏览器...")
            await asyncio.sleep(10)
            await browser.close()

if __name__ == '__main__':
    asyncio.run(search_and_screenshot())