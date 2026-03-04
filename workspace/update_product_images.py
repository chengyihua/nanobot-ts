#!/usr/bin/env python3
"""
为没有图片的产品补充图片
"""
import json
import re
import time
import urllib.request
from playwright.sync_api import sync_playwright

# 数据库配置
SUPABASE_URL = "http://47.115.253.217:8080"
SERVICE_ROLE_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoicG9sYXJkYiIsImlhdCI6MTc2ODM2OTgwMiwiZXhwIjoyMDgzNzI5ODAyfQ.OvbbXDxvsQWO-sJkiKFF62ULPzauTVaDJbju9PFDp8Y"

# 搜索关键词映射 - 根据分类提取关键词
CATEGORY_KEYWORDS = {
    "蔬菜 / 叶菜类": ["白菜", "黄心白菜", "小白菜", "生菜", "菠菜"],
    "蔬菜 / 根茎类": ["萝卜", "胡萝卜", "山药", "土豆"],
    "蔬菜 / 茄果类": ["辣椒", "彩椒", "西红柿", "茄子", "小米椒"],
    "蔬菜 / 豆类": ["豆角", "四季豆", "豇豆", "毛豆"],
    "蔬菜 / 葱蒜类": ["大蒜", "大葱", "生姜"],
    "蔬菜 / 食用菌": ["香菇", "平菇", "金针菇"],
    "水果 / 柑橘类": ["橘子", "柑橘", "橙子"],
    "水果 / 仁果类": ["苹果", "梨"],
    "水果 / 核果类": ["桃子", "樱桃"],
    "水果 / 浆果类": ["草莓", "蓝莓"],
}

def extract_keyword(title, category):
    """从标题中提取搜索关键词"""
    # 清理标题
    title = re.sub(r'货版一致|不对版包赔|坏损包赔|包邮|部分包邮|【.*?】', '', title)
    title = title.replace('\n', ' ').strip()
    
    # 根据分类提取关键词
    keywords = []
    
    # 常见农产品关键词
    product_names = [
        "白菜", "黄心白菜", "小白菜", "生菜", "菠菜", "油麦菜",
        "萝卜", "胡萝卜", "山药", "土豆", "红薯",
        "辣椒", "彩椒", "小米椒", "螺丝椒", "西红柿", "茄子",
        "豆角", "四季豆", "豇豆", "毛豆", "豌豆",
        "大蒜", "大葱", "生姜", "韭菜",
        "苹果", "梨", "桃子", "樱桃", "草莓", "蓝莓",
        "橘子", "柑橘", "橙子", "西瓜", "哈密瓜"
    ]
    
    for name in product_names:
        if name in title:
            keywords.append(name)
    
    if keywords:
        return keywords[0]  # 返回第一个匹配的关键词
    
    # 如果没有匹配，返回标题前10个字符
    return title[:10] if len(title) > 10 else title

def search_image_on_huinong(page, keyword):
    """在惠农网搜索产品图片"""
    try:
        # 构建搜索URL
        search_url = f"https://www.cnhnb.com/search/?q={urllib.parse.quote(keyword)}"
        
        page.goto(search_url, timeout=20000)
        page.wait_for_timeout(2000)
        
        # 查找第一个商品的图片
        img = page.query_selector('img[src*="image.cnhnb.com"]')
        if img:
            src = img.get_attribute('src')
            if src and src.startswith('http'):
                return src
        
        # 尝试其他选择器
        imgs = page.query_selector_all('img')
        for img in imgs:
            src = img.get_attribute('src')
            if src and 'image.cnhnb.com' in src:
                return src
        
        return None
    except Exception as e:
        print(f"    搜索失败: {e}")
        return None

def get_product_image_by_category(page, category, keyword):
    """根据分类获取产品图片"""
    # 分类到惠农网URL路径的映射
    category_paths = {
        "蔬菜 / 叶菜类": "bc",      # 白菜
        "蔬菜 / 根茎类": "luobo",   # 萝卜
        "蔬菜 / 茄果类": "lajiao",  # 辣椒
        "蔬菜 / 豆类": "doujiao",   # 豆角
        "蔬菜 / 葱蒜类": "dasuan",  # 大蒜
        "蔬菜 / 食用菌": "syjl",    # 食用菌
        "水果 / 柑橘类": "juzi",    # 橘子
        "水果 / 仁果类": "pingguo", # 苹果
        "水果 / 核果类": "taozi",   # 桃子
        "水果 / 浆果类": "caomei",  # 草莓
    }
    
    path = category_paths.get(category, "bc")  # 默认白菜
    
    try:
        url = f"https://www.cnhnb.com/p/{path}/"
        page.goto(url, timeout=15000)
        page.wait_for_timeout(1500)
        
        # 获取商品图片
        imgs = page.query_selector_all('img[src*="image.cnhnb.com"]')
        for img in imgs[:5]:  # 只看前5张
            src = img.get_attribute('src')
            if src and src.startswith('http'):
                # 跳过太小的图片（缩略图）
                if 'resize' not in src or 'w_525' in src:
                    return src
        
        return None
    except Exception as e:
        print(f"    获取分类图片失败: {e}")
        return None

def update_product_image(product_id, image_url):
    """更新产品图片"""
    try:
        data = {"images": [image_url]}
        
        req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/products?id=eq.{product_id}",
            data=json.dumps(data).encode('utf-8'),
            headers={
                "Content-Type": "application/json",
                "apikey": SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
                "Prefer": "return=minimal"
            },
            method="PATCH"
        )
        
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.status in [200, 204]
    except Exception as e:
        print(f"    更新失败: {e}")
        return False

def get_products_without_images():
    """获取没有图片的产品列表"""
    try:
        req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/products?select=id,title,category&or=(images.is.null,images.eq.{{}})",
            headers={
                "apikey": SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SERVICE_ROLE_KEY}"
            }
        )
        
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"获取产品列表失败: {e}")
        return []

def main():
    print("=" * 60)
    print("产品图片补充脚本 - 开始运行")
    print("=" * 60)
    
    # 获取没有图片的产品
    products = get_products_without_images()
    print(f"\n找到 {len(products)} 个没有图片的产品")
    
    if not products:
        print("所有产品都有图片了！")
        return
    
    updated = 0
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        page.set_extra_http_headers({
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        })
        
        for i, product in enumerate(products):
            product_id = product['id']
            title = product['title']
            category = product.get('category', '蔬菜 / 叶菜类')
            
            # 清理标题
            title_clean = re.sub(r'\n.*', '', title)  # 去掉换行后的内容
            print(f"\n[{i+1}/{len(products)}] {title_clean[:40]}...")
            
            # 提取关键词
            keyword = extract_keyword(title, category)
            print(f"  关键词: {keyword}")
            
            # 方法1: 搜索获取图片
            image_url = search_image_on_huinong(page, keyword)
            
            # 方法2: 如果搜索失败，从分类页面获取
            if not image_url:
                image_url = get_product_image_by_category(page, category, keyword)
            
            if image_url:
                print(f"  找到图片: {image_url[:60]}...")
                
                # 更新数据库
                if update_product_image(product_id, image_url):
                    print(f"  ✓ 更新成功")
                    updated += 1
                else:
                    print(f"  ✗ 更新失败")
            else:
                print(f"  ✗ 未找到图片")
            
            time.sleep(1)  # 避免请求过快
        
        browser.close()
    
    print("\n" + "=" * 60)
    print(f"完成！成功更新 {updated}/{len(products)} 个产品图片")
    print("=" * 60)

if __name__ == "__main__":
    main()
