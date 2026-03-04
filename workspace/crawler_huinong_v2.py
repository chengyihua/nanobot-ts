#!/usr/bin/env python3
"""
惠农网商品爬虫 V2 - 爬取商品数据并写入链禾网数据库
支持：起批量、阶梯价格、供应能力、图片上传七牛云、去重
"""
import json
import re
import random
import time
import urllib.request
import urllib.parse
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
    "bc": ("蔬菜", "叶菜类"),
    "xbc": ("蔬菜", "叶菜类"),
    "shengcai": ("蔬菜", "叶菜类"),
    "bocai": ("蔬菜", "叶菜类"),
    "ymc": ("蔬菜", "叶菜类"),
    "luobo": ("蔬菜", "根茎类"),
    "hlb": ("蔬菜", "根茎类"),
    "shanyao": ("蔬菜", "根茎类"),
    "lajiao": ("蔬菜", "茄果类"),
    "xhs": ("蔬菜", "茄果类"),
    "qiezi": ("蔬菜", "茄果类"),
    "dasuan": ("蔬菜", "葱蒜类"),
    "dacong": ("蔬菜", "葱蒜类"),
    "shengjiang": ("蔬菜", "葱蒜类"),
    "doujiao": ("蔬菜", "豆类"),
    "maodou": ("蔬菜", "豆类"),
    "syjl": ("蔬菜", "食用菌"),
    "juzi": ("水果", "柑橘类"),
    "ganju": ("水果", "柑橘类"),
    "pingguo": ("水果", "仁果类"),
    "li": ("水果", "仁果类"),
    "taozi": ("水果", "核果类"),
    "yingtao": ("水果", "核果类"),
    "caomei": ("水果", "浆果类"),
    "lanmei": ("水果", "浆果类"),
    "xigua": ("水果", "瓜果类"),
    "hamigua": ("水果", "瓜果类"),
    "mangguo": ("水果", "热带水果"),
}

CRAWL_CATEGORIES = [
    "bc", "luobo", "lajiao", "xhs", "doujiao",
    "juzi", "pingguo", "taozi", "qiezi", "bocai",
    "shengcai", "ymc", "hlb", "shanyao", "dasuan"
]


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


def parse_price(price_str):
    """解析价格字符串，返回价格和单位"""
    if not price_str:
        return None, None
    
    # 清理
    price_str = price_str.replace('￥', '').replace('¥', '').strip()
    
    # 匹配 "0.5-1.2元/斤" 或 "0.5元/斤" 或 "面议"
    if '面议' in price_str:
        return 0, '面议'
    
    # 匹配价格范围 "0.5-1.2"
    range_match = re.match(r'([\d.]+)\s*[-~]\s*([\d.]+)', price_str)
    if range_match:
        low = float(range_match.group(1))
        high = float(range_match.group(2))
        price = round((low + high) / 2, 2)
    else:
        # 单一价格
        single_match = re.search(r'([\d.]+)', price_str)
        if single_match:
            price = float(single_match.group(1))
        else:
            return None, None
    
    # 提取单位
    unit_match = re.search(r'/([^\d\s]+)$', price_str)
    unit = unit_match.group(1) if unit_match else '斤'
    
    return price, unit


def parse_moq(moq_str):
    """解析起批量"""
    if not moq_str:
        return 1
    
    # 匹配 "10斤起批" "100斤起" "起批100斤"
    match = re.search(r'(\d+)', str(moq_str))
    if match:
        return int(match.group(1))
    return 1


def parse_tier_prices(price_text):
    """解析阶梯价格"""
    tier_prices = []
    
    # 匹配类似 "100-500斤:1.2元/斤, 500斤以上:1.0元/斤"
    if not price_text:
        return tier_prices
    
    # 简单匹配
    patterns = re.findall(r'(\d+)[-~]?(\d*)\s*(斤|件|箱|个)[:：]?\s*([\d.]+)', price_text)
    for p in patterns:
        min_qty = int(p[0])
        max_qty = int(p[1]) if p[1] else None
        unit = p[2]
        price = float(p[3])
        tier_prices.append({
            "min_quantity": min_qty,
            "max_quantity": max_qty,
            "price": price,
            "unit": unit
        })
    
    return tier_prices


def get_existing_titles():
    """获取数据库中已有的商品标题（用于去重）"""
    url = f"{SUPABASE_URL}/rest/v1/products?select=title"
    req = urllib.request.Request(url)
    req.add_header('apikey', SERVICE_ROLE_KEY)
    req.add_header('Authorization', f'Bearer {SERVICE_ROLE_KEY}')
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())
            return {item['title'][:50] for item in data}
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
        
        # 上传到七牛云（使用API）
        import hmac
        import hashlib
        import base64
        import time as t
        
        timestamp = int(t.time())
        ext = image_url.split('?')[0].split('.')[-1] or 'jpg'
        safe_ext = ext if ext in ['jpg', 'jpeg', 'png', 'webp', 'gif'] else 'jpg'
        key = f"products/{product_id[:8]}_{timestamp}.{safe_ext}"
        
        # 生成上传凭证
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


def crawl_product_detail(page, url):
    """爬取商品详情页"""
    try:
        page.goto(url, timeout=15000, wait_until='domcontentloaded')
        time.sleep(1)
        
        detail = {
            'moq': 1,
            'tier_prices': [],
            'supply_capacity': None,
            'supply_unit': None,
            'origin': '',
            'description': ''
        }
        
        # 起批量
        moq_selectors = [
            '.product-moq', '.moq-value', '[class*="moq"]',
            '.min-buy', '.start-quantity'
        ]
        for selector in moq_selectors:
            try:
                moq_el = page.query_selector(selector)
                if moq_el:
                    detail['moq'] = parse_moq(moq_el.inner_text())
                    break
            except:
                pass
        
        # 阶梯价格
        try:
            price_table = page.query_selector('.price-table, .tier-price-table, [class*="price-tier"]')
            if price_table:
                detail['tier_prices'] = parse_tier_prices(price_table.inner_text())
        except:
            pass
        
        # 产地
        try:
            origin_el = page.query_selector('.product-origin, [class*="origin"], .address')
            if origin_el:
                detail['origin'] = origin_el.inner_text().strip()[:50]
        except:
            pass
        
        # 供应能力
        try:
            supply_el = page.query_selector('.supply-capacity, [class*="supply"]')
            if supply_el:
                text = supply_el.inner_text()
                match = re.search(r'(\d+)\s*(斤|吨|件|箱)', text)
                if match:
                    detail['supply_capacity'] = int(match.group(1))
                    detail['supply_unit'] = match.group(2)
        except:
            pass
        
        return detail
    
    except Exception as e:
        print(f"    详情页爬取失败: {e}")
        return None


def crawl_category(page, category):
    """爬取一个分类的商品"""
    print(f"\n正在爬取分类: {category}")
    
    category_info = CATEGORY_MAP.get(category, ("蔬菜", "其他"))
    url = f"https://www.cnhnb.com/p/{category}/"
    
    products = []
    
    try:
        page.goto(url, timeout=20000, wait_until='domcontentloaded')
        time.sleep(2)
        
        # 滚动加载更多
        for _ in range(3):
            page.evaluate('window.scrollBy(0, 1000)')
            time.sleep(0.5)
        
        # 查找商品卡片
        cards = page.query_selector_all('.product-item, .goods-item, [class*="product-card"]')
        
        if not cards:
            # 尝试其他选择器
            cards = page.query_selector_all('a[href*="/product/"]')
        
        print(f"  找到 {len(cards)} 个商品卡片")
        
        for i, card in enumerate(cards[:15]):  # 每个分类最多15个
            try:
                product = {}
                
                # 标题
                title_el = card.query_selector('.product-title, .goods-title, h3, [class*="title"]')
                if title_el:
                    product['title'] = clean_title(title_el.inner_text())
                
                # 链接
                link_el = card.query_selector('a[href*="/product/"]')
                if link_el:
                    href = link_el.get_attribute('href')
                    if href:
                        product['url'] = f"https://www.cnhnb.com{href}" if href.startswith('/') else href
                
                # 价格
                price_el = card.query_selector('.price, .product-price, [class*="price"]')
                if price_el:
                    price_text = price_el.inner_text()
                    product['price'], product['unit'] = parse_price(price_text)
                
                # 图片
                img_el = card.query_selector('img')
                if img_el:
                    src = img_el.get_attribute('src') or img_el.get_attribute('data-src')
                    if src and not src.startswith('data:'):
                        product['image'] = src if src.startswith('http') else f"https:{src}"
                
                # 分类
                product['category'] = category_info[0]
                product['sub_category'] = category_info[1]
                
                # 验证必要字段
                if product.get('title') and product.get('price'):
                    products.append(product)
                    print(f"  [{len(products)}] {product['title'][:30]}... - {product.get('price')}元/{product.get('unit', '斤')}")
                
            except Exception as e:
                continue
        
        # 爬取详情页获取更多信息
        for product in products[:5]:  # 只爬前5个的详情
            if product.get('url'):
                detail = crawl_product_detail(page, product['url'])
                if detail:
                    product.update(detail)
                time.sleep(0.5)
        
    except Exception as e:
        print(f"  爬取分类失败: {e}")
    
    return products


def insert_to_database(products):
    """插入数据库"""
    inserted = 0
    
    for product in products:
        try:
            import uuid
            product_id = str(uuid.uuid4())
            
            # 上传图片
            images = []
            if product.get('image'):
                new_url = upload_to_qiniu(product['image'], product_id)
                if new_url:
                    images.append(new_url)
            
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
                    print(f"  ✓ 插入成功: {product['title'][:30]}")
        
        except Exception as e:
            print(f"  ✗ 插入失败: {e}")
    
    return inserted


def main():
    print("=" * 60)
    print("惠农网商品爬虫 V2 - 开始运行")
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
            time.sleep(2)
        
        browser.close()
    
    print(f"\n共爬取到 {len(all_products)} 个商品")
    
    # 去重 - 排除数据库中已有的
    unique_products = []
    for p in all_products:
        title_key = p['title'][:50]
        if title_key not in existing_titles:
            unique_products.append(p)
            existing_titles.add(title_key)  # 防止本次爬取重复
    
    print(f"去重后剩余 {len(unique_products)} 个新商品")
    
    if not unique_products:
        print("\n没有新商品需要插入")
        return
    
    # 随机选择10-20个插入
    insert_count = min(random.randint(10, 20), len(unique_products))
    to_insert = random.sample(unique_products, insert_count)
    
    print(f"\n准备插入 {len(to_insert)} 个商品到数据库...")
    
    inserted = insert_to_database(to_insert)
    
    print("\n" + "=" * 60)
    print(f"爬取完成！成功插入 {inserted} 个商品")
    print("=" * 60)


if __name__ == "__main__":
    main()
