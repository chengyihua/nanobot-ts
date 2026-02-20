#!/usr/bin/env python3
import imaplib
import email
from email.header import decode_header
from email.utils import parsedate_to_datetime
import os
from datetime import datetime, timedelta

def decode_mime_words(s):
    if s is None:
        return ''
    decoded = decode_header(s)
    return ''.join([str(t[0], t[1] or 'utf-8') if isinstance(t[0], bytes) else t[0] for t in decoded])

# 配置
imap_server = 'imap.exmail.qq.com'
username = 'chengyihua@acbnlink.com'
password = 'SB9KN6kj2MaiWLnF'
imap_port = 993

try:
    # 连接到IMAP服务器
    print(f"正在连接到 {imap_server}...")
    mail = imaplib.IMAP4_SSL(imap_server, imap_port)
    mail.login(username, password)
    print("登录成功！")
    
    # 选择收件箱
    mail.select('INBOX')
    
    # 搜索最近24小时的邮件
    yesterday = (datetime.now() - timedelta(hours=24)).strftime('%d-%b-%Y')
    print(f"搜索从 {yesterday} 以来的邮件...")
    status, recent_messages = mail.search(None, f'SINCE {yesterday}')
    
    if status == 'OK' and recent_messages[0]:
        msg_nums = recent_messages[0].split()
        print(f'📧 最近24小时收到 {len(msg_nums)} 封新邮件')
        print('=' * 80)
        
        if len(msg_nums) == 0:
            print('没有新邮件')
        else:
            for i, num in enumerate(reversed(msg_nums), 1):
                status, msg_data = mail.fetch(num, '(RFC822)')
                if status == 'OK':
                    msg = email.message_from_bytes(msg_data[0][1])
                    
                    # 获取发件人
                    from_ = decode_mime_words(msg.get('From'))
                    # 获取主题
                    subject = decode_mime_words(msg.get('Subject'))
                    # 获取日期
                    date_str = msg.get('Date')
                    
                    # 检查是否已读
                    status, flags_data = mail.fetch(num, '(FLAGS)')
                    is_unread = '\\Seen' not in str(flags_data[0])
                    
                    # 提取发件人邮箱
                    sender_email = ''
                    if '<' in from_ and '>' in from_:
                        email_start = from_.find('<') + 1
                        email_end = from_.find('>')
                        sender_email = from_[email_start:email_end]
                    else:
                        sender_email = from_
                    
                    # 获取发件人名称
                    sender_name = from_.split('<')[0].strip().strip('\"') if '<' in from_ else from_
                    
                    # 截断过长的主题
                    if len(subject) > 50:
                        subject_display = subject[:47] + '...'
                    else:
                        subject_display = subject
                    
                    status_icon = '🔴' if is_unread else '🔵'
                    print(f'{status_icon} {i}. {sender_name}')
                    print(f'   邮箱: {sender_email}')
                    print(f'   主题: {subject_display}')
                    print(f'   时间: {date_str}')
                    
                    # 检查是否是重要邮件（包含关键词）
                    important_keywords = ['重要', '紧急', 'urgent', 'important', '通知', '提醒', '会议', 'meeting']
                    is_important = any(keyword.lower() in subject.lower() for keyword in important_keywords)
                    if is_important:
                        print(f'   ⚠️  重要邮件标记')
                    
                    print()
    
    # 检查未读邮件总数
    status, unread_messages = mail.search(None, 'UNSEEN')
    if status == 'OK' and unread_messages[0]:
        unread_count = len(unread_messages[0].split())
        print(f'📬 总未读邮件: {unread_count} 封')
    else:
        print('📬 总未读邮件: 0 封')
    
    mail.logout()
    print("连接已关闭")
    
except Exception as e:
    print(f'错误: {str(e)}')