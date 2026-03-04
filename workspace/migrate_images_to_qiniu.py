#!/usr/bin/env python3
"""
将惠农网图片迁移到七牛云
"""
import json
import time
import urllib.request
import urllib.parse
import hashlib
import hmac
import base64
from datetime import datetime

# 数据库配置
SUPABASE_URL = "http://47.115.253.217:8080"
SERVICE_ROLE_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoicG9sYXJkYiIsImlhdCI6MTc2ODM2OTgwMiwiZXhwIjoyMDgzNzI5ODAyfQ.OvbbXDxvsQWO-sJkiKFF62ULPzauTVaDJbju9PFDp8Y"

# 七牛云配置
QINIU_ACCESS_KEY = "DrZycDvbl2sLXU866Gc-RrWMRRpTAvSESiU6fm1i"
QINIU_SECRET_KEY = "82GmouLH8Pk5Znf7zHeWSG0DHmN27AHRrC_zgDHm"
QINIU_BUCKET = "lianheimagecdn"
QINIU_DOMAIN = "https://lianheimagecdn.acbnlink.com"

def urlsafe_base64_encode(data):
    """URL安全的Base64编码"""
    if isinstance(data, str):
        data = data.encode('utf-8')
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')

def generate_qiniu_token(access_key, secret_key, bucket, key=None):
    """生成七牛云上传凭证"""
    # 构建上传策略
    if key:
        scope = f"{bucket}:{key}"
    else:
        scope = bucket
    
    deadline = int(time.time()) + 3600  # 1小时有效期
    put_policy = {
        "scope": scope,
        "deadline": deadline
    }
    
    # 编码上传策略
    encoded_put_policy = urlsafe_base64_encode(json.dumps(put_policy))
    
    # 使用HMAC-SHA1签名
    sign = hmac.new(
        secret_key.encode('utf-8'),
        encoded_put_policy.encode('utf-8'),
        hashlib.sha1
    ).digest()
    
    # 编码签名
    encoded_sign = urlsafe_base64_encode(sign)
    
    # 生成上传凭证
    upload_token = f"{access_key}:{encoded_sign}:{encoded_put_policy}"
    
    return upload_token

def download_image(url):
    """下载图片"""
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                "Referer": "https://www.cnhnb.com/"
            }
        )
        with urllib.request.urlopen(req, timeout=30) as response:
            return response.read()
    except Exception as e:
        print(f"    下载失败: {e}")
        return None

def upload_to_qiniu(image_data, key):
    """上传图片到七牛云"""
    try:
        # 生成上传token
        upload_token = generate_qiniu_token(QINIU_ACCESS_KEY, QINIU_SECRET_KEY, QINIU_BUCKET, key)
        
        # 构建multipart/form-data请求
        boundary = "----WebKitFormBoundary" + "".join([str(int(time.time() * 1000) % 10) for _ in range(16)])
        
        body = []
        body.append(f"--{boundary}".encode())
        body.append(f'Content-Disposition: form-data; name="token"'.encode())
        body.append(b"")
        body.append(upload_token.encode())
        body.append(f"--{boundary}".encode())
        body.append(f'Content-Disposition: form-data; name="key"'.encode())
        body.append(b"")
        body.append(key.encode())
        body.append(f"--{boundary}".encode())
        body.append(f'Content-Disposition: form-data; name="file"; filename="{key}"'.encode())
        body.append(b"Content-Type: image/jpeg")
        body.append(b"")
        body.append(image_data)
        body.append(f"--{boundary}--".encode())
        body.append(b"")
        
        body_data = b"\r\n".join(body)
        
        req = urllib.request.Request(
            "https://upload.qiniup.com/",
            data=body_data,
            headers={
                "Content-Type": f"multipart/form-data; boundary={boundary}"
            },
            method="POST"
        )
        
        with urllib.request.urlopen(req, timeout=60) as response:
            result = json.loads(response.read().decode())
            return result.get("key") == key
    except Exception as e:
        print(f"    上传失败: {e}")
        return False

def get_all_products():
    """获取所有产品"""
    try:
        req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/products?select=id,title,images&order=created_at.desc",
            headers={
                "apikey": SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SERVICE_ROLE_KEY}"
            }
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"获取产品失败: {e}")
        return []

def update_product_images(product_id, images):
    """更新产品图片"""
    try:
        data = json.dumps({"images": images}).encode('utf-8')
        req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/products?id=eq.{product_id}",
            data=data,
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

def main():
    print("=" * 60)
    print("图片迁移到七牛云 - 开始运行")
    print("=" * 60)
    
    # 获取所有产品
    products = get_all_products()
    print(f"\n找到 {len(products)} 个产品")
    
    # 统计
    total = 0
    migrated = 0
    skipped = 0
    failed = 0
    
    for i, product in enumerate(products):
        product_id = product['id']
        title = product.get('title', '')[:30]
        images = product.get('images', [])
        
        if not images:
            continue
        
        total += 1
        
        # 检查是否已经是七牛云图片
        new_images = []
        need_migrate = False
        
        for img_url in images:
            if 'lianheimagecdn.acbnlink.com' in img_url:
                # 已经是七牛云图片
                new_images.append(img_url)
            else:
                # 需要迁移
                need_migrate = True
                new_images.append(img_url)  # 暂时保留原URL
        
        if not need_migrate:
            skipped += 1
            continue
        
        print(f"\n[{i+1}/{len(products)}] {title}...")
        
        # 迁移图片
        migrated_images = []
        for j, img_url in enumerate(images):
            if 'lianheimagecdn.acbnlink.com' in img_url:
                migrated_images.append(img_url)
                continue
            
            print(f"  迁移图片 {j+1}/{len(images)}: {img_url[:60]}...")
            
            # 下载图片
            image_data = download_image(img_url)
            if not image_data:
                print(f"    ✗ 下载失败，保留原URL")
                migrated_images.append(img_url)
                failed += 1
                continue
            
            # 生成新文件名
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
            file_ext = img_url.split('?')[0].split('.')[-1] or 'jpg'
            if file_ext not in ['jpg', 'jpeg', 'png', 'webp', 'gif']:
                file_ext = 'jpg'
            key = f"products/{product_id[:8]}_{timestamp}_{j}.{file_ext}"
            
            # 上传到七牛云
            if upload_to_qiniu(image_data, key):
                new_url = f"{QINIU_DOMAIN}/{key}"
                migrated_images.append(new_url)
                print(f"    ✓ 上传成功: {new_url}")
                migrated += 1
            else:
                print(f"    ✗ 上传失败，保留原URL")
                migrated_images.append(img_url)
                failed += 1
            
            time.sleep(0.5)  # 避免请求过快
        
        # 更新数据库
        if migrated_images != images:
            if update_product_images(product_id, migrated_images):
                print(f"  ✓ 数据库更新成功")
            else:
                print(f"  ✗ 数据库更新失败")
        
        time.sleep(1)  # 避免请求过快
    
    print("\n" + "=" * 60)
    print(f"完成！")
    print(f"  总计: {total} 个产品需要迁移")
    print(f"  成功: {migrated} 张图片")
    print(f"  跳过: {skipped} 个产品（已是七牛云）")
    print(f"  失败: {failed} 张图片")
    print("=" * 60)

if __name__ == "__main__":
    main()
