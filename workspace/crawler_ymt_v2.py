#!/usr/bin/env python3
"""
一亩田农产品爬虫 V2
特点：
1. 从一亩田首页获取各分类商品数据
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

QINIU_ACCESS_KEY = "DrZycDvbl2sLXU866Gc-RrWMRRpTAvSESiU6fm1i"
QINIU_SECRET_KEY = "82GmouLH8Pk5Znf7zHeWSG0DHmN27AHRrC_zgDHm"
QINIU_BUCKET = "lianheimagecdn"
QINIU_DOMAIN = "https://lianheimagecdn.acbnlink.com"

# 分类映射
CATEGORY_MAP = {
    "水果": "水果 / 仁果类",
    "蔬菜": "蔬菜 / 叶菜类",
    "中药材": "中药材 / 根茎类",
    "种苗": "种苗 / 果树苗",
    "农副产品": "农副产品 / 干货",
    "禽畜牧蛋肉": "肉禽蛋 / 畜肉类",
    "绿化苗木": "绿化苗木 / 乔木",
    "粮油作物": "粮油作物 / 粮食",
    "水产": "水产 / 鱼类",
    "食用菌": "食用菌 / 菌菇",
    "坚果干果": "坚果干果 / 干果",
    "食品": "食品 / 加工食品",
    "种子": "种子 / 蔬菜种子",
    "花卉盆景": "花卉盆景 / 盆栽",
    "肥料": "肥料 / 有机肥",
    "饲料": "饲料 / 畜禽饲料",
}


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


def extract_products_from_page(page):
    """从一亩田页面提取商品"""
    products = []
    
    try:
        # 获取页面状态数据
        state = page.evaluate('() => window.__NUXT__')
        
        if state and 'fetch' in state:
            for key, value in state['fetch'].items():
                if isinstance(value, dict) and 'categories' in value:
                    categories = value['categories']
                    
                    for cat in categories:
                        cat_name = cat.get('name', '')
                        supply_list = cat.get('supplyList', [])
                        
                        for item in supply_list:
                            try:
                                title = clean_title(item.get('supply_name', ''))
                                price_str = item.get('price', '0')
                                
                                # 处理价格
                                try:
                                    price = float(price_str)
                                except:
                                    price = 0
                                
                                if not title or price <= 0:
                                    continue
                                
                                product = {
                                    'title': title,
                                    'price': price,
                                    'unit': item.get('unit_name', '斤'),
                                    'origin': item.get('supply_address', ''),
                                    'image': item.get('supply_img', ''),
                                    'category': cat_name,
                                    'batch': item.get('supply_batch', '')
                                }
                                products.append(product)
                            except Exception as e:
                                continue
        
        return products
    except Exception as e:
        print(f"提取商品失败: {e}")
        return []


def insert_products(products, existing_titles):
    """插入商品到数据库"""
    inserted = 0
    
    for p in products:
        if p['title'][:50].strip() in existing_titles:
            continue
        
        # 上传图片
        image_url = None
        if p['image']:
            image_url = upload_to_qiniu(p['image'])
        
        if not image_url:
            print(f"    跳过（无图片）: {p['title'][:30]}")
            continue
        
        # 获取分类
        category = CATEGORY_MAP.get(p['category'], f"其他 / {p['category']}")
        
        # 构建数据
        data = {
            'id': str(uuid.uuid4()),
            'title': p['title'],
            'price': p['price'],
            'unit': p['unit'],
            'origin': p['origin'],
            'images': [image_url],
            'category': category
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
    print("一亩田农产品爬虫 V2 - 开始")
    print("=" * 60)
    
    existing_titles = get_existing_titles()
    print(f"数据库已有商品: {len(existing_titles)} 个")
    
    total_products = 0
    total_inserted = 0
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        print("\n📍 访问一亩田首页...")
        page.goto("https://m.ymt.com/", timeout=30000)
        page.wait_for_load_state('networkidle')
        time.sleep(3)
        
        # 提取商品
        products = extract_products_from_page(page)
        print(f"提取到 {len(products)} 个商品")
        total_products = len(products)
        
        # 按分类统计
        cat_count = {}
        for p in products:
            cat = p['category']
            cat_count[cat] = cat_count.get(cat, 0) + 1
        
        print("\n各分类商品数量:")
        for cat, count in sorted(cat_count.items(), key=lambda x: -x[1]):
            print(f"  {cat}: {count} 个")
        
        # 插入数据库
        if products:
            print("\n插入数据库...")
            inserted = insert_products(products, existing_titles)
            total_inserted = inserted
        
        browser.close()
    
    print("\n" + "=" * 60)
    print(f"爬取完成！")
    print(f"  提取商品: {total_products} 个")
    print(f"  新增入库: {total_inserted} 个")
    print("=" * 60)


if __name__ == "__main__":
    main()
