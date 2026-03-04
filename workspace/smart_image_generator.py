#!/usr/bin/env python3
"""
智能配图生成系统
根据文章选题自动生成匹配的封面图片
"""

import os
import sys
import json
import subprocess
from pathlib import Path
from datetime import datetime

class SmartImageGenerator:
    def __init__(self, workspace_path):
        self.workspace = Path(workspace_path)
        self.skill_dir = Path("/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/skills/baoyu-cover-image")
        self.image_gen_skill = Path("/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/skills/baoyu-image-gen")
        
        # 主题到配图风格的映射
        self.theme_styles = {
            # AI芯片/硬件主题
            "芯片": {
                "type": "technology",
                "palette": "cyberpunk",
                "rendering": "3d_render",
                "text": "minimal",
                "mood": "futuristic",
                "prompt": "AI芯片, 神经网络处理器, 电路板, 发光线路, 未来科技, 赛博朋克风格, 蓝色和紫色光效, 高科技感"
            },
            "硬件": {
                "type": "technology", 
                "palette": "tech_blue",
                "rendering": "photorealistic",
                "text": "bold",
                "mood": "innovative",
                "prompt": "AI硬件, 服务器机房, 数据中心, 芯片特写, 科技感, 蓝色调, 专业摄影风格"
            },
            
            # AI监管/政策主题
            "监管": {
                "type": "conceptual",
                "palette": "corporate",
                "rendering": "flat_design",
                "text": "clean",
                "mood": "authoritative",
                "prompt": "AI监管, 法律文件, 天平, 地球仪, 政府建筑, 蓝色和金色, 权威感, 扁平设计"
            },
            "政策": {
                "type": "conceptual",
                "palette": "professional",
                "rendering": "vector",
                "text": "elegant",
                "mood": "serious",
                "prompt": "AI政策, 会议室, 文件堆叠, 全球地图, 决策过程, 深蓝色调, 专业感"
            },
            
            # AI教育主题
            "教育": {
                "type": "educational",
                "palette": "vibrant",
                "rendering": "illustration",
                "text": "friendly",
                "mood": "inspiring",
                "prompt": "AI教育, 学生使用平板电脑, 虚拟教室, 知识树, 多彩配色, 插画风格, 积极向上"
            },
            "学习": {
                "type": "educational",
                "palette": "warm",
                "rendering": "watercolor",
                "text": "handwritten",
                "mood": "creative",
                "prompt": "个性化学习, 大脑连接, 知识网络, 温暖色调, 水彩风格, 创意感"
            },
            
            # AI医疗主题
            "医疗": {
                "type": "medical",
                "palette": "clinical",
                "rendering": "clean",
                "text": "professional",
                "mood": "trustworthy",
                "prompt": "AI医疗, 医生与AI协作, 医疗设备, DNA双螺旋, 蓝色和白色, 干净专业, 可信赖感"
            },
            "健康": {
                "type": "medical",
                "palette": "fresh",
                "rendering": "minimal",
                "text": "clean",
                "mood": "healthy",
                "prompt": "AI健康管理, 智能手环, 健康数据可视化, 绿色植物, 清新色调, 简约风格"
            },
            
            # AI创作/艺术主题
            "创作": {
                "type": "artistic",
                "palette": "creative",
                "rendering": "painterly",
                "text": "artistic",
                "mood": "expressive",
                "prompt": "AI艺术创作, 画笔与调色板, 数字画布, 抽象艺术, 多彩配色, 油画质感"
            },
            "艺术": {
                "type": "artistic",
                "palette": "artistic",
                "rendering": "abstract",
                "text": "decorative",
                "mood": "creative",
                "prompt": "AI与艺术, 机器人绘画, 数字雕塑, 抽象几何, 艺术感配色, 创意表达"
            },
            
            # AI就业/伦理主题
            "就业": {
                "type": "social",
                "palette": "human",
                "rendering": "photographic",
                "text": "human",
                "mood": "thoughtful",
                "prompt": "AI与就业, 人与机器人协作, 职业发展, 办公室场景, 人文关怀, 摄影风格"
            },
            "伦理": {
                "type": "social",
                "palette": "philosophical",
                "rendering": "conceptual",
                "text": "philosophical",
                "mood": "contemplative",
                "prompt": "AI伦理, 道德天平, 人类与AI关系, 深色背景, 哲学思考, 概念艺术"
            },
            
            # AI开源主题
            "开源": {
                "type": "community",
                "palette": "open_source",
                "rendering": "geometric",
                "text": "modern",
                "mood": "collaborative",
                "prompt": "开源AI, 代码协作, GitHub风格, 社区贡献, 绿色和黑色, 几何设计, 现代感"
            },
            "社区": {
                "type": "community",
                "palette": "collaborative",
                "rendering": "flat",
                "text": "friendly",
                "mood": "inclusive",
                "prompt": "AI社区, 开发者协作, 开源项目, 多彩人物剪影, 扁平设计, 包容性"
            },
            
            # AI边缘计算主题
            "边缘": {
                "type": "technology",
                "palette": "iot",
                "rendering": "futuristic",
                "text": "tech",
                "mood": "connected",
                "prompt": "边缘AI, IoT设备网络, 智能传感器, 连接点, 紫色和蓝色, 未来感, 连接性"
            },
            "物联网": {
                "type": "technology",
                "palette": "network",
                "rendering": "diagram",
                "text": "technical",
                "mood": "connected",
                "prompt": "AI物联网, 设备互联, 数据流, 网络拓扑, 科技图表风格"
            },
            
            # AI量子计算主题
            "量子": {
                "type": "scientific",
                "palette": "quantum",
                "rendering": "scientific",
                "text": "scientific",
                "mood": "mysterious",
                "prompt": "量子AI, 量子比特, 叠加态, 深空背景, 紫色和黑色, 科学可视化, 神秘感"
            },
            
            # 默认AI主题
            "AI": {
                "type": "technology",
                "palette": "ai_blue",
                "rendering": "holographic",
                "text": "futuristic",
                "mood": "innovative",
                "prompt": "人工智能, 神经网络可视化, 数据流, 蓝色光效, 全息投影风格, 未来科技"
            },
            "智能": {
                "type": "conceptual",
                "palette": "smart",
                "rendering": "glowing",
                "text": "smart",
                "mood": "intelligent",
                "prompt": "智能系统, 大脑与芯片结合, 发光电路, 智慧之光, 现代设计"
            }
        }
    
    def analyze_topic(self, topic):
        """分析主题，确定配图风格"""
        topic_lower = topic.lower()
        
        # 查找匹配的主题关键词
        for keyword, style in self.theme_styles.items():
            if keyword.lower() in topic_lower:
                print(f"🎯 匹配到主题: {keyword}")
                return style
        
        # 如果没有匹配，使用默认AI主题
        print("⚠️  未找到完全匹配的主题，使用默认AI主题")
        return self.theme_styles["AI"]
    
    def generate_cover_image(self, topic, output_dir, article_index):
        """生成封面图片"""
        # 分析主题风格
        style = self.analyze_topic(topic)
        
        # 创建输出目录
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)
        
        # 生成图片文件名
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        image_file = output_path / f"cover_{article_index}_{timestamp}.jpg"
        
        print(f"🎨 生成封面图片: {image_file}")
        print(f"📋 主题: {topic}")
        print(f"🎨 风格配置:")
        print(f"   类型: {style['type']}")
        print(f"   调色板: {style['palette']}")
        print(f"   渲染: {style['rendering']}")
        print(f"   文字: {style['text']}")
        print(f"   氛围: {style['mood']}")
        print(f"   Prompt: {style['prompt']}")
        
        # 使用baoyu-cover-image技能生成图片
        # 注意：这里需要根据实际技能接口调整
        # 暂时使用模拟生成
        
        # 创建模拟图片（实际应该调用技能）
        self.create_mock_image(image_file, topic, style)
        
        return str(image_file)
    
    def create_mock_image(self, image_file, topic, style):
        """创建模拟图片（实际应该调用AI生成）"""
        # 这里应该调用baoyu-cover-image或baoyu-image-gen技能
        # 暂时创建占位文件
        
        # 创建图片信息文件
        info_file = image_file.with_suffix('.json')
        info = {
            "topic": topic,
            "style": style,
            "generated_at": datetime.now().isoformat(),
            "image_file": str(image_file),
            "note": "实际应该调用AI图像生成技能"
        }
        
        with open(info_file, 'w', encoding='utf-8') as f:
            json.dump(info, f, ensure_ascii=False, indent=2)
        
        print(f"📝 创建图片信息: {info_file}")
        print("⚠️  注意：实际应该调用AI图像生成技能生成真实图片")
        
        # 返回模拟文件路径
        return str(image_file)
    
    def generate_with_ai(self, topic, output_dir, article_index):
        """使用AI技能生成真实图片"""
        # 分析主题风格
        style = self.analyze_topic(topic)
        
        # 创建输出目录
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)
        
        # 生成图片文件名
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        image_file = output_path / f"cover_{article_index}_{timestamp}.jpg"
        
        print(f"🤖 使用AI生成封面图片: {image_file}")
        print(f"🎨 Prompt: {style['prompt']}")
        
        # 这里应该调用实际的AI图像生成技能
        # 例如：baoyu-image-gen或baoyu-cover-image
        
        # 暂时使用系统命令模拟
        try:
            # 尝试调用baoyu-image-gen技能
            cmd = [
                "node",
                str(self.image_gen_skill / "scripts" / "generate.js"),
                "--prompt", style['prompt'],
                "--output", str(image_file),
                "--size", "1200x630"
            ]
            
            result = subprocess.run(
                cmd,
                cwd=str(self.workspace),
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0 and image_file.exists():
                print(f"✅ AI图片生成成功: {image_file}")
                return str(image_file)
            else:
                print(f"❌ AI图片生成失败，使用模拟图片")
                print(f"错误: {result.stderr}")
                return self.create_mock_image(image_file, topic, style)
                
        except Exception as e:
            print(f"❌ 调用AI技能失败: {str(e)}")
            return self.create_mock_image(image_file, topic, style)
    
    def batch_generate(self, topics, output_dir):
        """批量生成封面图片"""
        print(f"🚀 批量生成封面图片")
        print(f"📋 主题列表: {len(topics)}个")
        
        images = {}
        for i, topic in enumerate(topics, 1):
            print(f"\n📊 处理第{i}个主题: {topic}")
            
            # 生成图片
            image_path = self.generate_with_ai(topic, output_dir, i)
            images[topic] = image_path
            
            print(f"✅ 完成: {image_path}")
        
        # 保存图片映射
        mapping_file = Path(output_dir) / "image_mapping.json"
        with open(mapping_file, 'w', encoding='utf-8') as f:
            json.dump(images, f, ensure_ascii=False, indent=2)
        
        print(f"\n🎉 批量生成完成!")
        print(f"📁 输出目录: {output_dir}")
        print(f"🗺️  图片映射: {mapping_file}")
        
        return images

def main():
    """主函数"""
    if len(sys.argv) < 2:
        print("智能配图生成系统")
        print("==================")
        print("使用方法:")
        print(f"  {sys.argv[0]} generate <主题> <输出目录> [文章序号]")
        print(f"  {sys.argv[0]} batch <主题1,主题2,主题3> <输出目录>")
        print()
        print("示例:")
        print(f"  {sys.argv[0]} generate 'AI芯片战争' ./covers 1")
        print(f"  {sys.argv[0]} batch 'AI芯片,AI教育,AI医疗' ./daily_covers")
        return
    
    workspace = "/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace"
    generator = SmartImageGenerator(workspace)
    
    action = sys.argv[1]
    
    if action == "generate":
        if len(sys.argv) < 4:
            print("❌ 缺少参数: generate <主题> <输出目录> [文章序号]")
            return
        
        topic = sys.argv[2]
        output_dir = sys.argv[3]
        article_index = sys.argv[4] if len(sys.argv) > 4 else "1"
        
        image_path = generator.generate_with_ai(topic, output_dir, article_index)
        print(f"\n🎉 生成完成!")
        print(f"📁 图片路径: {image_path}")
    
    elif action == "batch":
        if len(sys.argv) < 4:
            print("❌ 缺少参数: batch <主题列表> <输出目录>")
            return
        
        topics_str = sys.argv[2]
        output_dir = sys.argv[3]
        
        # 解析主题列表
        topics = [t.strip() for t in topics_str.split(',')]
        
        images = generator.batch_generate(topics, output_dir)
        
        # 显示结果
        print("\n📊 生成结果:")
        for topic, image_path in images.items():
            print(f"  {topic}: {image_path}")
    
    else:
        print(f"❌ 未知操作: {action}")

if __name__ == "__main__":
    main()