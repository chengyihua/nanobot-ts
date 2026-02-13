# QQ邮箱配置指南

## 1. 启用IMAP/SMTP服务

### 步骤：
1. 登录QQ邮箱网页版：https://mail.qq.com
2. 点击顶部"设置" → "账户"
3. 找到"POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV服务"部分
4. 开启以下服务：
   - **IMAP/SMTP服务**：点击"开启"
   - **POP3/SMTP服务**：可选开启

## 2. 获取授权码

### 为什么需要？
- QQ邮箱不允许直接使用QQ密码
- 需要使用"授权码"作为应用密码

### 步骤：
1. 在"开启服务"时，会提示验证身份
2. 按照提示发送短信到指定号码
3. 发送后点击"我已发送"
4. 系统会生成一个**16位授权码**

**重要**：这个授权码只显示一次，请立即保存！

## 3. 配置nanobot

### 环境变量配置：
```bash
# QQ邮箱配置
MAIL_SMTP_SERVER=smtp.qq.com
MAIL_SMTP_PORT=587
MAIL_USERNAME=your_qq_number@qq.com  # 或 your_email@qq.com
MAIL_PASSWORD=your_authorization_code_here  # 16位授权码
MAIL_IMAP_SERVER=imap.qq.com
MAIL_IMAP_PORT=993
MAIL_FROM_NAME=您的名称
MAIL_PROVIDER=qq
```

## 4. 邮箱地址格式

QQ邮箱支持多种格式：
- **QQ号码邮箱**：123456789@qq.com
- **英文邮箱**：yourname@qq.com（需要单独注册）
- **Foxmail邮箱**：yourname@foxmail.com

## 5. 测试连接

### 使用配置脚本测试：
```bash
python scripts/mail_config.py test
```

### 快速配置（推荐）：
```bash
python scripts/mail_config.py setup qq 123456789@qq.com your_authorization_code
```

## 6. 常见问题

### 问题1：授权码无效
**错误信息**：`(535, b'Error: authentication failed')`

**解决方案**：
1. 确认使用的是"授权码"，不是QQ密码
2. 授权码可能已过期，重新生成
3. 检查邮箱地址是否正确

### 问题2：连接超时
**错误信息**：`Connection timed out`

**解决方案**：
1. 尝试使用SSL端口465
   ```bash
   MAIL_SMTP_PORT=465
   MAIL_SMTP_USE_SSL=true
   ```
2. 检查防火墙设置
3. 确认网络可以访问QQ邮箱服务

### 问题3：发送频率限制
QQ邮箱有发送频率限制：
- 单个邮箱每日发送限制：500封
- 单个IP每日发送限制：1000封
- 每分钟发送限制：50封

## 7. 安全建议

### 授权码管理：
1. **每个应用使用独立授权码**
2. **定期更换授权码**（建议每3-6个月）
3. **不在公共场合保存授权码**

### 账户安全：
1. 开启QQ安全中心
2. 绑定手机令牌
3. 定期修改QQ密码

## 8. 高级功能

### 使用企业邮箱
如果使用QQ企业邮箱，配置略有不同：

```bash
# QQ企业邮箱配置
MAIL_SMTP_SERVER=smtp.exmail.qq.com
MAIL_SMTP_PORT=465
MAIL_IMAP_SERVER=imap.exmail.qq.com
MAIL_IMAP_PORT=993
```

### 大附件支持
QQ邮箱支持最大50MB附件，但建议：
1. 超过25MB使用云存储链接
2. 分卷压缩大文件
3. 使用QQ邮箱超大附件功能（2GB）

### 邮件撤回
QQ邮箱支持邮件撤回功能：
- 发送后15分钟内可撤回
- 仅限QQ邮箱之间
- 需要收件人未阅读

## 9. 故障排除

### 检查服务状态：
访问：https://service.mail.qq.com/cgi-bin/help?subtype=1&&id=28&&no=1001257
查看QQ邮箱服务状态。

### 测试命令：
```bash
# 测试SMTP连接
openssl s_client -connect smtp.qq.com:465 -quiet

# 测试IMAP连接
openssl s_client -connect imap.qq.com:993 -quiet
```

### 查看错误日志：
```bash
# 启用调试模式
python scripts/send_mail.py --to "test@example.com" --subject "测试" --body "测试" --debug
```

## 10. 与其他邮箱对比

| 功能 | QQ邮箱 | Gmail | 163邮箱 |
|------|--------|-------|---------|
| 免费存储 | 无限 | 15GB | 无限 |
| 附件大小 | 50MB | 25MB | 50MB |
| 授权方式 | 授权码 | 应用密码 | 客户端密码 |
| IMAP支持 | ✅ | ✅ | ✅ |
| 垃圾过滤 | 中等 | 优秀 | 中等 |
| 国际访问 | 一般 | 优秀 | 一般 |

## 11. 备用方案

如果QQ邮箱遇到问题：

### 方案A：使用Foxmail
1. 注册Foxmail邮箱（腾讯旗下）
2. 配置类似QQ邮箱
3. 国际访问性更好

### 方案B：使用企业邮箱
1. 申请腾讯企业邮箱（免费版）
2. 功能更强大
3. 支持自定义域名

### 方案C：切换服务商
```bash
# 切换到163邮箱
python scripts/mail_config.py setup 163 your_email@163.com your_client_password
```

## 12. 联系支持

### QQ邮箱官方帮助：
- 帮助中心：https://service.mail.qq.com
- 客服电话：0755-83765566
- 在线客服：邮箱内"帮助与反馈"

### 常见问题链接：
1. 如何获取授权码：https://service.mail.qq.com/cgi-bin/help?subtype=1&&id=28&&no=1001256
2. 发送限制说明：https://service.mail.qq.com/cgi-bin/help?subtype=1&id=28&no=1001258
3. 安全设置指南：https://service.mail.qq.com/cgi-bin/help?subtype=1&id=28&no=1001270