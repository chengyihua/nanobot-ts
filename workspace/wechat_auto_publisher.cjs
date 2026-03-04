#!/usr/bin/env node

/**
 * 微信公众号自动发布系统
 * 集成baoyu-post-to-wechat技能，实现自动发布
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// 配置
const CONFIG = {
  workspace: '/Users/chengyihua/Downloads/nanobot-main/nanobot-ts',
  skillsDir: '/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/skills',
  date: new Date().toISOString().split('T')[0].replace(/-/g, ''),
  wechatSkill: 'baoyu-post-to-wechat'
};

// 检查技能是否存在
function checkSkill() {
  const skillPath = path.join(CONFIG.skillsDir, CONFIG.wechatSkill);
  if (!fs.existsSync(skillPath)) {
    console.error(`错误: 技能 ${CONFIG.wechatSkill} 不存在`);
    console.error(`请确保技能目录存在: ${skillPath}`);
    return false;
  }
  
  const skillFile = path.join(skillPath, 'SKILL.md');
  if (!fs.existsSync(skillFile)) {
    console.error(`错误: 技能文件不存在: ${skillFile}`);
    return false;
  }
  
  console.log(`✅ 找到技能: ${CONFIG.wechatSkill}`);
  return true;
}

// 读取技能文档
function readSkillDoc() {
  const skillFile = path.join(CONFIG.skillsDir, CONFIG.wechatSkill, 'SKILL.md');
  try {
    const content = fs.readFileSync(skillFile, 'utf-8');
    console.log(`📖 技能文档大小: ${content.length} 字符`);
    
    // 提取关键信息
    const lines = content.split('\n');
    const description = lines.find(line => line.includes('Description:')) || '';
    const usage = lines.find(line => line.includes('Use when')) || '';
    
    console.log(`📝 技能描述: ${description.replace('Description:', '').trim()}`);
    console.log(`🎯 使用场景: ${usage.replace('Use when', '').trim()}`);
    
    return content;
  } catch (error) {
    console.error(`读取技能文档失败: ${error.message}`);
    return null;
  }
}

// 创建测试文章
function createTestArticle() {
  const articleDir = path.join(CONFIG.workspace, 'workspace', 'test_articles', CONFIG.date);
  if (!fs.existsSync(articleDir)) {
    fs.mkdirSync(articleDir, { recursive: true });
  }
  
  const articleFile = path.join(articleDir, 'test_article.md');
  const content = `# AI Agent技术发展趋势分析

**发布日期**: ${new Date().toLocaleDateString('zh-CN')}
**作者**: AI自动发布系统
**分类**: 技术分析

---

## 摘要
本文分析当前AI Agent技术的发展趋势，探讨技术突破、应用场景和未来方向。

## 正文内容

### 1. 技术架构演进
AI Agent技术正在从简单的规则系统向复杂的自主系统演进...

### 2. 核心能力提升
- **自主决策**: 基于目标的智能决策
- **多模态理解**: 文本、图像、语音的统一处理
- **工具使用**: 外部API和系统集成
- **长期记忆**: 持续学习和知识积累

### 3. 应用场景扩展
- **企业级应用**: 客户服务、数据分析、流程自动化
- **个人助理**: 日程管理、信息整理、学习辅助
- **行业解决方案**: 医疗、金融、教育等垂直领域

### 4. 发展趋势展望
- **更加自主**: 减少人工干预，提高自主性
- **更加智能**: 更强的理解和推理能力
- **更加普及**: 降低使用门槛，扩大应用范围

## 总结
AI Agent技术正在快速发展，为各行各业带来新的机遇。未来，随着技术的成熟和应用的深入，AI Agent将成为数字化转型的重要推动力。

---

**标签**: #AI #人工智能 #Agent #技术趋势 #行业分析
`;

  fs.writeFileSync(articleFile, content);
  console.log(`📄 创建测试文章: ${articleFile}`);
  
  return articleFile;
}

// 创建发布配置
function createPublishConfig(articleFile) {
  const config = {
    wechat_config: {
      // 实际使用时需要配置以下参数
      app_id: process.env.WECHAT_APP_ID || 'YOUR_APP_ID',
      app_secret: process.env.WECHAT_APP_SECRET || 'YOUR_APP_SECRET',
      access_token: process.env.WECHAT_ACCESS_TOKEN || 'AUTO_RENEW',
      account_id: process.env.WECHAT_ACCOUNT_ID || 'YOUR_ACCOUNT_ID'
    },
    article: {
      title: 'AI Agent技术发展趋势分析 - 自动发布测试',
      content_file: articleFile,
      author: 'AI自动发布系统',
      show_cover_pic: 1,
      digest: '分析AI Agent技术的最新发展趋势和应用前景',
      content_source_url: 'https://example.com/ai-agent-trends',
      thumb_media_id: 'TEST_THUMB_MEDIA_ID', // 需要上传封面图获取
      need_open_comment: 1,
      only_fans_can_comment: 0
    },
    publish_options: {
      publish_time: new Date(Date.now() + 3600000).toISOString(), // 1小时后
      is_published: false, // 先保存为草稿
      is_debug: true // 调试模式
    }
  };
  
  const configFile = path.join(CONFIG.workspace, 'workspace', 'wechat_publish_config.json');
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  console.log(`⚙️ 创建发布配置: ${configFile}`);
  
  return configFile;
}

// 生成技能使用指南
function generateSkillGuide() {
  const guideFile = path.join(CONFIG.workspace, 'workspace', 'wechat_publish_guide.md');
  
  const guide = `# 微信公众号自动发布指南

## 系统概述
本系统集成 baoyu-post-to-wechat 技能，实现AI Agent新闻的自动搜索、生成和发布。

## 技能信息
- **技能名称**: baoyu-post-to-wechat
- **技能路径**: ${path.join(CONFIG.skillsDir, CONFIG.wechatSkill)}
- **功能描述**: 通过API或Chrome CDP发布内容到微信公众号

## 发布模式

### 1. API模式（推荐）
使用微信公众号官方API进行发布：
\`\`\`javascript
// 基本配置
const config = {
  app_id: '你的AppID',
  app_secret: '你的AppSecret',
  access_token: '自动获取或手动设置'
};

// 文章内容
const article = {
  title: '文章标题',
  content: '文章内容（HTML格式）',
  author: '作者',
  digest: '摘要',
  show_cover_pic: 1,
  content_source_url: '原文链接'
};
\`\`\`

### 2. Chrome CDP模式
通过Chrome浏览器自动化发布，适合需要登录或复杂交互的场景。

## 配置步骤

### 步骤1: 获取微信公众号凭证
1. 登录微信公众平台 (https://mp.weixin.qq.com)
2. 进入「开发」->「基本配置」
3. 获取 AppID 和 AppSecret
4. 设置IP白名单（如果需要）

### 步骤2: 配置环境变量
\`\`\`bash
export WECHAT_APP_ID="你的AppID"
export WECHAT_APP_SECRET="你的AppSecret"
export WECHAT_ACCOUNT_ID="你的公众号ID"
\`\`\`

### 步骤3: 测试发布
\`\`\`bash
# 测试API连接
node test_wechat_api.js

# 发布测试文章
node publish_test_article.js
\`\`\`

## 自动化流程

### 每日任务流程
1. **06:00** - 启动新闻搜索和分析
2. **06:10** - 生成文章内容
3. **06:20** - 准备配图
4. **06:30** - 调用API发布到公众号
5. **06:40** - 发送发布报告

### 文章类型
1. **技术分析** (08:00发布)
   - AI Agent架构设计
   - 核心技术突破
   - 性能优化策略

2. **应用案例** (12:00发布)
   - 企业应用实践
   - 效果评估分析
   - 实施经验分享

3. **趋势展望** (18:00发布)
   - 技术发展趋势
   - 市场动态分析
   - 投资机会展望

## 错误处理

### 常见错误
1. **API调用频率限制**: 微信公众号API有调用频率限制
2. **Access Token过期**: Token有效期为2小时，需要自动刷新
3. **内容审核不通过**: 文章内容需要符合平台规范
4. **网络连接问题**: 需要重试机制

### 重试策略
1. **立即重试**: 对于网络错误，立即重试1-2次
2. **延迟重试**: 对于API限制，延迟5-10分钟后重试
3. **备用方案**: 如果API失败，保存为草稿手动发布

## 监控和日志

### 日志文件
- \`wechat_publish.log\` - 发布操作日志
- \`api_calls.log\` - API调用日志
- \`error_log.log\` - 错误日志

### 监控指标
1. **发布成功率**: 成功发布文章的比例
2. **API响应时间**: API调用的平均响应时间
3. **文章阅读量**: 发布后24小时的阅读数据
4. **用户互动**: 点赞、评论、分享数据

## 安全注意事项

### 凭证安全
1. **不要硬编码**: 不要在代码中硬编码AppSecret
2. **环境变量**: 使用环境变量存储敏感信息
3. **访问控制**: 限制API调用的IP地址
4. **定期轮换**: 定期更新Access Token

### 内容安全
1. **人工审核**: 重要内容需要人工审核
2. **合规检查**: 确保内容符合法律法规
3. **版权保护**: 尊重原创，避免侵权
4. **事实核查**: 重要数据和事实需要核实

## 扩展功能

### 多平台发布
1. **知乎专栏**: 同步发布到知乎
2. **头条号**: 发布到今日头条
3. **CSDN**: 技术社区分享
4. **个人博客**: 自有博客系统

### 内容优化
1. **SEO优化**: 优化文章标题和关键词
2. **图片优化**: 自动压缩和优化图片
3. **格式转换**: 支持多种内容格式
4. **多语言**: 支持中英文内容

### 数据分析
1. **阅读分析**: 分析文章阅读数据
2. **用户画像**: 分析读者特征
3. **趋势预测**: 预测热门话题
4. **效果评估**: 评估发布效果

## 故障排除

### 问题1: API返回"invalid credential"
**原因**: Access Token无效或过期
**解决**: 重新获取Access Token

### 问题2: 发布失败，返回"content is illegal"
**原因**: 内容包含违规信息
**解决**: 检查并修改文章内容

### 问题3: 图片上传失败
**原因**: 图片格式或大小不符合要求
**解决**: 压缩图片或转换格式

### 问题4: 发布频率过高被限制
**原因**: 超过API调用频率限制
**解决**: 降低发布频率或分批发布

## 联系支持

### 技能开发者
- **GitHub**: https://github.com/baoyu-ai
- **文档**: 查看技能目录下的SKILL.md

### 系统维护
- **日志文件**: 查看workspace目录下的日志文件
- **配置文件**: 检查wechat_publish_config.json
- **环境变量**: 确认环境变量设置正确

---

**最后更新**: ${new Date().toLocaleDateString('zh-CN')}
**系统版本**: v1.0
**适用平台**: 微信公众号服务号、订阅号
`;

  fs.writeFileSync(guideFile, guide);
  console.log(`📚 生成使用指南: ${guideFile}`);
  
  return guideFile;
}

// 创建测试脚本
function createTestScript() {
  const testScript = path.join(CONFIG.workspace, 'workspace', 'test_wechat_publish.js');
  
  const script = `#!/usr/bin/env node

/**
 * 微信公众号发布测试脚本
 * 测试baoyu-post-to-wechat技能的基本功能
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 微信公众号发布测试脚本');
console.log('==============================');

// 检查环境变量
const requiredEnvVars = ['WECHAT_APP_ID', 'WECHAT_APP_SECRET'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.warn('⚠️  缺少环境变量:', missingVars.join(', '));
  console.warn('请设置以下环境变量:');
  missingVars.forEach(varName => {
    console.warn(\`  export \${varName}="你的\${varName.replace('WECHAT_', '')}"\`);
  });
  console.warn('或者编辑 wechat_publish_config.json 文件');
} else {
  console.log('✅ 环境变量检查通过');
}

// 检查技能目录
const skillPath = path.join(__dirname, '..', '..', 'skills', 'baoyu-post-to-wechat');
if (!fs.existsSync(skillPath)) {
  console.error('❌ 技能目录不存在:', skillPath);
  process.exit(1);
}

console.log('✅ 技能目录存在:', skillPath);

// 检查技能文件
const skillFiles = ['SKILL.md', 'index.js', 'package.json'].filter(file => 
  fs.existsSync(path.join(skillPath, file))
);

console.log(\`📁 技能文件: \${skillFiles.length}个文件存在\`);

// 读取技能文档
try {
  const skillDoc = fs.readFileSync(path.join(skillPath, 'SKILL.md'), 'utf-8');
  const descriptionMatch = skillDoc.match(/Description:\\s*(.+)/);
  const usageMatch = skillDoc.match(/Use when\\s*(.+)/);
  
  if (descriptionMatch) {
    console.log(\`📝 技能描述: \${descriptionMatch[1].trim()}\`);
  }
  
  if (usageMatch) {
    console.log(\`🎯 使用场景: \${usageMatch[1].trim()}\`);
  }
} catch (error) {
  console.warn('⚠️  无法读取技能文档:', error.message);
}

// 创建测试配置
const testConfig = {
  test_mode: true,
  timestamp: new Date().toISOString(),
  steps: [
    '1. 检查技能和环境',
    '2. 创建测试文章',
    '3. 准备发布配置',
    '4. 测试API连接',
    '5. 模拟发布流程'
  ],
  expected_files: [
    'test_article.md',
    'wechat_publish_config.json',
    'wechat_publish_guide.md',
    'test_report.md'
  ]
};

const configFile = path.join(__dirname, 'test_config.json');
fs.writeFileSync(configFile, JSON.stringify(testConfig, null, 2));
console.log(\`⚙️  测试配置已保存: \${configFile}\`);

// 生成测试报告
const report = \`# 微信公众号发布测试报告

**测试时间**: \${new Date().toLocaleString('zh-CN')}
**测试环境**: Node.js \${process.version}
**工作目录**: \${__dirname}

## 测试结果

### 环境检查
- ✅ Node.js版本: \${process.version}
- ✅ 技能目录: \${skillPath}
- ✅ 技能文件: \${skillFiles.length}个
- ⚠️  环境变量: \${missingVars.length > 0 ? '缺少' + missingVars.join(', ') : '完整'}

### 文件生成
- ✅ 测试配置: \${configFile}
- ✅ 使用指南: \${path.join(__dirname, 'wechat_publish_guide.md')}
- ✅ 发布配置: \${path.join(__dirname, 'wechat_publish_config.json')}

## 下一步操作

### 1. 配置微信公众号
1. 登录微信公众平台
2. 获取AppID和AppSecret
3. 设置IP白名单（如果需要）

### 2. 设置环境变量
\`\`\`bash
export WECHAT_APP_ID="你的AppID"
export WECHAT_APP_SECRET="你的AppSecret"
export WECHAT_ACCOUNT_ID="你的公众号ID"
\`\`\`

### 3. 运行实际测试
\`\`\`bash
# 方法1: 使用nanobot技能
nanobot skill run baoyu-post-to-wechat --article test_article.md

# 方法2: 直接调用技能脚本
cd skills/baoyu-post-to-wechat && node index.js --config ../workspace/wechat_publish_config.json
\`\`\`

### 4. 验证发布结果
1. 检查微信公众号后台草稿箱
2. 预览文章效果
3. 确认发布成功

## 故障排除

### 常见问题
1. **API返回"invalid credential"**: Access Token无效，需要重新获取
2. **"content is illegal"**: 内容包含违规信息，需要修改
3. **网络连接失败**: 检查网络连接和代理设置
4. **权限不足**: 确认公众号有发布权限

### 调试建议
1. 启用详细日志: \`DEBUG=* node test_wechat_publish.js\`
2. 检查网络请求: 使用抓包工具查看API调用
3. 验证Access Token: 单独测试Token获取接口
4. 简化测试: 使用最小化的测试文章

## 支持资源

### 官方文档
- 微信公众平台开发文档: https://developers.weixin.qq.com/doc/
- API调试工具: https://mp.weixin.qq.com/debug/

### 技能支持
- 技能文档: \${path.join(skillPath, 'SKILL.md')}
- 示例代码: 查看技能目录下的examples/
- 问题反馈: GitHub Issues

---

**测试状态**: \${missingVars.length > 0 ? '需要配置环境变量' : '准备就绪'}
**建议操作**: \${missingVars.length > 0 ? '先配置环境变量' : '可以开始测试'}
**生成时间**: \${new Date().toLocaleString('zh-CN')}
\`;

const reportFile = path.join(__dirname, 'test_report.md');
fs.writeFileSync(reportFile, report);
console.log(\`📋 测试报告已生成: \${reportFile}\`);

console.log('\\n🎉 测试脚本执行完成！');
console.log('📋 查看测试报告:', reportFile);
console.log('🚀 下一步: 配置环境变量并运行实际测试');
`;

  fs.writeFileSync(testScript, script);
  fs.chmodSync(testScript, '755');
  console.log(`🧪 创建测试脚本: ${testScript}`);
  
  return testScript;
}

// 主函数
async function main() {
  console.log('🚀 微信公众号自动发布系统初始化');
  console.log('==========================================');
  
  // 检查技能
  if (!checkSkill()) {
    process.exit(1);
  }
  
  // 读取技能文档
  readSkillDoc();
  
  // 创建测试文章
  const articleFile = createTestArticle();
  
  // 创建发布配置
  const configFile = createPublishConfig(articleFile);
  
  // 生成使用指南
  const guideFile = generateSkillGuide();
  
  // 创建测试脚本
  const testScript = createTestScript();
  
  console.log('\n==========================================');
  console.log('✅ 系统初始化完成！');
  console.log(`📁 工作目录: ${path.join(CONFIG.workspace, 'workspace')}`);
  console.log(`📄 测试文章: ${articleFile}`);
  console.log(`⚙️  发布配置: ${configFile}`);
  console.log(`📚 使用指南: ${guideFile}`);
  console.log(`🧪 测试脚本: ${testScript}`);
  console.log('\n🚀 下一步操作:');
  console.log('1. 配置微信公众号API凭证');
  console.log('2. 设置环境变量 (WECHAT_APP_ID, WECHAT_APP_SECRET)');
  console.log('3. 运行测试脚本: node workspace/test_wechat_publish.js');
  console.log('4. 配置每日定时任务');
  console.log('==========================================\n');
  
  // 输出环境变量设置示例
  console.log('💡 环境变量设置示例:');
  console.log('export WECHAT_APP_ID="你的AppID"');
  console.log('export WECHAT_APP_SECRET="你的AppSecret"');
  console.log('export WECHAT_ACCOUNT_ID="你的公众号ID"');
}

// 执行
if (require.main === module) {
  main().catch(error => {
    console.error('执行失败:', error);
    process.exit(1);
  });
}

module.exports = {
  checkSkill,
  readSkillDoc,
  createTestArticle,
  createPublishConfig,
  generateSkillGuide,
  createTestScript
};