import os
import sys
from pathlib import Path
from typing import Optional, Dict, Any

async def launch_browser(p, browser_type: str = "chromium", headless: bool = True):
    """
    启动浏览器，支持系统已安装浏览器的回退
    """
    launch_options = {"headless": headless}
    
    # macOS 系统浏览器路径
    chrome_path = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    
    if browser_type == "chromium" and os.path.exists(chrome_path):
        launch_options["executable_path"] = chrome_path
        print(f"[Browser] Using system Chrome: {chrome_path}")
    
    try:
        return await p[browser_type].launch(**launch_options)
    except Exception as e:
        print(f"[Browser] Failed to launch with options {launch_options}: {e}")
        # 如果带路径失败，尝试默认启动
        if "executable_path" in launch_options:
            print("[Browser] Retrying without executable_path...")
            del launch_options["executable_path"]
            return await p[browser_type].launch(**launch_options)
        raise e
