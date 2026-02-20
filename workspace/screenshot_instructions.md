# YouTube视频截图获取指南

## 截图需求
为YouTube视频 https://www.youtube.com/watch?v=KFBzCUtCktk 获取以下截图：

### 必需截图
1. **视频封面截图** - 显示视频标题、上传者、观看次数等信息
2. **视频播放界面截图** - 显示视频播放器和控制栏
3. **描述区域截图** - 显示完整视频描述和章节信息
4. **评论区域截图** - 显示前10-20条评论

### 可选截图
5. **章节导航截图** - 显示视频章节时间点
6. **相关视频截图** - 显示推荐的相关视频
7. **完整页面截图** - 整个YouTube页面的完整截图

## 截图方法

### 方法1: 使用浏览器开发者工具
```bash
# 在Chrome或Firefox中
1. 打开YouTube视频页面
2. 按F12打开开发者工具
3. 使用截图工具或命令
4. 保存为PNG或JPEG格式
```

### 方法2: 使用Python Selenium
```python
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import time

# 设置Chrome选项
chrome_options = Options()
chrome_options.add_argument('--headless')  # 无头模式
chrome_options.add_argument('--no-sandbox')
chrome_options.add_argument('--disable-dev-shm-usage')

# 创建驱动
driver = webdriver.Chrome(options=chrome_options)

try:
    # 打开YouTube视频
    driver.get('https://www.youtube.com/watch?v=KFBzCUtCktk')
    time.sleep(5)  # 等待页面加载
    
    # 截图1: 整个页面
    driver.save_screenshot('youtube_full_page.png')
    
    # 截图2: 特定元素（如视频播放器）
    video_player = driver.find_element_by_css_selector('#movie_player')
    video_player.screenshot('video_player.png')
    
    # 截图3: 描述区域
    description = driver.find_element_by_css_selector('#description')
    description.screenshot('description.png')
    
finally:
    driver.quit()
```

### 方法3: 使用命令行工具
```bash
# 使用wkhtmltoimage
wkhtmltoimage --quality 100 https://www.youtube.com/watch?v=KFBzCUtCktk youtube_screenshot.png

# 使用cutycapt
cutycapt --url=https://www.youtube.com/watch?v=KFBzCUtCktk --out=youtube.png

# 使用phantomjs
phantomjs rasterize.js https://www.youtube.com/watch?v=KFBzCUtCktk youtube.png A4
```

### 方法4: 使用Node.js Puppeteer
```javascript
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  await page.goto('https://www.youtube.com/watch?v=KFBzCUtCktk', {
    waitUntil: 'networkidle2'
  });
  
  // 等待视频加载
  await page.waitForTimeout(5000);
  
  // 截图整个页面
  await page.screenshot({ path: 'youtube_full.png', fullPage: true });
  
  // 截图特定区域
  const videoElement = await page.$('#movie_player');
  await videoElement.screenshot({ path: 'video_player.png' });
  
  await browser.close();
})();
```

## 截图保存位置
建议将截图保存在以下目录：
```
/Users/chengyihua/Downloads/nanobot-main/nanobot-ts/workspace/screenshots/
```

建议的文件命名格式：
```
youtube_KFBzCUtCktk_[类型]_[时间戳].png
```

例如：
- `youtube_KFBzCUtCktk_fullpage_20240115_1430.png`
- `youtube_KFBzCUtCktk_videoplayer_20240115_1430.png`
- `youtube_KFBzCUtCktk_description_20240115_1430.png`
- `youtube_KFBzCUtCktk_comments_20240115_1430.png`

## 截图质量要求
1. **分辨率**: 至少1920x1080
2. **格式**: PNG（无损）或高质量JPEG
3. **文件大小**: 每个截图不超过5MB
4. **清晰度**: 文字清晰可读

## 当前状态
由于网络连接问题，无法获取实时截图。网络测试显示：
- curl连接YouTube超时
- wget连接YouTube超时
- webFetch工具15秒超时

## 建议解决方案
1. **检查网络设置** - 确保可以访问YouTube
2. **使用代理/VPN** - 绕过可能的网络限制
3. **使用本地缓存** - 如果之前访问过，可能已有缓存
4. **使用API替代** - 使用YouTube Data API获取信息而非截图

## 截图验证
获取截图后应验证：
1. 截图是否完整包含所需信息
2. 文字是否清晰可读
3. 颜色和布局是否正确
4. 文件是否可以正常打开