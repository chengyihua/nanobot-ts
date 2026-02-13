# 邮件功能故障排除指南

## 1. 快速诊断

### 检查基本配置：
```bash
# 查看当前配置
python scripts/mail_config.py show

# 测试连接
python scripts/mail_config.py test
```

## 2. 常见错误及解决方案

### 错误1：认证失败
```
535, b'5.7.8 Username and Password not accepted'
535, b'Error: authentication failed'
```

**可能原因**：
1. 密码错误（使用了账户密码而不是应用密码）
2. 两步验证未启用
3. 授权码/应用密码已过期
4. 账户被锁定

**解决方案**：
1. **Gmail**：使用"应用专用密码"，不是Gmail密码
2. **QQ邮箱**：使用"授权码"，不是QQ密码
3. **163邮箱**：使用"客户端授权密码"
4. 重新生成应用密码/授权码
5. 检查账户是否被锁定

### 错误2：连接被拒绝
```
Connection refused
Connection timed out
```

**可能原因**：
1. 防火墙阻止
2. 端口被屏蔽
3. 服务器地址错误
4. 网络问题

**解决方案**：
1. 检查防火墙设置
2. 尝试不同端口（587, 465, 25）
3. 确认服务器地址正确
4. 测试网络连接：
   ```bash
   telnet smtp.gmail.com 587
   telnet imap.qq.com 993
   ```

### 错误3：SSL/TLS错误
```
SSL: WRONG_VERSION_NUMBER
SSL: CERTIFICATE_VERIFY_FAILED
```

**可能原因**：
1. SSL配置错误
2. 证书问题
3. 使用了错误的端口

**解决方案**：
1. 检查SSL/TLS设置：
   ```bash
   MAIL_SMTP_USE_SSL=true  # 使用SSL
   MAIL_SMTP_USE_TLS=true  # 使用TLS
   ```
2. 尝试不同端口组合：
   - SSL: 465 (SMTP), 993 (IMAP)
   - TLS: 587 (SMTP), 143 (IMAP)
3. 更新证书：
   ```bash
   pip install --upgrade certifi
   ```

### 错误4：发送限制
```
550, b'Daily sending quota exceeded'
```

**可能原因**：
1. 达到每日发送限制
2. 发送频率过高
3. 被标记为垃圾邮件发送者

**解决方案**：
1. 等待24小时重置
2. 降低发送频率
3. 检查邮件内容是否触发垃圾邮件过滤
4. 使用多个邮箱账户轮换发送

## 3. 分服务商故障排除

### Gmail特定问题：
1. **"低安全性应用"警告**：
   - 访问：https://myaccount.google.com/lesssecureapps
   - 启用"允许不够安全的应用"
   - 或使用应用专用密码

2. **配额限制**：
   - 每日发送：500封
   - 收件人：每封100人
   - 附件：25MB

### QQ邮箱特定问题：
1. **授权码无效**：
   - 重新生成授权码
   - 确认已发送验证短信
   - 检查邮箱格式：123456789@qq.com

2. **发送频率限制**：
   - 单个邮箱：500封/天
   - 单个IP：1000封/天
   - 频率：50封/分钟

### 163邮箱特定问题：
1. **客户端密码错误**：
   - 需要在网页版设置中开启"客户端授权密码"
   - 不是邮箱登录密码

2. **附件大小限制**：
   - 普通附件：50MB
   - 超大附件：2GB（需要手动上传）

## 4. 网络诊断

### 测试网络连接：
```bash
# 测试SMTP端口
nc -zv smtp.gmail.com 587
nc -zv smtp.qq.com 587

# 测试IMAP端口
nc -zv imap.gmail.com 993
nc -zv imap.qq.com 993
```

### 检查DNS解析：
```bash
# 解析邮件服务器
nslookup smtp.gmail.com
nslookup imap.qq.com

# 使用特定DNS
nslookup smtp.gmail.com 8.8.8.8
```

### 路由跟踪：
```bash
# 跟踪到邮件服务器的路由
traceroute smtp.gmail.com
mtr smtp.qq.com
```

## 5. 日志分析

### 启用详细日志：
```python
# 在代码中启用调试
import smtplib
smtplib.SMTP.debuglevel = 1

import imaplib
imaplib.IMAP4.debuglevel = 4
```

### 查看系统日志：
```bash
# macOS
log show --predicate 'process == "Python"' --last 1h

# Linux
journalctl -u your_service -f
```

### 保存错误日志：
```bash
# 重定向错误到文件
python scripts/send_mail.py --to "test@example.com" --subject "测试" --body "测试" 2> error.log

# 查看错误日志
tail -f error.log
```

## 6. 性能优化

### 连接池：
```python
# 重用SMTP连接
import smtplib
from contextlib import contextmanager

@contextmanager
def get_smtp_connection():
    server = smtplib.SMTP('smtp.gmail.com', 587)
    server.starttls()
    server.login('user', 'pass')
    try:
        yield server
    finally:
        server.quit()
```

### 批量发送优化：
1. 使用连接池
2. 异步发送
3. 合理设置延迟
4. 错误重试机制

### 内存优化：
1. 流式处理大附件
2. 及时关闭连接
3. 清理临时文件

## 7. 安全故障排除

### 证书验证失败：
```bash
# 临时跳过证书验证（不推荐）
import ssl
ssl._create_default_https_context = ssl._create_unverified_context
```

### 更好的解决方案：
```bash
# 更新证书
pip install --upgrade certifi

# 指定证书路径
export SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
```

### 密码安全：
1. 使用环境变量，不要硬编码
2. 定期更换密码
3. 使用密钥管理服务
4. 启用两步验证

## 8. 测试工具

### 创建测试脚本：
```python
#!/usr/bin/env python3
import sys
import smtplib
import imaplib

def test_all():
    print("开始全面测试...")
    
    # 测试1: SMTP连接
    try:
        server = smtplib.SMTP('smtp.gmail.com', 587, timeout=10)
        server.starttls()
        print("✅ SMTP连接测试通过")
        server.quit()
    except Exception as e:
        print(f"❌ SMTP连接失败: {e}")
    
    # 测试2: IMAP连接
    try:
        mail = imaplib.IMAP4_SSL('imap.gmail.com', 993, timeout=10)
        print("✅ IMAP连接测试通过")
        mail.logout()
    except Exception as e:
        print(f"❌ IMAP连接失败: {e}")
    
    print("测试完成")

if __name__ == '__main__':
    test_all()
```

### 使用在线测试工具：
1. **MX Toolbox**：https://mxtoolbox.com
2. **Mail-Tester**：https://www.mail-tester.com
3. **GlockApps**：https://glockapps.com

## 9. 联系支持

### 各服务商支持：
- **Gmail**：https://support.google.com/mail
- **QQ邮箱**：https://service.mail.qq.com
- **163邮箱**：https://help.mail.163.com
- **Outlook**：https://support.microsoft.com/mail

### 提供的信息：
1. 错误信息全文
2. 时间戳
3. 发送的邮件内容（脱敏）
4. 网络环境信息
5. 已尝试的解决方案

## 10. 备用方案

### 临时解决方案：
1. **使用Web API**：如SendGrid、Mailgun免费额度
2. **使用命令行工具**：如msmtp、mutt
3. **使用系统邮件命令**：
   ```bash
   echo "邮件内容" | mail -s "主题" recipient@example.com
   ```

### 长期解决方案：
1. **搭建自己的邮件服务器**
2. **使用企业邮箱服务**
3. **使用邮件发送平台API**

### 降级方案：
如果所有方案都失败：
1. 使用邮件客户端手动发送
2. 使用网页版邮箱
3. 联系收件人使用其他方式