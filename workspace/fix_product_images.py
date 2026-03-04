#!/usr/bin/env python3
"""
修复数据库中图片URL不是七牛云的产品
1. 获取所有问题产品
2. 下载图片并上传到七牛云
3. 更新数据库
"""
import json
import time
import urllib.request
import urllib.parse
import urllib.error
import uuid
import hmac
import hashlib
import base64

# 数据库配置
SUPABASE_URL = "http://47.115.253.217:8080"
SERVICE_ROLE_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoicG9sYXJkYiIsImlhdCI6MTc2ODM2OTgwMiwiZXhwIjoyMDgzNzI5ODAyfQ.OvbbXDxvsQWO-sJkiKFF62ULPzauTVaDJbju9PFDp8Y"

# 七牛云配置
QINIU_ACCESS_KEY = "DrZycDvbl2sLXU866Gc-RrWMRRpTAvSESiU6fm1i"
QINIU_SECRET_KEY = "82GmouLH8Pk5Znf7zHeWSG0DHmN27AHRrC_zgDHm"
QINIU_BUCKET = "lianheimagecdn"
QINIU_DOMAIN = "https://lianheimagecdn.acbnlink.com"


def upload_to_qiniu(image_url, retry=3):
    """上传图片到七牛云"""
    for attempt in range(retry):
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
                continue
            
            # 生成上传凭证
            deadline = int(time.time()) + 3600
            put_policy = json.dumps({"scope": QINIU_BUCKET, "deadline": deadline})
            encoded_put_policy = base64.urlsafe_b64encode(put_policy.encode()).decode()
            sign = hmac.new(QINIU_SECRET_KEY.encode(), encoded_put_policy.encode(), hashlib.sha1).digest()
            encoded_sign = base64.urlsafe_b64encode(sign).decode()
            upload_token = f"{QINIU_ACCESS_KEY}:{encoded_sign}:{encoded_put_policy}"
            
            # 上传
            filename = f"products/{uuid.uuid4().hex}.jpg"
            boundary = '----WebKitFormBoundary' + uuid.uuid4().hex[:16]
            body = f'--{boundary}\r\nContent-Disposition: form-data; name="token"\r\n\r\n{upload_token}\r\n'
            body += f'--{boundary}\r\nContent-Disposition: form-data; name="key"\r\n\r\n{filename}\r\n'
            body += f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="image.jpg"\r\nContent-Type: image/jpeg\r\n\r\n'
            body_bytes = body.encode() + image_data + f'\r\n--{boundary}--\r\n'.encode()
            
            req = urllib.request.Request('https://upload.qiniup.com/', data=body_bytes, headers={
                'Content-Type': f'multipart/form-data; boundary={boundary}'
            })
            with urllib.request.urlopen(req, timeout=30) as response:
                result = json.loads(response.read().decode())
                return f"{QINIU_DOMAIN}/{filename}"
        except Exception as e:
            print(f"    尝试 {attempt+1}/{retry} 失败: {e}")
            if attempt < retry - 1:
                time.sleep(2)
    
    return None


def get_problem_products():
    """获取所有图片URL不是七牛云的产品"""
    url = f"{SUPABASE_URL}/rest/v1/products?select=id,title,images"
    req = urllib.request.Request(url, headers={
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': f'Bearer {SERVICE_ROLE_KEY}'
    })
    
    with urllib.request.urlopen(req) as response:
        all_products = json.loads(response.read().decode())
    
    # 筛选问题产品
    problem_products = []
    for p in all_products:
        if p.get('images'):
            for img in p['images']:
                if img and 'lianheimagecdn' not in img:
                    problem_products.append(p)
                    break
    
    return problem_products


def update_product_images(product_id, new_images):
    """更新产品的图片"""
    url = f"{SUPABASE_URL}/rest/v1/products?id=eq.{product_id}"
    data = json.dumps({'images': new_images}).encode()
    
    req = urllib.request.Request(url, data=data, headers={
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': f'Bearer {SERVICE_ROLE_KEY}',
        'Prefer': 'return=minimal'
    }, method='PATCH')
    
    with urllib.request.urlopen(req) as response:
        return response.status == 204


def main():
    print("=" * 60)
    print("修复产品图片 - 开始")
    print("=" * 60)
    
    # 获取问题产品
    print("\n1. 获取问题产品...")
    problem_products = get_problem_products()
    print(f"   找到 {len(problem_products)} 个问题产品")
    
    if not problem_products:
        print("\n没有需要修复的产品")
        return
    
    # 统计问题类型
    cnhnb_count = 0
    unsplash_count = 0
    base64_count = 0
    other_count = 0
    
    for p in problem_products:
        img = p['images'][0] if p.get('images') else ''
        if 'cnhnb.com' in img:
            cnhnb_count += 1
        elif 'unsplash.com' in img:
            unsplash_count += 1
        elif img.startswith('data:'):
            base64_count += 1
        else:
            other_count += 1
    
    print(f"\n   问题类型统计:")
    print(f"   - 惠农网原始URL: {cnhnb_count}")
    print(f"   - Unsplash: {unsplash_count}")
    print(f"   - Base64: {base64_count}")
    print(f"   - 其他: {other_count}")
    
    # 修复产品
    print("\n2. 开始修复...")
    fixed = 0
    failed = 0
    skipped = 0
    
    for i, p in enumerate(problem_products):
        print(f"\n[{i+1}/{len(problem_products)}] {p['title'][:40]}...")
        
        old_images = p.get('images', [])
        new_images = []
        
        for img in old_images:
            # 跳过已经是七牛云的图片
            if 'lianheimagecdn' in img:
                new_images.append(img)
                continue
            
            # 跳过base64图片（太大，无法处理）
            if img.startswith('data:'):
                print(f"    跳过base64图片")
                skipped += 1
                continue
            
            # 跳过本地存储URL
            if '47.115.253.217' in img:
                print(f"    跳过本地存储URL")
                skipped += 1
                continue
            
            # 上传到七牛云
            print(f"    上传: {img[:60]}...")
            qiniu_url = upload_to_qiniu(img)
            
            if qiniu_url:
                new_images.append(qiniu_url)
                print(f"    成功: {qiniu_url}")
            else:
                print(f"    失败: 无法上传")
        
        # 更新数据库
        if new_images and new_images != old_images:
            if update_product_images(p['id'], new_images):
                print(f"    ✅ 数据库更新成功")
                fixed += 1
            else:
                print(f"    ❌ 数据库更新失败")
                failed += 1
        elif not new_images:
            # 没有有效图片，设置为空数组
            if update_product_images(p['id'], []):
                print(f"    ✅ 已清除无效图片")
                fixed += 1
            else:
                failed += 1
        else:
            skipped += 1
        
        # 避免请求过快
        time.sleep(0.5)
    
    print("\n" + "=" * 60)
    print(f"修复完成！成功: {fixed}, 失败: {failed}, 跳过: {skipped}")
    print("=" * 60)


if __name__ == "__main__":
    main()
