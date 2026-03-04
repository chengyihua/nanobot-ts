#!/usr/bin/env python3
"""
分析工作空间中的Python脚本，识别可能已过时的脚本
"""

import os
import re
from datetime import datetime
from pathlib import Path

def analyze_python_scripts(workspace_path):
    """分析Python脚本"""
    print("🔍 分析工作空间中的Python脚本...")
    
    # 查找所有Python脚本
    python_files = []
    for root, dirs, files in os.walk(workspace_path):
        # 跳过一些目录
        if '__pycache__' in root or '.git' in root:
            continue
            
        for file in files:
            if file.endswith('.py'):
                full_path = os.path.join(root, file)
                python_files.append(full_path)
    
    print(f"找到 {len(python_files)} 个Python脚本")
    
    # 分析每个脚本
    script_categories = {
        'test_scripts': [],
        'demo_scripts': [],
        'utility_scripts': [],
        'system_scripts': [],
        'unknown_scripts': []
    }
    
    for script_path in python_files:
        script_name = os.path.basename(script_path)
        rel_path = os.path.relpath(script_path, workspace_path)
        
        # 获取文件信息
        stat_info = os.stat(script_path)
        file_size = stat_info.st_size
        mod_time = datetime.fromtimestamp(stat_info.st_mtime)
        
        # 读取文件内容进行分析
        try:
            with open(script_path, 'r', encoding='utf-8') as f:
                content = f.read(5000)  # 只读取前5000字符进行分析
        except:
            content = ""
        
        # 分类脚本
        category = 'unknown_scripts'
        
        # 基于文件名和内容分类
        if 'test' in script_name.lower():
            category = 'test_scripts'
        elif 'demo' in script_name.lower():
            category = 'demo_scripts'
        elif any(keyword in content.lower() for keyword in ['utility', 'helper', 'tool', 'clean', 'analyze']):
            category = 'utility_scripts'
        elif any(keyword in content.lower() for keyword in ['system', 'summary', 'classifier', 'priority']):
            category = 'system_scripts'
        
        script_info = {
            'name': script_name,
            'path': rel_path,
            'size': file_size,
            'modified': mod_time.strftime('%Y-%m-%d %H:%M'),
            'category': category,
            'description': extract_description(content)
        }
        
        script_categories[category].append(script_info)
    
    return script_categories

def extract_description(content):
    """从Python脚本中提取描述"""
    # 查找文档字符串
    docstring_patterns = [
        r'"""(.*?)"""',
        r"'''(.*?)'''",
        r'#\s*(.*?)\n'
    ]
    
    for pattern in docstring_patterns:
        match = re.search(pattern, content, re.DOTALL)
        if match:
            desc = match.group(1).strip()
            # 取前100个字符
            if len(desc) > 100:
                desc = desc[:100] + '...'
            return desc
    
    # 如果没有文档字符串，尝试从注释中提取
    lines = content.split('\n')
    for line in lines:
        if line.strip().startswith('#') and len(line.strip()) > 2:
            return line.strip('# ').strip()[:100]
    
    return "无描述"

def generate_report(script_categories, workspace_path):
    """生成分析报告"""
    report = f"""# Python脚本分析报告

## 分析时间
{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## 总体统计
"""
    
    total_scripts = sum(len(scripts) for scripts in script_categories.values())
    report += f"- 总脚本数量: {total_scripts}\n"
    
    for category, scripts in script_categories.items():
        report += f"- {category.replace('_', ' ').title()}: {len(scripts)} 个\n"
    
    report += "\n## 详细分析\n"
    
    # 按类别详细列出
    for category, scripts in script_categories.items():
        if scripts:
            report += f"\n### {category.replace('_', ' ').title()}\n"
            
            for script in scripts:
                report += f"#### {script['name']}\n"
                report += f"- 路径: {script['path']}\n"
                report += f"- 大小: {script['size']} 字节\n"
                report += f"- 修改时间: {script['modified']}\n"
                report += f"- 描述: {script['description']}\n"
    
    # 清理建议
    report += "\n## 清理建议\n"
    
    # 测试脚本建议
    if script_categories['test_scripts']:
        report += "### 测试脚本\n"
        report += "- 可以考虑归档或删除旧的测试脚本\n"
        report += "- 保留最近使用的测试脚本\n"
    
    # 演示脚本建议
    if script_categories['demo_scripts']:
        report += "### 演示脚本\n"
        report += "- 可以考虑归档到专门的demo目录\n"
        report += "- 如果不再需要可以删除\n"
    
    # 工具脚本建议
    if script_categories['utility_scripts']:
        report += "### 工具脚本\n"
        report += "- 评估使用频率\n"
        report += "- 不常用的工具可以归档\n"
    
    report += "\n## 操作建议\n"
    report += "1. **立即清理**: 删除明显过时或不再需要的脚本\n"
    report += "2. **归档处理**: 将可能还有用但不常用的脚本移动到archive目录\n"
    report += "3. **保留核心**: 保留系统核心脚本和常用工具脚本\n"
    report += "4. **定期检查**: 建议每季度检查一次脚本使用情况\n"
    
    return report

def main():
    workspace_path = "/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace"
    
    # 分析脚本
    script_categories = analyze_python_scripts(workspace_path)
    
    # 生成报告
    report = generate_report(script_categories, workspace_path)
    
    # 保存报告
    report_path = os.path.join(workspace_path, "python_scripts_analysis_report.md")
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"\n✅ 分析完成！报告已保存到: {report_path}")
    
    # 打印摘要
    print("\n📊 脚本分类摘要:")
    for category, scripts in script_categories.items():
        if scripts:
            print(f"  {category.replace('_', ' ').title()}: {len(scripts)} 个")
            for script in scripts[:3]:  # 只显示前3个
                print(f"    - {script['name']} ({script['path']})")
            if len(scripts) > 3:
                print(f"    - ... 还有 {len(scripts)-3} 个")

if __name__ == "__main__":
    main()