#!/usr/bin/env node
/**
 * 将惠农网图片迁移到七牛云
 */
const qiniu = require('qiniu');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// 数据库配置
const SUPABASE_URL = 'http://47.115.253.217:8080';
const SERVICE_ROLE_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoicG9sYXJkYiIsImlhdCI6MTc2ODM2OTgwMiwiZXhwIjoyMDgzNzI5ODAyfQ.OvbbXDxvsQWO-sJkiKFF62ULPzauTVaDJbju9PFDp8Y';

// 七牛云配置
const QINIU_ACCESS_KEY = 'DrZycDvbl2sLXU866Gc-RrWMRRpTAvSESiU6fm1i';
const QINIU_SECRET_KEY = '82GmouLH8Pk5Znf7zHeWSG0DHmN27AHRrC_zgDHm';
const QINIU_BUCKET = 'lianheimagecdn';
const QINIU_DOMAIN = 'https://lianheimagecdn.acbnlink.com';

// 初始化七牛云
const mac = new qiniu.auth.digest.Mac(QINIU_ACCESS_KEY, QINIU_SECRET_KEY);
const config = new qiniu.conf.Config();
config.zone = qiniu.zone.Zone_z0; // 华东机房
const formUploader = new qiniu.form_up.FormUploader(config);
const putExtra = new qiniu.form_up.PutExtra();

/**
 * 下载图片
 */
function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://www.cnhnb.com/'
      }
    };
    
    const req = protocol.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    req.end();
  });
}

/**
 * 上传到七牛云
 */
function uploadToQiniu(data, key) {
  return new Promise((resolve, reject) => {
    const putPolicy = new qiniu.rs.PutPolicy({ scope: QINIU_BUCKET + ':' + key });
    const uploadToken = putPolicy.uploadToken(mac);
    
    formUploader.put(uploadToken, key, data, putExtra, (err, body, info) => {
      if (err) {
        reject(err);
      } else if (info.statusCode === 200) {
        resolve(QINIU_DOMAIN + '/' + key);
      } else {
        reject(new Error(`Upload failed: ${info.statusCode}`));
      }
    });
  });
}

/**
 * 获取所有产品
 */
async function getAllProducts() {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + '/rest/v1/products');
    url.searchParams.set('select', 'id,title,images');
    url.searchParams.set('order', 'created_at.desc');
    
    http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': 'Bearer ' + SERVICE_ROLE_KEY
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject).end();
  });
}

/**
 * 更新产品图片
 */
async function updateProductImages(productId, images) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ images });
    
    const url = new URL(SUPABASE_URL + '/rest/v1/products');
    url.searchParams.set('id', 'eq.' + productId);
    
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': 'Bearer ' + SERVICE_ROLE_KEY,
        'Prefer': 'return=minimal'
      }
    }, (res) => {
      resolve(res.statusCode === 204 || res.statusCode === 200);
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * 延迟
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 主函数
 */
async function main() {
  console.log('='.repeat(60));
  console.log('图片迁移到七牛云 - 开始运行');
  console.log('='.repeat(60));
  
  // 获取所有产品
  const products = await getAllProducts();
  console.log(`\n找到 ${products.length} 个产品`);
  
  let total = 0;
  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const productId = product.id;
    const title = (product.title || '').substring(0, 30);
    const images = product.images || [];
    
    if (!images || images.length === 0) continue;
    
    total++;
    
    // 检查是否需要迁移
    const needMigrate = images.some(img => 
      img && !img.includes('lianheimagecdn.acbnlink.com')
    );
    
    if (!needMigrate) {
      skipped++;
      continue;
    }
    
    console.log(`\n[${i + 1}/${products.length}] ${title}...`);
    
    const migratedImages = [];
    
    for (let j = 0; j < images.length; j++) {
      let imgUrl = images[j];
      
      if (!imgUrl) {
        continue;
      }
      
      // 跳过base64图片
      if (imgUrl.startsWith('data:')) {
        console.log(`  跳过base64图片 ${j + 1}/${images.length}`);
        migratedImages.push(imgUrl);
        continue;
      }
      
      // 跳过已经是七牛云的图片
      if (imgUrl.includes('lianheimagecdn.acbnlink.com')) {
        migratedImages.push(imgUrl);
        continue;
      }
      
      console.log(`  迁移图片 ${j + 1}/${images.length}: ${imgUrl.substring(0, 60)}...`);
      
      try {
        // 下载图片
        const imageData = await downloadImage(imgUrl);
        console.log(`    ✓ 下载成功 (${(imageData.length / 1024).toFixed(1)}KB)`);
        
        // 生成文件名
        const timestamp = Date.now();
        const ext = imgUrl.split('?')[0].split('.').pop() || 'jpg';
        const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext.toLowerCase()) ? ext : 'jpg';
        const key = `products/${productId.substring(0, 8)}_${timestamp}_${j}.${safeExt}`;
        
        // 上传到七牛云
        const newUrl = await uploadToQiniu(imageData, key);
        console.log(`    ✓ 上传成功: ${newUrl}`);
        migratedImages.push(newUrl);
        migrated++;
        
      } catch (err) {
        console.log(`    ✗ 失败: ${err.message}`);
        migratedImages.push(imgUrl);
        failed++;
      }
      
      await sleep(500);
    }
    
    // 更新数据库
    try {
      const updated = await updateProductImages(productId, migratedImages);
      console.log(`  ${updated ? '✓' : '✗'} 数据库更新${updated ? '成功' : '失败'}`);
    } catch (err) {
      console.log(`  ✗ 数据库更新失败: ${err.message}`);
    }
    
    await sleep(1000);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('完成！');
  console.log(`  总计: ${total} 个产品需要迁移`);
  console.log(`  成功: ${migrated} 张图片`);
  console.log(`  跳过: ${skipped} 个产品（已是七牛云）`);
  console.log(`  失败: ${failed} 张图片`);
  console.log('='.repeat(60));
}

main().catch(console.error);
