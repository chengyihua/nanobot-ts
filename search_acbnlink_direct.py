#!/usr/bin/env python3
import asyncio
from playwright.async_api import async_playwright

async def search_acbnlink_direct():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        page = await context.new_page()
        
        try:
            print("=== 方法1: 直接搜索 acbnlink.com ===")
            await page.goto('https://www.baidu.com/s?wd=acbnlink.com', wait_until='networkidle')
            await asyncio.sleep(3)
            
            screenshot1 = 'acbnlink_search.png'
            await page.screenshot(path=screenshot1, full_page=True)
            print(f"截图: {screenshot1}")
            
            # 获取搜索结果
            results1 = await page.evaluate('''
                () => {
                    const results = [];
                    const resultElements = document.querySelectorAll('.result, .c-container, [tpl="se_com_default"]');
                    
                    for (let i = 0; i < Math.min(5, resultElements.length); i++) {
                        const el = resultElements[i];
                        const titleEl = el.querySelector('h3 a');
                        const abstractEl = el.querySelector('.c-abstract, .content-right_8Zs40');
                        
                        if (titleEl) {
                            results.push({
                                index: i + 1,
                                title: titleEl.textContent.trim(),
                                href: titleEl.href,
                                abstract: abstractEl ? abstractEl.textContent.trim() : ''
                            });
                        }
                    }
                    return results;
                }
            ''')
            
            print(f"\nacbnlink.com 搜索结果:")
            for result in results1:
                print(f"{result['index']}. {result['title']}")
                print(f"   链接: {result['href']}")
                if '链禾' in result['abstract']:
                    print(f"   ⭐ 包含'链禾'相关信息")
            
            print("\n=== 方法2: 搜索 'acbnlink.com 链禾网' ===")
            await page.goto('https://www.baidu.com/s?wd=acbnlink.com+链禾网', wait_until='networkidle')
            await asyncio.sleep(3)
            
            screenshot2 = 'acbnlink_lianhe_search.png'
            await page.screenshot(path=screenshot2, full_page=True)
            print(f"截图: {screenshot2}")
            
            # 获取搜索结果
            results2 = await page.evaluate('''
                () => {
                    const results = [];
                    const resultElements = document.querySelectorAll('.result, .c-container, [tpl="se_com_default"]');
                    
                    for (let i = 0; i < Math.min(5, resultElements.length); i++) {
                        const el = resultElements[i];
                        const titleEl = el.querySelector('h3 a');
                        const abstractEl = el.querySelector('.c-abstract, .content-right_8Zs40');
                        
                        if (titleEl) {
                            results.push({
                                index: i + 1,
                                title: titleEl.textContent.trim(),
                                href: titleEl.href,
                                abstract: abstractEl ? abstractEl.textContent.trim() : ''
                            });
                        }
                    }
                    return results;
                }
            ''')
            
            print(f"\nacbnlink.com 链禾网 搜索结果:")
            for result in results2:
                print(f"{result['index']}. {result['title']}")
                print(f"   链接: {result['href']}")
                print(f"   摘要: {result['abstract'][:100]}...")
            
            print("\n=== 方法3: 直接访问 acbnlink.com ===")
            try:
                await page.goto('http://acbnlink.com', wait_until='networkidle', timeout=10000)
                await asyncio.sleep(5)
                
                page_title = await page.title()
                page_url = page.url
                print(f"页面标题: {page_title}")
                print(f"页面URL: {page_url}")
                
                # 截图
                screenshot3 = 'acbnlink_direct_visit.png'
                await page.screenshot(path=screenshot3, full_page=True)
                print(f"截图: {screenshot3}")
                
                # 检查页面内容
                has_lianhe = await page.evaluate('''() => document.body.textContent.includes('链禾')''')
                has_acbnlink = await page.evaluate('''() => document.body.textContent.includes('acbnlink')''')
                
                print(f"包含'链禾': {'是' if has_lianhe else '否'}")
                print(f"包含'acbnlink': {'是' if has_acbnlink else '否'}")
                
                # 获取页面内容片段
                content_preview = await page.evaluate('''
                    () => {
                        const bodyText = document.body.textContent.trim();
                        return bodyText.substring(0, 500);
                    }
                ''')
                
                print(f"\n页面内容预览:")
                print(content_preview[:300] + "..." if len(content_preview) > 300 else content_preview)
                
            except Exception as e:
                print(f"访问 acbnlink.com 失败: {e}")
                
                # 尝试 https
                try:
                    await page.goto('https://acbnlink.com', wait_until='networkidle', timeout=10000)
                    await asyncio.sleep(5)
                    
                    page_title = await page.title()
                    page_url = page.url
                    print(f"HTTPS页面标题: {page_title}")
                    print(f"HTTPS页面URL: {page_url}")
                    
                    screenshot4 = 'acbnlink_https.png'
                    await page.screenshot(path=screenshot4, full_page=True)
                    print(f"截图: {screenshot4}")
                except:
                    print("HTTPS访问也失败")
            
            print("\n=== 方法4: 搜索 '链禾网 site:acbnlink.com' ===")
            await page.goto('https://www.baidu.com/s?wd=链禾网+site:acbnlink.com', wait_until='networkidle')
            await asyncio.sleep(3)
            
            screenshot5 = 'lianhe_site_acbnlink.png'
            await page.screenshot(path=screenshot5, full_page=True)
            print(f"截图: {screenshot5}")
            
        except Exception as e:
            print(f"错误: {e}")
            import traceback
            traceback.print_exc()
        finally:
            print("\n完成！")
            print("生成的文件:")
            print("1. acbnlink_search.png - acbnlink.com搜索结果")
            print("2. acbnlink_lianhe_search.png - acbnlink.com链禾网搜索结果")
            print("3. acbnlink_direct_visit.png - 直接访问acbnlink.com")
            print("4. lianhe_site_acbnlink.png - 链禾网 site:acbnlink.com搜索结果")

if __name__ == '__main__':
    asyncio.run(search_acbnlink_direct())