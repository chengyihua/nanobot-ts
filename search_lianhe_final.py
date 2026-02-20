#!/usr/bin/env python3
import asyncio
from playwright.async_api import async_playwright
import os

async def search_and_screenshot():
    async with async_playwright() as p:
        # 启动浏览器（有头模式，方便调试）
        browser = await p.chromium.launch(
            headless=False,
            args=['--start-maximized']
        )
        
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            locale='zh-CN'
        )
        
        page = await context.new_page()
        
        try:
            print("正在打开百度...")
            await page.goto('https://www.baidu.com', wait_until='networkidle')
            
            # 等待页面完全加载
            await asyncio.sleep(2)
            
            # 尝试多种选择器找到搜索框
            print("寻找搜索框...")
            
            # 先截图当前页面状态
            await page.screenshot(path='baidu_homepage.png')
            print("首页截图已保存: baidu_homepage.png")
            
            # 尝试点击搜索框区域
            search_box_selectors = [
                '#kw',
                'input[name="wd"]',
                '.s_ipt',
                'input[placeholder*="搜索"]',
                'input[placeholder*="Search"]',
                'input[type="search"]',
                'input[type="text"]'
            ]
            
            found = False
            for selector in search_box_selectors:
                try:
                    await page.wait_for_selector(selector, timeout=2000)
                    await page.click(selector)
                    print(f"找到搜索框: {selector}")
                    found = True
                    break
                except:
                    continue
            
            if not found:
                print("未找到搜索框，尝试点击页面中间")
                # 点击页面中间位置
                await page.mouse.click(400, 300)
                await asyncio.sleep(1)
            
            # 输入搜索词
            print("输入搜索词: 链禾网")
            await page.keyboard.type('链禾网', delay=100)  # 模拟人工输入
            
            # 点击搜索按钮
            print("开始搜索...")
            search_button_selectors = [
                '#su',
                'input[type="submit"]',
                'button[type="submit"]',
                '.s_btn'
            ]
            
            for selector in search_button_selectors:
                try:
                    await page.click(selector)
                    print(f"点击搜索按钮: {selector}")
                    break
                except:
                    continue
            
            # 等待搜索结果加载
            print("等待搜索结果...")
            await page.wait_for_load_state('networkidle')
            await asyncio.sleep(3)
            
            # 截取长图（滚动截图）
            print("截取长图...")
            
            # 获取页面总高度
            total_height = await page.evaluate('document.body.scrollHeight')
            print(f"页面总高度: {total_height}px")
            
            # 如果页面太长，限制最大高度
            max_height = 5000
            if total_height > max_height:
                print(f"页面过长，限制为 {max_height}px")
                total_height = max_height
            
            # 设置视口高度
            await page.set_viewport_size({'width': 1920, 'height': total_height})
            
            # 截图
            screenshot_path = 'lianhe_baidu_search_full.png'
            await page.screenshot(path=screenshot_path, full_page=True)
            
            print(f"长截图已保存: {screenshot_path}")
            print(f"截图尺寸: 1920x{total_height}")
            
            # 获取页面标题和URL
            page_title = await page.title()
            page_url = page.url
            print(f"\n页面标题: {page_title}")
            print(f"页面URL: {page_url}")
            
            # 获取搜索结果信息
            try:
                # 百度搜索结果的选择器
                result_count = await page.evaluate('''
                    () => {
                        const results = document.querySelectorAll('.result, .c-container, [tpl="se_com_default"]');
                        return results.length;
                    }
                ''')
                
                print(f"找到 {result_count} 个搜索结果")
                
                # 获取前几个结果的标题和链接
                results = await page.evaluate('''
                    () => {
                        const items = [];
                        const resultElements = document.querySelectorAll('.result, .c-container, [tpl="se_com_default"]');
                        for (let i = 0; i < Math.min(10, resultElements.length); i++) {
                            const el = resultElements[i];
                            const titleEl = el.querySelector('h3 a');
                            if (titleEl) {
                                items.push({
                                    title: titleEl.textContent.trim(),
                                    url: titleEl.href
                                });
                            }
                        }
                        return items;
                    }
                ''')
                
                if results:
                    print("\n搜索结果:")
                    for i, result in enumerate(results, 1):
                        print(f"{i}. {result['title'][:80]}...")
                        print(f"   链接: {result['url'][:100]}...")
                else:
                    print("未找到搜索结果，尝试其他选择器...")
                    
            except Exception as e:
                print(f"获取结果信息时出错: {e}")
            
            # 保存页面HTML用于调试
            html_content = await page.content()
            with open('search_results.html', 'w', encoding='utf-8') as f:
                f.write(html_content)
            print("页面HTML已保存: search_results.html")
            
        except Exception as e:
            print(f"发生错误: {e}")
            import traceback
            traceback.print_exc()
            
            # 即使出错也尝试截图
            try:
                error_screenshot = 'final_error_screenshot.png'
                await page.screenshot(path=error_screenshot, full_page=True)
                print(f"错误截图已保存: {error_screenshot}")
            except:
                pass
        finally:
            # 等待用户查看结果
            print("\n浏览器将保持打开状态，请手动关闭...")
            print("截图文件:")
            print("1. baidu_homepage.png - 百度首页")
            print("2. lianhe_baidu_search_full.png - 搜索结果长截图")
            print("3. search_results.html - 页面HTML源码")
            
            # 不自动关闭浏览器，让用户查看
            # await browser.close()

if __name__ == '__main__':
    asyncio.run(search_and_screenshot())