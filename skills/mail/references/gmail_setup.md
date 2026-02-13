# Gmail配置指南

## 1. 启用IMAP访问

### 步骤：
1. 登录Gmail账户
2. 点击右上角齿轮图标 → "查看所有设置"
3. 进入"转发和POP/IMAP"标签页
4. 在"IMAP访问"部分，选择"启用IMAP"
5. 点击"保存更改"

## 2. 启用两步验证（推荐）

### 为什么需要？
- 提高账户安全性
- 启用"应用专用密码"

### 步骤：
1. 访问：https://myaccount.google.com/security
2. 找到"两步验证"
3. 按照提示启用两步验证
4. 可以使用手机验证码或Google Authenticator

## 3. 创建应用专用密码

### 为什么需要？
- Gmail不允许直接使用账户密码
- 需要为每个应用创建专用密码

### 步骤：
1. 访问：https://myaccount.google.com/apppasswords
2. 选择"邮件"作为应用
3. 选择"其他（自定义名称）"，输入"nanobot"
4. 点击"生成"
5. 复制生成的16位密码（如：xxxx xxxx xxxx xxxx）

**重要**：这个密码只显示一次，请立即保存！

## 4. 配置nanobot

### 环境变量配置：
```bash
# Gmail配置
MAIL_SMTP_SERVER=smtp.gmail.com
MAIL_SMTP_PORT=587
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_app_password_here  # 应用专用密码
MAIL_IMAP_SERVER=imap.gmail.com
MAIL_IMAP_PORT=993
MAIL_FROM_NAME=您的名称
MAIL_PROVIDER=gmail
```

## 5. 测试连接

### 使用配置脚本测试：
```bash
python scripts/mail_config.py test
```

### 手动测试SMTP：
```bash
python scripts/send_mail.py --to "test@example.com" --subject "测试" --body "这是一封测试邮件"
```

### 手动测试IMAP：
```bash
python scripts/receive_mail.py --limit 5
```

## 6. 常见问题

### 问题1：认证失败
**错误信息**：`(535, b'5.7.8 Username and Password not accepted)`

**解决方案**：
1. 确认使用的是"应用专用密码"，不是Gmail账户密码
2. 确保两步验证已启用
3. 重新生成应用专用密码

### 问题2：连接被拒绝
**错误信息**：`Connection refused` 或 `Timeout`

**解决方案**：
1. 检查防火墙设置
2. 尝试使用不同端口（465或587）
3. 确认网络可以访问Google服务

### 问题3：邮件被标记为垃圾邮件
**解决方案**：
1. 在发件人设置中使用真实姓名
2. 避免使用敏感词汇
3. 首次发送后检查垃圾邮件箱，标记为"非垃圾邮件"

## 7. 安全建议

### 最佳实践：
1. **定期更换应用专用密码**
2. **监控账户活动**：定期检查https://myaccount.google.com/notifications
3. **启用登录提醒**：收到新设备登录时发送通知
4. **使用强密码**：应用专用密码也要复杂

### 隐私设置：
1. 在Google账户中检查应用权限
2. 定期审查已连接的第三方应用
3. 不使用时可以撤销应用专用密码

## 8. 高级配置

### 使用OAuth 2.0（更安全）
如果需要更高级的安全性，可以使用OAuth 2.0：

```python
# 需要安装google-auth-oauthlib和google-auth-httplib2
pip install google-auth-oauthlib google-auth-httplib2
```

### 配置发送限制
Gmail有发送限制：
- 每日发送限制：500封
- 收件人限制：每封邮件最多100个收件人
- 附件大小限制：25MB

### 使用别名发送
可以在Gmail设置中配置"以其他地址发送"：
1. 设置 → 账户 → 以其他地址发送
2. 添加其他邮箱地址
3. 验证所有权

## 9. 故障排除

### 检查日志：
```bash
# 启用详细日志
python scripts/send_mail.py --to "test@example.com" --subject "测试" --body "测试" --verbose
```

### 测试网络连接：
```bash
# 测试SMTP连接
telnet smtp.gmail.com 587

# 测试IMAP连接
telnet imap.gmail.com 993
```

### 检查配额：
访问：https://drive.google.com/settings/storage
确保有足够的存储空间。

## 10. 备用方案

如果无法使用Gmail，可以考虑：
1. **使用企业邮箱**：通常限制较少
2. **使用其他免费邮箱**：如QQ邮箱、163邮箱
3. **使用邮件发送服务**：如SendGrid、Mailgun（有免费额度）