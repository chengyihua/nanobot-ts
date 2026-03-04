#!/usr/bin/env python3
"""
惠农网商品爬虫 V3 - 直接从NUXT数据获取商品信息
支持：起批量、阶梯价格、供应能力、图片上传七牛云、去重
"""
import json
import re
import random
import time
import urllib.request
import urllib.parse
import uuid
import hmac
import hashlib
import base64
from playwright.sync_api import sync_playwright

# 数据库配置
SUPABASE_URL = "http://47.115.253.217:8080"
SERVICE_ROLE_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoicG9sYXJkYiIsImlhdCI6MTc2ODM2OTgwMiwiZXhwIjoyMDgzNzI5ODAyfQ.OvbbXDxvsQWO-sJkiKFF62ULPzauTVaDJbju9PFDp8Y"

# 七牛云配置
QINIU_ACCESS_KEY = "DrZycDvbl2sLXU866Gc-RrWMRRpTAvSESiU6fm1i"
QINIU_SECRET_KEY = "82GmouLH8Pk5Znf7zHeWSG0DHmN27AHRrC_zgDHm"
QINIU_BUCKET = "lianheimagecdn"
QINIU_DOMAIN = "https://lianheimagecdn.acbnlink.com"

# 分类映射
CATEGORY_MAP = {
    "bc": ("蔬菜", "叶菜类", "白菜"),
    "xbc": ("蔬菜", "叶菜类", "小白菜"),
    "shengcai": ("蔬菜", "叶菜类", "生菜"),
    "bocai": ("蔬菜", "叶菜类", "菠菜"),
    "ymc": ("蔬菜", "叶菜类", "油麦菜"),
    "luobo": ("蔬菜", "根茎类", "萝卜"),
    "hlb": ("蔬菜", "根茎类", "胡萝卜"),
    "shanyao": ("蔬菜", "根茎类", "山药"),
    "lajiao": ("蔬菜", "茄果类", "辣椒"),
    "xhs": ("蔬菜", "茄果类", "西红柿"),
    "qiezi": ("蔬菜", "茄果类", "茄子"),
    "dasuan": ("蔬菜", "葱蒜类", "大蒜"),
    "dacong": ("蔬菜", "葱蒜类", "大葱"),
    "shengjiang": ("蔬菜", "葱蒜类", "生姜"),
    "doujiao": ("蔬菜", "豆类", "豆角"),
    "maodou": ("蔬菜", "豆类", "毛豆"),
    "syjl": ("蔬菜", "食用菌", "食用菌"),
    "juzi": ("水果", "柑橘类", "橘子"),
    "ganju": ("水果", "柑橘类", "柑橘"),
    "pingguo": ("水果", "仁果类", "苹果"),
    "li": ("水果", "仁果类", "梨"),
    "taozi": ("水果", "核果类", "桃子"),
    "yingtao": ("水果", "核果类", "樱桃"),
    "caomei": ("水果", "浆果类", "草莓"),
    "lanmei": ("水果", "浆果类", "蓝莓"),
    "xigua": ("水果", "瓜果类", "西瓜"),
    "hamigua": ("水果", "瓜果类", "哈密瓜"),
    "mangguo": ("水果", "热带水果", "芒果"),
}

CRAWL_CATEGORIES = list(CATEGORY_MAP.keys())


def clean_title(title):
    """清理标题"""
    if not title:
        return ""
    remove_patterns = [
        r'货版一致', r'不对版包赔', r'坏损包赔', r'坏果包赔',
        r'包邮', r'部分包邮', r'【推荐】', r'【.*?】',
    ]
    for pattern in remove_patterns:
        title = re.sub(pattern, '', title)
    title = title.replace('\n', ' ').replace('\r', ' ')
    title = re.sub(r'\s+', ' ', title).strip()
    return title[:100] if len(title) > 100 else title


def get_existing_titles():
    """获取数据库中已有的商品标题（用于去重）"""
    url = f"{SUPABASE_URL}/rest/v1/products?select=title"
    req = urllib.request.Request(url)
    req.add_header('apikey', SERVICE_ROLE_KEY)
    req.add_header('Authorization', f'Bearer {SERVICE_ROLE_KEY}')
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())
            # 标题去重（取前50个字符比较）
            return {item['title'][:50].strip() if item.get('title') else '' for item in data}
    except Exception as e:
        print(f"获取已有标题失败: {e}")
        return set()


def upload_to_qiniu(image_url, product_id):
    """下载图片并上传到七牛云"""
    try:
        # 下载图片
        req = urllib.request.Request(image_url)
        req.add_header('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')
        req.add_header('Referer', 'https://www.cnhnb.com/')
        
        with urllib.request.urlopen(req, timeout=15) as response:
            image_data = response.read()
        
        # 生成上传凭证
        timestamp = int(time.time())
        ext = image_url.split('?')[0].split('.')[-1] or 'jpg'
        safe_ext = ext if ext in ['jpg', 'jpeg', 'png', 'webp', 'gif'] else 'jpg'
        key = f"products/{product_id[:8]}_{timestamp}.{safe_ext}"
        
        put_policy = json.dumps({
            "scope": f"{QINIU_BUCKET}:{key}",
            "deadline": timestamp + 3600
        })
        encoded_put_policy = base64.urlsafe_b64encode(put_policy.encode()).decode()
        sign = hmac.new(QINIU_SECRET_KEY.encode(), encoded_put_policy.encode(), hashlib.sha1).digest()
        encoded_sign = base64.urlsafe_b64encode(sign).decode()
        upload_token = f"{QINIU_ACCESS_KEY}:{encoded_sign}:{encoded_put_policy}"
        
        # 上传
        boundary = '----WebKitFormBoundary' + ''.join(random.choices('abcdefghijklmnopqrstuvwxyz0123456789', k=16))
        body = f'--{boundary}\r\nContent-Disposition: form-data; name="token"\r\n\r\n{upload_token}\r\n'
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="key"\r\n\r\n{key}\r\n'
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="image.{safe_ext}"\r\n'
        body += 'Content-Type: image/jpeg\r\n\r\n'
        
        body_bytes = body.encode() + image_data + f'\r\n--{boundary}--\r\n'.encode()
        
        upload_req = urllib.request.Request(
            'https://upload-z2.qiniup.com/',
            data=body_bytes,
            method='POST'
        )
        upload_req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')
        
        with urllib.request.urlopen(upload_req, timeout=30) as response:
            result = json.loads(response.read().decode())
            return f"{QINIU_DOMAIN}/{key}"
    
    except Exception as e:
        print(f"    图片上传失败: {e}")
        return None


def crawl_category(page, category):
    """爬取一个分类的商品"""
    print(f"\n正在爬取分类: {category}")
    
    category_info = CATEGORY_MAP.get(category, ("蔬菜", "其他", category))
    url = f"https://www.cnhnb.com/p/{category}/"
    
    products = []
    
    try:
        page.goto(url, timeout=20000, wait_until='domcontentloaded')
        page.wait_for_timeout(2000)
        
        # 滚动加载更多
        for _ in range(5):
            page.evaluate('window.scrollBy(0, 800)')
            page.wait_for_timeout(300)
        
        # 获取NUXT数据
        nuxt_data = page.evaluate('() => window.__NUXT__ || null')
        
        if nuxt_data:
            data = nuxt_data.get('data', [])
            for item in data:
                if isinstance(item, dict) and 'supplyList' in item:
                    supply_list = item['supplyList']
                    if isinstance(supply_list, dict):
                        # 数据在datas字段
                        product_list = supply_list.get('datas', supply_list.get('list', []))
                    else:
                        product_list = []
                    
                    for p in product_list:
                        if not isinstance(p, dict):
                            continue
                        
                        product = {
                            'supply_id': p.get('supplyId'),
                            'title': clean_title(p.get('title', '')),
                            'price': p.get('price', 0),
                            'unit': p.get('unit', '斤'),
                            'moq': p.get('minimum', 1),
                            'origin': p.get('address', ''),
                            'image': p.get('url400', ''),
                            'category': category_info[0],
                            'sub_category': category_info[1],
                            'breed_name': p.get('breedName', category_info[2]),
                            'shop_name': p.get('shopName', ''),
                        }
                        
                        # 验证必要字段
                        if product['title'] and product['price'] > 0:
                            products.append(product)
                            print(f"  [{len(products)}] {product['title'][:30]}... - {product['price']}元/{product['unit']} (起批:{product['moq']})")
                    
                    break
        
    except Exception as e:
        print(f"  爬取分类失败: {e}")
    
    return products


def insert_to_database(products, existing_titles):
    """插入数据库"""
    inserted = 0
    
    for product in products:
        try:
            # 去重检查 - 只按标题去重
            title_key = product['title'][:50].strip()
            if title_key in existing_titles:
                print(f"  跳过(标题重复): {product['title'][:30]}")
                continue
            
            product_id = str(uuid.uuid4())
            
            # 上传图片
            images = []
            if product.get('image'):
                print(f"  上传图片: {product['title'][:30]}...")
                new_url = upload_to_qiniu(product['image'], product_id)
                if new_url:
                    images.append(new_url)
                    print(f"    图片上传成功: {new_url}")
            
            data = {
                "id": product_id,
                "title": product['title'],
                "category": product['category'],
                "origin": product.get('origin', product['category']),
                "price": product['price'],
                "unit": product.get('unit', '斤'),
                "moq": product.get('moq', 1),
                "tier_prices": product.get('tier_prices', []),
                "supply_capacity": product.get('supply_capacity'),
                "supply_unit": product.get('supply_unit'),
                "images": images,
                "status": "active"
            }
            
            url = f"{SUPABASE_URL}/rest/v1/products"
            req = urllib.request.Request(url, data=json.dumps(data).encode(), method='POST')
            req.add_header('Content-Type', 'application/json')
            req.add_header('apikey', SERVICE_ROLE_KEY)
            req.add_header('Authorization', f'Bearer {SERVICE_ROLE_KEY}')
            req.add_header('Prefer', 'return=minimal')
            
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status in [200, 201]:
                    inserted += 1
                    existing_titles.add(title_key)  # 更新去重集合
                    print(f"  ✓ 插入成功: {product['title'][:30]}")
        
        except urllib.error.HTTPError as e:
            error_body = e.read().decode() if e.fp else ''
            if e.code == 409:
                print(f"  跳过(已存在): {product['title'][:30]}")
            else:
                print(f"  ✗ 插入失败({e.code}): {error_body[:100]}")
        except Exception as e:
            print(f"  ✗ 插入失败: {e}")
    
    return inserted


def main():
    print("=" * 60)
    print("惠农网商品爬虫 V3 - 开始运行")
    print("=" * 60)
    
    # 获取已有标题
    print("\n正在获取数据库中已有商品...")
    existing_titles = get_existing_titles()
    print(f"数据库中已有 {len(existing_titles)} 个商品")
    
    all_products = []
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_extra_http_headers({
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        })
        
        # 随机选择分类
        num_categories = random.randint(3, 5)
        categories = random.sample(CRAWL_CATEGORIES, min(num_categories, len(CRAWL_CATEGORIES)))
        
        for category in categories:
            products = crawl_category(page, category)
            all_products.extend(products)
            time.sleep(1)
        
        browser.close()
    
    print(f"\n共爬取到 {len(all_products)} 个商品")
    
    if not all_products:
        print("\n没有爬取到商品")
        return
    
    # 去重 - 排除已存在的标题
    unique_products = []
    for p in all_products:
        title_key = p['title'][:50].strip()
        if title_key not in existing_titles:
            unique_products.append(p)
            existing_titles.add(title_key)  # 防止本次重复
    
    print(f"去重后剩余 {len(unique_products)} 个新商品")
    
    if not unique_products:
        print("\n没有新商品需要插入")
        return
    
    # 随机选择10-20个插入
    insert_count = min(random.randint(10, 20), len(unique_products))
    to_insert = random.sample(unique_products, insert_count)
    
    print(f"\n准备插入 {len(to_insert)} 个商品到数据库...")
    
    inserted = insert_to_database(to_insert, existing_titles)
    
    print("\n" + "=" * 60)
    print(f"爬取完成！成功插入 {inserted} 个商品")
    print("=" * 60)


if __name__ == "__main__":
    main()
