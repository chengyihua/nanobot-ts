#!/usr/bin/env python3
"""
一亩田农产品爬虫
特点：
1. 支持多种农产品分类
2. 完整数据：标题、价格、单位、产地、图片
3. 图片上传七牛云
4. 自动去重
"""

import json
import re
import time
import urllib.request
import uuid
from datetime import datetime
from playwright.sync_api import sync_playwright
from qiniu import Auth, put_data

# 配置
SUPABASE_URL = "http://47.115.253.217:8080"
SERVICE_ROLE_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoicG9sYXJkYiIsImlhdCI6MTc2ODM2OTgwMiwiZXhwIjoyMDgzNzI5ODAyfQ.OvbbXDxvsQWO-sJkiKFF62ULPzauTVaDJbju9PFDp8Y"

QINIU_ACCESS_KEY = "n3f3wqPzYbRf-ecL9lQxI6M5hVLsKqWpJzGxTmHk"
QINIU_SECRET_KEY = "e8FgD7jH2sN4pR1vC6wX9yK3bA5zM0qL7tU8iO2a"
QINIU_BUCKET = "lianheimagecdn"
QINIU_DOMAIN = "https://lianheimagecdn.acbnlink.com"

# 禽肉蛋类搜索关键词
POULTRY_KEYWORDS = [
    ("鸡蛋", "肉禽蛋", "蛋类"),
    ("鸭蛋", "肉禽蛋", "蛋类"),
    ("鹅蛋", "肉禽蛋", "蛋类"),
    ("活鸡", "肉禽蛋", "家禽类"),
    ("活鸭", "肉禽蛋", "家禽类"),
    ("活鹅", "肉禽蛋", "家禽类"),
    ("牛肉", "肉禽蛋", "畜肉类"),
    ("羊肉", "肉禽蛋", "畜肉类"),
    ("猪肉", "肉禽蛋", "畜肉类"),
]


def get_existing_titles():
    """获取已有标题"""
    url = f"{SUPABASE_URL}/rest/v1/products?select=title"
    req = urllib.request.Request(url)
    req.add_header('apikey', SERVICE_ROLE_KEY)
    req.add_header('Authorization', f'Bearer {SERVICE_ROLE_KEY}')
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode())
            return {item['title'][:50].strip() for item in data}
    except Exception as e:
        print(f"获取已有标题失败: {e}")
        return set()


def upload_to_qiniu(image_url):
    """上传图片到七牛云"""
    try:
        if not image_url or not image_url.startswith('http'):
            return None
        
        # 处理URL
        if image_url.startswith('//'):
            image_url = 'https:' + image_url
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://m.ymt.com/',
            'Accept': 'image/*'
        }
        req = urllib.request.Request(image_url, headers=headers)
        with urllib.request.urlopen(req, timeout=20) as response:
            image_data = response.read()
        
        if len(image_data) < 100:
            return None
        
        q = Auth(QINIU_ACCESS_KEY, QINIU_SECRET_KEY)
        filename = f"products/{uuid.uuid4().hex}.jpg"
        token = q.upload_token(QINIU_BUCKET, filename, 3600)
        ret, info = put_data(token, filename, image_data)
        
        if ret:
            return f"{QINIU_DOMAIN}/{filename}"
        return None
    except Exception as e:
        print(f"    图片上传失败: {e}")
        return None


def clean_title(title):
    """清理标题"""
    if not title:
        return ""
    title = re.sub(r'【.*?】', '', title)
    title = title.replace('\n', ' ').strip()
    return title[:100]


def extract_products(page, keyword):
    """从一亩田提取商品"""
    products = []
    
    try:
        # 等待页面加载
        time.sleep(2)
        
        # 查找所有商品卡片 - 一亩田的商品在列表中
        items = page.query_selector_all('.goods-list-item, .product-item, [class*="goods-item"]')
        
        if not items:
            # 尝试其他选择器
            items = page.query_selector_all('[class*="item"]')
        
        print(f"    找到 {len(items)} 个元素")
        
        for item in items[:30]:
            try:
                # 获取标题
                title_el = item.query_selector('[class*="title"], h3, h4, .name')
                if not title_el:
                    continue
                title = clean_title(title_el.inner_text())
                
                # 确保标题包含关键词
                if keyword not in title:
                    continue
                
                # 获取价格
                price_el = item.query_selector('[class*="price"]')
                price_text = price_el.inner_text() if price_el else ""
                
                # 解析价格
                price_match = re.search(r'(\d+\.?\d*)', price_text)
                price = float(price_match.group(1)) if price_match else 0
                
                # 解析单位
                unit_match = re.search(r'/(斤|公斤|吨|件|箱)', price_text)
                unit = unit_match.group(1) if unit_match else "斤"
                
                # 获取产地
                location_el = item.query_selector('[class*="location"], [class*="addr"], [class*="origin"]')
                location = location_el.inner_text().strip() if location_el else ""
                
                # 获取图片
                img_el = item.query_selector('img')
                img_url = img_el.get_attribute('src') if img_el else ""
                if img_url and not img_url.startswith('http'):
                    if img_url.startswith('//'):
                        img_url = 'https:' + img_url
                    else:
                        img_url = 'https://m.ymt.com' + img_url
                
                if title and price > 0:
                    products.append({
                        'title': title,
                        'price': price,
                        'unit': unit,
                        'location': location,
                        'image_url': img_url,
                        'keyword': keyword
                    })
            except Exception as e:
                continue
        
        return products
    except Exception as e:
        print(f"    页面解析失败: {e}")
        return []


def insert_products(products, existing_titles, category_info):
    """插入商品到数据库"""
    inserted = 0
    
    for p in products:
        if p['title'][:50].strip() in existing_titles:
            continue
        
        # 上传图片
        image_url = None
        if p['image_url']:
            image_url = upload_to_qiniu(p['image_url'])
        
        if not image_url:
            print(f"    跳过（无图片）: {p['title'][:30]}")
            continue
        
        # 构建数据
        data = {
            'id': str(uuid.uuid4()),
            'title': p['title'],
            'price': p['price'],
            'unit': p['unit'],
            'origin': p['location'],
            'images': [image_url],
            'category': f"{category_info[0]} / {category_info[1]}",
            'tags': [p['keyword']]
        }
        
        # 插入数据库
        url = f"{SUPABASE_URL}/rest/v1/products"
        req = urllib.request.Request(url, data=json.dumps(data).encode(), method='POST')
        req.add_header('apikey', SERVICE_ROLE_KEY)
        req.add_header('Authorization', f'Bearer {SERVICE_ROLE_KEY}')
        req.add_header('Content-Type', 'application/json')
        req.add_header('Prefer', 'return=minimal')
        
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                inserted += 1
                existing_titles.add(p['title'][:50].strip())
                print(f"    ✅ {p['title'][:40]}")
        except Exception as e:
            print(f"    ❌ 插入失败: {e}")
    
    return inserted


def main():
    print("=" * 60)
    print("一亩田农产品爬虫 - 开始")
    print("=" * 60)
    
    existing_titles = get_existing_titles()
    print(f"数据库已有商品: {len(existing_titles)} 个")
    
    total_inserted = 0
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        for keyword, cat1, cat2 in POULTRY_KEYWORDS:
            print(f"\n📍 搜索: {keyword}")
            
            # 搜索URL
            search_url = f"https://m.ymt.com/search?kw={keyword}"
            
            try:
                page.goto(search_url, timeout=30000)
                page.wait_for_load_state('networkidle')
                
                products = extract_products(page, keyword)
                print(f"    提取到 {len(products)} 个商品")
                
                if products:
                    inserted = insert_products(products, existing_titles, (cat1, cat2))
                    total_inserted += inserted
                    print(f"    新增: {inserted} 个")
                
                time.sleep(1)
            except Exception as e:
                print(f"    访问失败: {e}")
        
        browser.close()
    
    print("\n" + "=" * 60)
    print(f"爬取完成！共新增 {total_inserted} 个商品")
    print("=" * 60)


if __name__ == "__main__":
    main()
