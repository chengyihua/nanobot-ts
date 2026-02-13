# 浏览器技能

基于Playwright的浏览器自动化技能，支持网页操作、数据提取、表单填写等功能。

## 快速开始

### 1. 安装依赖
```bash
# 安装Playwright
pip install playwright

# 安装浏览器（推荐Chromium）
playwright install chromium
```

### 2. 基本使用
```bash
# 打开网页并截图
nanobot browser open --url "https://www.baidu.com" --screenshot "baidu.png"

# 搜索内容
nanobot browser search --query "Python教程" --engine "baidu" --limit 10

# 获取页面内容
nanobot browser get-content --url "https://example.com" --selector "div.content" --output "content.txt"

# 填写表单
nanobot browser fill-form --url "https://example.com/login" --data '{"username":"test","password":"123456"}'

# 点击元素
nanobot browser click --url "https://example.com" --selector "button.submit"
```

## 脚本说明

### open_url.py - 打开网页
```bash
python open_url.py --url "https://www.baidu.com" --screenshot --headless false
```

### search.py - 搜索内容
```bash
python search.py --query "天气预报" --engine "baidu" --limit 5
```

### get_content.py - 获取页面内容
```bash
python get_content.py --url "https://news.baidu.com" --selector "h3.news-title" --output "news.txt"
```

### fill_form.py - 填写表单
```bash
python fill_form.py --url "https://example.com/login" --data '{"username":"admin","password":"admin123"}'
```

### click_element.py - 点击元素
```bash
python click_element.py --url "https://example.com" --selector "a.more" --wait-after 2
```

## 配置说明

编辑 `config.json` 文件可以修改默认配置：
```json
{
  "default_browser": "chromium",
  "headless": true,
  "timeout": 30000,
  "viewport": {"width": 1280, "height": 720}
}
```

## 示例

### 数据采集示例
```bash
# 采集新闻标题
python get_content.py --url "https://news.baidu.com" --selector "h3.news-title" --output "news_titles.txt"

# 批量采集
for url in $(cat urls.txt); do
    filename=$(echo $url | sed 's/[^a-zA-Z0-9]/_/g')
    python get_content.py --url "$url" --output "data/${filename}.txt"
done
```

### 自动化测试示例
```bash
# 测试登录功能
python fill_form.py --url "https://example.com/login" --data '{"username":"test","password":"test123"}'

# 验证登录成功
python get_content.py --url "https://example.com/dashboard" --selector "h1.welcome" --format text
```

## 故障排除

### 常见问题

1. **浏览器无法启动**
   ```bash
   # 重新安装浏览器
   playwright install chromium
   ```

2. **元素找不到**
   - 检查CSS选择器是否正确
   - 增加等待时间：`--wait 5`
   - 使用更稳定的选择器

3. **页面加载超时**
   ```bash
   # 增加超时时间
   python open_url.py --url "https://example.com" --timeout 60000
   ```

### 调试技巧

1. **显示浏览器窗口**
   ```bash
   python open_url.py --url "https://example.com" --headless false
   ```

2. **慢动作模式**
   ```python
   # 在代码中添加
   browser = p.chromium.launch(slow_mo=1000)  # 每个操作延迟1秒
   ```

## 注意事项

1. **遵守网站规则**：不要过度请求
2. **合法使用**：仅用于合法目的
3. **保护隐私**：不要泄露敏感信息
4. **性能考虑**：合理设置超时和重试

## 更多资源

- [Playwright官方文档](https://playwright.dev/python/)
- [CSS选择器参考](https://developer.mozilla.org/zh-CN/docs/Web/CSS/CSS_Selectors)
- [浏览器自动化最佳实践](https://playwright.dev/python/docs/best-practices)