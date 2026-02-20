#!/usr/bin/env python3
import asyncio
from playwright.async_api import async_playwright

async def click_first_and_screenshot():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        page = await context.new_page()
        
        try:
            print("=== 步骤1: 访问百度搜索'链禾网' ===")
            await page.goto('https://www.baidu.com/s?wd=链禾网', wait_until='networkidle')
            await asyncio.sleep(3)
            
            # 截图搜索页面
            search_screenshot = 'step1_search_page.png'
            await page.screenshot(path=search_screenshot, full_page=True)
            print(f"✓ 搜索页面截图: {search_screenshot}")
            
            # 获取第一个结果信息
            first_result_info = await page.evaluate('''
                () => {
                    const firstResult = document.querySelector('.result, .c-container, [tpl="se_com_default"]');
                    if (firstResult) {
                        const titleEl = firstResult.querySelector('h3 a');
                        const abstractEl = firstResult.querySelector('.c-abstract, .content-right_8Zs40');
                        return {
                            title: titleEl ? titleEl.textContent.trim() : '无标题',
                            url: titleEl ? titleEl.href : '',
                            abstract: abstractEl ? abstractEl.textContent.trim() : '无摘要'
                        };
                    }
                    return null;
                }
            ''')
            
            if not first_result_info:
                print("❌ 未找到第一个搜索结果")
                return
            
            print(f"\n=== 第一个搜索结果 ===")
            print(f"标题: {first_result_info['title']}")
            print(f"URL: {first_result_info['url']}")
            print(f"摘要: {first_result_info['abstract'][:100]}...")
            
            print("\n=== 步骤2: 点击第一个结果 ===")
            
            # 方法1: 直接点击第一个结果的链接
            await page.click('.result h3 a, .c-container h3 a, [tpl="se_com_default"] h3 a')
            
            # 等待可能的跳转
            print("等待页面跳转...")
            await asyncio.sleep(5)
            
            # 检查是否跳转成功
            current_url = page.url
            current_title = await page.title()
            
            print(f"当前URL: {current_url}")
            print(f"当前标题: {current_title}")
            
            # 如果还是百度搜索页面，尝试其他方法
            if 'baidu.com' in current_url and 'search' in current_url:
                print("⚠️ 还在百度搜索页面，尝试直接访问真实网站...")
                
                # 从摘要中提取可能的网站
                abstract = first_result_info['abstract'].lower()
                possible_urls = []
                
                # 尝试提取域名
                import re
                url_patterns = [
                    r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+',
                    r'www\.[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
                    r'[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}'
                ]
                
                for pattern in url_patterns:
                    matches = re.findall(pattern, abstract)
                    possible_urls.extend(matches)
                
                # 添加常见域名
                possible_urls.extend(['lianhe.com', 'www.lianhe.com', 'lianhe.cn', 'www.lianhe.cn'])
                
                print(f"尝试的URL: {possible_urls[:3]}")
                
                # 尝试访问
                for url in possible_urls[:3]:
                    try:
                        if not url.startswith('http'):
                            url = 'http://' + url
                        
                        print(f"尝试访问: {url}")
                        await page.goto(url, wait_until='networkidle', timeout=10000)
                        await asyncio.sleep(3)
                        break
                    except:
                        continue
            
            print("\n=== 步骤3: 截取目标页面长图 ===")
            
            # 获取页面总高度
            total_height = await page.evaluate('document.body.scrollHeight')
            print(f"页面总高度: {total_height}px")
            
            # 限制高度
            if total_height > 10000:
                total_height = 10000
                print(f"限制为: {total_height}px")
            
            # 设置视口
            await page.set_viewport_size({'width': 1920, 'height': total_height})
            
            # 截取长图
            final_screenshot = 'lianhe_target_page_full.png'
            await page.screenshot(path=final_screenshot, full_page=True)
            print(f"✓ 目标页面长截图: {final_screenshot}")
            print(f"✓ 截图尺寸: 1920x{total_height}")
            
            # 截取视口
            viewport_screenshot = 'lianhe_target_page_viewport.png'
            await page.screenshot(path=viewport_screenshot)
            print(f"✓ 目标页面视口截图: {viewport_screenshot}")
            
            # 获取页面信息
            page_info = await page.evaluate('''
                () => {
                    return {
                        title: document.title,
                        url: window.location.href,
                        content_length: document.body.textContent.trim().length,
                        has_lianhe: document.body.textContent.includes('链禾'),
                        has_nongchanpin: document.body.textContent.includes('农产品')
                    };
                }
            ''')
            
            print(f"\n=== 目标页面信息 ===")
            print(f"标题: {page_info['title']}")
            print(f"URL: {page_info['url']}")
            print(f"内容长度: {page_info['content_length']} 字符")
            print(f"包含'链禾': {'是' if page_info['has_lianhe'] else '否'}")
            print(f"包含'农产品': {'是' if page_info['has_nongchanpin'] else '否'}")
            
            # 提取页面内容片段
            content_preview = await page.evaluate('''
                () => {
                    const bodyText = document.body.textContent.trim();
                    // 查找包含链禾或农产品的段落
                    const paragraphs = bodyText.split(/\\n\\s*\\n/);
                    for (const para of paragraphs) {
                        if (para.length > 100 && para.length < 500) {
                            if (para.includes('链禾') || para.includes('农产品')) {
                                return para;
                            }
                        }
                    }
                    return bodyText.substring(0, 500);
                }
            ''')
            
            print(f"\n=== 页面内容预览 ===")
            print(content_preview[:300] + "..." if len(content_preview) > 300 else content_preview)
            
            # 保存HTML
            html_content = await page.content()
            with open('lianhe_target_page.html', 'w', encoding='utf-8') as f:
                f.write(html_content)
            print(f"\n✓ HTML已保存: lianhe_target_page.html")
            
        except Exception as e:
            print(f"❌ 发生错误: {e}")
            import traceback
            traceback.print_exc()
            
            # 即使出错也截图
            try:
                error_screenshot = 'lianhe_error_final.png'
                await page.screenshot(path=error_screenshot, full_page=True)
                print(f"✓ 错误截图: {error_screenshot}")
            except:
                pass
        finally:
            print("\n=== 完成 ===")
            print("浏览器保持打开，请查看结果...")
            print("生成的文件:")
            print("1. step1_search_page.png - 百度搜索页面")
            print("2. lianhe_target_page_full.png - 目标页面长截图")
            print("3. lianhe_target_page_viewport.png - 目标页面视口截图")
            print("4. lianhe_target_page.html - 目标页面HTML")

if __name__ == '__main__':
    asyncio.run(click_first_and_screenshot())