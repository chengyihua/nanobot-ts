const fs = require('fs');
const path = require('path');

// 测试文件路径
const testFile = '/Users/chengyihua/Desktop/banner1.png';
console.log('测试文件:', testFile);
console.log('文件存在:', fs.existsSync(testFile));
console.log('文件大小:', fs.statSync(testFile).size, 'bytes');
console.log('文件扩展名:', path.extname(testFile));

// 检查微信通道代码中的路径解析逻辑
const workspacePath = '/Users/chengyihua/Downloads/nanobot-main/nanobot-ts';
const uploadsDir = path.join(workspacePath, 'uploads');
console.log('上传目录:', uploadsDir);
console.log('上传目录存在:', fs.existsSync(uploadsDir));

// 检查文件是否在uploads目录中
const fileName = path.basename(testFile);
const potentialPath1 = path.join(workspacePath, testFile);
const potentialPath2 = path.join(workspacePath, 'uploads', fileName);
console.log('路径1:', potentialPath1, '存在:', fs.existsSync(potentialPath1));
console.log('路径2:', potentialPath2, '存在:', fs.existsSync(potentialPath2));
