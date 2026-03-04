#!/bin/bash

# 自动化文章发布系统
# 解决重复发布问题，确保每篇文章只发布一次

WORKSPACE="/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace"
PUBLISH_LOG="$WORKSPACE/publish_history.txt"
SKILL_DIR="/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/skills/baoyu-post-to-wechat"
API_SCRIPT="$SKILL_DIR/scripts/wechat-api.ts"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 计算文件哈希
calculate_hash() {
    local file="$1"
    if [ -f "$file" ]; then
        md5 -q "$file"
    else
        echo ""
    fi
}

# 检查是否已发布
check_already_published() {
    local file="$1"
    local title="$2"
    local hash=$(calculate_hash "$file")
    
    if [ ! -f "$PUBLISH_LOG" ]; then
        return 1
    fi
    
    # 检查哈希
    if grep -q "$hash" "$PUBLISH_LOG"; then
        log_warning "相同内容的文章已发布过"
        return 0
    fi
    
    # 检查标题
    if grep -q "标题: $title" "$PUBLISH_LOG"; then
        log_warning "相同标题的文章已发布过"
        return 0
    fi
    
    return 1
}

# 记录发布历史
record_publish() {
    local file="$1"
    local title="$2"
    local media_id="$3"
    local author="$4"
    local hash=$(calculate_hash "$file")
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "=== 发布记录 ===" >> "$PUBLISH_LOG"
    echo "时间: $timestamp" >> "$PUBLISH_LOG"
    echo "标题: $title" >> "$PUBLISH_LOG"
    echo "作者: $author" >> "$PUBLISH_LOG"
    echo "文件: $file" >> "$PUBLISH_LOG"
    echo "哈希: $hash" >> "$PUBLISH_LOG"
    echo "Media ID: $media_id" >> "$PUBLISH_LOG"
    echo "" >> "$PUBLISH_LOG"
    
    log_success "发布记录已保存"
}

# 发布文章
publish_article() {
    local markdown_file="$1"
    local title="$2"
    local cover_image="$3"
    local author="$4"
    local summary="$5"
    
    # 检查文件是否存在
    if [ ! -f "$markdown_file" ]; then
        log_error "文件不存在: $markdown_file"
        return 1
    fi
    
    # 检查是否已发布
    if check_already_published "$markdown_file" "$title"; then
        log_warning "跳过重复发布: $title"
        return 0
    fi
    
    log_info "开始发布文章: $title"
    log_info "源文件: $markdown_file"
    
    # 构建命令
    cmd="npx -y bun $API_SCRIPT \"$markdown_file\" --title \"$title\""
    
    if [ -n "$cover_image" ] && [ -f "$cover_image" ]; then
        cmd="$cmd --cover \"$cover_image\""
    else
        # 使用默认封面
        default_cover="$WORKSPACE/ai_agent_news_2026-02-28/cover.jpg"
        if [ -f "$default_cover" ]; then
            cmd="$cmd --cover \"$default_cover\""
            log_info "使用默认封面: $default_cover"
        fi
    fi
    
    if [ -n "$author" ]; then
        cmd="$cmd --author \"$author\""
    fi
    
    if [ -n "$summary" ]; then
        cmd="$cmd --summary \"$summary\""
    fi
    
    log_info "执行命令: $cmd"
    
    # 执行发布
    cd "$WORKSPACE"
    output=$(eval "$cmd" 2>&1)
    
    # 解析输出
    if echo "$output" | grep -q "Published successfully!"; then
        # 提取Media ID
        media_id=$(echo "$output" | grep -o "media_id: [^ ]*" | cut -d' ' -f2)
        
        if [ -n "$media_id" ]; then
            log_success "发布成功!"
            log_info "Media ID: $media_id"
            
            # 记录发布历史
            record_publish "$markdown_file" "$title" "$media_id" "$author"
            
            # 显示发布详情
            echo ""
            log_info "发布详情:"
            echo "   标题: $title"
            echo "   作者: $author"
            echo "   Media ID: $media_id"
            echo "   文件: $markdown_file"
            echo "   时间: $(date '+%Y-%m-%d %H:%M:%S')"
            echo ""
            
            return 0
        else
            log_error "无法提取Media ID"
            return 1
        fi
    else
        log_error "发布失败"
        echo "$output"
        return 1
    fi
}

# 列出已发布文章
list_published() {
    if [ ! -f "$PUBLISH_LOG" ]; then
        log_info "暂无发布记录"
        return
    fi
    
    log_info "已发布文章列表:"
    echo "========================================"
    grep -A6 "=== 发布记录 ===" "$PUBLISH_LOG" | while read -r line; do
        if [[ "$line" == "=== 发布记录 ===" ]]; then
            echo ""
        elif [[ "$line" == "时间:"* ]]; then
            echo "📅 $line"
        elif [[ "$line" == "标题:"* ]]; then
            echo "📝 $line"
        elif [[ "$line" == "Media ID:"* ]]; then
            echo "🆔 $line"
        fi
    done
    echo ""
}

# 检查重复
check_duplicates() {
    if [ ! -f "$PUBLISH_LOG" ]; then
        log_info "暂无发布记录"
        return 0
    fi
    
    log_info "检查重复发布..."
    
    # 提取所有标题和哈希
    titles=()
    hashes=()
    
    while IFS= read -r line; do
        if [[ "$line" == "标题:"* ]]; then
            title="${line#标题: }"
            titles+=("$title")
        elif [[ "$line" == "哈希:"* ]]; then
            hash="${line#哈希: }"
            hashes+=("$hash")
        fi
    done < "$PUBLISH_LOG"
    
    # 检查重复标题
    duplicate_titles=()
    for i in "${!titles[@]}"; do
        for j in "${!titles[@]}"; do
            if [ $i -ne $j ] && [ "${titles[$i]}" = "${titles[$j]}" ]; then
                duplicate_titles+=("${titles[$i]}")
            fi
        done
    done
    
    # 检查重复哈希
    duplicate_hashes=()
    for i in "${!hashes[@]}"; do
        for j in "${!hashes[@]}"; do
            if [ $i -ne $j ] && [ "${hashes[$i]}" = "${hashes[$j]}" ]; then
                duplicate_hashes+=("${hashes[$i]}")
            fi
        done
    done
    
    if [ ${#duplicate_titles[@]} -gt 0 ] || [ ${#duplicate_hashes[@]} -gt 0 ]; then
        log_warning "发现重复发布:"
        
        if [ ${#duplicate_titles[@]} -gt 0 ]; then
            echo "重复标题:"
            printf "  - %s\n" "${duplicate_titles[@]}" | sort -u
        fi
        
        if [ ${#duplicate_hashes[@]} -gt 0 ]; then
            echo "重复内容:"
            printf "  - %s\n" "${duplicate_hashes[@]}" | sort -u
        fi
        
        return 1
    else
        log_success "无重复发布"
        return 0
    fi
}

# 主函数
main() {
    action="$1"
    
    case "$action" in
        "publish")
            if [ $# -lt 3 ]; then
                log_error "使用方法: $0 publish <markdown文件> <标题> [封面] [作者] [摘要]"
                exit 1
            fi
            
            markdown_file="$2"
            title="$3"
            cover="${4:-}"
            author="${5:-}"
            summary="${6:-}"
            
            publish_article "$markdown_file" "$title" "$cover" "$author" "$summary"
            ;;
            
        "list")
            list_published
            ;;
            
        "check")
            check_duplicates
            ;;
            
        "help"|"")
            echo "自动化文章发布系统"
            echo "=================="
            echo "使用方法:"
            echo "  $0 publish <文件> <标题> [封面] [作者] [摘要]"
            echo "  $0 list                         # 列出已发布文章"
            echo "  $0 check                        # 检查重复发布"
            echo "  $0 help                         # 显示帮助"
            echo ""
            echo "示例:"
            echo "  $0 publish article.md 'AI分析' cover.jpg '作者' '摘要'"
            ;;
            
        *)
            log_error "未知操作: $action"
            echo "使用 '$0 help' 查看帮助"
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"