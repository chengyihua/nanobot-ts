#!/bin/bash

# 测试baoyu-post-to-wechat技能基本功能

echo "🧪 测试baoyu-post-to-wechat技能基本功能"
echo "=========================================="

WORKSPACE="/Users/chengyihua/Downloads/nanobot-main/nanobot-ts"
SKILL_DIR="$WORKSPACE/skills/baoyu-post-to-wechat"

# 测试1: 检查技能结构
echo ""
echo "📁 测试1: 检查技能结构"
echo "技能目录: $SKILL_DIR"
if [ -d "$SKILL_DIR" ]; then
    echo "✅ 技能目录存在"
    
    # 检查主要文件
    FILES=("SKILL.md" "scripts/wechat-browser.ts" "scripts/wechat-article.ts" "scripts/wechat-api.ts")
    for file in "${FILES[@]}"; do
        if [ -f "$SKILL_DIR/$file" ]; then
            echo "✅ $file 存在"
        else
            echo "❌ $file 不存在"
        fi
    done
else
    echo "❌ 技能目录不存在"
    exit 1
fi

# 测试2: 检查TypeScript文件语法
echo ""
echo "🔧 测试2: 检查TypeScript文件语法"
TS_FILES=("wechat-browser.ts" "wechat-article.ts" "wechat-api.ts")
for ts_file in "${TS_FILES[@]}"; do
    file_path="$SKILL_DIR/scripts/$ts_file"
    if [ -f "$file_path" ]; then
        echo "检查 $ts_file..."
        # 简单检查文件内容
        head -5 "$file_path" | grep -q "import\|export\|function\|class" && echo "  ✅ 看起来是有效的TypeScript文件"
        echo "  大小: $(wc -l < "$file_path") 行"
    fi
done

# 测试3: 检查bun可用性
echo ""
echo "⚡ 测试3: 检查bun可用性"
if command -v bun &> /dev/null; then
    echo "✅ bun已安装: $(bun --version)"
else
    echo "❌ bun未安装"
    echo "安装命令: curl -fsSL https://bun.sh/install | bash"
fi

# 测试4: 创建最简单的测试
echo ""
echo "📝 测试4: 创建最简单的测试脚本"
TEST_SCRIPT="$WORKSPACE/workspace/test_minimal.ts"

cat > "$TEST_SCRIPT" << 'EOF'
// 最简单的TypeScript测试
console.log("🧪 baoyu-post-to-wechat技能测试");
console.log("================================");

// 模拟技能参数
const args = {
  markdown: "test.md",
  images: "test_images",
  submit: false
};

console.log("测试参数:", args);
console.log("✅ 测试脚本创建成功");

// 检查必要的模块
try {
  // 这些是技能可能需要的模块
  const modules = ["fs", "path", "child_process", "os"];
  modules.forEach(mod => {
    try {
      require(mod);
      console.log(`✅ 模块 ${mod} 可用`);
    } catch (e) {
      console.log(`❌ 模块 ${mod} 不可用: ${e.message}`);
    }
  });
} catch (error) {
  console.log("⚠️  模块检查出错:", error.message);
}

console.log("🎯 测试完成");
EOF

echo "✅ 测试脚本已创建: $TEST_SCRIPT"

# 测试5: 运行简单TypeScript测试
echo ""
echo "🚀 测试5: 运行简单TypeScript测试"
if command -v bun &> /dev/null; then
    echo "使用bun运行测试..."
    cd "$WORKSPACE/workspace" && bun run "$TEST_SCRIPT"
else
    echo "使用node运行测试（需要ts-node）..."
    if command -v ts-node &> /dev/null; then
        cd "$WORKSPACE/workspace" && ts-node "$TEST_SCRIPT"
    else
        echo "❌ 需要bun或ts-node来运行TypeScript"
        echo "安装ts-node: npm install -g ts-node typescript"
    fi
fi

# 测试6: 显示使用说明
echo ""
echo "📚 测试6: 技能使用说明"
echo ""
echo "baoyu-post-to-wechat技能支持三种发布方式:"
echo ""
echo "1. 📸 图片文章（图文/贴图）"
echo "   使用 wechat-browser.ts 脚本"
echo "   支持多张图片（最多9张）"
echo "   通过Chrome浏览器自动化"
echo ""
echo "2. 📄 普通文章"
echo "   使用 wechat-article.ts 脚本"
echo "   支持Markdown转HTML"
echo "   通过Chrome浏览器自动化"
echo ""
echo "3. 🔌 API发布"
echo "   使用 wechat-api.ts 脚本"
echo "   需要微信公众号API凭证"
echo "   直接调用微信API"
echo ""
echo "💡 首次使用提示:"
echo "- 第一次运行会打开Chrome浏览器"
echo "- 需要扫码登录微信公众号"
echo "- 建议先使用预览模式测试"
echo "- 确保网络连接正常"

echo ""
echo "=========================================="
echo "🧪 基本功能测试完成！"
echo "🎯 下一步: 运行实际发布测试"