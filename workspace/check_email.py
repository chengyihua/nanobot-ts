#!/usr/bin/env python3
import imaplib
import email
from email.header import decode_header
import os
import sys

def decode_mime_words(s):
    """解码MIME编码的邮件头"""
    if s is None:
        return ""
    decoded = decode_header(s)
    return ''.join([str(t[0], t[1] or 'utf-8') if isinstance(t[0], bytes) else t[0] for t in decoded])

def check_qq_email():
    """检查QQ企业邮箱"""
    try:
        # 从环境变量获取配置
        imap_server = os.getenv('MAIL_IMAP_SERVER', 'imap.exmail.qq.com')
        username = os.getenv('MAIL_USERNAME', 'chengyihua@acbnlink.com')
        password = os.getenv('MAIL_PASSWORD', '')
        imap_port = int(os.getenv('MAIL_IMAP_PORT', '993'))
        
        if not password:
            print("错误：未找到邮件密码")
            return
        
        print(f"正在连接到 {imap_server}:{imap_port}...")
        
        # 连接到IMAP服务器
        mail = imaplib.IMAP4_SSL(imap_server, imap_port)
        
        # 登录
        mail.login(username, password)
        print("登录成功！")
        
        # 选择收件箱
        mail.select('INBOX')
        
        # 搜索未读邮件
        status, messages = mail.search(None, 'UNSEEN')
        if status != 'OK':
            print("搜索未读邮件失败")
            return
        
        unread_msg_nums = messages[0].split()
        print(f"\n未读邮件数量: {len(unread_msg_nums)}")
        
        # 搜索所有邮件（最近20封）
        status, all_messages = mail.search(None, 'ALL')
        if status != 'OK':
            print("搜索所有邮件失败")
            return
        
        all_msg_nums = all_messages[0].split()
        recent_count = min(20, len(all_msg_nums))
        
        print(f"\n最近 {recent_count} 封邮件:")
        print("=" * 80)
        
        # 获取最近的邮件
        for i, num in enumerate(all_msg_nums[-recent_count:], 1):
            try:
                # 获取邮件
                status, msg_data = mail.fetch(num, '(RFC822)')
                if status != 'OK':
                    print(f"  获取邮件 {num} 失败")
                    continue
                
                # 解析邮件
                msg = email.message_from_bytes(msg_data[0][1])
                
                # 获取发件人、主题和日期
                from_ = decode_mime_words(msg.get('From'))
                subject = decode_mime_words(msg.get('Subject'))
                date = msg.get('Date', '未知日期')
                
                # 检查是否已读
                flags = msg.get('X-GM-LABELS', '')
                is_unread = num in unread_msg_nums
                
                status_mark = "[未读]" if is_unread else "[已读]"
                
                print(f"{i}. {status_mark}")
                print(f"   发件人: {from_}")
                print(f"   主题: {subject}")
                print(f"   日期: {date}")
                print(f"   邮件ID: {num.decode()}")
                print("-" * 80)
                
            except Exception as e:
                print(f"  处理邮件 {num} 时出错: {str(e)}")
                continue
        
        # 关闭连接
        mail.logout()
        print("\n检查完成！")
        
    except imaplib.IMAP4.error as e:
        print(f"IMAP错误: {str(e)}")
        print("请检查用户名和密码是否正确")
    except Exception as e:
        print(f"错误: {str(e)}")

if __name__ == '__main__':
    check_qq_email()