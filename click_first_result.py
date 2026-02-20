#!/usr/bin/env python3
import asyncio
from playwright.async_api import async_playwright

async def click_first_result_and_screenshot():
    async with async_playwright() as p:
        # 启动浏览器
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        page = await context.new_page()
        
        try:
            # 1. 先访问百度搜索结果页面
            search_url = 'https://www.baidu.com/s?wd=链禾网'
            print(f"正在访问搜索结果页面: {search_url}")
            await page.goto(search_url, wait_until='networkidle')
            await asyncio.sleep(3)
            
            # 2. 获取第一个结果的链接
            print("查找第一个搜索结果...")
            first_result = await page.evaluate('''
                () => {
                    const resultElements = document.querySelectorAll('.result, .c-container, [tpl="se_com_default"]');
                    if (resultElements.length > 0) {
                        const firstEl = resultElements[0];
                        const titleEl = firstEl.querySelector('h3 a');
                        if (titleEl) {
                            return {
                                title: titleEl.textContent.trim(),
                                url: titleEl.href
                            };
                        }
                    }
                    return null;
                }
            ''')
            
            if not first_result:
                print("未找到第一个搜索结果")
                return
            
            print(f"第一个结果标题: {first_result['title']}")
            print(f"第一个结果URL: {first_result['url']}")
            
            # 3. 点击第一个结果
            print("点击第一个结果...")
            await page.click('.result h3 a, .c-container h3 a, [tpl="se_com_default"] h3 a')
            
            # 等待新页面加载
            print("等待新页面加载...")
            await page.wait_for_load_state('networkidle')
            await asyncio.sleep(5)  # 等待页面完全加载
            
            # 4. 获取新页面信息
            new_title = await page.title()
            new_url = page.url
            print(f"新页面标题: {new_title}")
            print(f"新页面URL: {new_url}")
            
            # 5. 截取长图
            print("截取长图...")
            
            # 获取页面总高度
            total_height = await page.evaluate('document.body.scrollHeight')
            print(f"页面总高度: {total_height}px")
            
            # 限制最大高度
            max_height = 8000
            if total_height > max_height:
                print(f"页面过长，限制为 {max_height}px")
                total_height = max_height
            
            # 设置视口高度
            await page.set_viewport_size({'width': 1920, 'height': total_height})
            
            # 截图
            screenshot_path = 'lianhe_first_result_full.png'
            await page.screenshot(path=screenshot_path, full_page=True)
            
            print(f"长截图已保存: {screenshot_path}")
            print(f"截图尺寸: 1920x{total_height}")
            
            # 6. 也截取当前视口
            viewport_path = 'lianhe_first_result_viewport.png'
            await page.screenshot(path=viewport_path)
            print(f"视口截图已保存: {viewport_path}")
            
            # 7. 获取页面主要内容
            page_content = await page.evaluate('''
                () => {
                    // 尝试获取主要内容
                    const mainSelectors = [
                        'main', 'article', '.content', '.main-content',
                        '.article-content', '#content', '.post-content'
                    ];
                    
                    let content = '';
                    for (const selector of mainSelectors) {
                        const el = document.querySelector(selector);
                        if (el) {
                            content = el.textContent.trim();
                            break;
                        }
                    }
                    
                    // 如果没有找到特定选择器，获取body内容
                    if (!content) {
                        content = document.body.textContent.trim();
                    }
                    
                    return content.substring(0, 2000); // 限制长度
                }
            ''')
            
            print(f"\n页面内容摘要（前2000字符）:")
            print("-" * 50)
            print(page_content[:500] + "..." if len(page_content) > 500 else page_content)
            print("-" * 50)
            
            # 8. 保存页面HTML
            html_content = await page.content()
            with open('lianhe_first_result.html', 'w', encoding='utf-8') as f:
                f.write(html_content)
            print("页面HTML已保存: lianhe_first_result.html")
            
        except Exception as e:
            print(f"发生错误: {e}")
            import traceback
            traceback.print_exc()
            
            # 即使出错也尝试截图
            try:
                error_screenshot = 'lianhe_click_error.png'
                await page.screenshot(path=error_screenshot, full_page=True)
                print(f"错误截图已保存: {error_screenshot}")
            except:
                pass
        finally:
            print("\n浏览器将保持打开状态，请手动关闭...")
            print("生成的文件:")
            print("1. lianhe_first_result_full.png - 第一个结果页面长截图")
            print("2. lianhe_first_result_viewport.png - 第一个结果页面视口截图")
            print("3. lianhe_first_result.html - 第一个结果页面HTML源码")
            
            # 不自动关闭浏览器

if __name__ == '__main__':
    asyncio.run(click_first_result_and_screenshot())