#!/bin/bash

# 完整的AI文章智能发布系统
# 集成：智能选题 + 深度写作 + 智能配图 + 防重复发布 + 自动发布

WORKSPACE="/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace"
DATE=$(date '+%Y-%m-%d')
LOG_FILE="$WORKSPACE/complete_publish_${DATE}.log"

# 组件路径
AUTO_PUBLISH="$WORKSPACE/auto_publish_system.sh"
IMAGE_GENERATOR="$WORKSPACE/ai_image_generator.sh"
DAILY_SCRIPT="$WORKSPACE/daily_ai_articles_with_images.sh"

# 目录
ARTICLE_DIR="$WORKSPACE/articles_${DATE}"
IMAGE_DIR="$WORKSPACE/images_${DATE}"
CONFIG_DIR="$WORKSPACE/config"

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# 日志函数
log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${CYAN}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

highlight() {
    echo -e "${PURPLE}[HIGHLIGHT]${NC} $1" | tee -a "$LOG_FILE"
}

# 显示横幅
show_banner() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║                AI文章智能发布系统 v2.0                  ║"
    echo "║      智能选题 · 深度写作 · 智能配图 · 自动发布         ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo ""
}

# 检查系统依赖
check_dependencies() {
    log "🔧 检查系统依赖..."
    
    missing=0
    
    # 检查必要组件
    if [ -f "$AUTO_PUBLISH" ]; then
        success "✅ 自动发布系统: $AUTO_PUBLISH"
    else
        error "❌ 自动发布系统: 文件不存在"
        missing=$((missing+1))
    fi
    
    if [ -f "$IMAGE_GENERATOR" ]; then
        success "✅ 图像生成器: $IMAGE_GENERATOR"
    else
        error "❌ 图像生成器: 文件不存在"
        missing=$((missing+1))
    fi
    
    if [ -f "$DAILY_SCRIPT" ]; then
        success "✅ 每日发布脚本: $DAILY_SCRIPT"
    else
        error "❌ 每日发布脚本: 文件不存在"
        missing=$((missing+1))
    fi
    
    # 检查命令
    commands=("node" "python3")
    for cmd in "${commands[@]}"; do
        if command -v "$cmd" >/dev/null 2>&1; then
            success "✅ 命令: $cmd"
        else
            warning "⚠️  命令: $cmd 未安装"
        fi
    done
    
    if [ $missing -gt 0 ]; then
        error "❌ 缺少 $missing 个必要组件"
        return 1
    else
        success "✅ 所有必要组件就绪"
        return 0
    fi
}

# 初始化目录
init_directories() {
    log "📁 初始化目录..."
    
    mkdir -p "$ARTICLE_DIR"
    mkdir -p "$IMAGE_DIR"
    mkdir -p "$CONFIG_DIR"
    
    success "✅ 文章目录: $ARTICLE_DIR"
    success "✅ 图片目录: $IMAGE_DIR"
    success "✅ 配置目录: $CONFIG_DIR"
}

# 智能选题
select_topics() {
    log "🎯 智能选题..."
    
    # 预设话题库
    topics=(
        "AI芯片战争：英伟达的垄断与挑战者"
        "AI监管博弈：中美欧政策对比分析"
        "AI教育革命：个性化学习如何改变教育"
        "AI医疗突破：诊断、药物研发、健康管理"
        "AI创作边界：艺术、音乐、文学的AI创作"
        "AI就业影响：哪些工作会被取代，哪些会新生"
        "AI伦理挑战：偏见、隐私、责任问题"
        "AI开源运动：社区驱动的创新模式"
        "AI边缘计算：设备端AI的应用前景"
        "AI量子计算：下一代计算范式"
        "AI金融科技：智能投顾与风险控制"
        "AI自动驾驶：技术突破与商业化路径"
        "AI农业科技：精准农业与粮食安全"
        "AI能源管理：智能电网与节能减排"
        "AI城市治理：智慧城市与公共服务"
    )
    
    # 选择3个不同领域的话题
    selected=()
    domains=()
    
    while [ ${#selected[@]} -lt 3 ]; do
        topic=${topics[$RANDOM % ${#topics[@]}]}
        
        # 提取领域关键词
        domain=""
        case "$topic" in
            *芯片*|*硬件*) domain="硬件" ;;
            *监管*|*政策*) domain="政策" ;;
            *教育*) domain="教育" ;;
            *医疗*) domain="医疗" ;;
            *创作*|*艺术*) domain="艺术" ;;
            *就业*|*伦理*) domain="社会" ;;
            *开源*) domain="开源" ;;
            *边缘*|*物联网*) domain="物联网" ;;
            *量子*) domain="量子" ;;
            *金融*) domain="金融" ;;
            *驾驶*) domain="交通" ;;
            *农业*) domain="农业" ;;
            *能源*) domain="能源" ;;
            *城市*) domain="城市" ;;
            *) domain="通用" ;;
        esac
        
        # 确保领域不重复
        if [[ ! " ${domains[@]} " =~ " ${domain} " ]]; then
            selected+=("$topic")
            domains+=("$domain")
            info "  📝 选择话题: $topic (领域: $domain)"
        fi
    done
    
    # 保存选题
    topics_file="$CONFIG_DIR/topics_${DATE}.txt"
    printf "%s\n" "${selected[@]}" > "$topics_file"
    
    highlight "🎯 今日选题 (3个不同领域):"
    for i in "${!selected[@]}"; do
        echo "  $((i+1)). ${selected[$i]}"
    done
    
    echo "${selected[@]}"
}

# 智能配图（模拟版）
generate_images() {
    local topics=("$@")
    
    log "🎨 智能配图生成..."
    
    # 创建主题文件
    topics_file="$CONFIG_DIR/topics_for_images_${DATE}.txt"
    printf "%s\n" "${topics[@]}" > "$topics_file"
    
    # 模拟生成图片（实际应该调用AI生成）
    for i in "${!topics[@]}"; do
        topic="${topics[$i]}"
        index=$((i+1))
        
        # 根据主题选择不同的占位图片
        case "$topic" in
            *芯片*|*硬件*)
                image_name="chip_tech.jpg"
                prompt="AI芯片科技感图片"
                ;;
            *监管*|*政策*)
                image_name="policy_law.jpg"
                prompt="AI监管政策图片"
                ;;
            *教育*)
                image_name="education_ai.jpg"
                prompt="AI教育学习图片"
                ;;
            *医疗*)
                image_name="medical_ai.jpg"
                prompt="AI医疗健康图片"
                ;;
            *创作*|*艺术*)
                image_name="art_creative.jpg"
                prompt="AI艺术创作图片"
                ;;
            *)
                image_name="ai_general.jpg"
                prompt="通用AI科技图片"
                ;;
        esac
        
        # 创建图片信息文件（模拟）
        image_file="$IMAGE_DIR/cover_${index}.jpg"
        info_file="$IMAGE_DIR/cover_${index}.info.txt"
        
        echo "主题: $topic" > "$info_file"
        echo "Prompt: $prompt" >> "$info_file"
        echo "生成时间: $(date '+%Y-%m-%d %H:%M:%S')" >> "$info_file"
        echo "文件: $image_file" >> "$info_file"
        echo "状态: 模拟生成（实际应调用AI图像生成）" >> "$info_file"
        
        info "  生成图片 $index: $topic → $image_name"
    done
    
    success "✅ 配图信息生成完成"
    warning "⚠️  注意：实际应该调用AI图像生成技能生成真实图片"
}

# 获取对应图片
get_image_for_topic() {
    local topic_index="$1"
    local image_dir="$2"
    
    # 查找对应序号的图片信息文件
    info_file="$image_dir/cover_${topic_index}.info.txt"
    
    if [ -f "$info_file" ]; then
        # 从信息文件中提取图片路径
        image_file=$(grep "^文件:" "$info_file" | cut -d' ' -f2)
        if [ -n "$image_file" ]; then
            echo "$image_file"
        else
            echo ""
        fi
    else
        echo ""
    fi
}

# 深度文章生成
generate_articles() {
    local topics=("$@")
    local image_dir="$1"
    
    log "📝 深度文章生成..."
    
    articles_info=()
    
    for i in "${!topics[@]}"; do
        topic="${topics[$i]}"
        index=$((i+1))
        
        info "  处理第${index}篇文章: $topic"
        
        # 获取对应图片
        cover_image=$(get_image_for_topic "$index" "$image_dir")
        
        if [ -n "$cover_image" ]; then
            info "    配图: $(basename "$cover_image")"
        else
            warning "    未找到配图"
        fi
        
        # 生成文章
        article_file="$ARTICLE_DIR/article_${index}.md"
        author=$(get_author_for_topic "$topic")
        
        generate_single_article "$topic" "$article_file" "$author" "$cover_image"
        
        if [ -f "$article_file" ]; then
            success "    ✅ 文章生成完成: $(basename "$article_file")"
            articles_info+=("$article_file:$author:$cover_image")
        else
            error "    ❌ 文章生成失败"
        fi
    done
    
    # 保存文章信息
    info_file="$CONFIG_DIR/articles_info_${DATE}.json"
    echo "[" > "$info_file"
    for i in "${!articles_info[@]}"; do
        IFS=':' read -r file author cover <<< "${articles_info[$i]}"
        if [ $i -gt 0 ]; then
            echo "," >> "$info_file"
        fi
        cat >> "$info_file" << EOF
  {
    "index": $((i+1)),
    "file": "$file",
    "author": "$author",
    "cover": "$cover",
    "topic": "${topics[$i]}"
  }
EOF
    done
    echo "]" >> "$info_file"
    
    success "✅ 所有文章生成完成"
    echo "${articles_info[@]}"
}

# 获取作者身份
get_author_for_topic() {
    local topic="$1"
    
    case "$topic" in
        *芯片*|*硬件*) echo "硬件分析师" ;;
        *监管*|*政策*) echo "政策研究员" ;;
        *教育*) echo "教育科技专家" ;;
        *医疗*) echo "医疗AI研究员" ;;
        *创作*|*艺术*) echo "创意科技作家" ;;
        *就业*|*伦理*) echo "社会学家" ;;
        *开源*) echo "开源倡导者" ;;
        *金融*) echo "金融科技专家" ;;
        *驾驶*) echo "自动驾驶工程师" ;;
        *农业*) echo "农业科技研究员" ;;
        *能源*) echo "能源系统分析师" ;;
        *城市*) echo "智慧城市规划师" ;;
        *) echo "科技观察者" ;;
    esac
}

# 生成单篇文章
generate_single_article() {
    local topic="$1"
    local output_file="$2"
    local author="$3"
    local cover_image="$4"
    
    # 生成副标题
    subtitle=$(generate_subtitle "$topic")
    
    # 生成文章内容
    cat > "$output_file" << EOF
# $topic

> $subtitle

$(if [ -n "$cover_image" ]; then 
  echo "![封面图片]($(basename "$cover_image"))"
  echo ""
  echo "*配图说明: 根据'$topic'主题智能生成的AI封面图片*"
  echo ""
fi)

---

## 🔥 核心洞察

$(generate_insight "$topic")

---

## 📡 现象观察

$(generate_observation "$topic")

---

## 🧠 深度分析

### 1. 技术维度
$(generate_analysis_tech "$topic")

### 2. 商业维度  
$(generate_analysis_business "$topic")

### 3. 社会维度
$(generate_analysis_social "$topic")

---

## 🎯 关键发现

- **发现一**: $(generate_finding1 "$topic")
- **发现二**: $(generate_finding2 "$topic")
- **发现三**: $(generate_finding3 "$topic")

---

## 💡 行动建议

### 给技术从业者
$(generate_advice_tech "$topic")

### 给创业者
$(generate_advice_startup "$topic")

### 给投资者
$(generate_advice_investor "$topic")

### 给普通人
$(generate_advice_general "$topic")

---

## 🚀 未来展望

$(generate_outlook "$topic")

---

*本文基于行业观察和数据分析，观点代表个人见解。*

*作者: $author | 分析时间: $DATE*
EOF
}

# 内容生成辅助函数
generate_subtitle() {
    local topic="$1"
    case "$topic" in
        *芯片*) echo "当算力成为战略资源，芯片战争决定AI未来" ;;
        *监管*) echo "政策制定者如何在创新与安全之间寻找平衡" ;;
        *教育*) echo "个性化学习正在重新定义教育的本质" ;;
        *医疗*) echo "AI如何从辅助诊断走向主动健康管理" ;;
        *创作*) echo "当AI学会创作，艺术的边界在哪里" ;;
        *就业*) echo "AI时代的工作革命：消失与新生" ;;
        *开源*) echo "社区力量如何挑战科技巨头" ;;
        *金融*) echo "智能金融：风险与机遇并存" ;;
        *驾驶*) echo "自动驾驶：从实验室到公路的革命" ;;
        *农业*) echo "智慧农业：用AI养活未来世界" ;;
        *能源*) echo "AI能源管理：绿色未来的关键" ;;
        *城市*) echo "智慧城市：科技让生活更美好" ;;
        *) echo "深度解读技术趋势背后的商业逻辑和社会影响" ;;
    esac
}

generate_insight() {
    local topic="$1"
    echo "AI技术正在深刻改变$topic领域，从技术突破到商业应用，再到社会影响，这一过程充满了机遇与挑战。"
}

generate_observation() {
    local topic="$1"
    echo "近期，$topic领域出现了多个标志性进展，包括技术创新、资本投入、政策支持等，这些变化预示着行业的重大转型。"
}

generate_analysis_tech() {
    local topic="$1"
    echo "技术层面，$topic涉及算法优化、硬件升级、数据处理等多个方面的创新。当前的技术瓶颈和突破方向值得重点关注。"
}

generate_analysis_business() {
    local topic="$1"
    echo "商业角度，$topic正在催生新的商业模式和市场格局。传统企业面临转型压力，新兴公司寻找差异化竞争策略。"
}

generate_analysis_social() {
    local topic="$1"
    echo "社会影响方面，$topic关系到就业结构、资源配置、公平效率等多个维度，需要在技术进步与社会福祉之间找到平衡点。"
}

generate_finding1() {
    local topic="$1"
    echo "$topic领域的技术成熟度显著提升，但大规模商业化应用仍需时间"
}

generate_finding2() {
    local topic="$1"
    echo "资本对$topic的关注持续升温，投资重点从概念验证转向实际价值创造"
}

generate_finding3() {
    local topic="$1"
    echo "政策环境对$topic发展至关重要，合规与创新需要协同推进"
}

generate_advice_tech() {
    local topic="$1"
    echo "深入掌握$topic的核心技术，关注前沿研究，建立专业能力壁垒"
}

generate_advice_startup() {
    local topic="$1"
    echo "寻找$topic与具体场景的结合点，解决实际问题，避免同质化竞争"
}

generate_advice_investor() {
    local topic="$1"
    echo "关注$topic领域有技术深度和商业模式的团队，注重长期价值投资"
}

generate_advice_general() {
    local topic="$1"
    echo "了解$topic的基本知识和发展趋势，思考如何利用相关技术提升效率"
}

generate_outlook() {
    local topic="$1"
    echo "未来3-5年，$topic将完成从技术探索到产业成熟的转变，相关生态系统将更加完善。"
}

# 智能发布
publish_articles() {
    local articles_info=("$@")
    
    log "🚀 智能发布文章..."
    
    success_count=0
    fail_count=0
    
    for i in "${!articles_info[@]}"; do
        IFS=':' read -r article_file author cover_image <<< "${articles_info[$i]}"
        index=$((i+1))
        
        info "  发布第${index}篇文章..."
        
        # 提取标题
        title=$(head -1 "$article_file" | sed 's/^# //')
        
        # 生成摘要
        summary="深度分析${title}，探讨技术趋势、商业机会和社会影响。本文提供多维度解读和实用建议。"
        
        # 发布文章（使用默认封面，因为模拟图片不存在）
        default_cover="$WORKSPACE/ai_agent_news_2026-02-28/cover.jpg"
        if [ -f "$default_cover" ]; then
            actual_cover="$default_cover"
            info "    使用默认封面: $(basename "$actual_cover")"
        else
            actual_cover=""
            warning "    未找到封面图片"
        fi
        
        # 发布文章
        if [ -f "$AUTO_PUBLISH" ]; then
            if "$AUTO_PUBLISH" publish "$article_file" "$title" "$actual_cover" "$author" "$summary"; then
                success "    ✅ 发布成功"
                success_count=$((success_count+1))
            else
                error "    ❌ 发布失败"
                fail_count=$((fail_count+1))
            fi
        else
            error "    ❌ 发布系统不可用"
            fail_count=$((fail_count+1))
        fi
        
        # 间隔避免API限制
        if [ $i -lt $((${#articles_info[@]}-1)) ]; then
            sleep 3
        fi
    done
    
    # 发布统计
    highlight "📊 发布统计:"
    echo "  ✅ 成功: $success_count 篇"
    echo "  ❌ 失败: $fail_count 篇"
    
    if [ $success_count -gt 0 ]; then
        success "🎉 文章发布任务完成!"
    else
        error "😞 发布任务失败"
    fi
}

# 生成报告
generate_report() {
    log "📋 生成执行报告..."
    
    report_file="$WORKSPACE/report_${DATE}.md"
    
    cat > "$report_file" << EOF
# AI文章智能发布系统执行报告

**日期**: $DATE  
**执行时间**: $(date '+%Y-%m-%d %H:%M:%S')  
**系统版本**: v2.0 (智能配图版)

---

## 📊 执行概览

- **选题数量**: 3篇
- **配图生成**: 3张（模拟）
- **文章生成**: 3篇
- **发布成功**: $success_count篇

---

## 🎯 今日选题

$(for i in "${!SELECTED_TOPICS[@]}"; do
  echo "$((i+1)). ${SELECTED_TOPICS[$i]}"
done)

---

## 🖼️ 配图生成

$(if [ -d "$IMAGE_DIR" ]; then
  echo "生成图片信息:"
  find "$IMAGE_DIR" -name "*.info.txt" 2>/dev/null | while read info; do
    topic=\$(grep "^主题:" "\$info" | cut -d' ' -f2-)
    prompt=\$(grep "^Prompt:" "\$info" | cut -d' ' -f2-)
    echo "- \$topic"
    echo "  Prompt: \$prompt"
  done
else
  echo "无配图生成"
fi)

---

## 📝 文章生成

$(if [ -d "$ARTICLE_DIR" ]; then
  echo "生成文章:"
  find "$ARTICLE_DIR" -name "*.md" 2>/dev/null | while read article; do
    title=\$(head -1 "\$article" | sed 's/^# //')
    echo "- \$title"
  done
else
  echo "无文章生成"
fi)

---

## 📋 日志摘要

\`\`\`
$(tail -20 "$LOG_FILE" 2>/dev/null || echo "无日志")
\`\`\`

---

## 🔧 系统状态

- 自动发布系统: $(if [ -f "$AUTO_PUBLISH" ]; then echo "✅ 正常"; else echo "❌ 异常"; fi)
- 图像生成器: $(if [ -f "$IMAGE_GENERATOR" ]; then echo "✅ 正常"; else echo "❌ 异常"; fi)
- 发布脚本: $(if [ -f "$DAILY_SCRIPT" ]; then echo "✅ 正常"; else echo "❌ 异常"; fi)

---

## 🚀 后续建议

1. 检查微信公众号草稿箱确认发布结果
2. 根据需要调整文章内容或配图
3. 设置定时任务实现自动化运行
4. 集成真实AI图像生成功能

---

*报告生成时间: $(date '+%Y-%m-%d %H:%M:%S')*
EOF
    
    success "✅ 报告生成完成: $report_file"
}

# 主流程
main() {
    show_banner
    
    # 检查依赖
    if ! check_dependencies; then
        error "❌ 系统依赖检查失败，请修复后重试"
        return 1
    fi
    
    # 初始化
    init_directories
    
    # 智能选题
    IFS=$'\n' read -r -a SELECTED_TOPICS <<< "$(select_topics)"
    
    # 智能配图（模拟）
    generate_images "${SELECTED_TOPICS[@]}"
    
    # 深度文章生成
    IFS=$'\n' read -r -a ARTICLES_INFO <<< "$(generate_articles "${SELECTED_TOPICS[@]}" "$IMAGE_DIR")"
    
    # 智能发布
    publish_articles "${ARTICLES_INFO[@]}"
    
    # 生成报告
    generate_report
    
    # 最终总结
    echo ""
    highlight "🎉 AI文章智能发布系统执行完成!"
    echo ""
    echo "📁 输出目录:"
    echo "  文章: $ARTICLE_DIR"
    echo "  图片: $IMAGE_DIR"
    echo "  配置: $CONFIG_DIR"
    echo "  日志: $LOG_FILE"
    echo "  报告: $WORKSPACE/report_${DATE}.md"
    echo ""
    echo "🚀 下一步:"
    echo "  1. 检查微信公众号草稿箱"
    echo "  2. 预览和编辑文章"
    echo "  3. 设置定时任务自动化运行"
    echo "  4. 集成真实AI图像生成功能"
    echo ""
}

# 执行主流程
main "$@"