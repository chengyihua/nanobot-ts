#!/usr/bin/env python3
import asyncio
from playwright.async_api import async_playwright
import datetime

async def get_spring_festival_news():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        page = await context.new_page()
        
        try:
            print("=== 获取春节期间大事 ===")
            print(f"当前时间: {datetime.datetime.now()}")
            print(f"2026年春节: 2月17日(除夕) - 2月23日(初六)")
            
            # 1. 访问百度新闻
            print("\n1. 访问百度新闻...")
            await page.goto('https://news.baidu.com/', wait_until='networkidle')
            await asyncio.sleep(3)
            
            # 获取热点新闻
            hot_news = await page.evaluate('''
                () => {
                    const news = [];
                    // 获取热点新闻
                    const hotElements = document.querySelectorAll('.hotnews a, .hotspot a, .hdline0 a, .hdline1 a');
                    
                    for (const el of hotElements) {
                        if (el.textContent.trim()) {
                            news.push({
                                title: el.textContent.trim(),
                                href: el.href,
                                is_hot: true
                            });
                        }
                    }
                    
                    // 获取国内新闻
                    const domesticElements = document.querySelectorAll('#guonei a, .domestic a');
                    for (const el of domesticElements) {
                        if (el.textContent.trim() && el.textContent.trim().length > 10) {
                            news.push({
                                title: el.textContent.trim(),
                                href: el.href,
                                category: '国内'
                            });
                        }
                    }
                    
                    return news;
                }
            ''')
            
            print(f"获取到 {len(hot_news)} 条新闻")
            
            # 筛选春节期间相关新闻
            spring_keywords = ['春节', '除夕', '初一', '初二', '初三', '初四', '初五', '初六', 
                             '春运', '春晚', '年货', '拜年', '红包', '团圆', '年夜饭', '庙会',
                             '旅游', '消费', '电影', '票房', '出行', '交通', '天气']
            
            spring_news = []
            for news in hot_news:
                title = news['title'].lower()
                for keyword in spring_keywords:
                    if keyword in title:
                        spring_news.append(news)
                        break
            
            print(f"\n春节期间相关新闻 ({len(spring_news)}条):")
            for i, news in enumerate(spring_news[:10], 1):
                print(f"{i}. {news['title']}")
                if 'category' in news:
                    print(f"   分类: {news['category']}")
            
            # 2. 访问新浪新闻
            print("\n2. 访问新浪新闻...")
            await page.goto('https://news.sina.com.cn/', wait_until='networkidle')
            await asyncio.sleep(3)
            
            sina_news = await page.evaluate('''
                () => {
                    const news = [];
                    const newsElements = document.querySelectorAll('.news-item h2 a, .blk122 a, .blk124 a');
                    
                    for (const el of newsElements) {
                        if (el.textContent.trim()) {
                            news.push({
                                title: el.textContent.trim(),
                                href: el.href
                            });
                        }
                    }
                    return news;
                }
            ''')
            
            # 筛选春节相关
            sina_spring_news = []
            for news in sina_news:
                title = news['title'].lower()
                for keyword in spring_keywords:
                    if keyword in title:
                        sina_spring_news.append(news)
                        break
            
            print(f"新浪春节新闻 ({len(sina_spring_news)}条):")
            for i, news in enumerate(sina_spring_news[:10], 1):
                print(f"{i}. {news['title']}")
            
            # 3. 访问央视新闻
            print("\n3. 访问央视新闻...")
            await page.goto('https://news.cctv.com/', wait_until='networkidle')
            await asyncio.sleep(3)
            
            cctv_news = await page.evaluate('''
                () => {
                    const news = [];
                    const newsElements = document.querySelectorAll('.title a, .news_title a');
                    
                    for (const el of newsElements) {
                        if (el.textContent.trim()) {
                            news.push({
                                title: el.textContent.trim(),
                                href: el.href
                            });
                        }
                    }
                    return news;
                }
            ''')
            
            # 筛选春节相关
            cctv_spring_news = []
            for news in cctv_news:
                title = news['title'].lower()
                for keyword in spring_keywords:
                    if keyword in title:
                        cctv_spring_news.append(news)
                        break
            
            print(f"央视春节新闻 ({len(cctv_spring_news)}条):")
            for i, news in enumerate(cctv_spring_news[:10], 1):
                print(f"{i}. {news['title']}")
            
            # 4. 搜索特定春节话题
            print("\n4. 搜索春节热点话题...")
            
            # 春节旅游
            await page.goto('https://www.baidu.com/s?wd=2026年春节旅游', wait_until='networkidle')
            await asyncio.sleep(2)
            
            travel_info = await page.evaluate('''
                () => {
                    const results = [];
                    const resultElements = document.querySelectorAll('.result, .c-container');
                    
                    for (const el of resultElements) {
                        const titleEl = el.querySelector('h3 a');
                        const abstractEl = el.querySelector('.c-abstract');
                        
                        if (titleEl) {
                            results.push({
                                title: titleEl.textContent.trim(),
                                abstract: abstractEl ? abstractEl.textContent.trim() : ''
                            });
                        }
                    }
                    return results;
                }
            ''')
            
            print(f"\n春节旅游信息:")
            for i, result in enumerate(travel_info[:5], 1):
                print(f"{i}. {result['title']}")
                if result['abstract']:
                    print(f"   摘要: {result['abstract'][:100]}...")
            
            # 春节电影
            await page.goto('https://www.baidu.com/s?wd=2026春节档电影', wait_until='networkidle')
            await asyncio.sleep(2)
            
            movie_info = await page.evaluate('''
                () => {
                    const results = [];
                    const resultElements = document.querySelectorAll('.result, .c-container');
                    
                    for (const el of resultElements) {
                        const titleEl = el.querySelector('h3 a');
                        const abstractEl = el.querySelector('.c-abstract');
                        
                        if (titleEl) {
                            results.push({
                                title: titleEl.textContent.trim(),
                                abstract: abstractEl ? abstractEl.textContent.trim() : ''
                            });
                        }
                    }
                    return results;
                }
            ''')
            
            print(f"\n春节档电影信息:")
            for i, result in enumerate(movie_info[:5], 1):
                print(f"{i}. {result['title']}")
                if result['abstract']:
                    print(f"   摘要: {result['abstract'][:100]}...")
            
            # 春节消费
            await page.goto('https://www.baidu.com/s?wd=2026春节消费', wait_until='networkidle')
            await asyncio.sleep(2)
            
            consumption_info = await page.evaluate('''
                () => {
                    const results = [];
                    const resultElements = document.querySelectorAll('.result, .c-container');
                    
                    for (const el of resultElements) {
                        const titleEl = el.querySelector('h3 a');
                        const abstractEl = el.querySelector('.c-abstract');
                        
                        if (titleEl) {
                            results.push({
                                title: titleEl.textContent.trim(),
                                abstract: abstractEl ? abstractEl.textContent.trim() : ''
                            });
                        }
                    }
                    return results;
                }
            ''')
            
            print(f"\n春节消费信息:")
            for i, result in enumerate(consumption_info[:5], 1):
                print(f"{i}. {result['title']}")
                if result['abstract']:
                    print(f"   摘要: {result['abstract'][:100]}...")
            
            # 截图
            screenshot_path = 'spring_festival_news.png'
            await page.screenshot(path=screenshot_path, full_page=True)
            print(f"\n✓ 截图已保存: {screenshot_path}")
            
            # 整理总结
            print("\n" + "="*80)
            print("2026年春节期间大事总结")
            print("="*80)
            
            all_spring_news = spring_news + sina_spring_news + cctv_spring_news
            unique_titles = set()
            categorized_news = {
                '旅游出行': [],
                '文化娱乐': [],
                '消费经济': [],
                '社会民生': [],
                '其他': []
            }
            
            for news in all_spring_news:
                title = news['title']
                if title in unique_titles:
                    continue
                unique_titles.add(title)
                
                # 分类
                if any(keyword in title for keyword in ['旅游', '出行', '交通', '春运', '机场', '高铁']):
                    categorized_news['旅游出行'].append(title)
                elif any(keyword in title for keyword in ['电影', '春晚', '庙会', '文化', '演出', '娱乐']):
                    categorized_news['文化娱乐'].append(title)
                elif any(keyword in title for keyword in ['消费', '经济', '零售', '电商', '年货', '购物']):
                    categorized_news['消费经济'].append(title)
                elif any(keyword in title for keyword in ['天气', '安全', '健康', '防疫', '民生', '服务']):
                    categorized_news['社会民生'].append(title)
                else:
                    categorized_news['其他'].append(title)
            
            # 输出分类总结
            for category, titles in categorized_news.items():
                if titles:
                    print(f"\n📌 {category}:")
                    for i, title in enumerate(titles[:5], 1):
                        print(f"  {i}. {title}")
            
            print("\n" + "="*80)
            print("💡 2026年春节热点预测:")
            print("1. 旅游出行高峰 - 预计出行人数创新高")
            print("2. 春节档电影 - 多部大片上映竞争激烈")
            print("3. 消费市场 - 线上线下年货销售火爆")
            print("4. 文化活动 - 各地庙会、灯会丰富多彩")
            print("5. 春运保障 - 交通部门全力保障出行")
            
        except Exception as e:
            print(f"❌ 获取新闻时出错: {e}")
            import traceback
            traceback.print_exc()
        finally:
            print("\n=== 完成 ===")

if __name__ == '__main__':
    asyncio.run(get_spring_festival_news())