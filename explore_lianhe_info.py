#!/usr/bin/env python3
import asyncio
from playwright.async_api import async_playwright

async def explore_lianhe_info():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        page = await context.new_page()
        
        try:
            # 1. 访问百度搜索结果
            print("访问百度搜索结果页面...")
            await page.goto('https://www.baidu.com/s?wd=链禾网', wait_until='networkidle')
            await asyncio.sleep(3)
            
            # 2. 获取所有搜索结果信息
            print("获取搜索结果信息...")
            search_results = await page.evaluate('''
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
                                url: titleEl.href,
                                abstract: abstractEl ? abstractEl.textContent.trim() : ''
                            });
                        }
                    }
                    return results;
                }
            ''')
            
            print(f"获取到 {len(search_results)} 个搜索结果")
            
            # 3. 显示搜索结果
            for result in search_results:
                print(f"\n{result['index']}. {result['title']}")
                print(f"   摘要: {result['abstract'][:100]}...")
                print(f"   URL: {result['url']}")
            
            # 4. 尝试访问第二个结果（可能是公司介绍页面）
            if len(search_results) > 1:
                second_result = search_results[1]  # 第二个结果
                print(f"\n尝试访问第二个结果: {second_result['title']}")
                
                # 点击第二个结果
                selector = f'.result:nth-child({second_result["index"]}) h3 a, .c-container:nth-child({second_result["index"]}) h3 a'
                await page.click(selector)
                
                # 等待页面加载
                await page.wait_for_load_state('networkidle')
                await asyncio.sleep(5)
                
                # 获取新页面信息
                new_title = await page.title()
                new_url = page.url
                print(f"新页面标题: {new_title}")
                print(f"新页面URL: {new_url}")
                
                # 截取长图
                total_height = await page.evaluate('document.body.scrollHeight')
                if total_height > 10000:
                    total_height = 10000
                
                await page.set_viewport_size({'width': 1920, 'height': total_height})
                
                screenshot_path = 'lianhe_info_full.png'
                await page.screenshot(path=screenshot_path, full_page=True)
                print(f"信息页面长截图已保存: {screenshot_path}")
                
                # 截取视口
                viewport_path = 'lianhe_info_viewport.png'
                await page.screenshot(path=viewport_path)
                print(f"信息页面视口截图已保存: {viewport_path}")
                
                # 分析页面内容
                page_content = await page.evaluate('''
                    () => {
                        const bodyText = document.body.textContent.trim();
                        
                        // 提取关于链禾网的信息
                        const keywords = ['链禾', '农产品', '大宗', '交易', '平台', '数字化', '供应链', '广东', '公司'];
                        let relevantText = '';
                        
                        // 查找包含多个关键词的段落
                        const paragraphs = bodyText.split(/\\n\\s*\\n/);
                        for (const para of paragraphs) {
                            if (para.length > 100 && para.length < 1000) {
                                let keywordCount = 0;
                                for (const keyword of keywords) {
                                    if (para.includes(keyword)) {
                                        keywordCount++;
                                    }
                                }
                                if (keywordCount >= 3) {
                                    relevantText = para;
                                    break;
                                }
                            }
                        }
                        
                        return {
                            title: document.title,
                            url: window.location.href,
                            relevant_info: relevantText || bodyText.substring(0, 1000),
                            full_length: bodyText.length
                        };
                    }
                ''')
                
                print(f"\n页面内容分析:")
                print(f"标题: {page_content['title']}")
                print(f"URL: {page_content['url']}")
                print(f"内容长度: {page_content['full_length']} 字符")
                print(f"相关信息:")
                print("-" * 50)
                print(page_content['relevant_info'][:500] + "..." if len(page_content['relevant_info']) > 500 else page_content['relevant_info'])
                print("-" * 50)
                
                # 保存HTML
                html_content = await page.content()
                with open('lianhe_info.html', 'w', encoding='utf-8') as f:
                    f.write(html_content)
                print("页面HTML已保存: lianhe_info.html")
            
            # 5. 如果第二个结果也不理想，尝试搜索"广东链禾信息科技有限公司"
            print("\n尝试搜索公司全名...")
            await page.goto('https://www.baidu.com/s?wd=广东链禾信息科技有限公司', wait_until='networkidle')
            await asyncio.sleep(3)
            
            # 截取搜索结果
            company_search_screenshot = 'lianhe_company_search.png'
            await page.screenshot(path=company_search_screenshot, full_page=True)
            print(f"公司搜索截图已保存: {company_search_screenshot}")
            
            # 获取公司相关信息
            company_info = await page.evaluate('''
                () => {
                    const firstResult = document.querySelector('.result, .c-container, [tpl="se_com_default"]');
                    if (firstResult) {
                        const abstract = firstResult.querySelector('.c-abstract, .content-right_8Zs40');
                        return abstract ? abstract.textContent.trim() : '未找到公司信息';
                    }
                    return '未找到搜索结果';
                }
            ''')
            
            print(f"\n公司信息:")
            print(company_info[:200] + "..." if len(company_info) > 200 else company_info)
            
        except Exception as e:
            print(f"发生错误: {e}")
            import traceback
            traceback.print_exc()
        finally:
            print("\n浏览器保持打开，请查看结果...")
            print("生成的文件:")
            print("1. lianhe_info_full.png - 链禾网信息页面长截图")
            print("2. lianhe_info_viewport.png - 链禾网信息页面视口截图")
            print("3. lianhe_company_search.png - 公司搜索截图")
            print("4. lianhe_info.html - 信息页面HTML")

if __name__ == '__main__':
    asyncio.run(explore_lianhe_info())