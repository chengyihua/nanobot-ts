#!/bin/bash

# AI图像生成脚本
# 使用baoyu-image-gen技能生成文章封面图片

WORKSPACE="/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace"
SKILL_DIR="/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/skills/baoyu-image-gen"
SCRIPT="$SKILL_DIR/scripts/generate.js"

# 主题到Prompt的映射
declare -A PROMPT_MAP=(
    ["芯片"]="AI芯片, 神经网络处理器, 电路板, 发光线路, 未来科技, 赛博朋克风格, 蓝色和紫色光效, 高科技感, 4K, 高质量"
    ["硬件"]="AI硬件, 服务器机房, 数据中心, 芯片特写, 科技感, 蓝色调, 专业摄影风格, 4K, 高质量"
    ["监管"]="AI监管, 法律文件, 天平, 地球仪, 政府建筑, 蓝色和金色, 权威感, 扁平设计, 4K, 高质量"
    ["政策"]="AI政策, 会议室, 文件堆叠, 全球地图, 决策过程, 深蓝色调, 专业感, 4K, 高质量"
    ["教育"]="AI教育, 学生使用平板电脑, 虚拟教室, 知识树, 多彩配色, 插画风格, 积极向上, 4K, 高质量"
    ["学习"]="个性化学习, 大脑连接, 知识网络, 温暖色调, 水彩风格, 创意感, 4K, 高质量"
    ["医疗"]="AI医疗, 医生与AI协作, 医疗设备, DNA双螺旋, 蓝色和白色, 干净专业, 可信赖感, 4K, 高质量"
    ["健康"]="AI健康管理, 智能手环, 健康数据可视化, 绿色植物, 清新色调, 简约风格, 4K, 高质量"
    ["创作"]="AI艺术创作, 画笔与调色板, 数字画布, 抽象艺术, 多彩配色, 油画质感, 4K, 高质量"
    ["艺术"]="AI与艺术, 机器人绘画, 数字雕塑, 抽象几何, 艺术感配色, 创意表达, 4K, 高质量"
    ["就业"]="AI与就业, 人与机器人协作, 职业发展, 办公室场景, 人文关怀, 摄影风格, 4K, 高质量"
    ["伦理"]="AI伦理, 道德天平, 人类与AI关系, 深色背景, 哲学思考, 概念艺术, 4K, 高质量"
    ["开源"]="开源AI, 代码协作, GitHub风格, 社区贡献, 绿色和黑色, 几何设计, 现代感, 4K, 高质量"
    ["社区"]="AI社区, 开发者协作, 开源项目, 多彩人物剪影, 扁平设计, 包容性, 4K, 高质量"
    ["边缘"]="边缘AI, IoT设备网络, 智能传感器, 连接点, 紫色和蓝色, 未来感, 连接性, 4K, 高质量"
    ["物联网"]="AI物联网, 设备互联, 数据流, 网络拓扑, 科技图表风格, 4K, 高质量"
    ["量子"]="量子AI, 量子比特, 叠加态, 深空背景, 紫色和黑色, 科学可视化, 神秘感, 4K, 高质量"
    ["AI"]="人工智能, 神经网络可视化, 数据流, 蓝色光效, 全息投影风格, 未来科技, 4K, 高质量"
    ["智能"]="智能系统, 大脑与芯片结合, 发光电路, 智慧之光, 现代设计, 4K, 高质量"
)

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 分析主题，生成合适的Prompt
analyze_topic() {
    local topic="$1"
    local topic_lower=$(echo "$topic" | tr '[:upper:]' '[:lower:]')
    
    # 查找匹配的关键词
    for keyword in "${!PROMPT_MAP[@]}"; do
        keyword_lower=$(echo "$keyword" | tr '[:upper:]' '[:lower:]')
        if [[ "$topic_lower" == *"$keyword_lower"* ]]; then
            echo "${PROMPT_MAP[$keyword]}"
            return 0
        fi
    done
    
    # 如果没有匹配，使用通用AI主题
    warning "未找到匹配的主题关键词，使用通用AI主题"
    echo "${PROMPT_MAP[AI]}"
}

# 生成图片
generate_image() {
    local topic="$1"
    local output_file="$2"
    
    log "生成图片: $topic"
    log "输出文件: $output_file"
    
    # 分析主题，获取Prompt
    prompt=$(analyze_topic "$topic")
    log "Prompt: $prompt"
    
    # 检查脚本是否存在
    if [ ! -f "$SCRIPT" ]; then
        error "图像生成脚本不存在: $SCRIPT"
        return 1
    fi
    
    # 创建输出目录
    output_dir=$(dirname "$output_file")
    mkdir -p "$output_dir"
    
    # 生成图片（使用Node.js运行脚本）
    cd "$WORKSPACE"
    
    # 尝试使用baoyu-image-gen技能
    # 注意：这里需要根据实际技能接口调整
    
    # 方法1：使用Node.js直接运行
    if command -v node >/dev/null 2>&1; then
        log "使用Node.js生成图片..."
        
        # 创建临时配置文件
        temp_config="/tmp/image_config_$$.json"
        cat > "$temp_config" << EOF
{
  "prompt": "$prompt",
  "output": "$output_file",
  "size": "1200x630",
  "model": "dall-e-3",
  "quality": "hd",
  "style": "vivid"
}
EOF
        
        # 运行生成脚本
        if node "$SCRIPT" --config "$temp_config"; then
            if [ -f "$output_file" ]; then
                success "图片生成成功: $output_file"
                rm -f "$temp_config"
                return 0
            else
                error "脚本执行成功但未生成图片文件"
                rm -f "$temp_config"
                return 1
            fi
        else
            error "Node.js脚本执行失败"
            rm -f "$temp_config"
            return 1
        fi
    else
        error "Node.js未安装"
        return 1
    fi
}

# 批量生成
batch_generate() {
    local topics_file="$1"
    local output_dir="$2"
    
    if [ ! -f "$topics_file" ]; then
        error "主题文件不存在: $topics_file"
        return 1
    fi
    
    mkdir -p "$output_dir"
    
    index=1
    while IFS= read -r topic || [ -n "$topic" ]; do
        topic=$(echo "$topic" | xargs)  # 去除空格
        if [ -n "$topic" ]; then
            log "处理第${index}个主题: $topic"
            
            output_file="$output_dir/cover_${index}.jpg"
            generate_image "$topic" "$output_file"
            
            index=$((index+1))
            
            # 间隔一下，避免API限制
            sleep 2
        fi
    done < "$topics_file"
    
    success "批量生成完成!"
    log "输出目录: $output_dir"
    
    # 显示生成的文件
    if [ -d "$output_dir" ]; then
        count=$(find "$output_dir" -name "*.jpg" -o -name "*.png" 2>/dev/null | wc -l)
        log "生成图片数量: $count"
    fi
}

# 主函数
main() {
    if [ $# -lt 2 ]; then
        echo "AI图像生成脚本"
        echo "================"
        echo "使用方法:"
        echo "  $0 single <主题> <输出文件>"
        echo "  $0 batch <主题文件> <输出目录>"
        echo ""
        echo "示例:"
        echo "  $0 single 'AI芯片战争' ./cover.jpg"
        echo "  $0 batch topics.txt ./covers/"
        echo ""
        echo "主题文件格式（每行一个主题）:"
        echo "  AI芯片战争"
        echo "  AI教育革命"
        echo "  AI医疗突破"
        return 1
    fi
    
    action="$1"
    
    case "$action" in
        "single")
            if [ $# -lt 3 ]; then
                error "使用方法: $0 single <主题> <输出文件>"
                return 1
            fi
            
            topic="$2"
            output_file="$3"
            
            generate_image "$topic" "$output_file"
            ;;
            
        "batch")
            if [ $# -lt 3 ]; then
                error "使用方法: $0 batch <主题文件> <输出目录>"
                return 1
            fi
            
            topics_file="$2"
            output_dir="$3"
            
            batch_generate "$topics_file" "$output_dir"
            ;;
            
        *)
            error "未知操作: $action"
            echo "使用 '$0' 查看帮助"
            return 1
            ;;
    esac
}

# 执行主函数
main "$@"