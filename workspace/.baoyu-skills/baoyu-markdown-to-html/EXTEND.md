# Markdown to HTML 主题配置

## 当前主题设置
theme: default

## 可用主题列表

### 1. default - 经典主题
- 标题居中带底边
- 二级标题白字彩底
- 传统排版风格

### 2. grace - 优雅主题
- 文字阴影效果
- 圆角卡片设计
- 精致引用块

### 3. simple - 简洁主题
- 现代极简风
- 不对称圆角
- 清爽留白

### 4. modern - 现代商务主题 ⭐ 新
- 专业商务风格
- 渐变背景效果
- 圆角胶囊标题
- 适合商业文章

### 5. tech - 科技风格主题 ⭐ 新
- 深色科技感
- 渐变边框效果
- 代码高亮优化
- 适合技术文章

### 6. elegant - 优雅简约主题 ⭐ 新
- 温暖舒适
- 长文阅读优化
- 柔和阴影
- 适合深度文章

## 如何切换主题

修改上面的 `theme` 值即可：

```yaml
# 切换到现代商务主题
theme: modern

# 切换到科技风格主题
theme: tech

# 切换到优雅简约主题
theme: elegant
```

## 自定义主题色

可以自定义主题色（默认为蓝色）：

```yaml
theme: modern
primary_color: "#4A90E2"  # 蓝色
# primary_color: "#E74C3C"  # 红色
# primary_color: "#2ECC71"  # 绿色
# primary_color: "#9B59B6"  # 紫色
# primary_color: "#F39C12"  # 橙色
```

## 代码块样式

可以自定义代码块样式：

```yaml
theme: tech
code_theme: monokai  # 代码高亮主题
# code_theme: github
# code_theme: tomorrow-night
```

## 字体设置

可以自定义字体：

```yaml
theme: elegant
font_family: "PingFang SC, Microsoft YaHei, sans-serif"
code_font: "Fira Code, Monaco, Consolas, monospace"
```

## 使用示例

在文章的 frontmatter 中指定主题：

```markdown
---
title: 我的技术文章
theme: tech
primary_color: "#4A90E2"
---

# 文章标题

内容...
```

或者在命令行中指定：

```bash
bun skills/baoyu-markdown-to-html/scripts/main.ts \
  --markdown 文章.md \
  --theme tech \
  --primary-color "#4A90E2"
```
