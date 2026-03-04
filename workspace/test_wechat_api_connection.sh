#!/bin/bash

# 微信公众号API连接测试脚本

echo "🔌 微信公众号API连接测试"
echo "========================="

WORKSPACE="/Users/chengyihua/Downloads/nanobot-main/nanobot-ts"
SKILL_DIR="$WORKSPACE/skills/baoyu-post-to-wechat"
ARTICLE_FILE="$WORKSPACE/workspace/test_image_article.md"

# 检查环境变量
echo ""
echo "📋 检查环境变量:"
if [ -n "$WECHAT_APP_ID" ] && [ -n "$WECHAT_APP_SECRET" ]; then
    echo "✅ WECHAT_APP_ID: ${WECHAT_APP_ID:0:4}****"
    echo "✅ WECHAT_APP_SECRET: ${WECHAT_APP_SECRET:0:4}****"
    USE_ENV_VARS=true
else
    echo "❌ 未设置WECHAT_APP_ID和WECHAT_APP_SECRET环境变量"
    echo ""
    echo "💡 请设置环境变量:"
    echo "export WECHAT_APP_ID=\"您的AppID\""
    echo "export WECHAT_APP_SECRET=\"您的AppSecret\""
    echo ""
    read -p "是否现在输入凭证？(y/n): " input_creds
    
    if [ "$input_creds" = "y" ] || [ "$input_creds" = "Y" ]; then
        read -p "请输入WECHAT_APP_ID: " app_id
        read -s -p "请输入WECHAT_APP_SECRET: " app_secret
        echo ""
        export WECHAT_APP_ID="$app_id"
        export WECHAT_APP_SECRET="$app_secret"
        USE_ENV_VARS=true
    else
        echo "⚠️  使用测试模式（需要您提供实际凭证）"
        USE_ENV_VARS=false
    fi
fi

# 检查文章文件
echo ""
echo "📄 检查文章文件:"
if [ -f "$ARTICLE_FILE" ]; then
    echo "✅ 文章文件存在: $ARTICLE_FILE"
    TITLE=$(grep -m1 '^title:' "$ARTICLE_FILE" | sed 's/title: //' | tr -d '\"')
    AUTHOR=$(grep -m1 '^author:' "$ARTICLE_FILE" | sed 's/author: //' | tr -d '\"')
    echo "   标题: $TITLE"
    echo "   作者: $AUTHOR"
else
    echo "❌ 文章文件不存在: $ARTICLE_FILE"
    exit 1
fi

# 检查技能脚本
echo ""
echo "🔧 检查技能脚本:"
if [ -f "$SKILL_DIR/scripts/wechat-api.ts" ]; then
    echo "✅ API脚本存在: wechat-api.ts"
    
    # 检查脚本参数
    echo "   检查脚本参数支持..."
    if grep -q "dry-run\|test" "$SKILL_DIR/scripts/wechat-api.ts"; then
        echo "   ✅ 可能支持测试模式"
    fi
else
    echo "❌ API脚本不存在"
    exit 1
fi

# 执行测试
echo ""
echo "🚀 执行API连接测试:"

if [ "$USE_ENV_VARS" = true ]; then
    echo "使用环境变量中的凭证进行测试..."
    
    # 测试1: 获取access_token
    echo ""
    echo "🧪 测试1: 获取access_token"
    echo "--------------------------"
    
    # 创建临时测试脚本
    TEST_SCRIPT="$WORKSPACE/workspace/test_access_token.js"
    
    cat > "$TEST_SCRIPT" << 'EOF'
const https = require('https');

const appid = process.env.WECHAT_APP_ID;
const secret = process.env.WECHAT_APP_SECRET;

if (!appid || !secret) {
    console.error('❌ 缺少AppID或AppSecret');
    process.exit(1);
}

console.log('🔑 尝试获取access_token...');
console.log(`AppID: ${appid.substring(0, 4)}****`);
console.log(`AppSecret: ${secret.substring(0, 4)}****`);

const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`;

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
            } else {
                console.log(`❌ 获取access_token失败: ${result.errmsg || '未知错误'}`);
                console.log(`   错误码: ${result.errcode || '未知'}`);
            }
        } catch (e) {
            console.error('❌ 解析响应失败:', e.message);
            console.log('原始响应:', data);
        }
    });
    
}).on('error', (err) => {
    console.error('❌ 请求失败:', err.message);
});
EOF
    
    node "$TEST_SCRIPT"
    
    # 测试2: 运行技能API脚本（测试模式）
    echo ""
    echo "🧪 测试2: 运行微信公众号API技能"
    echo "-------------------------------"
    
    echo "执行命令:"
    echo "cd $WORKSPACE && \\"
    echo "WECHAT_APP_ID=\"$WECHAT_APP_ID\" \\"
    echo "WECHAT_APP_SECRET=\"$WECHAT_APP_SECRET\" \\"
    echo "bun $SKILL_DIR/scripts/wechat-api.ts \\"
    echo "  --markdown $ARTICLE_FILE \\"
    echo "  --dry-run"
    
    echo ""
    read -p "是否执行？(y/n): " confirm
    
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        cd "$WORKSPACE" && \
        WECHAT_APP_ID="$WECHAT_APP_ID" \
        WECHAT_APP_SECRET="$WECHAT_APP_SECRET" \
        bun "$SKILL_DIR/scripts/wechat-api.ts" \
          --markdown "$ARTICLE_FILE" \
          --dry-run
    else
        echo "跳过实际执行"
    fi
    
else
    echo ""
    echo "📝 生成测试命令（需要您提供凭证）:"
    echo "--------------------------------"
    echo ""
    echo "1. 设置环境变量:"
    echo "export WECHAT_APP_ID=\"您的AppID\""
    echo "export WECHAT_APP_SECRET=\"您的AppSecret\""
    echo ""
    echo "2. 执行测试:"
    echo "cd $WORKSPACE && \\"
    echo "bun $SKILL_DIR/scripts/wechat-api.ts \\"
    echo "  --markdown $ARTICLE_FILE \\"
    echo "  --dry-run"
    echo ""
    echo "3. 实际发布（去掉--dry-run）:"
    echo "cd $WORKSPACE && \\"
    echo "bun $SKILL_DIR/scripts/wechat-api.ts \\"
    echo "  --markdown $ARTICLE_FILE"
fi

# 清理
rm -f "$WORKSPACE/workspace/test_access_token.js" 2>/dev/null

echo ""
echo "========================================"
echo "🎯 测试完成！"
echo ""
echo "💡 下一步建议:"
echo "1. 如果凭证正确，API连接应该成功"
echo "2. 使用--dry-run参数测试，不实际发布"
echo "3. 测试成功后，去掉--dry-run进行实际发布"
echo "4. 将凭证保存到.env文件以便长期使用"