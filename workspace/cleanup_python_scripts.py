#!/usr/bin/env python3
"""
清理Python脚本 - 将过时或不常用的脚本归档
"""

import os
import shutil
from datetime import datetime

def create_archive_structure(workspace_path):
    """创建归档目录结构"""
    archive_root = os.path.join(workspace_path, "archive")
    python_archive = os.path.join(archive_root, "python_scripts")
    
    # 创建目录
    os.makedirs(python_archive, exist_ok=True)
    
    # 创建子目录
    subdirs = ['test_scripts', 'demo_scripts', 'old_utilities', 'misc']
    for subdir in subdirs:
        os.makedirs(os.path.join(python_archive, subdir), exist_ok=True)
    
    return python_archive

def categorize_and_archive(workspace_path, archive_path):
    """分类并归档脚本"""
    print("📦 开始归档Python脚本...")
    
    # 定义要归档的脚本
    scripts_to_archive = {
        'test_scripts': [
            'test_summary_system.py',
            'test_integration.py'
        ],
        'demo_scripts': [
            'simple_protocol_demo.py',
            'agentmesh_demo.py',
            'agentmesh_demo_simple.py'
        ],
        'old_utilities': [
            'get_youtube_info.py',
            'get_youtube_simple.py',
            'check_email.py',
            'check_unread_email.py'
        ],
        'misc': [
            'agentmesh_protocol_implementation.py'
        ]
    }
    
    # 保留的核心脚本（不要归档）
    core_scripts = [
        'clean_events.py',
        'analyze_python_scripts.py',
        'cleanup_python_scripts.py',
        'intelligent_summary.py',
        'enhanced_classifier.py',
        'priority_classifier.py',
        'email_summary.py',
        'schedule_summary.py',
        'organize_email.py'
    ]
    
    archive_log = []
    moved_count = 0
    
    # 归档脚本
    for category, scripts in scripts_to_archive.items():
        category_path = os.path.join(archive_path, category)
        
        for script_name in scripts:
            source_path = os.path.join(workspace_path, script_name)
            
            # 检查文件是否存在
            if os.path.exists(source_path):
                dest_path = os.path.join(category_path, script_name)
                
                # 移动文件
                shutil.move(source_path, dest_path)
                
                archive_log.append({
                    'script': script_name,
                    'category': category,
                    'source': source_path,
                    'destination': dest_path,
                    'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                })
                moved_count += 1
                print(f"  ✅ 已归档: {script_name} -> {category}/")
            else:
                print(f"  ⚠️  文件不存在: {script_name}")
    
    # 检查代码示例目录
    code_examples_dir = os.path.join(workspace_path, "代码示例")
    if os.path.exists(code_examples_dir):
        # 移动整个目录到归档
        dest_examples = os.path.join(archive_path, "code_examples")
        shutil.move(code_examples_dir, dest_examples)
        
        archive_log.append({
            'script': '代码示例目录',
            'category': 'misc',
            'source': code_examples_dir,
            'destination': dest_examples,
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        })
        moved_count += 1
        print(f"  ✅ 已归档: 代码示例目录 -> misc/")
    
    return archive_log, moved_count, core_scripts

def generate_cleanup_report(archive_log, moved_count, core_scripts, workspace_path):
    """生成清理报告"""
    report = f"""# Python脚本清理报告

## 清理时间
{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## 清理统计
- 归档脚本数量: {moved_count}
- 保留核心脚本: {len(core_scripts)} 个

## 归档详情
"""
    
    if archive_log:
        for item in archive_log:
            report += f"### {item['script']}\n"
            report += f"- 分类: {item['category']}\n"
            report += f"- 归档时间: {item['timestamp']}\n"
            report += f"- 原路径: {item['source']}\n"
            report += f"- 归档路径: {item['destination']}\n\n"
    else:
        report += "没有脚本被归档\n\n"
    
    report += "## 保留的核心脚本\n"
    for script in core_scripts:
        report += f"- {script}\n"
    
    report += "\n## 清理效果\n"
    report += "1. **工作空间更整洁**: 移除了过时和不常用的脚本\n"
    report += "2. **保留核心功能**: 所有重要系统脚本都保留在原位置\n"
    report += "3. **易于恢复**: 归档的脚本可以随时恢复使用\n"
    report += "4. **减少混乱**: 减少了工作空间中的文件数量\n"
    
    report += "\n## 归档目录结构\n"
    report += "```\n"
    report += "archive/\n"
    report += "├── python_scripts/\n"
    report += "│   ├── test_scripts/      # 测试脚本\n"
    report += "│   ├── demo_scripts/      # 演示脚本\n"
    report += "│   ├── old_utilities/     # 旧工具脚本\n"
    report += "│   ├── misc/             # 其他脚本\n"
    report += "│   └── code_examples/    # 代码示例目录\n"
    report += "└── uploads/              # 语音文件归档\n"
    report += "```\n"
    
    report += "\n## 注意事项\n"
    report += "1. 归档的脚本仍然可以访问，只是不在主工作空间\n"
    report += "2. 如果需要使用归档的脚本，可以临时复制回工作空间\n"
    report += "3. 建议定期检查归档目录，删除真正不再需要的文件\n"
    
    return report

def main():
    workspace_path = "/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace"
    
    print("🧹 Python脚本清理开始...")
    
    # 创建归档结构
    archive_path = create_archive_structure(workspace_path)
    print(f"📁 归档目录已创建: {archive_path}")
    
    # 分类并归档脚本
    archive_log, moved_count, core_scripts = categorize_and_archive(workspace_path, archive_path)
    
    # 生成报告
    report = generate_cleanup_report(archive_log, moved_count, core_scripts, workspace_path)
    
    # 保存报告
    report_path = os.path.join(workspace_path, "python_scripts_cleanup_report.md")
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"\n✅ 清理完成！")
    print(f"   归档脚本: {moved_count} 个")
    print(f"   保留脚本: {len(core_scripts)} 个")
    print(f"   报告文件: {report_path}")
    
    # 显示当前工作空间的Python脚本
    print(f"\n📋 当前工作空间的Python脚本:")
    remaining_scripts = []
    for root, dirs, files in os.walk(workspace_path):
        # 跳过archive目录
        if 'archive' in root:
            continue
            
        for file in files:
            if file.endswith('.py'):
                rel_path = os.path.relpath(os.path.join(root, file), workspace_path)
                remaining_scripts.append(rel_path)
    
    for script in sorted(remaining_scripts):
        print(f"   - {script}")

if __name__ == "__main__":
    main()