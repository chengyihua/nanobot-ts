#!/usr/bin/env python3
import asyncio
from playwright.async_api import async_playwright

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
            # 直接访问百度搜索链禾网的URL
            search_url = 'https://www.baidu.com/s?wd=链禾网'
            print(f"正在访问: {search_url}")
            
            await page.goto(search_url, wait_until='networkidle')
            await asyncio.sleep(3)  # 等待页面完全加载
            
            # 获取页面信息
            page_title = await page.title()
            page_url = page.url
            print(f"页面标题: {page_title}")
            print(f"页面URL: {page_url}")
            
            # 截取当前视口截图
            viewport_screenshot = 'lianhe_search_viewport.png'
            await page.screenshot(path=viewport_screenshot)
            print(f"视口截图已保存: {viewport_screenshot}")
            
            # 获取页面总高度
            total_height = await page.evaluate('document.body.scrollHeight')
            print(f"页面总高度: {total_height}px")
            
            # 限制最大高度为5000px
            max_height = 5000
            if total_height > max_height:
                print(f"页面过长，限制为 {max_height}px")
                total_height = max_height
            
            # 设置视口高度并截取长图
            await page.set_viewport_size({'width': 1920, 'height': total_height})
            
            full_screenshot = 'lianhe_search_full.png'
            await page.screenshot(path=full_screenshot, full_page=True)
            print(f"长截图已保存: {full_screenshot}")
            print(f"截图尺寸: 1920x{total_height}")
            
            # 获取搜索结果数量
            result_count = await page.evaluate('''
                () => {
                    const results = document.querySelectorAll('.result, .c-container, [tpl="se_com_default"]');
                    return results.length;
                }
            ''')
            
            print(f"找到 {result_count} 个搜索结果")
            
            # 获取前10个结果的标题和链接
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
                print("未找到搜索结果")
                
                # 尝试其他选择器
                all_links = await page.evaluate('''
                    () => {
                        const links = [];
                        const linkElements = document.querySelectorAll('a');
                        for (let i = 0; i < Math.min(20, linkElements.length); i++) {
                            const el = linkElements[i];
                            if (el.textContent.includes('链禾') || el.href.includes('链禾')) {
                                links.push({
                                    title: el.textContent.trim(),
                                    url: el.href
                                });
                            }
                        }
                        return links;
                    }
                ''')
                
                if all_links:
                    print("\n包含'链禾'的链接:")
                    for i, link in enumerate(all_links, 1):
                        print(f"{i}. {link['title'][:80]}...")
                        print(f"   链接: {link['url'][:100]}...")
            
            # 保存页面HTML
            html_content = await page.content()
            with open('lianhe_search_results.html', 'w', encoding='utf-8') as f:
                f.write(html_content)
            print("页面HTML已保存: lianhe_search_results.html")
            
        except Exception as e:
            print(f"发生错误: {e}")
            import traceback
            traceback.print_exc()
            
            # 即使出错也尝试截图
            try:
                error_screenshot = 'lianhe_error.png'
                await page.screenshot(path=error_screenshot, full_page=True)
                print(f"错误截图已保存: {error_screenshot}")
            except:
                pass
        finally:
            print("\n浏览器将保持打开状态，请手动关闭查看结果...")
            print("生成的文件:")
            print("1. lianhe_search_viewport.png - 当前视口截图")
            print("2. lianhe_search_full.png - 完整页面长截图")
            print("3. lianhe_search_results.html - 页面HTML源码")
            
            # 不自动关闭浏览器，让用户查看

if __name__ == '__main__':
    asyncio.run(search_and_screenshot())