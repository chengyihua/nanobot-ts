# 测试图片目录

## 图片要求
- 格式: JPG或PNG
- 尺寸: 建议900x500（封面图），800x450（正文图）
- 命名: 按顺序命名，如 01-cover.jpg, 02-content.jpg

## 测试图片
1. 封面图: 展示AI技术概念
2. 技术架构图: 展示分层架构
3. 应用场景图: 展示企业应用
4. 趋势图: 展示未来发展

## 使用方式
```bash
# 使用baoyu-post-to-wechat技能
npx -y bun /Users/chengyihua/Downloads/nanobot-main/nanobot-ts/skills/baoyu-post-to-wechat/scripts/wechat-browser.ts \
  --markdown /Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace/test_image_article.md \
  --images /Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace/test_images
```
