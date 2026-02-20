#!/usr/bin/env python3
import asyncio
from playwright.async_api import async_playwright
import re

async def visit_real_url():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        page = await context.new_page()
        
        try:
            # 1. 访问搜索结果页面
            search_url = 'https://www.baidu.com/s?wd=链禾网'
            print(f"访问: {search_url}")
            await page.goto(search_url, wait_until='networkidle')
            await asyncio.sleep(3)
            
            # 2. 获取第一个结果的真实URL（从data-landurl属性）
            print("获取第一个结果的真实URL...")
            real_url = await page.evaluate('''
                () => {
                    const firstResult = document.querySelector('.result, .c-container, [tpl="se_com_default"]');
                    if (firstResult) {
                        // 尝试获取真实URL
                        const link = firstResult.querySelector('h3 a');
                        if (link) {
                            // 从data-landurl属性获取真实URL
                            if (link.getAttribute('data-landurl')) {
                                return link.getAttribute('data-landurl');
                            }
                            // 从href解析
                            const href = link.href;
                            if (href.includes('link?url=')) {
                                // 这是百度跳转链接，需要提取真实URL
                                const match = href.match(/url=([^&]+)/);
                                if (match) {
                                    try {
                                        return decodeURIComponent(match[1]);
                                    } catch(e) {
                                        return match[1];
                                    }
                                }
                            }
                            return href;
                        }
                    }
                    return null;
                }
            ''')
            
            if not real_url:
                print("无法获取真实URL，尝试直接访问链禾网官网")
                real_url = 'http://www.lianhe.com'  # 假设的官网
            
            print(f"真实URL: {real_url}")
            
            # 3. 访问真实URL
            print(f"访问真实网站: {real_url}")
            try:
                await page.goto(real_url, wait_until='networkidle', timeout=30000)
            except:
                print("访问超时，尝试其他方式...")
                # 尝试常见域名
                common_urls = [
                    'http://www.lianhe.com',
                    'http://www.lianhe.cn',
                    'http://lianhe.com',
                    'http://lianhe.cn',
                    'https://www.lianhe.com',
                    'https://www.lianhe.cn'
                ]
                
                for url in common_urls:
                    try:
                        print(f"尝试: {url}")
                        await page.goto(url, wait_until='networkidle', timeout=10000)
                        break
                    except:
                        continue
            
            await asyncio.sleep(5)  # 等待页面完全加载
            
            # 4. 获取页面信息
            page_title = await page.title()
            page_url = page.url
            print(f"页面标题: {page_title}")
            print(f"页面URL: {page_url}")
            
            # 5. 截取长图
            print("截取长图...")
            
            # 获取页面总高度
            total_height = await page.evaluate('document.body.scrollHeight')
            print(f"页面总高度: {total_height}px")
            
            # 限制最大高度
            max_height = 10000
            if total_height > max_height:
                print(f"页面过长，限制为 {max_height}px")
                total_height = max_height
            
            # 设置视口高度
            await page.set_viewport_size({'width': 1920, 'height': total_height})
            
            # 截图
            screenshot_path = 'lianhe_website_full.png'
            await page.screenshot(path=screenshot_path, full_page=True)
            
            print(f"网站长截图已保存: {screenshot_path}")
            print(f"截图尺寸: 1920x{total_height}")
            
            # 6. 截取视口
            viewport_path = 'lianhe_website_viewport.png'
            await page.screenshot(path=viewport_path)
            print(f"网站视口截图已保存: {viewport_path}")
            
            # 7. 分析页面内容
            page_content = await page.evaluate('''
                () => {
                    // 获取页面主要内容
                    const bodyText = document.body.textContent.trim();
                    
                    // 提取关键信息
                    const keywords = ['链禾', '农产品', '大宗', '交易', '平台', '数字化', '供应链'];
                    let summary = '';
                    
                    // 查找包含关键词的段落
                    const paragraphs = bodyText.split(/\\n\\s*\\n/);
                    for (const para of paragraphs) {
                        if (para.length > 50 && para.length < 500) {
                            let keywordCount = 0;
                            for (const keyword of keywords) {
                                if (para.includes(keyword)) {
                                    keywordCount++;
                                }
                            }
                            if (keywordCount >= 2) {
                                summary = para;
                                break;
                            }
                        }
                    }
                    
                    // 如果没有找到，取前500字符
                    if (!summary) {
                        summary = bodyText.substring(0, 500);
                    }
                    
                    return {
                        title: document.title,
                        url: window.location.href,
                        content_preview: summary,
                        full_length: bodyText.length
                    };
                }
            ''')
            
            print(f"\n页面分析:")
            print(f"标题: {page_content['title']}")
            print(f"URL: {page_content['url']}")
            print(f"内容长度: {page_content['full_length']} 字符")
            print(f"内容预览:")
            print("-" * 50)
            print(page_content['content_preview'])
            print("-" * 50)
            
            # 8. 保存HTML
            html_content = await page.content()
            with open('lianhe_website.html', 'w', encoding='utf-8') as f:
                f.write(html_content)
            print("页面HTML已保存: lianhe_website.html")
            
        except Exception as e:
            print(f"发生错误: {e}")
            import traceback
            traceback.print_exc()
            
            # 即使出错也尝试截图
            try:
                error_screenshot = 'lianhe_website_error.png'
                await page.screenshot(path=error_screenshot, full_page=True)
                print(f"错误截图已保存: {error_screenshot}")
            except:
                pass
        finally:
            print("\n浏览器将保持打开状态...")
            print("生成的文件:")
            print("1. lianhe_website_full.png - 链禾网网站长截图")
            print("2. lianhe_website_viewport.png - 链禾网网站视口截图")
            print("3. lianhe_website.html - 链禾网网站HTML源码")

if __name__ == '__main__':
    asyncio.run(visit_real_url())