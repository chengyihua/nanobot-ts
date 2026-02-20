// 简单的文档索引测试脚本
const fs = require('fs');
const path = require('path');

// 读取索引文件
const indexPath = path.join(__dirname, 'DOC_INDEX.md');
console.log('索引文件路径:', indexPath);

try {
  const content = fs.readFileSync(indexPath, 'utf8');
  console.log('✅ 索引文件加载成功');
  console.log('文件大小:', content.length, '字符');
  
  // 简单解析
  const lines = content.split('\n');
  let entryCount = 0;
  
  console.log('\n=== 索引内容预览 ===');
  for (const line of lines) {
    if (line.trim() && !line.trim().startsWith('#') && line.includes('|')) {
      const parts = line.split('|');
      if (parts.length >= 2) {
        console.log(`${entryCount + 1}. ${parts[0].trim()} -> ${parts[1].trim()}`);
        entryCount++;
        
        if (entryCount >= 10) {
          console.log('...（显示前10条）');
          break;
        }
      }
    }
  }
  
  console.log(`\n总共找到 ${entryCount} 个索引条目`);
  
  // 测试搜索
  console.log('\n=== 测试搜索 ===');
  const searchTerms = ['语音', '文件', '浏览器', '邮件', '截图'];
  
  searchTerms.forEach(term => {
    const matches = [];
    for (const line of lines) {
      if (line.toLowerCase().includes(term.toLowerCase())) {
        matches.push(line);
      }
    }
    
    console.log(`"${term}": 找到 ${matches.length} 个匹配`);
    if (matches.length > 0) {
      matches.slice(0, 2).forEach(match => {
        console.log(`  - ${match.substring(0, 60)}...`);
      });
    }
  });
  
} catch (error) {
  console.error('❌ 加载索引失败:', error.message);
  
  // 显示目录内容
  console.log('\n当前目录内容:');
  const files = fs.readdirSync(__dirname);
  files.forEach(file => {
    const stat = fs.statSync(path.join(__dirname, file));
    console.log(`  ${stat.isDirectory() ? '[DIR]' : '[FILE]'} ${file}`);
  });
}