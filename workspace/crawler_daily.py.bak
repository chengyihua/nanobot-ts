#!/usr/bin/env python3
"""
惠农网商品爬虫 - 每日定时爬取
特点：
1. 每天轮换不同品类，覆盖蔬菜、水果、禽畜肉蛋、粮油、水产等
2. 完整数据：标题、价格、单位、起批量、产地、供应能力、图片
3. 图片上传七牛云
4. 自动去重
"""
import json
import re
import random
import time
import urllib.request
import urllib.parse
import urllib.error
import uuid
from datetime import datetime
from playwright.sync_api import sync_playwright
from qiniu import Auth, put_data

# 数据库配置
SUPABASE_URL = "http://47.115.253.217:8080"
SERVICE_ROLE_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoicG9sYXJkYiIsImlhdCI6MTc2ODM2OTgwMiwiZXhwIjoyMDgzNzI5ODAyfQ.OvbbXDxvsQWO-sJkiKFF62ULPzauTVaDJbju9PFDp8Y"

# 七牛云配置
QINIU_ACCESS_KEY = "DrZycDvbl2sLXU866Gc-RrWMRRpTAvSESiU6fm1i"
QINIU_SECRET_KEY = "82GmouLH8Pk5Znf7zHeWSG0DHmN27AHRrC_zgDHm"
QINIU_BUCKET = "lianheimagecdn"
QINIU_DOMAIN = "https://lianheimagecdn.acbnlink.com"

# 完整分类映射 - 按品类分组，每天选一个组
CATEGORY_GROUPS = {
    # 蔬菜类
    "蔬菜-叶菜类": ["bc", "xbc", "shengcai", "bocai", "ymc", "wawacai", "xianc", "kxco", "xiangcai"],
    "蔬菜-根茎类": ["luobo", "hlb", "shanyao", "dongsun", "gegen", "liou", "xbh", "lusun"],
    "蔬菜-茄果类": ["lajiao", "xhs", "qiezi", "qiukui", "xyumi"],
    "蔬菜-葱蒜类": ["dasuan", "dacong", "shengjiang", "yuancong", "xiaocong", "suantai", "suanmiao", "jiuhuang"],
    "蔬菜-豆类": ["doujiao", "maodou", "wandouo", "sijidou", "biandou", "hld", "daodou"],
    "蔬菜-食用菌": ["syjl", "xianggu", "mogu", "haixg", "lurg", "jig", "yuanm"],
    
    # 水果类
    "水果-柑橘类": ["juzi", "ganju", "chengzi", "gan", "shatangju"],
    "水果-仁果类": ["pingguo", "li", "haguo"],
    "水果-核果类": ["taozi", "yingtao", "lizi", "xingzi", "zao"],
    "水果-浆果类": ["caomei", "lanmei", "putao", "shiliu"],
    "水果-瓜果类": ["xigua", "hamigua", "donggua", "甜瓜"],
    "水果-热带水果": ["mangguo", "xijiao", "lizhi", "longyan", "boluo", "mihoutao", "shanzhu", "liulian"],
    
    # 禽畜肉蛋类
    "禽畜-蛋类": ["jidan", "yadan", "andan", "edan", "gzedan", "pidan", "xiandan"],
    "禽畜-活禽": ["huoji", "huoya", "huoe", "an", "gezi"],
    "禽畜-活畜": ["huoniu", "huoyang", "zhubao", "tu", "lv"],
    "禽畜-禽苗": ["jimiao", "yamiao", "emiao", "zhumiao", "anmiao"],
    "禽畜-肉类": ["niurou", "yangrou", "zhurou", "turou", "jiya"],
    
    # 粮油米面
    "粮油-粮食": ["dami", "xiaomai", "yumi", "daidou", "lvdo", "hongdou"],
    "粮油-油料": ["caizi", "huasheng", "dado", "zhima", "xiangyou"],
    "粮油-米面": ["mianfen", "damifen", "xiaomifen", "zaliangfen"],
    
    # 水产类
    "水产-鱼类": ["lianyu", "caoyu", "qingyu", "jiyu", "guiyu", "luofei"],
    "水产-虾蟹": ["xia", "xie", "longxia", "jixia"],
    "水产-其他": ["haishen", "beilei", "ziliao"],
    
    # 农副加工
    "农副-干货": ["ganjun", "muxer", "huanghua", "xianggu-gan"],
    "农副-腌制品": ["xiancai", "paojiao", "suancai"],
}

# 详细分类信息（品类代码 -> (大类, 子类, 品种名)）
CATEGORY_MAP = {
    # 蔬菜-叶菜类
    "bc": ("蔬菜", "叶菜类", "白菜"),
    "xbc": ("蔬菜", "叶菜类", "小白菜"),
    "shengcai": ("蔬菜", "叶菜类", "生菜"),
    "bocai": ("蔬菜", "叶菜类", "菠菜"),
    "ymc": ("蔬菜", "叶菜类", "油麦菜"),
    "wawacai": ("蔬菜", "叶菜类", "娃娃菜"),
    "xianc": ("蔬菜", "叶菜类", "苋菜"),
    "kxco": ("蔬菜", "叶菜类", "空心菜"),
    "xiangcai": ("蔬菜", "叶菜类", "香菜"),
    
    # 蔬菜-根茎类
    "luobo": ("蔬菜", "根茎类", "萝卜"),
    "hlb": ("蔬菜", "根茎类", "胡萝卜"),
    "shanyao": ("蔬菜", "根茎类", "山药"),
    "dongsun": ("蔬菜", "根茎类", "竹笋"),
    "gegen": ("蔬菜", "根茎类", "葛根"),
    "liou": ("蔬菜", "根茎类", "莲藕"),
    "xbh": ("蔬菜", "根茎类", "鲜百合"),
    "lusun": ("蔬菜", "根茎类", "芦笋"),
    
    # 蔬菜-茄果类
    "lajiao": ("蔬菜", "茄果类", "辣椒"),
    "xhs": ("蔬菜", "茄果类", "西红柿"),
    "qiezi": ("蔬菜", "茄果类", "茄子"),
    "qiukui": ("蔬菜", "茄果类", "秋葵"),
    "xyumi": ("蔬菜", "茄果类", "鲜玉米"),
    
    # 蔬菜-葱蒜类
    "dasuan": ("蔬菜", "葱蒜类", "大蒜"),
    "dacong": ("蔬菜", "葱蒜类", "大葱"),
    "shengjiang": ("蔬菜", "葱蒜类", "生姜"),
    "yuancong": ("蔬菜", "葱蒜类", "洋葱"),
    "xiaocong": ("蔬菜", "葱蒜类", "小葱"),
    "suantai": ("蔬菜", "葱蒜类", "蒜苔"),
    "suanmiao": ("蔬菜", "葱蒜类", "蒜苗"),
    "jiuhuang": ("蔬菜", "葱蒜类", "韭黄"),
    
    # 蔬菜-豆类
    "doujiao": ("蔬菜", "豆类", "豆角"),
    "maodou": ("蔬菜", "豆类", "毛豆"),
    "wandouo": ("蔬菜", "豆类", "豌豆"),
    "sijidou": ("蔬菜", "豆类", "四季豆"),
    "biandou": ("蔬菜", "豆类", "扁豆"),
    "hld": ("蔬菜", "豆类", "荷兰豆"),
    "daodou": ("蔬菜", "豆类", "刀豆"),
    
    # 蔬菜-食用菌
    "syjl": ("蔬菜", "食用菌", "食用菌"),
    "xianggu": ("蔬菜", "食用菌", "香菇"),
    "mogu": ("蔬菜", "食用菌", "蘑菇"),
    "haixg": ("蔬菜", "食用菌", "海鲜菇"),
    "lurg": ("蔬菜", "食用菌", "鹿茸菇"),
    "jig": ("蔬菜", "食用菌", "姬菇"),
    "yuanm": ("蔬菜", "食用菌", "元蘑"),
    
    # 水果-柑橘类
    "juzi": ("水果", "柑橘类", "橘子"),
    "ganju": ("水果", "柑橘类", "柑橘"),
    "chengzi": ("水果", "柑橘类", "橙子"),
    "gan": ("水果", "柑橘类", "柑"),
    "shatangju": ("水果", "柑橘类", "沙糖橘"),
    
    # 水果-仁果类
    "pingguo": ("水果", "仁果类", "苹果"),
    "li": ("水果", "仁果类", "梨"),
    "haguo": ("水果", "仁果类", "哈密果"),
    
    # 水果-核果类
    "taozi": ("水果", "核果类", "桃子"),
    "yingtao": ("水果", "核果类", "樱桃"),
    "lizi": ("水果", "核果类", "李子"),
    "xingzi": ("水果", "核果类", "杏子"),
    "zao": ("水果", "核果类", "枣"),
    
    # 水果-浆果类
    "caomei": ("水果", "浆果类", "草莓"),
    "lanmei": ("水果", "浆果类", "蓝莓"),
    "putao": ("水果", "浆果类", "葡萄"),
    "shiliu": ("水果", "浆果类", "石榴"),
    
    # 水果-瓜果类
    "xigua": ("水果", "瓜果类", "西瓜"),
    "hamigua": ("水果", "瓜果类", "哈密瓜"),
    "donggua": ("水果", "瓜果类", "冬瓜"),
    
    # 水果-热带水果
    "mangguo": ("水果", "热带水果", "芒果"),
    "xijiao": ("水果", "热带水果", "香蕉"),
    "lizhi": ("水果", "热带水果", "荔枝"),
    "longyan": ("水果", "热带水果", "龙眼"),
    "boluo": ("水果", "热带水果", "菠萝"),
    "mihoutao": ("水果", "热带水果", "猕猴桃"),
    "shanzhu": ("水果", "热带水果", "山竹"),
    "liulian": ("水果", "热带水果", "榴莲"),
    
    # 禽畜-蛋类
    "jidan": ("禽畜肉蛋", "蛋类", "鸡蛋"),
    "yadan": ("禽畜肉蛋", "蛋类", "鸭蛋"),
    "andan": ("禽畜肉蛋", "蛋类", "鹌鹑蛋"),
    "edan": ("禽畜肉蛋", "蛋类", "鹅蛋"),
    "gzedan": ("禽畜肉蛋", "蛋类", "鸽子蛋"),
    "pidan": ("禽畜肉蛋", "蛋类", "皮蛋"),
    "xiandan": ("禽畜肉蛋", "蛋类", "咸蛋"),
    
    # 禽畜-活禽
    "huoji": ("禽畜肉蛋", "活禽", "活鸡"),
    "huoya": ("禽畜肉蛋", "活禽", "活鸭"),
    "huoe": ("禽畜肉蛋", "活禽", "活鹅"),
    "an": ("禽畜肉蛋", "活禽", "鹌鹑"),
    "gezi": ("禽畜肉蛋", "活禽", "鸽子"),
    
    # 禽畜-活畜
    "huoniu": ("禽畜肉蛋", "活畜", "活牛"),
    "huoyang": ("禽畜肉蛋", "活畜", "活羊"),
    "zhubao": ("禽畜肉蛋", "活畜", "生猪"),
    "tu": ("禽畜肉蛋", "活畜", "兔子"),
    "lv": ("禽畜肉蛋", "活畜", "驴"),
    
    # 禽畜-禽苗
    "jimiao": ("禽畜肉蛋", "禽苗", "鸡苗"),
    "yamiao": ("禽畜肉蛋", "禽苗", "鸭苗"),
    "emiao": ("禽畜肉蛋", "禽苗", "鹅苗"),
    "zhumiao": ("禽畜肉蛋", "禽苗", "猪苗"),
    "anmiao": ("禽畜肉蛋", "禽苗", "鹌鹑苗"),
    
    # 禽畜-肉类
    "niurou": ("禽畜肉蛋", "肉类", "牛肉"),
    "yangrou": ("禽畜肉蛋", "肉类", "羊肉"),
    "zhurou": ("禽畜肉蛋", "肉类", "猪肉"),
    "turou": ("禽畜肉蛋", "肉类", "兔肉"),
    "jiya": ("禽畜肉蛋", "肉类", "鸡鸭肉"),
    
    # 粮油-粮食
    "dami": ("粮油米面", "粮食", "大米"),
    "xiaomai": ("粮油米面", "粮食", "小麦"),
    "yumi": ("粮油米面", "粮食", "玉米"),
    "daidou": ("粮油米面", "粮食", "大豆"),
    "lvdo": ("粮油米面", "粮食", "绿豆"),
    "hongdou": ("粮油米面", "粮食", "红豆"),
    
    # 粮油-油料
    "caizi": ("粮油米面", "油料", "菜籽"),
    "huasheng": ("粮油米面", "油料", "花生"),
    "dado": ("粮油米面", "油料", "大豆油"),
    "zhima": ("粮油米面", "油料", "芝麻"),
    "xiangyou": ("粮油米面", "油料", "香油"),
    
    # 粮油-米面
    "mianfen": ("粮油米面", "米面", "面粉"),
    "damifen": ("粮油米面", "米面", "大米粉"),
    "xiaomifen": ("粮油米面", "米面", "小米粉"),
    "zaliangfen": ("粮油米面", "米面", "杂粮粉"),
    
    # 水产-鱼类
    "lianyu": ("水产", "鱼类", "鲤鱼"),
    "caoyu": ("水产", "鱼类", "草鱼"),
    "qingyu": ("水产", "鱼类", "青鱼"),
    "jiyu": ("水产", "鱼类", "鲫鱼"),
    "guiyu": ("水产", "鱼类", "桂鱼"),
    "luofei": ("水产", "鱼类", "罗非鱼"),
    
    # 水产-虾蟹
    "xia": ("水产", "虾蟹", "虾"),
    "xie": ("水产", "虾蟹", "蟹"),
    "longxia": ("水产", "虾蟹", "龙虾"),
    "jixia": ("水产", "虾蟹", "基围虾"),
    
    # 水产-其他
    "haishen": ("水产", "其他", "海参"),
    "beilei": ("水产", "其他", "贝类"),
    "ziliao": ("水产", "其他", "紫菜"),
    
    # 农副-干货
    "ganjun": ("农副加工", "干货", "干菌"),
    "muxer": ("农副加工", "干货", "木耳"),
    "huanghua": ("农副加工", "干货", "黄花菜"),
    "xianggu-gan": ("农副加工", "干货", "干香菇"),
    
    # 农副-腌制品
    "xiancai": ("农副加工", "腌制品", "咸菜"),
    "paojiao": ("农副加工", "腌制品", "泡椒"),
    "suancai": ("农副加工", "腌制品", "酸菜"),
}


def get_today_category_group():
    """根据日期选择今天的品类组"""
    group_names = list(CATEGORY_GROUPS.keys())
    # 用日期作为种子，同一天选择相同品类
    today = datetime.now().strftime("%Y-%m-%d")
    index = hash(today) % len(group_names)
    return group_names[index]


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
    """获取数据库中已有的商品标题"""
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
    """上传图片到七牛云（使用qiniu SDK）"""
    try:
        # 下载图片
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://www.cnhnb.com/',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        }
        req = urllib.request.Request(image_url, headers=headers)
        with urllib.request.urlopen(req, timeout=20) as response:
            image_data = response.read()
        
        if len(image_data) < 100:
            print(f"    图片数据太小: {len(image_data)} bytes")
            return None
        
        # 使用qiniu SDK上传
        q = Auth(QINIU_ACCESS_KEY, QINIU_SECRET_KEY)
        filename = f"products/{uuid.uuid4().hex}.jpg"
        token = q.upload_token(QINIU_BUCKET, filename, 3600)
        
        ret, info = put_data(token, filename, image_data)
        
        if ret:
            return f"{QINIU_DOMAIN}/{filename}"
        else:
            print(f"    七牛云上传失败: {info}")
            return None
    except Exception as e:
        print(f"    图片上传失败: {e}")
        return None


def extract_products_from_page(page, category_code):
    """从页面提取商品数据"""
    products = []
    
    try:
        # 等待页面加载
        page.wait_for_selector('.supply-list', timeout=10000)
        time.sleep(2)
        
        # 获取商品卡片
        cards = page.query_selector_all('.supply-item')
        print(f"  找到 {len(cards)} 个商品卡片")
        
        for card in cards[:15]:  # 每个品类最多15个
            try:
                # 标题
                title_el = card.query_selector('.supply-title a, .title a, h3 a')
                if not title_el:
                    continue
                title = clean_title(title_el.inner_text())
                if not title or len(title) < 3:
                    continue
                
                # 链接
                link = title_el.get_attribute('href') or ''
                
                # 图片
                img_el = card.query_selector('img')
                image_url = img_el.get_attribute('src') or img_el.get_attribute('data-src') if img_el else ''
                
                # 价格
                price_el = card.query_selector('.price, .supply-price')
                price_text = price_el.inner_text() if price_el else ''
                price_match = re.search(r'[\d.]+', price_text)
                price = float(price_match.group()) if price_match else 0
                
                # 单位
                unit_match = re.search(r'/([斤公斤克吨箱袋件个只头]+)', price_text)
                unit = unit_match.group(1) if unit_match else '斤'
                
                # 产地
                origin_el = card.query_selector('.origin, .area, .address')
                origin = origin_el.inner_text().strip() if origin_el else ''
                
                # 起批量
                min_quantity = 1
                min_qty_el = card.query_selector('.min-qty, .moq')
                if min_qty_el:
                    min_match = re.search(r'(\d+)', min_qty_el.inner_text())
                    if min_match:
                        min_quantity = int(min_match.group(1))
                
                # 分类信息
                category_info = CATEGORY_MAP.get(category_code, ("农产品", "其他", "其他"))
                
                product = {
                    'title': title,
                    'category': category_info[0],
                    'sub_category': category_info[1],
                    'product_type': category_info[2],
                    'origin': origin,
                    'price': price,
                    'unit': unit,
                    'min_quantity': min_quantity,
                    'image_url': image_url,
                    'source_url': f"https://www.cnhnb.com{link}" if link.startswith('/') else link,
                }
                products.append(product)
                
            except Exception as e:
                continue
        
    except Exception as e:
        print(f"  页面解析失败: {e}")
    
    return products


def crawl_category(page, category_code):
    """爬取单个品类"""
    category_info = CATEGORY_MAP.get(category_code, ("未知", "未知", "未知"))
    print(f"\n正在爬取品类: {category_code} ({category_info[0]}-{category_info[1]}-{category_info[2]})")
    
    url = f"https://www.cnhnb.com/p/{category_code}/"
    try:
        page.goto(url, timeout=30000, wait_until='domcontentloaded')
        time.sleep(2)
        return extract_products_from_page(page, category_code)
    except Exception as e:
        print(f"  爬取失败: {e}")
        return []


def insert_to_database(products, existing_titles):
    """插入商品到数据库"""
    inserted = 0
    
    for product in products:
        # 再次检查去重
        title_key = product['title'][:50].strip()
        if title_key in existing_titles:
            continue
        
        # 上传图片（失败则不存储图片，避免存储原始URL）
        images = []
        if product.get('image_url'):
            print(f"  上传图片: {product['title'][:30]}...")
            qiniu_url = upload_to_qiniu(product['image_url'])
            if qiniu_url:
                images = [qiniu_url]
                print(f"    ✅ 图片上传成功")
            else:
                print(f"    ⚠️ 图片上传失败，跳过该商品")
                continue  # 跳过没有图片的商品
        
        # 构建数据
        data = {
            'id': str(uuid.uuid4()),
            'title': product['title'],
            'category': product['category'],
            'sub_category': product.get('sub_category', ''),
            'product_type': product.get('product_type', ''),
            'origin': product.get('origin', ''),
            'price': product.get('price', 0),
            'unit': product.get('unit', '斤'),
            'min_quantity': product.get('min_quantity', 1),
            'quantity': random.randint(1000, 10000),
            'description': f"产地：{product.get('origin', '不详')}，品质优良，货源充足。",
            'images': images,
            'status': 'active',
            'created_at': datetime.now().isoformat(),
        }
        
        # 插入数据库
        try:
            req = urllib.request.Request(
                f"{SUPABASE_URL}/rest/v1/products",
                data=json.dumps(data).encode(),
                headers={
                    'Content-Type': 'application/json',
                    'apikey': SERVICE_ROLE_KEY,
                    'Authorization': f'Bearer {SERVICE_ROLE_KEY}',
                    'Prefer': 'return=minimal'
                },
                method='POST'
            )
            with urllib.request.urlopen(req, timeout=30) as response:
                inserted += 1
                existing_titles.add(title_key)
                print(f"  ✅ 已插入: {product['title'][:40]}")
        except urllib.error.HTTPError as e:
            if e.code != 409:  # 忽略重复错误
                print(f"  ❌ 插入失败: {e.code}")
        except Exception as e:
            print(f"  ❌ 插入失败: {e}")
    
    return inserted


def main():
    print("=" * 60)
    print("惠农网商品爬虫 - 每日定时爬取")
    print("=" * 60)
    print(f"运行时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 获取今天的品类组
    today_group = get_today_category_group()
    today_categories = CATEGORY_GROUPS[today_group]
    print(f"\n今日爬取品类组: {today_group}")
    print(f"包含品类: {', '.join(today_categories)}")
    
    # 获取已有标题（去重用）
    print("\n正在获取数据库中已有商品...")
    existing_titles = get_existing_titles()
    print(f"数据库中已有 {len(existing_titles)} 个商品")
    
    # 开始爬取
    all_products = []
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_default_timeout(30000)
        
        for category in today_categories:
            products = crawl_category(page, category)
            all_products.extend(products)
            time.sleep(1)
        
        browser.close()
    
    print(f"\n共爬取到 {len(all_products)} 个商品")
    
    if not all_products:
        print("\n没有爬取到商品")
        return
    
    # 去重
    unique_products = []
    for p in all_products:
        title_key = p['title'][:50].strip()
        if title_key not in existing_titles:
            unique_products.append(p)
            existing_titles.add(title_key)
    
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
