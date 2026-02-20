#!/usr/bin/env python3
import imaplib
import email
from email.header import decode_header
from email.utils import parsedate_to_datetime
import os
from datetime import datetime, timedelta

def decode_mime_words(s):
    """解码MIME编码的邮件头"""
    if s is None:
        return ""
    decoded = decode_header(s)
    return ''.join([str(t[0], t[1] or 'utf-8') if isinstance(t[0], bytes) else t[0] for t in decoded])

def get_email_summary():
    """获取邮件摘要信息"""
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
        
        # 获取统计信息
        print("\n" + "=" * 80)
        print("邮箱统计信息")
        print("=" * 80)
        
        # 搜索未读邮件
        status, unread_messages = mail.search(None, 'UNSEEN')
        unread_count = len(unread_messages[0].split()) if status == 'OK' else 0
        
        # 搜索所有邮件
        status, all_messages = mail.search(None, 'ALL')
        total_count = len(all_messages[0].split()) if status == 'OK' else 0
        
        # 搜索今天收到的邮件
        today = datetime.now().strftime('%d-%b-%Y')
        status, today_messages = mail.search(None, f'SINCE {today}')
        today_count = len(today_messages[0].split()) if status == 'OK' else 0
        
        # 搜索最近7天的邮件
        week_ago = (datetime.now() - timedelta(days=7)).strftime('%d-%b-%Y')
        status, week_messages = mail.search(None, f'SINCE {week_ago}')
        week_count = len(week_messages[0].split()) if status == 'OK' else 0
        
        print(f"总邮件数: {total_count}")
        print(f"未读邮件: {unread_count}")
        print(f"今天收到的邮件: {today_count}")
        print(f"最近7天收到的邮件: {week_count}")
        
        # 获取发件人统计
        print("\n" + "=" * 80)
        print("发件人统计（最近50封邮件）")
        print("=" * 80)
        
        # 获取最近的50封邮件
        recent_count = min(50, total_count)
        if recent_count > 0:
            all_msg_nums = all_messages[0].split()
            recent_nums = all_msg_nums[-recent_count:]
            
            sender_stats = {}
            
            for num in recent_nums:
                try:
                    status, msg_data = mail.fetch(num, '(RFC822)')
                    if status == 'OK':
                        msg = email.message_from_bytes(msg_data[0][1])
                        from_ = decode_mime_words(msg.get('From'))
                        
                        # 提取发件人邮箱
                        if '<' in from_ and '>' in from_:
                            # 格式：名字 <邮箱>
                            email_start = from_.find('<') + 1
                            email_end = from_.find('>')
                            sender_email = from_[email_start:email_end]
                        else:
                            sender_email = from_
                        
                        # 提取域名
                        if '@' in sender_email:
                            domain = sender_email.split('@')[1]
                        else:
                            domain = sender_email
                        
                        if domain in sender_stats:
                            sender_stats[domain] += 1
                        else:
                            sender_stats[domain] = 1
                except:
                    continue
            
            # 按数量排序
            sorted_senders = sorted(sender_stats.items(), key=lambda x: x[1], reverse=True)
            
            for domain, count in sorted_senders[:10]:  # 显示前10个
                percentage = (count / recent_count) * 100
                print(f"{domain}: {count} 封 ({percentage:.1f}%)")
        
        # 获取最近的未读邮件详情
        if unread_count > 0:
            print("\n" + "=" * 80)
            print("未读邮件详情")
            print("=" * 80)
            
            unread_msg_nums = unread_messages[0].split()
            display_count = min(5, unread_count)
            
            for i, num in enumerate(unread_msg_nums[:display_count], 1):
                try:
                    status, msg_data = mail.fetch(num, '(RFC822)')
                    if status == 'OK':
                        msg = email.message_from_bytes(msg_data[0][1])
                        from_ = decode_mime_words(msg.get('From'))
                        subject = decode_mime_words(msg.get('Subject'))
                        date_str = msg.get('Date', '未知日期')
                        
                        # 简化发件人显示
                        if '<' in from_ and '>' in from_:
                            # 提取名字部分
                            name_end = from_.find('<')
                            sender_name = from_[:name_end].strip()
                            if not sender_name:
                                # 如果没有名字，使用邮箱
                                email_start = from_.find('<') + 1
                                email_end = from_.find('>')
                                sender_name = from_[email_start:email_end]
                        else:
                            sender_name = from_
                        
                        # 截断过长的主题
                        if len(subject) > 50:
                            subject_display = subject[:47] + "..."
                        else:
                            subject_display = subject
                        
                        print(f"{i}. {sender_name}")
                        print(f"   主题: {subject_display}")
                        print(f"   日期: {date_str}")
                        print()
                        
                except:
                    print(f"{i}. 无法读取邮件 #{num.decode()}")
                    print()
        
        # 关闭连接
        mail.logout()
        print("=" * 80)
        print("邮箱检查完成！")
        
    except imaplib.IMAP4.error as e:
        print(f"IMAP错误: {str(e)}")
        print("请检查用户名和密码是否正确")
    except Exception as e:
        print(f"错误: {str(e)}")

if __name__ == '__main__':
    get_email_summary()