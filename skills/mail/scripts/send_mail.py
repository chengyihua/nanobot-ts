#!/usr/bin/env python3
"""
邮件发送脚本
支持发送纯文本、HTML邮件，支持附件、抄送、密送等功能
"""

import os
import sys
import smtplib
import argparse
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from email.mime.image import MIMEImage
from email.header import Header
from email.utils import formataddr
import mimetypes
from typing import List, Optional, Union
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

def get_mail_config():
    """从环境变量获取邮件配置"""
    config = {
        'smtp_server': os.getenv('MAIL_SMTP_SERVER', 'smtp.gmail.com'),
        'smtp_port': int(os.getenv('MAIL_SMTP_PORT', '587')),
        'username': os.getenv('MAIL_USERNAME', ''),
        'password': os.getenv('MAIL_PASSWORD', ''),
        'from_name': os.getenv('MAIL_FROM_NAME', ''),
        'use_ssl': os.getenv('MAIL_USE_SSL', 'false').lower() == 'true',
        'use_tls': os.getenv('MAIL_USE_TLS', 'true').lower() == 'true',
    }
    
    # 如果没有设置发件人名称，使用邮箱用户名
    if not config['from_name'] and config['username']:
        config['from_name'] = config['username'].split('@')[0]
    
    return config

def send_email(
    to: Union[str, List[str]],
    subject: str,
    body: str,
    cc: Optional[Union[str, List[str]]] = None,
    bcc: Optional[Union[str, List[str]]] = None,
    attachments: Optional[List[str]] = None,
    html: bool = False,
    from_email: Optional[str] = None,
    from_name: Optional[str] = None
) -> bool:
    """
    发送邮件
    
    参数：
    - to: 收件人邮箱（字符串或列表）
    - subject: 邮件主题
    - body: 邮件内容
    - cc: 抄送（可选）
    - bcc: 密送（可选）
    - attachments: 附件路径列表（可选）
    - html: 是否使用HTML格式（默认False）
    - from_email: 发件人邮箱（可选，默认使用环境变量配置）
    - from_name: 发件人名称（可选）
    
    返回：
    - 成功返回True，失败返回False
    """
    
    try:
        # 获取邮件配置
        config = get_mail_config()
        
        # 设置发件人
        if not from_email:
            from_email = config['username']
        if not from_name:
            from_name = config['from_name']
        
        # 创建邮件对象
        msg = MIMEMultipart()
        msg['From'] = formataddr((str(Header(from_name, 'utf-8')), from_email))
        
        # 处理收件人
        if isinstance(to, str):
            to = [to]
        msg['To'] = ', '.join(to)
        
        # 处理抄送
        if cc:
            if isinstance(cc, str):
                cc = [cc]
            msg['Cc'] = ', '.join(cc)
            to = to + cc  # 将抄送人添加到收件人列表
        
        # 处理密送
        if bcc:
            if isinstance(bcc, str):
                bcc = [bcc]
            msg['Bcc'] = ', '.join(bcc)
            to = to + bcc  # 将密送人添加到收件人列表
        
        # 设置邮件主题
        msg['Subject'] = Header(subject, 'utf-8')
        
        # 添加邮件正文
        if html:
            msg.attach(MIMEText(body, 'html', 'utf-8'))
        else:
            msg.attach(MIMEText(body, 'plain', 'utf-8'))
        
        # 添加附件
        if attachments:
            for attachment_path in attachments:
                if not os.path.exists(attachment_path):
                    print(f"警告：附件文件不存在: {attachment_path}")
                    continue
                
                with open(attachment_path, 'rb') as f:
                    file_data = f.read()
                    file_name = os.path.basename(attachment_path)
                    
                    # 根据文件类型创建不同的MIME对象
                    mime_type, _ = mimetypes.guess_type(attachment_path)
                    
                    if mime_type is None:
                        mime_type = 'application/octet-stream'
                    
                    main_type, sub_type = mime_type.split('/', 1)
                    
                    if main_type == 'text':
                        attachment = MIMEText(file_data.decode('utf-8'), _subtype=sub_type, _charset='utf-8')
                    elif main_type == 'image':
                        attachment = MIMEImage(file_data, _subtype=sub_type)
                    else:
                        attachment = MIMEApplication(file_data, _subtype=sub_type)
                    
                    attachment.add_header('Content-Disposition', 'attachment', filename=file_name)
                    msg.attach(attachment)
        
        # 连接SMTP服务器并发送邮件
        if config['smtp_port'] == 465:
            # SSL连接
            with smtplib.SMTP_SSL(config['smtp_server'], config['smtp_port']) as server:
                server.set_debuglevel(0)  # 设置为1可以查看调试信息
                server.login(config['username'], config['password'])
                server.sendmail(from_email, to, msg.as_string())
        else:
            # TLS连接
            with smtplib.SMTP(config['smtp_server'], config['smtp_port']) as server:
                server.set_debuglevel(0)  # 设置为1可以查看调试信息
                
                if config['use_tls']:
                    server.starttls()
                
                server.login(config['username'], config['password'])
                server.sendmail(from_email, to, msg.as_string())
        
        print(f"邮件发送成功！收件人: {', '.join(to)}")
        return True
        
    except Exception as e:
        print(f"邮件发送失败: {str(e)}")
        return False

def main():
    """命令行入口函数"""
    parser = argparse.ArgumentParser(description='发送邮件')
    parser.add_argument('--to', required=True, help='收件人邮箱（多个用逗号分隔）')
    parser.add_argument('--subject', required=True, help='邮件主题')
    parser.add_argument('--body', required=True, help='邮件内容')
    parser.add_argument('--cc', help='抄送邮箱（多个用逗号分隔）')
    parser.add_argument('--bcc', help='密送邮箱（多个用逗号分隔）')
    parser.add_argument('--attachments', help='附件文件路径（多个用逗号分隔）')
    parser.add_argument('--html', action='store_true', help='使用HTML格式')
    parser.add_argument('--from-email', help='发件人邮箱（默认使用环境变量）')
    parser.add_argument('--from-name', help='发件人名称（默认使用环境变量）')
    
    args = parser.parse_args()
    
    # 处理多个收件人
    to_list = [email.strip() for email in args.to.split(',')]
    
    # 处理抄送
    cc_list = None
    if args.cc:
        cc_list = [email.strip() for email in args.cc.split(',')]
    
    # 处理密送
    bcc_list = None
    if args.bcc:
        bcc_list = [email.strip() for email in args.bcc.split(',')]
    
    # 处理附件
    attachments_list = None
    if args.attachments:
        attachments_list = [path.strip() for path in args.attachments.split(',')]
    
    # 发送邮件
    success = send_email(
        to=to_list,
        subject=args.subject,
        body=args.body,
        cc=cc_list,
        bcc=bcc_list,
        attachments=attachments_list,
        html=args.html,
        from_email=args.from_email,
        from_name=args.from_name
    )
    
    if success:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == '__main__':
    main()