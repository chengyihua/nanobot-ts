import { readFileSync } from 'fs';
import { join } from 'path';

// 读取凭证
const envPath = join(process.cwd(), 'workspace', '.baoyu-skills', '.env');
console.log('读取凭证文件:', envPath);

try {
  const envContent = readFileSync(envPath, 'utf-8');
  console.log('凭证文件内容:');
  console.log(envContent);
  
  // 解析凭证
  const lines = envContent.split('\n');
  let appId = '';
  let appSecret = '';
  
  for (const line of lines) {
    if (line.startsWith('WECHAT_APP_ID=')) {
      appId = line.split('=')[1].trim();
    } else if (line.startsWith('WECHAT_APP_SECRET=')) {
      appSecret = line.split('=')[1].trim();
    }
  }
  
  console.log('\n解析结果:');
  console.log('AppID:', appId);
  console.log('AppID长度:', appId.length);
  console.log('AppSecret:', appSecret.substring(0, 10) + '...');
  console.log('AppSecret长度:', appSecret.length);
  
  // 验证格式
  console.log('\n格式验证:');
  if (appId.startsWith('gh_') || appId.startsWith('wx')) {
    console.log('✅ AppID格式正确');
  } else {
    console.log('❌ AppID格式可能不正确');
  }
  
  if (appSecret.length === 32) {
    console.log('✅ AppSecret长度正确');
  } else {
    console.log(`❌ AppSecret长度应为32位，当前为${appSecret.length}位`);
  }
  
} catch (error) {
  console.error('读取凭证文件失败:', error.message);
}