#!/usr/bin/env python3
import asyncio
from playwright.async_api import async_playwright

async def check_first_link():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        page = await context.new_page()
        
        try:
            print("访问百度搜索'链禾网'...")
            await page.goto('https://www.baidu.com/s?wd=链禾网', wait_until='networkidle')
            await asyncio.sleep(3)
            
            # 获取所有搜索结果详细信息
            print("获取搜索结果详细信息...")
            results = await page.evaluate('''
                () => {
                    const results = [];
                    const resultElements = document.querySelectorAll('.result, .c-container, [tpl="se_com_default"]');
                    
                    for (let i = 0; i < resultElements.length; i++) {
                        const el = resultElements[i];
                        const titleEl = el.querySelector('h3 a');
                        const abstractEl = el.querySelector('.c-abstract, .content-right_8Zs40');
                        
                        if (titleEl) {
                            // 获取完整HTML以查看隐藏信息
                            const html = el.innerHTML;
                            
                            results.push({
                                index: i + 1,
                                title: titleEl.textContent.trim(),
                                href: titleEl.href,
                                display_url: titleEl.textContent,
                                abstract: abstractEl ? abstractEl.textContent.trim() : '',
                                html_snippet: html.substring(0, 500)
                            });
                        }
                    }
                    return results;
                }
            ''')
            
            print(f"\n找到 {len(results)} 个搜索结果:")
            print("=" * 80)
            
            for result in results:
                print(f"\n{result['index']}. {result['title']}")
                print(f"   链接: {result['href']}")
                print(f"   显示文本: {result['display_url']}")
                print(f"   摘要: {result['abstract'][:100]}...")
                
                # 检查是否包含acbnlink.com
                if 'acbnlink.com' in result['href'] or 'acbnlink.com' in result['abstract']:
                    print(f"   ⭐ 包含 acbnlink.com!")
                
                # 检查是否包含其他域名
                import re
                domains = re.findall(r'[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', result['abstract'])
                if domains:
                    print(f"   可能域名: {', '.join(set(domains))}")
            
            print("\n" + "=" * 80)
            
            # 特别检查第一个结果
            if results:
                first_result = results[0]
                print(f"\n第一个结果的详细信息:")
                print(f"标题: {first_result['title']}")
                print(f"链接: {first_result['href']}")
                
                # 检查链接中是否包含acbnlink.com
                if 'acbnlink.com' in first_result['href']:
                    print("✅ 第一个链接包含 acbnlink.com!")
                    
                    # 直接访问这个链接
                    print(f"\n直接访问: {first_result['href']}")
                    await page.goto(first_result['href'], wait_until='networkidle')
                    await asyncio.sleep(5)
                    
                    # 截图
                    screenshot_path = 'acbnlink_page.png'
                    await page.screenshot(path=screenshot_path, full_page=True)
                    print(f"截图已保存: {screenshot_path}")
                    
                    # 获取页面信息
                    page_title = await page.title()
                    page_url = page.url
                    print(f"页面标题: {page_title}")
                    print(f"页面URL: {page_url}")
                    
                else:
                    print("❌ 第一个链接不包含 acbnlink.com")
                    
                    # 在摘要中搜索acbnlink.com
                    if 'acbnlink.com' in first_result['abstract']:
                        print("✅ 但在摘要中找到 acbnlink.com")
                        
                        # 从摘要中提取acbnlink.com链接
                        import re
                        acbnlink_match = re.search(r'https?://[a-zA-Z0-9.-]*acbnlink\.com[^\s]*', first_result['abstract'])
                        if acbnlink_match:
                            acbnlink_url = acbnlink_match.group(0)
                            print(f"提取的链接: {acbnlink_url}")
                            
                            # 访问这个链接
                            await page.goto(acbnlink_url, wait_until='networkidle')
                            await asyncio.sleep(5)
                            
                            screenshot_path = 'acbnlink_direct.png'
                            await page.screenshot(path=screenshot_path, full_page=True)
                            print(f"截图已保存: {screenshot_path}")
            
            # 保存搜索结果页面
            search_screenshot = 'search_results_detailed.png'
            await page.screenshot(path=search_screenshot, full_page=True)
            print(f"\n搜索结果页面截图: {search_screenshot}")
            
        except Exception as e:
            print(f"错误: {e}")
            import traceback
            traceback.print_exc()
        finally:
            print("\n浏览器保持打开...")

if __name__ == '__main__':
    asyncio.run(check_first_link())