# 微信公众号API配置指南

## 概述
本文档指导如何配置微信公众号API，实现AI Agent新闻的自动发布。

## 第一步：获取微信公众号API凭证

### 1.1 登录微信公众平台
1. 访问 https://mp.weixin.qq.com
2. 使用您的公众号账号登录

### 1.2 获取AppID和AppSecret
1. 进入「开发」->「基本配置」
2. 找到「开发者ID」部分：
   - **AppID(应用ID)**: 复制保存
   - **AppSecret(应用密钥)**: 点击重置或查看，复制保存

### 1.3 设置IP白名单（可选但推荐）
1. 在「基本配置」页面找到「IP白名单」
2. 添加您的服务器IP地址：
   - 如果您在本地运行：添加您的公网IP
   - 如果您在云服务器运行：添加服务器公网IP
   - 可以添加多个IP，用回车分隔

## 第二步：配置环境变量

### 2.1 创建环境变量文件
在nanobot工作目录创建 `.env` 文件：

```bash
cd /Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace
cat > .env << 'EOF'
# 微信公众号配置
WECHAT_APP_ID=你的AppID
WECHAT_APP_SECRET=你的AppSecret
WECHAT_ACCOUNT_ID=你的公众号原始ID

# 发布配置
PUBLISH_AUTO=true
PUBLISH_REVIEW=true
PUBLISH_TIME_1=08:00
PUBLISH_TIME_2=12:00
PUBLISH_TIME_3=18:00

# 通知配置
NOTIFICATION_EMAIL=你的邮箱@example.com
NOTIFICATION_WEBHOOK=你的Webhook地址
EOF
```

### 2.2 设置环境变量
```bash
# 加载环境变量
export $(grep -v '^#' .env | xargs)

# 验证环境变量
echo "AppID: $WECHAT_APP_ID"
echo "AppSecret: $WECHAT_APP_SECRET"
```

## 第三步：测试API连接

### 3.1 创建测试脚本
```bash
cat > test_wechat_api.sh << 'EOF'
#!/bin/bash

# 微信公众号API测试脚本

APP_ID="$WECHAT_APP_ID"
APP_SECRET="$WECHAT_APP_SECRET"

if [ -z "$APP_ID" ] || [ -z "$APP_SECRET" ]; then
  echo "错误: 请先设置WECHAT_APP_ID和WECHAT_APP_SECRET环境变量"
  exit 1
fi

echo "测试微信公众号API连接..."
echo "AppID: $APP_ID"

# 获取Access Token
TOKEN_URL="https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=$APP_ID&secret=$APP_SECRET"
echo "请求URL: $TOKEN_URL"

RESPONSE=$(curl -s "$TOKEN_URL")
echo "响应: $RESPONSE"

# 解析响应
ACCESS_TOKEN=$(echo "$RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
EXPIRES_IN=$(echo "$RESPONSE" | grep -o '"expires_in":[0-9]*' | cut -d':' -f2)

if [ -n "$ACCESS_TOKEN" ]; then
  echo "✅ API连接成功!"
  echo "Access Token: ${ACCESS_TOKEN:0:20}..."
  echo "有效期: $EXPIRES_IN 秒"
else
  echo "❌ API连接失败"
  ERROR_CODE=$(echo "$RESPONSE" | grep -o '"errcode":[0-9]*' | cut -d':' -f2)
  ERROR_MSG=$(echo "$RESPONSE" | grep -o '"errmsg":"[^"]*"' | cut -d'"' -f4)
  echo "错误代码: $ERROR_CODE"
  echo "错误信息: $ERROR_MSG"
fi
EOF

chmod +x test_wechat_api.sh
```

### 3.2 运行测试
```bash
./test_wechat_api.sh
```

## 第四步：配置自动发布脚本

### 4.1 修改发布脚本支持环境变量
编辑 `daily_ai_agent_publisher.sh`，在开头添加：

```bash
# 加载环境变量
if [ -f ".env" ]; then
  export $(grep -v '^#' .env | xargs)
fi

# 检查必要环境变量
if [ -z "$WECHAT_APP_ID" ] || [ -z "$WECHAT_APP_SECRET" ]; then
  echo "错误: 请先配置微信公众号API凭证"
  echo "设置环境变量: WECHAT_APP_ID 和 WECHAT_APP_SECRET"
  exit 1
fi
```

### 4.2 创建API发布函数
在脚本中添加微信公众号发布函数：

```bash
# 微信公众号发布函数
publish_to_wechat() {
  local article_file="$1"
  local title="$2"
  local author="$3"
  local digest="$4"
  
  echo "发布文章到微信公众号: $title"
  
  # 获取Access Token
  ACCESS_TOKEN=$(get_wechat_token)
  if [ -z "$ACCESS_TOKEN" ]; then
    echo "获取Access Token失败"
    return 1
  fi
  
  # 构建发布数据
  local content=$(cat "$article_file" | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')
  
  local post_data=$(cat << EOF
{
  "articles": [{
    "title": "$title",
    "author": "$author",
    "digest": "$digest",
    "content": "$content",
    "content_source_url": "https://your-domain.com/article",
    "show_cover_pic": 1,
    "need_open_comment": 1,
    "only_fans_can_comment": 0
  }]
}
EOF
)
  
  # 调用发布API
  local publish_url="https://api.weixin.qq.com/cgi-bin/draft/add?access_token=$ACCESS_TOKEN"
  local response=$(curl -s -X POST -H "Content-Type: application/json" -d "$post_data" "$publish_url")
  
  echo "发布响应: $response"
  
  # 检查发布结果
  local errcode=$(echo "$response" | grep -o '"errcode":[0-9]*' | cut -d':' -f2)
  if [ "$errcode" = "0" ]; then
    echo "✅ 文章发布成功（保存为草稿）"
    return 0
  else
    echo "❌ 文章发布失败"
    return 1
  fi
}

# 获取Access Token函数
get_wechat_token() {
  local token_url="https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=$WECHAT_APP_ID&secret=$WECHAT_APP_SECRET"
  local response=$(curl -s "$token_url")
  echo "$response" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4
}
```

## 第五步：集成baoyu-post-to-wechat技能

### 5.1 检查技能状态
```bash
cd /Users/chengyihua/Downloads/nanobot-main/nanobot-ts
ls -la skills/baoyu-post-to-wechat/
```

### 5.2 创建技能调用脚本
```bash
cat > call_wechat_skill.sh << 'EOF'
#!/bin/bash

# 调用baoyu-post-to-wechat技能发布文章

ARTICLE_FILE="$1"
TITLE="$2"
CONFIG_FILE="wechat_publish_config.json"

if [ ! -f "$ARTICLE_FILE" ]; then
  echo "错误: 文章文件不存在: $ARTICLE_FILE"
  exit 1
fi

echo "调用baoyu-post-to-wechat技能发布文章..."
echo "文章: $TITLE"
echo "文件: $ARTICLE_FILE"

# 检查技能
SKILL_DIR="skills/baoyu-post-to-wechat"
if [ ! -d "$SKILL_DIR" ]; then
  echo "错误: baoyu-post-to-wechat技能不存在"
  exit 1
fi

# 创建临时配置
cat > "$CONFIG_FILE" << CONFIG
{
  "article": {
    "title": "$TITLE",
    "content_file": "$ARTICLE_FILE",
    "author": "AI自动发布系统",
    "show_cover_pic": 1,
    "digest": "AI Agent技术分析文章",
    "need_open_comment": 1
  },
  "publish_options": {
    "is_published": false,
    "is_debug": true
  }
}
CONFIG

echo "配置已创建: $CONFIG_FILE"
echo "请手动运行: nanobot skill run baoyu-post-to-wechat --config $CONFIG_FILE"
EOF

chmod +x call_wechat_skill.sh
```

## 第六步：设置定时任务

### 6.1 查看当前cron任务
```bash
cd /Users/chengyihua/Downloads/nanobot-main/nanobot-ts
cat cron.json | python3 -m json.tool | grep -A5 -B5 '"expr": "0 6'
```

### 6.2 验证cron任务
```bash
# 手动测试脚本
cd workspace
./daily_ai_agent_publisher.sh

# 查看生成的日志
tail -f logs/ai_agent_publish_$(date +%Y%m%d).log
```

## 第七步：监控和告警

### 7.1 创建监控脚本
```bash
cat > monitor_publish.sh << 'EOF'
#!/bin/bash

# 发布任务监控脚本

LOG_DIR="workspace/logs"
TODAY=$(date +%Y%m%d)
LOG_FILE="$LOG_DIR/ai_agent_publish_${TODAY}.log"

# 检查今天是否已执行
if [ ! -f "$LOG_FILE" ]; then
  echo "⚠️  今天($TODAY)的发布任务尚未执行"
  exit 1
fi

# 检查执行状态
if grep -q "🎉 AI Agent新闻自动发布任务完成" "$LOG_FILE"; then
  echo "✅ 今天($TODAY)的发布任务已成功完成"
  
  # 统计信息
  ARTICLES=$(grep -c "生成文章" "$LOG_FILE")
  echo "生成文章数量: $ARTICLES"
  
  # 检查错误
  ERRORS=$(grep -c "错误\|失败\|ERROR\|FAILED" "$LOG_FILE")
  if [ "$ERRORS" -gt 0 ]; then
    echo "⚠️  发现 $ERRORS 个错误"
    grep "错误\|失败\|ERROR\|FAILED" "$LOG_FILE"
  fi
else
  echo "❌ 今天($TODAY)的发布任务未完成或失败"
  tail -20 "$LOG_FILE"
  exit 1
fi
EOF

chmod +x monitor_publish.sh
```

### 7.2 设置监控cron任务
```bash
# 每天7点检查发布任务
nanobot cron add --name "检查发布任务" --schedule "0 7 * * *" --command "cd /Users/chengyihua/Downloads/nanobot-main/nanobot-ts && ./monitor_publish.sh"
```

## 第八步：故障排除

### 8.1 常见问题

#### 问题1: API返回"invalid credential"
**原因**: Access Token无效或过期
**解决**: 
```bash
# 重新获取Access Token
curl "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=$WECHAT_APP_ID&secret=$WECHAT_APP_SECRET"
```

#### 问题2: 发布失败，返回"content is illegal"
**原因**: 内容包含违规信息
**解决**: 检查文章内容，修改敏感词汇

#### 问题3: IP不在白名单
**原因**: 服务器IP未添加到白名单
**解决**: 在公众号后台添加服务器IP到白名单

#### 问题4: 发布频率过高
**原因**: 超过API调用频率限制
**解决**: 降低发布频率，或分批发布

### 8.2 调试技巧
```bash
# 启用详细日志
DEBUG=1 ./daily_ai_agent_publisher.sh

# 查看API请求详情
curl -v "https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=YOUR_APPID&secret=YOUR_SECRET"

# 检查网络连接
ping api.weixin.qq.com
```

## 第九步：安全注意事项

### 9.1 凭证安全
1. **不要硬编码**: 不要在代码中硬编码AppSecret
2. **环境变量**: 使用环境变量存储敏感信息
3. **访问控制**: 限制脚本执行权限
4. **定期轮换**: 定期更新Access Token

### 9.2 内容安全
1. **人工审核**: 重要内容需要人工审核
2. **合规检查**: 确保内容符合法律法规
3. **版权保护**: 尊重原创，避免侵权
4. **事实核查**: 重要数据和事实需要核实

## 第十步：优化建议

### 10.1 性能优化
1. **缓存Access Token**: 避免每次调用都获取新Token
2. **批量发布**: 合并多个文章一次性发布
3. **异步处理**: 使用队列异步处理发布任务
4. **错误重试**: 实现智能重试机制

### 10.2 功能扩展
1. **多平台发布**: 扩展到知乎、头条等平台
2. **内容个性化**: 根据读者兴趣推荐内容
3. **数据分析**: 分析发布效果和读者反馈
4. **自动化配图**: 集成AI图片生成工具

## 支持资源

### 官方文档
- 微信公众平台开发文档: https://developers.weixin.qq.com/doc/
- API调试工具: https://mp.weixin.qq.com/debug/

### 技能支持
- baoyu-post-to-wechat技能文档: `skills/baoyu-post-to-wechat/SKILL.md`
- 示例代码: 查看技能目录下的examples/

### 问题反馈
- 系统问题: 检查workspace/logs/目录下的日志文件
- API问题: 查看微信公众号后台「开发」->「运维中心」
- 技能问题: 联系技能开发者

---

**最后更新**: $(date '+%Y年%m月%d日')
**适用版本**: AI Agent自动发布系统 v1.0
**维护团队**: 您的AI助手

> 提示: 本指南为配置参考，实际配置可能因公众号类型、权限设置等因素有所不同。建议先在小范围测试，确认无误后再投入生产使用。