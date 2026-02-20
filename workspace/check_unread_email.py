#!/usr/bin/env python3
import imaplib
import email
from email.header import decode_header
from email.utils import parsedate_to_datetime
import os
import sys
import textwrap

def decode_mime_words(s):
    """解码MIME编码的邮件头"""
    if s is None:
        return ""
    decoded = decode_header(s)
    return ''.join([str(t[0], t[1] or 'utf-8') if isinstance(t[0], bytes) else t[0] for t in decoded])

def get_email_body(msg):
    """获取邮件正文"""
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition"))
            
            # 跳过附件
            if "attachment" in content_disposition:
                continue
            
            # 优先获取纯文本内容
            if content_type == "text/plain":
                try:
                    body = part.get_payload(decode=True).decode()
                    return body
                except:
                    pass
            
            # 如果没有纯文本，使用HTML
            if content_type == "text/html":
                try:
                    body = part.get_payload(decode=True).decode()
                    return body
                except:
                    pass
    else:
        # 不是多部分邮件
        try:
            body = msg.get_payload(decode=True).decode()
            return body
        except:
            pass
    
    return "无法解析邮件正文"

def check_unread_emails():
    """检查未读邮件"""
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
        
        if not unread_msg_nums:
            print("没有未读邮件")
            mail.logout()
            return
        
        print(f"\n找到 {len(unread_msg_nums)} 封未读邮件:")
        print("=" * 100)
        
        # 获取未读邮件的详细信息
        for i, num in enumerate(unread_msg_nums, 1):
            try:
                # 获取邮件
                status, msg_data = mail.fetch(num, '(RFC822)')
                if status != 'OK':
                    print(f"  获取邮件 {num} 失败")
                    continue
                
                # 解析邮件
                msg = email.message_from_bytes(msg_data[0][1])
                
                # 获取邮件信息
                from_ = decode_mime_words(msg.get('From'))
                subject = decode_mime_words(msg.get('Subject'))
                date_str = msg.get('Date', '未知日期')
                
                # 尝试解析日期
                try:
                    date_obj = parsedate_to_datetime(date_str)
                    date_formatted = date_obj.strftime('%Y-%m-%d %H:%M:%S')
                except:
                    date_formatted = date_str
                
                # 获取邮件正文
                body = get_email_body(msg)
                
                # 截断过长的正文
                if len(body) > 500:
                    body_preview = body[:500] + "..."
                else:
                    body_preview = body
                
                print(f"\n{i}. 未读邮件 #{num.decode()}")
                print(f"   发件人: {from_}")
                print(f"   主题: {subject}")
                print(f"   日期: {date_formatted}")
                
                # 显示邮件ID和大小
                print(f"   邮件ID: {num.decode()}")
                
                # 显示正文预览
                print(f"\n   正文预览:")
                print("   " + "-" * 80)
                wrapped_body = textwrap.fill(body_preview, width=90, initial_indent='   ', subsequent_indent='   ')
                print(wrapped_body)
                print("   " + "-" * 80)
                
                # 显示邮件头信息
                print(f"\n   邮件头信息:")
                for header in ['To', 'Cc', 'Bcc', 'Reply-To', 'Message-ID']:
                    value = msg.get(header)
                    if value:
                        decoded_value = decode_mime_words(value)
                        print(f"   {header}: {decoded_value}")
                
                print("\n" + "=" * 100)
                
            except Exception as e:
                print(f"\n处理邮件 {num} 时出错: {str(e)}")
                print("=" * 100)
                continue
        
        # 关闭连接
        mail.logout()
        print("\n未读邮件检查完成！")
        
    except imaplib.IMAP4.error as e:
        print(f"IMAP错误: {str(e)}")
        print("请检查用户名和密码是否正确")
    except Exception as e:
        print(f"错误: {str(e)}")

if __name__ == '__main__':
    check_unread_emails()