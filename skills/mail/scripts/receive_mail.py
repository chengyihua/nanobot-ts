#!/usr/bin/env python3
"""
邮件接收脚本
支持接收邮件、搜索邮件、下载附件等功能
"""

import os
import sys
import argparse
import email
import imaplib
import email.header
from email.utils import parsedate_to_datetime
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from dotenv import load_dotenv
import json

# 加载环境变量
load_dotenv()

def get_mail_config():
    """从环境变量获取邮件配置"""
    config = {
        'imap_server': os.getenv('MAIL_IMAP_SERVER', 'imap.gmail.com'),
        'imap_port': int(os.getenv('MAIL_IMAP_PORT', '993')),
        'username': os.getenv('MAIL_USERNAME', ''),
        'password': os.getenv('MAIL_PASSWORD', ''),
        'use_ssl': os.getenv('MAIL_USE_SSL', 'true').lower() == 'true',
    }
    return config

def decode_header(header):
    """解码邮件头"""
    if header is None:
        return ""
    
    decoded_parts = []
    for part, encoding in email.header.decode_header(header):
        if isinstance(part, bytes):
            if encoding:
                decoded_parts.append(part.decode(encoding))
            else:
                # 尝试常用编码
                for enc in ['utf-8', 'gbk', 'gb2312', 'big5']:
                    try:
                        decoded_parts.append(part.decode(enc))
                        break
                    except:
                        continue
                else:
                    decoded_parts.append(part.decode('utf-8', errors='ignore'))
        else:
            decoded_parts.append(part)
    
    return ' '.join(decoded_parts)

def parse_email_message(msg):
    """解析邮件消息"""
    email_data = {
        'id': None,
        'from': decode_header(msg.get('From')),
        'to': decode_header(msg.get('To')),
        'cc': decode_header(msg.get('Cc')),
        'subject': decode_header(msg.get('Subject')),
        'date': decode_header(msg.get('Date')),
        'body': '',
        'attachments': [],
        'is_read': False,
        'size': 0
    }
    
    # 尝试解析日期
    try:
        email_data['date_parsed'] = parsedate_to_datetime(msg.get('Date')).isoformat()
    except:
        email_data['date_parsed'] = None
    
    # 解析邮件正文和附件
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition"))
            
            # 跳过附件
            if "attachment" in content_disposition:
                filename = part.get_filename()
                if filename:
                    filename = decode_header(filename)
                    email_data['attachments'].append({
                        'filename': filename,
                        'content_type': content_type,
                        'size': len(part.get_payload(decode=True)) if part.get_payload(decode=True) else 0
                    })
                continue
            
            # 获取正文
            if content_type == "text/plain" and "attachment" not in content_disposition:
                try:
                    body = part.get_payload(decode=True).decode()
                    email_data['body'] += body + "\n"
                except:
                    pass
            elif content_type == "text/html" and "attachment" not in content_disposition:
                try:
                    body = part.get_payload(decode=True).decode()
                    email_data['body'] += body + "\n"
                except:
                    pass
    else:
        # 非多部分邮件
        content_type = msg.get_content_type()
        try:
            body = msg.get_payload(decode=True).decode()
            email_data['body'] = body
        except:
            email_data['body'] = msg.get_payload()
    
    # 清理正文
    email_data['body'] = email_data['body'].strip()
    
    return email_data

def fetch_emails(
    limit: int = 10,
    search_criteria: Optional[Dict[str, Any]] = None,
    mailbox: str = 'INBOX',
    download_attachments: bool = False,
    download_dir: Optional[str] = None
) -> List[Dict]:
    """
    获取邮件
    
    参数：
    - limit: 获取邮件数量限制
    - search_criteria: 搜索条件字典
    - mailbox: 邮箱文件夹（默认INBOX）
    - download_attachments: 是否下载附件
    - download_dir: 附件下载目录
    
    返回：
    - 邮件列表
    """
    
    emails = []
    
    try:
        # 获取邮件配置
        config = get_mail_config()
        
        if not config['username'] or not config['password']:
            print("错误：未配置邮件用户名或密码")
            return emails
        
        # 连接IMAP服务器
        if config['use_ssl']:
            mail = imaplib.IMAP4_SSL(config['imap_server'], config['imap_port'])
        else:
            mail = imaplib.IMAP4(config['imap_server'], config['imap_port'])
        
        # 登录
        mail.login(config['username'], config['password'])
        
        # 选择邮箱文件夹
        mail.select(mailbox)
        
        # 构建搜索条件
        search_query = 'ALL'
        if search_criteria:
            criteria_parts = []
            for key, value in search_criteria.items():
                if key.lower() == 'unread':
                    criteria_parts.append('UNSEEN')
                elif key.lower() == 'from':
                    criteria_parts.append(f'FROM "{value}"')
                elif key.lower() == 'subject':
                    criteria_parts.append(f'SUBJECT "{value}"')
                elif key.lower() == 'since':
                    criteria_parts.append(f'SINCE "{value}"')
                elif key.lower() == 'before':
                    criteria_parts.append(f'BEFORE "{value}"')
            
            if criteria_parts:
                search_query = ' '.join(criteria_parts)
        
        # 搜索邮件
        status, message_ids = mail.search(None, search_query)
        
        if status != 'OK':
            print(f"搜索邮件失败: {status}")
            mail.logout()
            return emails
        
        # 获取邮件ID列表
        message_id_list = message_ids[0].split()
        
        # 限制数量
        if limit > 0:
            message_id_list = message_id_list[-limit:]  # 获取最新的邮件
        
        # 反转列表，使最新的邮件在前
        message_id_list = list(reversed(message_id_list))
        
        # 下载附件目录
        if download_attachments and download_dir:
            os.makedirs(download_dir, exist_ok=True)
        
        # 获取每封邮件
        for i, msg_id in enumerate(message_id_list):
            try:
                # 获取邮件
                status, msg_data = mail.fetch(msg_id, '(RFC822)')
                
                if status != 'OK':
                    print(f"获取邮件 {msg_id} 失败: {status}")
                    continue
                
                # 解析邮件
                raw_email = msg_data[0][1]
                msg = email.message_from_bytes(raw_email)
                
                # 解析邮件内容
                email_data = parse_email_message(msg)
                email_data['id'] = msg_id.decode()
                
                # 标记为已读（可选）
                # mail.store(msg_id, '+FLAGS', '\\Seen')
                
                # 下载附件
                if download_attachments and download_dir and email_data['attachments']:
                    for attachment_info in email_data['attachments']:
                        for part in msg.walk():
                            if part.get_filename():
                                filename = decode_header(part.get_filename())
                                if filename == attachment_info['filename']:
                                    filepath = os.path.join(download_dir, filename)
                                    with open(filepath, 'wb') as f:
                                        f.write(part.get_payload(decode=True))
                                    attachment_info['filepath'] = filepath
                                    print(f"附件已下载: {filepath}")
                
                emails.append(email_data)
                
                print(f"已获取邮件 {i+1}/{len(message_id_list)}: {email_data['subject'][:50]}...")
                
            except Exception as e:
                print(f"处理邮件 {msg_id} 时出错: {str(e)}")
                continue
        
        # 关闭连接
        mail.close()
        mail.logout()
        
        print(f"成功获取 {len(emails)} 封邮件")
        
    except Exception as e:
        print(f"获取邮件失败: {str(e)}")
    
    return emails

def main():
    """命令行入口函数"""
    parser = argparse.ArgumentParser(description='接收邮件')
    parser.add_argument('--limit', type=int, default=10, help='获取邮件数量限制')
    parser.add_argument('--unread', action='store_true', help='只获取未读邮件')
    parser.add_argument('--from', dest='from_email', help='发件人筛选')
    parser.add_argument('--subject', help='主题关键词筛选')
    parser.add_argument('--since', help='从指定日期开始（格式: DD-MMM-YYYY）')
    parser.add_argument('--mailbox', default='INBOX', help='邮箱文件夹')
    parser.add_argument('--download-attachments', action='store_true', help='下载附件')
    parser.add_argument('--download-dir', default='./attachments', help='附件下载目录')
    parser.add_argument('--output', choices=['text', 'json'], default='text', help='输出格式')
    
    args = parser.parse_args()
    
    # 构建搜索条件
    search_criteria = {}
    if args.unread:
        search_criteria['unread'] = True
    if args.from_email:
        search_criteria['from'] = args.from_email
    if args.subject:
        search_criteria['subject'] = args.subject
    if args.since:
        search_criteria['since'] = args.since
    
    # 获取邮件
    emails = fetch_emails(
        limit=args.limit,
        search_criteria=search_criteria if search_criteria else None,
        mailbox=args.mailbox,
        download_attachments=args.download_attachments,
        download_dir=args.download_dir
    )
    
    # 输出结果
    if args.output == 'json':
        print(json.dumps(emails, ensure_ascii=False, indent=2))
    else:
        for i, email_data in enumerate(emails):
            print(f"\n{'='*60}")
            print(f"邮件 {i+1}: {email_data['id']}")
            print(f"发件人: {email_data['from']}")
            print(f"收件人: {email_data['to']}")
            print(f"主题: {email_data['subject']}")
            print(f"日期: {email_data['date']}")
            print(f"附件: {len(email_data['attachments'])} 个")
            print(f"正文预览: {email_data['body'][:200]}...")
            print(f"{'='*60}")

if __name__ == '__main__':
    main()