// 验证微信公众号凭证
const https = require('https');

// 您提供的凭证
const appid = 'gh_5cc3a72cfabd';
const secret = 'wx15d2fab24534d34b6cb2b71ff8cc152814f407c58889e3e9';

console.log('🔍 验证微信公众号凭证');
console.log('====================');
console.log(`AppID: ${appid}`);
console.log(`AppID长度: ${appid.length} 字符`);
console.log(`AppSecret: ${secret.substring(0, 10)}...`);
console.log(`AppSecret长度: ${secret.length} 字符`);

// 检查AppSecret是否有换行符或空格
console.log('\n🔍 检查AppSecret格式:');
console.log(`原始AppSecret: "${secret}"`);
console.log(`去除空格后: "${secret.trim()}"`);
console.log(`去除空格后长度: ${secret.trim().length} 字符`);

// 检查是否包含换行符
if (secret.includes('\n') || secret.includes('\r')) {
    console.log('⚠️  AppSecret可能包含换行符');
    const cleanSecret = secret.replace(/[\n\r]/g, '');
    console.log(`清理后AppSecret: "${cleanSecret}"`);
    console.log(`清理后长度: ${cleanSecret.length} 字符`);
}

// 微信公众号AppID格式检查
if (!appid.startsWith('gh_') && !appid.startsWith('wx')) {
    console.log('⚠️  AppID格式可能不正确，通常以gh_或wx开头');
}

// 微信公众号AppSecret长度检查
const cleanSecret = secret.trim().replace(/[\n\r]/g, '');
if (cleanSecret.length !== 32) {
    console.log(`⚠️  AppSecret长度应为32位，当前为${cleanSecret.length}位`);
    console.log('   请检查是否有多余的空格或换行符');
}

// 测试API连接
console.log('\n🔗 测试API连接...');
const testSecret = cleanSecret;
const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${testSecret}`;

console.log(`请求URL: ${url.replace(testSecret, '***')}`);

https.get(url, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        try {
            const result = JSON.parse(data);
            console.log('📊 API响应:');
            console.log(JSON.stringify(result, null, 2));
            
            if (result.access_token) {
                console.log(`✅ 成功获取access_token: ${result.access_token.substring(0, 20)}...`);
                console.log(`   有效期: ${result.expires_in}秒`);
                
                // 测试获取公众号信息
                console.log('\n📱 测试获取公众号信息...');
                const infoUrl = `https://api.weixin.qq.com/cgi-bin/get_current_selfmenu_info?access_token=${result.access_token}`;
                
                https.get(infoUrl, (res2) => {
                    let data2 = '';
                    
                    res2.on('data', (chunk) => {
                        data2 += chunk;
                    });
                    
                    res2.on('end', () => {
                        try {
                            const infoResult = JSON.parse(data2);
                            console.log('📋 公众号信息:');
                            console.log(JSON.stringify(infoResult, null, 2));
                        } catch (e) {
                            console.log('❌ 解析公众号信息失败:', e.message);
                        }
                    });
                }).on('error', (err) => {
                    console.log('❌ 获取公众号信息失败:', err.message);
                });
                
            } else {
                console.log(`❌ 获取access_token失败: ${result.errmsg || '未知错误'}`);
                console.log(`   错误码: ${result.errcode || '未知'}`);
                
                // 常见错误码解释
                const errorCodes = {
                    '-1': '系统繁忙',
                    '40001': 'AppSecret错误',
                    '40013': 'AppID错误',
                    '40125': 'AppSecret错误',
                    '41002': '缺少appid参数',
                    '41004': '缺少secret参数'
                };
                
                if (result.errcode && errorCodes[result.errcode]) {
                    console.log(`💡 错误解释: ${errorCodes[result.errcode]}`);
                }
            }
        } catch (e) {
            console.error('❌ 解析响应失败:', e.message);
            console.log('原始响应:', data);
        }
    });
    
}).on('error', (err) => {
    console.error('❌ 请求失败:', err.message);
});

console.log('\n💡 凭证格式要求:');
console.log('1. AppID: 通常以gh_开头，18-20位字符');
console.log('2. AppSecret: 32位字符，无空格');
console.log('3. IP白名单: 需要在微信公众号后台添加服务器IP到白名单');
console.log('4. 权限: 需要获取access_token和消息管理权限');