#!/usr/bin/env python3
"""
惠农网商品爬虫 - 爬取商品数据并写入链禾网数据库
支持图片下载和上传到CDN
"""
import json
import re
import random
import time
import os
import urllib.request
import urllib.parse
from playwright.sync_api import sync_playwright

# 数据库配置
SUPABASE_URL = "http://47.115.253.217:8080"
SERVICE_ROLE_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoicG9sYXJkYiIsImlhdCI6MTc2ODM2OTgwMiwiZXhwIjoyMDgzNzI5ODAyfQ.OvbbXDxvsQWO-sJkiKFF62ULPzauTVaDJbju9PFDp8Y"

# 图片上传配置 - 使用链禾网CDN
IMAGE_UPLOAD_URL = "https://lianheimagecdn.acbnlink.com/upload"

# 分类映射
CATEGORY_MAP = {
    "bc": ("蔬菜", "叶菜类"),      # 白菜
    "xbc": ("蔬菜", "叶菜类"),     # 小白菜
    "shengcai": ("蔬菜", "叶菜类"), # 生菜
    "bocai": ("蔬菜", "叶菜类"),   # 菠菜
    "ymc": ("蔬菜", "叶菜类"),     # 油麦菜
    "xiangcai": ("蔬菜", "叶菜类"), # 香菜
    "luobo": ("蔬菜", "根茎类"),   # 萝卜
    "hlb": ("蔬菜", "根茎类"),     # 胡萝卜
    "shanyao": ("蔬菜", "根茎类"), # 山药
    "lusun": ("蔬菜", "根茎类"),   # 芦笋
    "lajiao": ("蔬菜", "茄果类"),  # 辣椒
    "xhs": ("蔬菜", "茄果类"),     # 西红柿
    "qiezi": ("蔬菜", "茄果类"),   # 茄子
    "qiukui": ("蔬菜", "茄果类"),  # 秋葵
    "dasuan": ("蔬菜", "葱蒜类"),  # 大蒜
    "dacong": ("蔬菜", "葱蒜类"),  # 大葱
    "xiaocong": ("蔬菜", "葱蒜类"), # 小葱
    "shengjiang": ("蔬菜", "葱蒜类"), # 生姜
    "jiuhuang": ("蔬菜", "葱蒜类"), # 韭黄
    "doujiao": ("蔬菜", "豆类"),   # 豆角
    "maodou": ("蔬菜", "豆类"),    # 毛豆
    "wandouo": ("蔬菜", "豆类"),   # 豌豆
    "syjl": ("蔬菜", "食用菌"),    # 食用菌
    "juzi": ("水果", "柑橘类"),    # 橘子
    "ganju": ("水果", "柑橘类"),   # 柑橘
    "pingguo": ("水果", "仁果类"), # 苹果
    "li": ("水果", "仁果类"),      # 梨
    "taozi": ("水果", "核果类"),   # 桃子
    "yingtao": ("水果", "核果类"), # 樱桃
    "caomei": ("水果", "浆果类"),  # 草莓
    "lanmei": ("水果", "浆果类"),  # 蓝莓
    "xigua": ("水果", "瓜果类"),   # 西瓜
    "hamigua": ("水果", "瓜果类"), # 哈密瓜
    "mangguo": ("水果", "热带水果"), # 芒果
}

# 要爬取的分类URL列表
CRAWL_CATEGORIES = [
    "bc", "luobo", "lajiao", "xhs", "doujiao",
    "juzi", "pingguo", "taozi", "qiezi", "bocai"
]

def clean_title(title):
    """清理标题"""
    if not title:
        return ""
    
    remove_patterns = [
        r'货版一致', r'不对版包赔', r'坏损包赔',
        r'包邮', r'部分包邮', r'【推荐】', r'【.*?】',
    ]
    
    for pattern in remove_patterns:
        title = re.sub(pattern, '', title)
    
    title = title.replace('\n', ' ').replace('\r', ' ')
    title = re.sub(r'\s+', ' ', title).strip()
    
    if len(title) > 100:
        title = title[:100]
    
    return title

def parse_price_unit(price_text):
    """解析价格和单位"""
    if not price_text:
        return None, "斤"
    
    price_text = price_text.strip()
    match = re.search(r'([\d.]+)\s*元[/／](.+)', price_text)
    if match:
        return float(match.group(1)), match.group(2).strip()
    
    match = re.search(r'([\d.]+)', price_text)
    if match:
        return float(match.group(1)), "斤"
    
    return None, "斤"

def parse_origin(text):
    """解析产地"""
    if not text:
        return "全国"
    origin = text.strip()[:20]
    return origin if origin else "全国"

def download_and_upload_image(image_url, product_id):
    """下载图片并上传到CDN"""
    try:
        # 创建临时目录
        temp_dir = "/tmp/crawler_images"
        os.makedirs(temp_dir, exist_ok=True)
        
        # 下载图片
        temp_path = os.path.join(temp_dir, f"{product_id}.jpg")
        
        req = urllib.request.Request(
            image_url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        )
        
        with urllib.request.urlopen(req, timeout=15) as response:
            with open(temp_path, 'wb') as f:
                f.write(response.read())
        
        # 尝试上传到CDN
        try:
            with open(temp_path, 'rb') as f:
                files = {'file': f}
                data = {'folder': 'product-images'}
                
                req = urllib.request.Request(
                    IMAGE_UPLOAD_URL,
                    data=urllib.parse.urlencode(data).encode(),
                    method='POST'
                )
                
                with urllib.request.urlopen(req, timeout=30) as response:
                    result = json.loads(response.read().decode())
                    if result.get('url'):
                        return result['url']
        except Exception as e:
            print(f"    CDN上传失败: {e}")
        
        # 如果CDN上传失败，返回原始URL
        return image_url
        
    except Exception as e:
        print(f"    图片下载失败: {e}")
        return None

def crawl_category(page, category_slug):
    """爬取单个分类的商品"""
    url = f"https://www.cnhnb.com/p/{category_slug}/"
    print(f"正在爬取: {url}")
    
    page.goto(url, timeout=30000)
    page.wait_for_timeout(3000)
    
    products = []
    
    try:
        # 获取商品卡片
        cards = page.query_selector_all('.supply-item, [class*="supply-card"], [class*="goods-item"]')
        
        if not cards:
            cards = page.query_selector_all('a[href*="/gongying/"]')[:20]
        
        for card in cards[:15]:
            try:
                product = {}
                
                # 获取详情页链接
                link = card.query_selector('a[href*="/gongying/"]') or card
                href = link.get_attribute('href') if link else None
                
                if href and '/gongying/' in href:
                    # 获取商品ID
                    product_id = href.split('/gongying/')[-1].rstrip('/')
                    
                    # 获取标题
                    title_elem = card.query_selector('h2, h3, .title, [class*="title"]')
                    if title_elem:
                        product['title'] = clean_title(title_elem.inner_text())
                    elif link:
                        product['title'] = clean_title(link.inner_text())
                    
                    # 获取价格
                    price_elem = card.query_selector('[class*="price"], .price')
                    if price_elem:
                        price, unit = parse_price_unit(price_elem.inner_text())
                        product['price'] = price
                        product['unit'] = unit
                    
                    # 获取产地
                    location_elem = card.query_selector('[class*="location"], [class*="addr"]')
                    if location_elem:
                        product['origin'] = parse_origin(location_elem.inner_text())
                    
                    # 获取图片
                    img_elem = card.query_selector('img')
                    if img_elem:
                        img_src = img_elem.get_attribute('src') or img_elem.get_attribute('data-src')
                        if img_src and img_src.startswith('http'):
                            product['image_url'] = img_src
                    
                    # 验证必要字段
                    if product.get('title') and product.get('price'):
                        cat_info = CATEGORY_MAP.get(category_slug, ("蔬菜", "其他蔬菜"))
                        product['category'] = f"{cat_info[0]} / {cat_info[1]}"
                        
                        if 'origin' not in product:
                            product['origin'] = "全国"
                        if 'unit' not in product:
                            product['unit'] = "斤"
                        
                        products.append(product)
                        print(f"  ✓ {product['title'][:30]}... - {product['price']}元/{product['unit']}")
                        
            except Exception as e:
                continue
                
    except Exception as e:
        print(f"  爬取失败: {e}")
    
    return products

def insert_to_database(products):
    """将商品插入数据库"""
    inserted = 0
    
    for product in products:
        try:
            # 处理图片
            images = []
            if product.get('image_url'):
                # 先直接使用原始URL，后续可以考虑上传CDN
                images = [product['image_url']]
            
            data = {
                "title": product['title'],
                "category": product['category'],
                "origin": product['origin'],
                "price": product['price'],
                "unit": product['unit'],
                "quantity": random.randint(100, 5000),
                "description": f"优质{product['title']}，产地直供，品质保证。价格实惠，量大从优，欢迎采购洽谈。",
                "images": images,
                "status": "available"
            }
            
            req = urllib.request.Request(
                f"{SUPABASE_URL}/rest/v1/products",
                data=json.dumps(data).encode('utf-8'),
                headers={
                    "Content-Type": "application/json",
                    "apikey": SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
                    "Prefer": "return=minimal"
                },
                method="POST"
            )
            
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status in [200, 201]:
                    inserted += 1
                    print(f"  ✓ 插入成功: {product['title'][:40]}")
                else:
                    print(f"  ✗ 插入失败: {response.status}")
                    
        except urllib.error.HTTPError as e:
            if e.code == 409:
                print(f"  - 已存在: {product['title'][:40]}")
            else:
                print(f"  ✗ 插入失败: {product['title'][:40]} - {e.code}")
        except Exception as e:
            print(f"  ✗ 插入失败: {product['title'][:40]} - {e}")
    
    return inserted

def main():
    print("=" * 60)
    print("惠农网商品爬虫 - 开始运行")
    print("=" * 60)
    
    all_products = []
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # 设置User-Agent避免被识别
        page.set_extra_http_headers({
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        })
        
        # 随机选择3-5个分类
        num_categories = random.randint(3, 5)
        categories = random.sample(CRAWL_CATEGORIES, min(num_categories, len(CRAWL_CATEGORIES)))
        
        for category in categories:
            products = crawl_category(page, category)
            all_products.extend(products)
            time.sleep(2)
        
        browser.close()
    
    print(f"\n共爬取到 {len(all_products)} 个商品")
    
    # 去重
    seen_titles = set()
    unique_products = []
    for p in all_products:
        title_key = p['title'][:30]
        if title_key not in seen_titles:
            seen_titles.add(title_key)
            unique_products.append(p)
    
    print(f"去重后剩余 {len(unique_products)} 个商品")
    
    # 随机选择10-20个插入
    insert_count = random.randint(10, min(20, len(unique_products)))
    to_insert = random.sample(unique_products, insert_count) if len(unique_products) > insert_count else unique_products
    
    print(f"\n准备插入 {len(to_insert)} 个商品到数据库...")
    
    inserted = insert_to_database(to_insert)
    
    print("\n" + "=" * 60)
    print(f"爬取完成！成功插入 {inserted} 个商品")
    print("=" * 60)

if __name__ == "__main__":
    main()
