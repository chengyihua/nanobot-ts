// 调试微信通道的文件发送问题
console.log("微信通道调试信息：");

// 检查uploads目录中的文件
const fs = require('fs');
const path = require('path');

const uploadsDir = path.join(__dirname, 'uploads');
console.log("uploads目录:", uploadsDir);

if (fs.existsSync(uploadsDir)) {
  const files = fs.readdirSync(uploadsDir);
  console.log("uploads中的文件:", files);
  
  // 检查banner1.png文件
  const bannerPath = path.join(uploadsDir, 'banner1.png');
  if (fs.existsSync(bannerPath)) {
    const stats = fs.statSync(bannerPath);
    console.log("banner1.png文件信息:");
    console.log("  大小:", stats.size, "字节");
    console.log("  修改时间:", stats.mtime);
    console.log("  权限:", stats.mode.toString(8));
  } else {
    console.log("banner1.png文件不存在");
  }
} else {
  console.log("uploads目录不存在");
}

console.log("\n建议的调试步骤:");
console.log("1. 检查微信企业应用的权限设置");
console.log("2. 检查用户是否在应用的可见范围");
console.log("3. 检查微信通道的代理配置");
console.log("4. 查看微信通道的控制台输出");
