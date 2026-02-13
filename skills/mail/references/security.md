# 邮件安全最佳实践

## 1. 密码安全管理

### 不要硬编码密码
**错误做法**：
```python
password = "my_secret_password"  # ❌ 绝对不要这样做
```

**正确做法**：
```python
import os
password = os.getenv('MAIL_PASSWORD')  # ✅ 使用环境变量
```

### 使用环境变量
```bash
# .env文件（添加到.gitignore）
MAIL_PASSWORD=your_app_password_here

# 加载环境变量
from dotenv import load_dotenv
load_dotenv()
```

### 密码轮换策略
1. **应用密码**：每3-6个月更换一次
2. **账户密码**：每6-12个月更换一次
3. **紧急情况**：怀疑泄露时立即更换

## 2. 账户安全设置

### 启用两步验证
**所有邮件服务商都应启用**：

| 服务商 | 两步验证设置 |
|--------|-------------|
| Gmail | https://myaccount.google.com/security |
| QQ邮箱 | QQ安全中心 |
| 163邮箱 | 安全设置 → 手机验证 |
| Outlook | https://account.microsoft.com/security |

### 使用应用专用密码
**不要使用主账户密码**：

1. **Gmail**：应用专用密码（16位）
2. **QQ邮箱**：授权码（16位）
3. **163邮箱**：客户端授权密码
4. **Outlook**：应用密码

### 监控账户活动
定期检查：
1. 登录历史记录
2. 最近活动设备
3. 第三方应用权限
4. 异常登录提醒

## 3. 连接安全

### 强制使用加密连接
```python
# 总是使用SSL/TLS
MAIL_SMTP_USE_TLS=true
MAIL_SMTP_USE_SSL=true
MAIL_IMAP_USE_SSL=true
```

### 验证服务器证书
```python
import ssl

# 创建安全上下文
context = ssl.create_default_context()
context.check_hostname = True
context.verify_mode = ssl.CERT_REQUIRED
```

### 使用安全端口
| 协议 | 安全端口 | 不安全端口 |
|------|----------|------------|
| SMTP | 465 (SSL), 587 (TLS) | 25 |
| IMAP | 993 (SSL) | 143 |

## 4. 数据安全

### 邮件内容加密
```python
# 敏感内容加密示例
from cryptography.fernet import Fernet

# 生成密钥
key = Fernet.generate_key()
cipher = Fernet(key)

# 加密
encrypted_body = cipher.encrypt(b"Sensitive content")

# 解密
decrypted_body = cipher.decrypt(encrypted_body)
```

### 附件安全
1. **扫描附件**：发送前扫描病毒
2. **文件类型限制**：限制可执行文件
3. **大小限制**：防止DoS攻击
4. **加密存储**：敏感附件加密

### 临时文件清理
```python
import tempfile
import os

# 安全创建临时文件
with tempfile.NamedTemporaryFile(delete=True) as tmp:
    tmp.write(b"temporary data")
    # 文件自动删除
    
# 手动清理
import shutil
shutil.rmtree(temp_dir, ignore_errors=True)
```

## 5. 访问控制

### 最小权限原则
只授予必要的权限：
1. **发送权限**：仅需要SMTP
2. **接收权限**：仅需要IMAP
3. **文件夹权限**：限制访问范围

### API密钥管理
```python
# 使用密钥管理服务
import boto3  # AWS KMS示例

client = boto3.client('kms')
response = client.decrypt(CiphertextBlob=encrypted_password)
password = response['Plaintext']
```

### 访问日志记录
```python
import logging
from datetime import datetime

logging.basicConfig(
    filename='mail_access.log',
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def log_mail_access(action, recipient, success):
    logging.info(f"{action} - {recipient} - {'成功' if success else '失败'}")
```

## 6. 防范常见攻击

### 防范暴力破解
```python
import time
from collections import defaultdict

login_attempts = defaultdict(list)
MAX_ATTEMPTS = 5
LOCK_TIME = 300  # 5分钟

def check_login_attempts(username):
    now = time.time()
    attempts = login_attempts[username]
    
    # 清理过期记录
    attempts = [t for t in attempts if now - t < LOCK_TIME]
    login_attempts[username] = attempts
    
    if len(attempts) >= MAX_ATTEMPTS:
        return False  # 账户锁定
    
    attempts.append(now)
    return True
```

### 防范钓鱼攻击
1. **发件人验证**：检查SPF、DKIM、DMARC
2. **链接检查**：不自动点击邮件中的链接
3. **附件检查**：扫描可疑附件

### 防范中间人攻击
1. **证书固定**：验证服务器证书指纹
2. **HSTS**：强制使用HTTPS
3. **定期更新**：保持库和证书更新

## 7. 合规性要求

### GDPR合规
1. **数据最小化**：只收集必要数据
2. **用户同意**：明确获取发送许可
3. **删除权**：提供退订和删除功能
4. **数据可移植性**：支持数据导出

### 中国网络安全法
1. **数据本地化**：敏感数据境内存储
2. **日志留存**：保留6个月以上
3. **实名认证**：用户身份验证
4. **内容审核**：过滤违法信息

### 行业标准
1. **ISO 27001**：信息安全管理
2. **SOC 2**：服务组织控制
3. **HIPAA**：医疗信息保护（如适用）

## 8. 安全审计

### 定期安全检查清单
每月检查：
- [ ] 密码是否过期
- [ ] 两步验证是否启用
- [ ] 异常登录记录
- [ ] 第三方应用权限
- [ ] 安全日志分析

### 渗透测试
```bash
# 使用工具测试安全性
nmap -sV --script ssl-enum-ciphers smtp.gmail.com
sslscan smtp.gmail.com:587
testssl.sh smtp.gmail.com:465
```

### 安全扫描工具
1. **OpenVAS**：漏洞扫描
2. **Nessus**：专业安全扫描
3. **Qualys**：云安全扫描
4. **Burp Suite**：Web应用测试

## 9. 应急响应

### 安全事件响应流程
1. **识别**：确认安全事件
2. **遏制**：阻止进一步损害
3. **消除**：清除威胁
4. **恢复**：恢复正常运营
5. **总结**：分析改进

### 泄露响应清单
如果密码泄露：
1. 立即更改所有相关密码
2. 撤销所有会话令牌
3. 检查账户活动
4. 通知相关方
5. 加强监控

### 备份与恢复
```bash
# 定期备份配置
cp .env .env.backup.$(date +%Y%m%d)

# 加密备份
gpg --encrypt --recipient your@email.com .env.backup
```

## 10. 安全工具推荐

### 密码管理
1. **1Password**：团队密码管理
2. **LastPass**：跨平台密码管理
3. **Bitwarden**：开源密码管理
4. **KeePass**：本地密码管理

### 密钥管理
1. **AWS KMS**：云密钥管理
2. **Hashicorp Vault**：开源密钥管理
3. **Azure Key Vault**：微软密钥管理
4. **Google Cloud KMS**：谷歌密钥管理

### 监控告警
1. **Sentry**：错误监控
2. **Datadog**：性能监控
3. **Prometheus**：指标监控
4. **Grafana**：数据可视化

## 11. 培训与意识

### 安全培训内容
1. **密码安全**：强密码、不重复使用
2. **钓鱼识别**：识别可疑邮件
3. **数据保护**：敏感数据处理
4. **应急响应**：安全事件处理

### 安全意识测试
定期进行：
1. 模拟钓鱼测试
2. 密码强度测试
3. 安全知识测验
4. 应急演练

### 安全文化建设
1. **领导支持**：管理层重视安全
2. **全员参与**：每个人都是安全员
3. **持续改进**：定期评估改进
4. **透明沟通**：安全事件透明处理