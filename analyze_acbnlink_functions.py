#!/usr/bin/env python3
import asyncio
from playwright.async_api import async_playwright

async def analyze_acbnlink_functions():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        page = await context.new_page()
        
        try:
            print("=== 访问链禾网官方网站: acbnlink.com ===")
            await page.goto('http://acbnlink.com', wait_until='networkidle')
            await asyncio.sleep(5)
            
            # 截图首页
            homepage_screenshot = 'acbnlink_homepage.png'
            await page.screenshot(path=homepage_screenshot, full_page=True)
            print(f"✓ 首页截图: {homepage_screenshot}")
            
            print("\n=== 1. 网站整体结构分析 ===")
            
            # 获取导航菜单
            navigation = await page.evaluate('''
                () => {
                    const navItems = [];
                    const navElements = document.querySelectorAll('nav a, .nav a, .menu a, .header a');
                    
                    for (const el of navElements) {
                        if (el.textContent.trim() && el.href) {
                            navItems.push({
                                text: el.textContent.trim(),
                                href: el.href,
                                is_external: !el.href.includes('acbnlink.com')
                            });
                        }
                    }
                    return navItems;
                }
            ''')
            
            print(f"导航菜单项 ({len(navigation)}个):")
            for item in navigation[:10]:  # 显示前10个
                print(f"  • {item['text']} - {item['href']}")
            
            print("\n=== 2. 主要功能模块分析 ===")
            
            # 分析页面内容结构
            page_structure = await page.evaluate('''
                () => {
                    const sections = [];
                    const sectionElements = document.querySelectorAll('section, .section, .module, .block, .container');
                    
                    for (const el of sectionElements) {
                        const heading = el.querySelector('h1, h2, h3, h4, h5, h6');
                        if (heading) {
                            sections.push({
                                heading: heading.textContent.trim(),
                                content: el.textContent.trim().substring(0, 200),
                                has_button: !!el.querySelector('button, .btn, a.btn'),
                                has_form: !!el.querySelector('form, input, select'),
                                has_image: !!el.querySelector('img')
                            });
                        }
                    }
                    return sections;
                }
            ''')
            
            print(f"页面主要模块 ({len(page_structure)}个):")
            for i, section in enumerate(page_structure[:8], 1):
                print(f"\n{i}. {section['heading']}")
                print(f"   内容: {section['content'][:100]}...")
                print(f"   功能: ", end="")
                features = []
                if section['has_button']: features.append("按钮/操作")
                if section['has_form']: features.append("表单/输入")
                if section['has_image']: features.append("图片展示")
                print(", ".join(features) if features else "内容展示")
            
            print("\n=== 3. 核心功能识别 ===")
            
            # 查找关键功能区域
            key_functions = await page.evaluate('''
                () => {
                    const functions = [];
                    const bodyText = document.body.textContent;
                    
                    // 查找功能关键词
                    const functionKeywords = [
                        '登录', '注册', '发布', '浏览', '搜索', '匹配', '交易',
                        '管理', '认证', '支付', '客服', '帮助', '下载', '上传',
                        '集市', '大厅', '产品', '订单', '消息', '通知', '设置'
                    ];
                    
                    // 查找包含这些关键词的按钮或链接
                    const allElements = document.querySelectorAll('button, a, .btn, .button, [role="button"]');
                    
                    for (const el of allElements) {
                        const text = el.textContent.trim();
                        if (text) {
                            for (const keyword of functionKeywords) {
                                if (text.includes(keyword)) {
                                    functions.push({
                                        element: el.tagName.toLowerCase(),
                                        text: text,
                                        keyword: keyword,
                                        href: el.href || '',
                                        type: el.tagName === 'BUTTON' ? '按钮' : '链接'
                                    });
                                    break;
                                }
                            }
                        }
                    }
                    
                    return functions;
                }
            ''')
            
            print(f"核心功能按钮/链接 ({len(key_functions)}个):")
            seen_functions = set()
            for func in key_functions[:15]:
                func_key = f"{func['keyword']}:{func['text']}"
                if func_key not in seen_functions:
                    seen_functions.add(func_key)
                    print(f"  • {func['keyword']}: {func['text']} ({func['type']})")
            
            print("\n=== 4. 网站特色功能分析 ===")
            
            # 分析网站特色
            website_features = await page.evaluate('''
                () => {
                    const features = [];
                    const bodyText = document.body.textContent;
                    
                    // 平台数据
                    const dataPatterns = [
                        {pattern: /\\d+\\+.*供货商/, name: "供货商数量"},
                        {pattern: /\\d+\\+.*SKU/, name: "SKU数量"},
                        {pattern: /\\d+[\\.\\d]*亿.*成交额/, name: "成交额"},
                        {pattern: /\\d+\\+.*县域/, name: "覆盖县域"}
                    ];
                    
                    for (const pattern of dataPatterns) {
                        const match = bodyText.match(pattern.pattern);
                        if (match) {
                            features.push({
                                type: "平台数据",
                                name: pattern.name,
                                value: match[0]
                            });
                        }
                    }
                    
                    // 核心功能
                    const coreFunctions = [
                        {keywords: ['集市', '大厅', '市场'], name: "交易市场"},
                        {keywords: ['发布', '上架', '供应'], name: "产品发布"},
                        {keywords: ['搜索', '匹配', '推荐'], name: "智能匹配"},
                        {keywords: ['认证', '审核', '诚信'], name: "商家认证"},
                        {keywords: ['支付', '结算', '交易'], name: "交易支付"},
                        {keywords: ['客服', '支持', '帮助'], name: "客户服务"}
                    ];
                    
                    for (const func of coreFunctions) {
                        for (const keyword of func.keywords) {
                            if (bodyText.includes(keyword)) {
                                features.push({
                                    type: "核心功能",
                                    name: func.name,
                                    keyword: keyword
                                });
                                break;
                            }
                        }
                    }
                    
                    return features;
                }
            ''')
            
            print("平台特色功能:")
            for feature in website_features:
                if feature['type'] == "平台数据":
                    print(f"  📊 {feature['name']}: {feature['value']}")
                else:
                    print(f"  ⚙️  {feature['name']} (关键词: {feature['keyword']})")
            
            print("\n=== 5. 用户角色分析 ===")
            
            # 分析目标用户
            user_roles = await page.evaluate('''
                () => {
                    const roles = [];
                    const bodyText = document.body.textContent;
                    
                    const roleKeywords = [
                        {keywords: ['供货商', '供应商', '卖家'], role: "供货商"},
                        {keywords: ['采购商', '买家', '经销商'], role: "采购商"},
                        {keywords: ['经纪人', '中间商', '代理商'], role: "经纪人"},
                        {keywords: ['农户', '农民', '产地'], role: "农户/产地"},
                        {keywords: ['企业', '公司', '厂商'], role: "企业用户"}
                    ];
                    
                    for (const role of roleKeywords) {
                        for (const keyword of role.keywords) {
                            if (bodyText.includes(keyword)) {
                                roles.push({
                                    role: role.role,
                                    keyword: keyword
                                });
                                break;
                            }
                        }
                    }
                    
                    return roles;
                }
            ''')
            
            print("目标用户角色:")
            for role in user_roles:
                print(f"  👤 {role['role']} (关键词: {role['keyword']})")
            
            print("\n=== 6. 技术特点分析 ===")
            
            # 检查技术特性
            tech_features = await page.evaluate('''
                () => {
                    const techs = [];
                    const bodyText = document.body.textContent.toLowerCase();
                    
                    const techKeywords = [
                        {keywords: ['数字化', '数字'], name: "数字化平台"},
                        {keywords: ['ai', '人工智能', '智能'], name: "AI技术"},
                        {keywords: ['大数据', '数据'], name: "大数据分析"},
                        {keywords: ['saas', '软件服务'], name: "SaaS模式"},
                        {keywords: ['移动', '手机', 'app'], name: "移动端支持"},
                        {keywords: ['api', '接口'], name: "API接口"},
                        {keywords: ['云', 'cloud'], name: "云计算"}
                    ];
                    
                    for (const tech of techKeywords) {
                        for (const keyword of tech.keywords) {
                            if (bodyText.includes(keyword)) {
                                techs.push({
                                    name: tech.name,
                                    keyword: keyword
                                });
                                break;
                            }
                        }
                    }
                    
                    return techs;
                }
            ''')
            
            print("技术特点:")
            for tech in tech_features:
                print(f"  💻 {tech['name']} (关键词: {tech['keyword']})")
            
            # 7. 尝试点击关键功能
            print("\n=== 7. 功能可用性测试 ===")
            
            # 尝试点击"登录"按钮
            try:
                login_button = await page.wait_for_selector('button:has-text("登录"), a:has-text("登录"), .btn:has-text("登录")', timeout=5000)
                if login_button:
                    await login_button.click()
                    await asyncio.sleep(3)
                    
                    login_screenshot = 'acbnlink_login_page.png'
                    await page.screenshot(path=login_screenshot)
                    print(f"✓ 登录页面截图: {login_screenshot}")
                    
                    # 返回首页
                    await page.go_back()
                    await asyncio.sleep(2)
            except:
                print("  ℹ️ 未找到登录按钮或登录功能不可用")
            
            # 尝试点击"发布产品"或类似功能
            try:
                publish_button = await page.wait_for_selector('button:has-text("发布"), a:has-text("发布"), .btn:has-text("发布")', timeout=5000)
                if publish_button:
                    await publish_button.click()
                    await asyncio.sleep(3)
                    
                    publish_screenshot = 'acbnlink_publish_page.png'
                    await page.screenshot(path=publish_screenshot)
                    print(f"✓ 发布页面截图: {publish_screenshot}")
            except:
                print("  ℹ️ 未找到发布功能按钮")
            
            # 8. 保存完整页面HTML用于进一步分析
            html_content = await page.content()
            with open('acbnlink_full_analysis.html', 'w', encoding='utf-8') as f:
                f.write(html_content)
            print(f"\n✓ 完整页面HTML已保存: acbnlink_full_analysis.html")
            
        except Exception as e:
            print(f"❌ 分析过程中出错: {e}")
            import traceback
            traceback.print_exc()
        finally:
            print("\n=== 分析完成 ===")
            print("生成的文件:")
            print("1. acbnlink_homepage.png - 网站首页截图")
            print("2. acbnlink_login_page.png - 登录页面截图（如可用）")
            print("3. acbnlink_publish_page.png - 发布页面截图（如可用）")
            print("4. acbnlink_full_analysis.html - 完整页面HTML")

if __name__ == '__main__':
    asyncio.run(analyze_acbnlink_functions())