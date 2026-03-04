#!/usr/bin/env node

/**
 * 微信公众号发布测试脚本
 * 测试baoyu-post-to-wechat技能的基本功能
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

console.log('🚀 微信公众号发布测试脚本');
console.log('==============================');

// 配置
const WORKSPACE = '/Users/chengyihua/Downloads/nanobot-main/nanobot-ts';
const SKILL_DIR = path.join(WORKSPACE, 'skills', 'baoyu-post-to-wechat');
const TEST_ARTICLE = path.join(WORKSPACE, 'workspace', 'test_image_article.md');

// 检查文件
console.log('📁 检查文件...');
console.log(`技能目录: ${SKILL_DIR} - ${fs.existsSync(SKILL_DIR) ? '✅ 存在' : '❌ 不存在'}`);
console.log(`测试文章: ${TEST_ARTICLE} - ${fs.existsSync(TEST_ARTICLE) ? '✅ 存在' : '❌ 不存在'}`);

if (!fs.existsSync(SKILL_DIR)) {
  console.error('错误: baoyu-post-to-wechat技能目录不存在');
  process.exit(1);
}

if (!fs.existsSync(TEST_ARTICLE)) {
  console.error('错误: 测试文章文件不存在');
  process.exit(1);
}

// 检查技能脚本
console.log('\n🔧 检查技能脚本...');
const scripts = ['wechat-browser.ts', 'wechat-article.ts', 'wechat-api.ts'];
scripts.forEach(script => {
  const scriptPath = path.join(SKILL_DIR, 'scripts', script);
  console.log(`${script}: ${fs.existsSync(scriptPath) ? '✅ 存在' : '❌ 不存在'}`);
});

// 读取测试文章内容
console.log('\n📄 测试文章内容预览:');
const articleContent = fs.readFileSync(TEST_ARTICLE, 'utf-8');
const lines = articleContent.split('\n').slice(0, 10);
console.log(lines.join('\n'));
console.log('...');

// 检查文章中的图片链接
console.log('\n🖼️ 检查文章中的图片链接:');
const imageRegex = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/g;
const images = [];
let match;
while ((match = imageRegex.exec(articleContent)) !== null) {
  images.push(match[1]);
  console.log(`✅ 图片链接: ${match[1]}`);
}

console.log(`\n📊 统计: 找到 ${images.length} 张图片链接`);

// 创建测试图片目录（如果需要本地图片）
const testImagesDir = path.join(WORKSPACE, 'workspace', 'test_images');
if (!fs.existsSync(testImagesDir)) {
  fs.mkdirSync(testImagesDir, { recursive: true });
  console.log(`\n📁 创建测试图片目录: ${testImagesDir}`);
  
  // 创建示例图片说明文件
  const imageInfo = path.join(testImagesDir, 'README.md');
  fs.writeFileSync(imageInfo, `# 测试图片目录

## 图片要求
- 格式: JPG或PNG
- 尺寸: 建议900x500（封面图），800x450（正文图）
- 命名: 按顺序命名，如 01-cover.jpg, 02-content.jpg

## 测试图片
1. 封面图: 展示AI技术概念
2. 技术架构图: 展示分层架构
3. 应用场景图: 展示企业应用
4. 趋势图: 展示未来发展

## 使用方式
\`\`\`bash
# 使用baoyu-post-to-wechat技能
npx -y bun ${path.join(SKILL_DIR, 'scripts', 'wechat-browser.ts')} \\
  --markdown ${TEST_ARTICLE} \\
  --images ${testImagesDir}
\`\`\`
`);
}

// 检查环境变量
console.log('\n⚙️ 检查环境变量:');
const requiredEnvVars = ['WECHAT_APP_ID', 'WECHAT_APP_SECRET'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.warn('⚠️  缺少环境变量:', missingVars.join(', '));
  console.warn('请设置以下环境变量:');
  missingVars.forEach(varName => {
    console.warn(`  export ${varName}="你的${varName.replace('WECHAT_', '')}"`);
  });
  console.warn('\n💡 测试模式: 可以使用浏览器模式，无需API凭证');
} else {
  console.log('✅ 环境变量检查通过');
}

// 检查Chrome浏览器
console.log('\n🌐 检查Chrome浏览器:');
try {
  const chromeCheck = execSync('which google-chrome-stable || which google-chrome || which chromium-browser || which chromium || which chrome', { encoding: 'utf-8' }).trim();
  if (chromeCheck) {
    console.log(`✅ Chrome浏览器: ${chromeCheck}`);
  } else {
    console.warn('⚠️  未找到Chrome浏览器，浏览器模式可能无法工作');
  }
} catch (error) {
  console.warn('⚠️  检查Chrome浏览器时出错:', error.message);
}

// 生成使用命令
console.log('\n🚀 使用命令示例:');

console.log('\n1. 浏览器模式（图片文章）:');
console.log(`npx -y bun ${path.join(SKILL_DIR, 'scripts', 'wechat-browser.ts')} \\`);
console.log(`  --markdown ${TEST_ARTICLE} \\`);
console.log(`  --images ${testImagesDir} \\`);
console.log(`  --submit`);

console.log('\n2. 浏览器模式（普通文章）:');
console.log(`npx -y bun ${path.join(SKILL_DIR, 'scripts', 'wechat-article.ts')} \\`);
console.log(`  --markdown ${TEST_ARTICLE}`);

console.log('\n3. API模式（需要凭证）:');
console.log(`npx -y bun ${path.join(SKILL_DIR, 'scripts', 'wechat-api.ts')} \\`);
console.log(`  --markdown ${TEST_ARTICLE} \\`);
console.log(`  --appid \${WECHAT_APP_ID} \\`);
console.log(`  --secret \${WECHAT_APP_SECRET}`);

// 创建测试配置
console.log('\n⚙️ 创建测试配置...');
const testConfig = {
  test_mode: true,
  timestamp: new Date().toISOString(),
  article: {
    file: TEST_ARTICLE,
    title: 'AI Agent技术发展趋势测试文章',
    images: images.length,
    word_count: articleContent.split(/\s+/).length
  },
  skill: {
    dir: SKILL_DIR,
    scripts: scripts.filter(script => fs.existsSync(path.join(SKILL_DIR, 'scripts', script))),
    has_dependencies: fs.existsSync(path.join(SKILL_DIR, 'node_modules'))
  },
  environment: {
    missing_vars: missingVars,
    chrome_available: !!execSync('which google-chrome-stable || which google-chrome || which chromium-browser || which chromium || which chrome 2>/dev/null', { encoding: 'utf-8' }).trim()
  }
};

const configFile = path.join(WORKSPACE, 'workspace', 'test_config.json');
fs.writeFileSync(configFile, JSON.stringify(testConfig, null, 2));
console.log(`✅ 测试配置已保存: ${configFile}`);

// 生成测试报告
console.log('\n📋 生成测试报告...');
const report = `# 微信公众号发布测试报告

**测试时间**: ${new Date().toLocaleString('zh-CN')}
**测试环境**: Node.js ${process.version}
**工作目录**: ${WORKSPACE}

## 测试结果

### 文件检查
- ✅ 技能目录: ${SKILL_DIR}
- ✅ 测试文章: ${TEST_ARTICLE}
- ✅ 技能脚本: ${testConfig.skill.scripts.length}个可用
- ⚠️  技能依赖: ${testConfig.skill.has_dependencies ? '已安装' : '未安装'}

### 文章内容
- 标题: ${testConfig.article.title}
- 字数: ${testConfig.article.word_count}字
- 图片: ${testConfig.article.images}张（在线链接）

### 环境检查
- Node.js版本: ${process.version}
- Chrome浏览器: ${testConfig.environment.chrome_available ? '可用' : '不可用'}
- 环境变量: ${testConfig.environment.missing_vars.length > 0 ? '缺少' + testConfig.environment.missing_vars.join(', ') : '完整'}

## 测试建议

### 推荐测试方案
1. **浏览器模式测试**（无需API凭证）:
   \`\`\`bash
   npx -y bun ${path.join(SKILL_DIR, 'scripts', 'wechat-browser.ts')} \\
     --markdown ${TEST_ARTICLE} \\
     --images ${testImagesDir}
   \`\`\`

2. **API模式测试**（需要API凭证）:
   \`\`\`bash
   # 先设置环境变量
   export WECHAT_APP_ID="你的AppID"
   export WECHAT_APP_SECRET="你的AppSecret"
   
   npx -y bun ${path.join(SKILL_DIR, 'scripts', 'wechat-api.ts')} \\
     --markdown ${TEST_ARTICLE}
   \`\`\`

### 测试步骤
1. **准备测试图片**（如果需要本地图片）:
   - 下载或创建测试图片
   - 保存到: ${testImagesDir}
   - 按顺序命名: 01-cover.jpg, 02-content.jpg等

2. **运行测试命令**:
   - 选择浏览器模式或API模式
   - 观察执行过程和输出

3. **验证结果**:
   - 检查微信公众号后台草稿箱
   - 确认文章内容和图片正确
   - 测试发布功能

## 故障排除

### 常见问题
1. **缺少依赖**: 技能目录缺少node_modules
   \`\`\`bash
   cd ${SKILL_DIR} && npm install
   \`\`\`

2. **Chrome未找到**: 安装Chrome浏览器或设置路径
   \`\`\`bash
   export WECHAT_BROWSER_CHROME_PATH="/path/to/chrome"
   \`\`\`

3. **API凭证错误**: 检查AppID和AppSecret是否正确
   - 登录微信公众平台确认
   - 检查IP白名单设置

4. **图片上传失败**: 检查图片格式和大小
   - 支持格式: JPG, PNG
   - 建议尺寸: 900x500, 800x450
   - 文件大小: 不超过5MB

### 调试建议
1. **启用详细输出**:
   \`\`\`bash
   DEBUG=* npx -y bun ${path.join(SKILL_DIR, 'scripts', 'wechat-browser.ts')} --markdown ${TEST_ARTICLE}
   \`\`\`

2. **检查网络连接**:
   \`\`\`bash
   curl -I https://mp.weixin.qq.com
   \`\`\`

3. **查看技能日志**:
   \`\`\`bash
   # 技能执行时会生成日志文件
   ls -la ${WORKSPACE}/workspace/*.log
   \`\`\`

## 下一步操作

### 立即测试
1. 准备测试图片（如果需要）
2. 选择测试模式（浏览器或API）
3. 运行测试命令
4. 验证发布结果

### 长期配置
1. 获取微信公众号API凭证
2. 设置环境变量
3. 配置定时发布任务
4. 建立监控和告警机制

---

**测试状态**: ${testConfig.environment.missing_vars.length > 0 ? '需要配置环境变量' : '准备就绪'}
**建议操作**: ${testConfig.environment.missing_vars.length > 0 ? '先配置环境变量或使用浏览器模式' : '可以开始测试'}
**生成时间**: ${new Date().toLocaleString('zh-CN')}
`;

const reportFile = path.join(WORKSPACE, 'workspace', 'test_report.md');
fs.writeFileSync(reportFile, report);
console.log(`✅ 测试报告已生成: ${reportFile}`);

console.log('\n🎉 测试脚本执行完成！');
console.log('📋 查看测试报告:', reportFile);
console.log('🚀 下一步: 运行上述命令进行实际测试');
console.log('💡 提示: 建议先从浏览器模式开始测试，无需API凭证');