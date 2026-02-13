#!/usr/bin/env python3
"""
填写表单脚本
自动填写和提交网页表单
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Dict, Any, Optional

# 添加技能目录到Python路径
skill_dir = Path(__file__).parent.parent
sys.path.insert(0, str(skill_dir.parent.parent))

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("错误：未安装Playwright，请运行：pip install playwright")
    print("然后安装浏览器：playwright install chromium")
    sys.exit(1)


async def fill_form(
    url: str,
    form_data: Dict[str, str],
    form_selector: Optional[str] = None,
    submit: bool = True,
    browser_type: str = "chromium",
    headless: bool = True,
    wait_time: float = 3.0,
    timeout: int = 30000,
) -> Dict[str, Any]:
    """
    填写网页表单
    
    Args:
        url: 表单页面URL
        form_data: 表单数据字典，键为字段名或选择器，值为要填写的内容
        form_selector: 表单CSS选择器（可选）
        submit: 是否提交表单
        browser_type: 浏览器类型
        headless: 是否无头模式
        wait_time: 等待时间（秒）
        timeout: 超时时间（毫秒）
    
    Returns:
        包含操作结果的字典
    """
    result = {
        "success": False,
        "url": url,
        "form_data": form_data,
        "submitted": submit,
        "final_url": "",
        "error": None,
    }
    
    async with async_playwright() as p:
        try:
            # 启动浏览器
            browser = await p[browser_type].launch(headless=headless)
            context = await browser.new_context(
                viewport={"width": 1280, "height": 720}
            )
            page = await context.new_page()
            page.set_default_timeout(timeout)
            
            # 访问表单页面
            print(f"正在访问表单页面: {url}")
            response = await page.goto(url, wait_until="networkidle")
            
            if response and response.status >= 400:
                result["error"] = f"HTTP错误: {response.status}"
                print(f"警告: {result['error']}")
            
            # 等待页面加载
            await asyncio.sleep(wait_time)
            
            # 查找表单
            form_element = None
            if form_selector:
                form_element = await page.query_selector(form_selector)
                if not form_element:
                    print(f"警告: 未找到表单选择器 '{form_selector}'")
            else:
                # 尝试自动查找表单
                forms = await page.query_selector_all("form")
                if forms:
                    form_element = forms[0]
                    print(f"找到 {len(forms)} 个表单，使用第一个")
            
            # 填写表单字段
            print(f"正在填写 {len(form_data)} 个字段...")
            filled_fields = []
            
            for field, value in form_data.items():
                try:
                    # 尝试不同的选择器策略
                    selectors = [
                        f'input[name="{field}"]',
                        f'textarea[name="{field}"]',
                        f'select[name="{field}"]',
                        f'[name="{field}"]',
                        f'#{field}',
                        f'input[id="{field}"]',
                        f'textarea[id="{field}"]',
                        field,  # 直接作为选择器
                    ]
                    
                    element = None
                    for selector in selectors:
                        element = await page.query_selector(selector)
                        if element:
                            break
                    
                    if element:
                        # 获取元素类型
                        element_type = await element.get_attribute("type")
                        tag_name = await element.evaluate("element => element.tagName")
                        
                        # 根据类型填写
                        if tag_name.lower() == "select":
                            # 下拉选择框
                            await element.select_option(value)
                            print(f"  ✓ 选择框 '{field}': {value}")
                        elif element_type in ["checkbox", "radio"]:
                            # 复选框或单选按钮
                            if value.lower() in ["true", "yes", "1", "checked"]:
                                await element.check()
                                print(f"  ✓ 勾选 '{field}'")
                            else:
                                await element.uncheck()
                                print(f"  ✓ 取消勾选 '{field}'")
                        else:
                            # 文本输入框
                            await element.fill(value)
                            print(f"  ✓ 文本框 '{field}': {value}")
                        
                        filled_fields.append(field)
                    else:
                        print(f"  ✗ 未找到字段: {field}")
                        
                except Exception as e:
                    print(f"  ✗ 填写字段 '{field}' 时出错: {e}")
            
            result["filled_fields"] = filled_fields
            
            # 提交表单
            if submit and filled_fields:
                print("正在提交表单...")
                
                try:
                    # 尝试点击提交按钮
                    submit_buttons = [
                        'input[type="submit"]',
                        'button[type="submit"]',
                        'button:has-text("提交")',
                        'button:has-text("Submit")',
                        'button:has-text("登录")',
                        'button:has-text("Login")',
                        'button:has-text("注册")',
                        'button:has-text("Register")',
                    ]
                    
                    submitted = False
                    for button_selector in submit_buttons:
                        submit_button = await page.query_selector(button_selector)
                        if submit_button:
                            await submit_button.click()
                            submitted = True
                            print(f"点击提交按钮: {button_selector}")
                            break
                    
                    if not submitted and form_element:
                        # 在表单上按回车
                        await form_element.press("Enter")
                        submitted = True
                        print("在表单上按回车提交")
                    
                    if submitted:
                        # 等待页面跳转或加载
                        await page.wait_for_load_state("networkidle")
                        await asyncio.sleep(2)
                        
                        result["final_url"] = page.url
                        print(f"表单提交完成，当前URL: {result['final_url']}")
                        
                        # 检查是否成功
                        page_content = await page.content()
                        success_indicators = ["成功", "成功提交", "提交成功", "success", "thank you", "谢谢"]
                        
                        for indicator in success_indicators:
                            if indicator.lower() in page_content.lower():
                                result["success_message"] = f"检测到成功提示: {indicator}"
                                print(result["success_message"])
                                break
                    
                    result["submitted"] = submitted
                    
                except Exception as e:
                    result["error"] = f"提交表单时出错: {e}"
                    print(f"错误: {e}")
            
            # 截图记录
            screenshot_path = f"/tmp/form_filled_{Path(url).name}.png"
            await page.screenshot(path=screenshot_path)
            result["screenshot"] = screenshot_path
            print(f"截图已保存: {screenshot_path}")
            
            # 关闭浏览器
            await context.close()
            await browser.close()
            
            result["success"] = True
            print(f"表单填写完成，成功填写 {len(filled_fields)}/{len(form_data)} 个字段")
            
        except Exception as e:
            result["error"] = str(e)
            print(f"错误: {e}")
            
            # 确保浏览器关闭
            try:
                if 'browser' in locals():
                    await browser.close()
            except:
                pass
    
    return result


def main():
    """命令行入口点"""
    parser = argparse.ArgumentParser(description="填写网页表单")
    parser.add_argument("--url", required=True, help="表单页面URL")
    parser.add_argument("--data", required=True, help="表单数据（JSON格式）")
    parser.add_argument("--form", help="表单CSS选择器（可选）")
    parser.add_argument("--submit", action="store_true", 
                       help="提交表单（默认: 是）")
    parser.add_argument("--no-submit", dest="submit", action="store_false",
                       help="不提交表单")
    parser.add_argument("--browser", default="chromium", 
                       choices=["chromium", "firefox", "webkit"],
                       help="浏览器类型（默认: chromium）")
    parser.add_argument("--headless", action="store_true", 
                       help="无头模式（不显示浏览器窗口）")
    parser.add_argument("--no-headless", dest="headless", action="store_false",
                       help="显示浏览器窗口")
    parser.add_argument("--wait", type=float, default=3.0,
                       help="等待时间（秒，默认: 3）")
    parser.add_argument("--timeout", type=int, default=30000,
                       help="超时时间（毫秒，默认: 30000）")
    parser.add_argument("--output", help="结果输出文件（JSON格式）")
    
    # 设置默认值
    parser.set_defaults(submit=True, headless=True)
    
    args = parser.parse_args()
    
    # 解析表单数据
    try:
        form_data = json.loads(args.data)
        if not isinstance(form_data, dict):
            raise ValueError("表单数据必须是JSON对象格式")
    except json.JSONDecodeError as e:
        print(f"错误: 表单数据不是有效的JSON格式: {e}")
        sys.exit(1)
    except ValueError as e:
        print(f"错误: {e}")
        sys.exit(1)
    
    # 运行异步函数
    result = asyncio.run(
        fill_form(
            url=args.url,
            form_data=form_data,
            form_selector=args.form,
            submit=args.submit,
            browser_type=args.browser,
            headless=args.headless,
            wait_time=args.wait,
            timeout=args.timeout,
        )
    )
    
    # 输出结果
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"结果已保存: {output_path}")
    
    # 显示结果摘要
    print("\n" + "="*60)
    print("表单填写结果:")
    print(f"  成功: {result['success']}")
    print(f"  页面: {result['url']}")
    
    if result.get('final_url'):
        print(f"  提交后URL: {result['final_url']}")
    
    print(f"  表单数据: {len(form_data)} 个字段")
    print(f"  成功填写: {len(result.get('filled_fields', []))} 个字段")
    
    if result.get('filled_fields'):
        print(f"  已填字段: {', '.join(result['filled_fields'])}")
    
    if result.get('submitted'):
        print(f"  表单提交: {'是' if result['submitted'] else '否'}")
    
    if result.get('success_message'):
        print(f"  成功提示: {result['success_message']}")
    
    if result.get('screenshot'):
        print(f"  截图: {result['screenshot']}")
    
    if result['error']:
        print(f"  错误: {result['error']}")
    
    print("="*60)
    
    # 返回退出码
    sys.exit(0 if result['success'] else 1)


if __name__ == "__main__":
    main()