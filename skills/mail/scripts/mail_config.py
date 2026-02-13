#!/usr/bin/env python3
"""
邮件配置管理脚本
用于测试邮件连接、验证配置等
"""

import os
import sys
import smtplib
import imaplib
import argparse
from dotenv import load_dotenv, set_key
from typing import Dict, Any

# 加载环境变量
load_dotenv()

def get_mail_config() -> Dict[str, Any]:
    """从环境变量获取完整的邮件配置"""
    config = {
        # SMTP配置（发送）
        'smtp_server': os.getenv('MAIL_SMTP_SERVER', ''),
        'smtp_port': int(os.getenv('MAIL_SMTP_PORT', '587')),
        'smtp_use_ssl': os.getenv('MAIL_SMTP_USE_SSL', 'false').lower() == 'true',
        'smtp_use_tls': os.getenv('MAIL_SMTP_USE_TLS', 'true').lower() == 'true',
        
        # IMAP配置（接收）
        'imap_server': os.getenv('MAIL_IMAP_SERVER', ''),
        'imap_port': int(os.getenv('MAIL_IMAP_PORT', '993')),
        'imap_use_ssl': os.getenv('MAIL_IMAP_USE_SSL', 'true').lower() == 'true',
        
        # 账户信息
        'username': os.getenv('MAIL_USERNAME', ''),
        'password': os.getenv('MAIL_PASSWORD', ''),
        'from_name': os.getenv('MAIL_FROM_NAME', ''),
        
        # 服务商特定配置
        'provider': os.getenv('MAIL_PROVIDER', ''),
    }
    
    # 如果没有设置发件人名称，使用邮箱用户名
    if not config['from_name'] and config['username']:
        config['from_name'] = config['username'].split('@')[0]
    
    # 如果没有明确设置服务商，根据邮箱地址猜测
    if not config['provider'] and config['username']:
        email_domain = config['username'].split('@')[-1].lower()
        if 'gmail.com' in email_domain:
            config['provider'] = 'gmail'
        elif 'qq.com' in email_domain:
            config['provider'] = 'qq'
        elif '163.com' in email_domain or '126.com' in email_domain:
            config['provider'] = '163'
        elif 'outlook.com' in email_domain or 'hotmail.com' in email_domain:
            config['provider'] = 'outlook'
    
    return config

def set_mail_config(config: Dict[str, Any], env_file: str = '.env'):
    """设置邮件配置到环境变量文件"""
    for key, value in config.items():
        if value is not None:
            set_key(env_file, f'MAIL_{key.upper()}', str(value))
    
    print(f"邮件配置已保存到 {env_file}")

def test_smtp_connection() -> bool:
    """测试SMTP连接（发送邮件）"""
    config = get_mail_config()
    
    if not config['smtp_server'] or not config['username'] or not config['password']:
        print("错误：SMTP配置不完整")
        return False
    
    try:
        print(f"测试SMTP连接: {config['smtp_server']}:{config['smtp_port']}")
        
        if config['smtp_use_ssl']:
            server = smtplib.SMTP_SSL(config['smtp_server'], config['smtp_port'])
        else:
            server = smtplib.SMTP(config['smtp_server'], config['smtp_port'])
        
        server.set_debuglevel(1)  # 显示调试信息
        
        if config['smtp_use_tls'] and not config['smtp_use_ssl']:
            server.starttls()
        
        server.login(config['username'], config['password'])
        server.quit()
        
        print("✅ SMTP连接测试成功！")
        return True
        
    except Exception as e:
        print(f"❌ SMTP连接测试失败: {str(e)}")
        return False

def test_imap_connection() -> bool:
    """测试IMAP连接（接收邮件）"""
    config = get_mail_config()
    
    if not config['imap_server'] or not config['username'] or not config['password']:
        print("错误：IMAP配置不完整")
        return False
    
    try:
        print(f"测试IMAP连接: {config['imap_server']}:{config['imap_port']}")
        
        if config['imap_use_ssl']:
            mail = imaplib.IMAP4_SSL(config['imap_server'], config['imap_port'])
        else:
            mail = imaplib.IMAP4(config['imap_server'], config['imap_port'])
        
        mail.login(config['username'], config['password'])
        
        # 列出邮箱文件夹
        status, folders = mail.list()
        if status == 'OK':
            print("可用的邮箱文件夹:")
            for folder in folders:
                print(f"  - {folder.decode()}")
        
        mail.logout()
        
        print("✅ IMAP连接测试成功！")
        return True
        
    except Exception as e:
        print(f"❌ IMAP连接测试失败: {str(e)}")
        return False

def test_mail_connection() -> bool:
    """测试完整的邮件连接"""
    print("开始测试邮件连接...")
    print("-" * 50)
    
    smtp_success = test_smtp_connection()
    print("-" * 50)
    imap_success = test_imap_connection()
    print("-" * 50)
    
    if smtp_success and imap_success:
        print("🎉 邮件连接测试全部通过！")
        return True
    else:
        print("⚠️  邮件连接测试部分失败")
        return False

def setup_mail_provider(provider: str, email: str, password: str):
    """根据邮件服务商自动配置"""
    
    provider_configs = {
        'gmail': {
            'smtp_server': 'smtp.gmail.com',
            'smtp_port': 587,
            'smtp_use_tls': True,
            'imap_server': 'imap.gmail.com',
            'imap_port': 993,
            'imap_use_ssl': True,
            'notes': 'Gmail需要使用"应用专用密码"，不是普通密码'
        },
        'qq': {
            'smtp_server': 'smtp.qq.com',
            'smtp_port': 587,
            'smtp_use_tls': True,
            'imap_server': 'imap.qq.com',
            'imap_port': 993,
            'imap_use_ssl': True,
            'notes': 'QQ邮箱需要使用"授权码"，不是QQ密码'
        },
        '163': {
            'smtp_server': 'smtp.163.com',
            'smtp_port': 465,
            'smtp_use_ssl': True,
            'imap_server': 'imap.163.com',
            'imap_port': 993,
            'imap_use_ssl': True,
            'notes': '163邮箱需要使用"客户端授权密码"'
        },
        'outlook': {
            'smtp_server': 'smtp.office365.com',
            'smtp_port': 587,
            'smtp_use_tls': True,
            'imap_server': 'outlook.office365.com',
            'imap_port': 993,
            'imap_use_ssl': True,
            'notes': 'Outlook/Hotmail使用Microsoft账户密码'
        }
    }
    
    if provider not in provider_configs:
        print(f"错误：不支持的服务商 {provider}")
        print(f"支持的服务商: {', '.join(provider_configs.keys())}")
        return False
    
    config = provider_configs[provider]
    config['username'] = email
    config['password'] = password
    config['provider'] = provider
    
    print(f"配置 {provider} 邮箱:")
    print(f"邮箱地址: {email}")
    print(f"SMTP服务器: {config['smtp_server']}:{config['smtp_port']}")
    print(f"IMAP服务器: {config['imap_server']}:{config['imap_port']}")
    print(f"备注: {config['notes']}")
    
    # 保存配置
    env_config = {}
    for key, value in config.items():
        if key not in ['notes']:
            env_key = f'MAIL_{key.upper()}'
            env_config[env_key] = str(value).lower() if isinstance(value, bool) else str(value)
    
    set_mail_config({k.replace('MAIL_', '').lower(): v for k, v in env_config.items()})
    
    print("\n配置已保存，正在测试连接...")
    return test_mail_connection()

def main():
    """命令行入口函数"""
    parser = argparse.ArgumentParser(description='邮件配置管理')
    subparsers = parser.add_subparsers(dest='command', help='子命令')
    
    # 测试连接命令
    test_parser = subparsers.add_parser('test', help='测试邮件连接')
    test_parser.add_argument('--smtp-only', action='store_true', help='只测试SMTP')
    test_parser.add_argument('--imap-only', action='store_true', help='只测试IMAP')
    
    # 配置命令
    setup_parser = subparsers.add_parser('setup', help='配置邮件服务商')
    setup_parser.add_argument('provider', choices=['gmail', 'qq', '163', 'outlook'], help='邮件服务商')
    setup_parser.add_argument('email', help='邮箱地址')
    setup_parser.add_argument('password', help='密码/授权码')
    
    # 显示配置命令
    show_parser = subparsers.add_parser('show', help='显示当前配置')
    
    args = parser.parse_args()
    
    if args.command == 'test':
        if args.smtp_only:
            test_smtp_connection()
        elif args.imap_only:
            test_imap_connection()
        else:
            test_mail_connection()
    
    elif args.command == 'setup':
        setup_mail_provider(args.provider, args.email, args.password)
    
    elif args.command == 'show':
        config = get_mail_config()
        print("当前邮件配置:")
        for key, value in config.items():
            print(f"  {key}: {value}")
    
    else:
        parser.print_help()

if __name__ == '__main__':
    main()