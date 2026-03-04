#!/usr/bin/env python3
"""
邮箱整理脚本
功能：自动整理邮箱，包括标记已读、分类整理、清理建议等
"""

import imaplib
import email
from email.header import decode_header
import os
import sys
from datetime import datetime, timedelta
import re

def decode_mime_words(s):
    """解码MIME编码的邮件头"""
    if s is None:
        return ""
    decoded = decode_header(s)
    return ''.join([str(t[0], t[1] or 'utf-8') if isinstance(t[0], bytes) else t[0] for t in decoded])

def connect_to_email():
    """连接到邮箱"""
    try:
        # 从环境变量获取配置
        imap_server = os.getenv('MAIL_IMAP_SERVER', 'imap.exmail.qq.com')
        username = os.getenv('MAIL_USERNAME', 'chengyihua@acbnlink.com')
        password = os.getenv('MAIL_PASSWORD', '')
        imap_port = int(os.getenv('MAIL_IMAP_PORT', '993'))
        
        if not password:
            print("❌ 错误：未找到邮件密码")
            print("请在环境变量中设置 MAIL_PASSWORD")
            return None
        
        print(f"🔗 正在连接到 {imap_server}:{imap_port}...")
        
        # 连接到IMAP服务器
        mail = imaplib.IMAP4_SSL(imap_server, imap_port)
        
        # 登录
        mail.login(username, password)
        print("✅ 登录成功！")
        
        return mail
        
    except Exception as e:
        print(f"❌ 连接失败: {str(e)}")
        return None

def analyze_email_status(mail):
    """分析邮箱状态"""
    print("\n📊 正在分析邮箱状态...")
    
    # 选择收件箱
    mail.select('INBOX')
    
    # 获取总邮件数
    status, messages = mail.search(None, 'ALL')
    if status != 'OK':
        print("❌ 搜索所有邮件失败")
        return None
    
    all_msg_nums = messages[0].split()
    total_emails = len(all_msg_nums)
    print(f"📧 总邮件数: {total_emails}")
    
    # 获取未读邮件数
    status, unread_messages = mail.search(None, 'UNSEEN')
    if status != 'OK':
        print("❌ 搜索未读邮件失败")
        return None
    
    unread_msg_nums = unread_messages[0].split()
    unread_count = len(unread_msg_nums)
    print(f"📨 未读邮件: {unread_count}")
    
    # 获取最近7天邮件
    seven_days_ago = (datetime.now() - timedelta(days=7)).strftime('%d-%b-%Y')
    status, recent_messages = mail.search(None, f'SINCE {seven_days_ago}')
    if status != 'OK':
        print("❌ 搜索最近7天邮件失败")
        return None
    
    recent_msg_nums = recent_messages[0].split()
    recent_count = len(recent_msg_nums)
    print(f"📅 最近7天邮件: {recent_count}")
    
    return {
        'total': total_emails,
        'unread': unread_count,
        'recent_7days': recent_count,
        'all_msg_nums': all_msg_nums,
        'unread_msg_nums': unread_msg_nums,
        'recent_msg_nums': recent_msg_nums
    }

def categorize_email(subject, sender):
    """根据主题和发件人分类邮件"""
    subject_lower = subject.lower()
    sender_lower = sender.lower()
    
    # 工作邮件
    work_keywords = ['工作', '项目', '会议', '报告', '任务', 'deadline', 'meeting', 'project']
    if any(keyword in subject_lower for keyword in work_keywords):
        return '工作'
    
    # 通知邮件
    notification_keywords = ['通知', '提醒', 'alert', 'notification', 'cronjob', '定时任务', '系统']
    if any(keyword in subject_lower for keyword in notification_keywords):
        return '通知'
    
    # 订阅邮件
    subscription_senders = ['newsletter', '订阅', 'news', 'update', 'blog', 'medium']
    if any(keyword in sender_lower for keyword in subscription_senders):
        return '订阅'
    
    # 个人邮件
    personal_keywords = ['朋友', '家人', 'personal', 'hello', 'hi', '问候']
    if any(keyword in subject_lower for keyword in personal_keywords):
        return '个人'
    
    return '其他'

def mark_as_read(mail, msg_nums):
    """标记邮件为已读"""
    if not msg_nums:
        print("📭 没有需要标记为已读的邮件")
        return 0
    
    print(f"\n📝 正在标记 {len(msg_nums)} 封邮件为已读...")
    marked_count = 0
    
    for num in msg_nums:
        try:
            # 标记为已读（移除 \Seen 标志）
            mail.store(num, '-FLAGS', '\\Seen')
            marked_count += 1
        except Exception as e:
            print(f"  标记邮件 {num} 失败: {str(e)}")
    
    print(f"✅ 已标记 {marked_count} 封邮件为已读")
    return marked_count

def get_email_details(mail, msg_nums, limit=10):
    """获取邮件详细信息"""
    emails = []
    
    for i, num in enumerate(msg_nums[:limit], 1):
        try:
            # 获取邮件
            status, msg_data = mail.fetch(num, '(RFC822)')
            if status != 'OK':
                continue
            
            # 解析邮件
            msg = email.message_from_bytes(msg_data[0][1])
            
            # 获取邮件信息
            from_ = decode_mime_words(msg.get('From'))
            subject = decode_mime_words(msg.get('Subject'))
            date = msg.get('Date', '未知日期')
            
            # 分类
            category = categorize_email(subject, from_)
            
            emails.append({
                'id': num.decode(),
                'from': from_,
                'subject': subject,
                'date': date,
                'category': category,
                'is_unread': num in mail.search(None, 'UNSEEN')[1][0].split()
            })
            
        except Exception as e:
            print(f"  处理邮件 {num} 时出错: {str(e)}")
            continue
    
    return emails

def print_email_summary(emails):
    """打印邮件摘要"""
    print("\n📋 邮件分类摘要:")
    print("=" * 80)
    
    categories = {}
    for email_info in emails:
        category = email_info['category']
        categories[category] = categories.get(category, 0) + 1
    
    for category, count in categories.items():
        print(f"  {category}: {count} 封")
    
    print("\n📬 最近邮件详情:")
    print("=" * 80)
    
    for i, email_info in enumerate(emails, 1):
        status = "[未读]" if email_info['is_unread'] else "[已读]"
        print(f"{i}. {status} [{email_info['category']}]")
        print(f"   发件人: {email_info['from']}")
        print(f"   主题: {email_info['subject']}")
        print(f"   日期: {email_info['date']}")
        print("-" * 80)

def provide_recommendations(stats, emails):
    """提供整理建议"""
    print("\n💡 邮箱整理建议:")
    print("=" * 80)
    
    recommendations = []
    
    # 未读邮件建议
    if stats['unread'] > 0:
        recommendations.append(f"1. 立即处理 {stats['unread']} 封未读邮件")
    
    # 分类建议
    categories = {}
    for email_info in emails:
        category = email_info['category']
        categories[category] = categories.get(category, 0) + 1
    
    if len(categories) > 3:
        recommendations.append("2. 创建文件夹分类：工作、通知、订阅、个人、归档")
    
    # 清理建议
    if stats['total'] > 50:
        recommendations.append("3. 清理超过6个月的旧邮件")
    
    # 自动化建议
    if stats['recent_7days'] > 10:
        recommendations.append("4. 设置过滤器自动分类新邮件")
    
    # 打印建议
    for i, rec in enumerate(recommendations, 1):
        print(f"  {rec}")
    
    return recommendations

def main():
    """主函数"""
    print("📧 邮箱整理助手")
    print("=" * 80)
    
    # 连接到邮箱
    mail = connect_to_email()
    if not mail:
        return
    
    try:
        # 分析邮箱状态
        stats = analyze_email_status(mail)
        if not stats:
            return
        
        # 获取最近邮件详情
        recent_emails = get_email_details(mail, stats['recent_msg_nums'][:10], limit=10)
        
        # 打印摘要
        print_email_summary(recent_emails)
        
        # 提供建议
        recommendations = provide_recommendations(stats, recent_emails)
        
        print("\n🎯 下一步操作:")
        print("=" * 80)
        print("1. 标记测试邮件为已读")
        print("2. 处理重要通知邮件")
        print("3. 创建分类文件夹")
        print("4. 清理旧邮件")
        print("\n输入选项编号执行相应操作，或按回车键退出")
        
        # 等待用户输入
        choice = input("\n请选择操作 (1-4): ").strip()
        
        if choice == '1':
            # 标记测试邮件为已读
            test_emails = []
            for email_info in recent_emails:
                if '测试' in email_info['subject']:
                    test_emails.append(email_info['id'].encode())
            
            if test_emails:
                mark_as_read(mail, test_emails)
            else:
                print("未找到测试邮件")
        
        elif choice == '2':
            # 处理重要通知
            important_emails = []
            for email_info in recent_emails:
                if 'cronjob' in email_info['subject'].lower() or '失败' in email_info['subject']:
                    important_emails.append(email_info['id'].encode())
            
            if important_emails:
                print(f"\n⚠️ 重要通知邮件:")
                for email_info in recent_emails:
                    if 'cronjob' in email_info['subject'].lower():
                        print(f"  - {email_info['subject']} ({email_info['date']})")
                print("\n请检查定时任务配置")
            else:
                print("未找到重要通知邮件")
        
        elif choice == '3':
            print("\n📁 创建分类文件夹:")
            print("  1. 工作邮件")
            print("  2. 通知提醒")
            print("  3. 订阅资讯")
            print("  4. 个人邮件")
            print("  5. 归档邮件")
            print("\n注：需要在邮件客户端中手动创建文件夹")
        
        elif choice == '4':
            print("\n🗑️ 清理建议:")
            print("  1. 删除超过1年的旧邮件")
            print("  2. 清理大附件邮件")
            print("  3. 删除垃圾邮件")
            print("\n建议定期清理以节省空间")
        
        print("\n✅ 邮箱整理分析完成！")
        
    finally:
        # 关闭连接
        mail.logout()
        print("🔒 连接已关闭")

if __name__ == '__main__':
    main()