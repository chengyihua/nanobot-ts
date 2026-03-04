"""
最简单的生鲜配送AI Agent原型
只需要Python和通义千问API即可运行
"""

import json
import httpx
import asyncio
from typing import Dict, Any, List
import logging

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SimpleFreshAI:
    """简单的生鲜配送AI助手"""
    
    def __init__(self, api_key: str):
        """
        初始化AI助手
        
        Args:
            api_key: 通义千问API Key
        """
        self.api_key = api_key
        self.api_url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation"
        
        # 系统提示词
        self.system_prompt = """你是一个生鲜配送系统的AI助手，专门帮助客户下单。
        
你的任务是：
1. 理解客户的下单需求
2. 提取订单信息（商品、数量、配送时间、地址等）
3. 以JSON格式返回结构化数据

请严格按照以下JSON格式返回：
{
    "intent": "create_order",  # 意图：create_order, query_order, other
    "products": [
        {
            "name": "商品名称",
            "quantity": 数量,
            "unit": "单位"
        }
    ],
    "delivery_time": "配送时间",
    "delivery_address": "配送地址",
    "customer_name": "客户姓名",
    "customer_phone": "客户电话",
    "special_requirements": "特殊要求"
}

如果信息不完整，请尽量询问或合理推断。
"""
    
    async def process_message(self, user_message: str) -> Dict[str, Any]:
        """
        处理用户消息
        
        Args:
            user_message: 用户输入的消息
            
        Returns:
            处理结果，包含AI回复和结构化数据
        """
        logger.info(f"处理用户消息: {user_message}")
        
        try:
            # 调用通义千问API
            response = await self._call_qwen_api(user_message)
            
            # 解析响应
            ai_response = response.get("output", {}).get("text", "")
            
            # 尝试提取JSON
            structured_data = self._extract_json_from_response(ai_response)
            
            return {
                "success": True,
                "ai_response": ai_response,
                "structured_data": structured_data,
                "raw_response": response
            }
            
        except Exception as e:
            logger.error(f"处理消息失败: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "ai_response": "抱歉，处理您的消息时出现了问题。",
                "structured_data": {}
            }
    
    async def _call_qwen_api(self, user_message: str) -> Dict[str, Any]:
        """
        调用通义千问API
        
        Args:
            user_message: 用户消息
            
        Returns:
            API响应
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": "qwen-max",  # 可以使用 qwen-plus 降低成本
            "input": {
                "messages": [
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": user_message}
                ]
            },
            "parameters": {
                "result_format": "message",  # 返回消息格式
                "temperature": 0.1,  # 低温度，确保稳定
                "max_tokens": 1000
            }
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                self.api_url,
                headers=headers,
                json=payload
            )
            
            if response.status_code != 200:
                raise Exception(f"API调用失败: {response.status_code} - {response.text}")
            
            return response.json()
    
    def _extract_json_from_response(self, response_text: str) -> Dict[str, Any]:
        """
        从AI响应中提取JSON
        
        Args:
            response_text: AI响应文本
            
        Returns:
            提取的JSON数据
        """
        try:
            # 查找JSON部分
            start = response_text.find('{')
            end = response_text.rfind('}')
            
            if start != -1 and end != -1 and end > start:
                json_str = response_text[start:end+1]
                data = json.loads(json_str)
                
                # 验证必要字段
                if "intent" not in data:
                    data["intent"] = "create_order"  # 默认创建订单
                
                if "products" not in data:
                    data["products"] = []
                
                return data
                
        except json.JSONDecodeError as e:
            logger.warning(f"JSON解析失败: {e}")
        
        # 如果提取失败，返回默认结构
        return {
            "intent": "create_order",
            "products": [],
            "delivery_time": "",
            "delivery_address": "",
            "customer_name": "",
            "customer_phone": "",
            "special_requirements": ""
        }
    
    def create_order_from_data(self, structured_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        根据结构化数据创建订单（模拟）
        
        Args:
            structured_data: 结构化订单数据
            
        Returns:
            订单创建结果
        """
        try:
            # 这里应该调用您现有的订单创建API
            # 以下为模拟代码
            
            # 验证必要数据
            if not structured_data.get("products"):
                return {
                    "success": False,
                    "error": "没有商品信息",
                    "order_id": None
                }
            
            # 模拟订单创建
            import uuid
            order_id = str(uuid.uuid4())[:8]
            
            logger.info(f"创建订单成功: {order_id}")
            logger.info(f"订单详情: {json.dumps(structured_data, ensure_ascii=False, indent=2)}")
            
            return {
                "success": True,
                "order_id": order_id,
                "message": f"订单创建成功！订单号: {order_id}",
                "data": structured_data
            }
            
        except Exception as e:
            logger.error(f"创建订单失败: {e}")
            return {
                "success": False,
                "error": str(e),
                "order_id": None
            }


class OrderAPIAdapter:
    """订单API适配器（需要根据您的实际API修改）"""
    
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url
        self.api_key = api_key
    
    async def create_order(self, order_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        调用实际订单创建API
        
        Args:
            order_data: 订单数据
            
        Returns:
            API响应
        """
        # 这里需要根据您的实际API修改
        # 示例代码：
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/orders",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json=order_data
            )
            return response.json()
        """
        
        # 暂时返回模拟数据
        return {
            "success": True,
            "order_id": "TEST123",
            "message": "订单创建成功"
        }


async def main():
    """主函数 - 测试AI助手"""
    
    # 请替换为您的通义千问API Key
    API_KEY = "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"  # 替换为您的API Key
    
    if API_KEY.startswith("sk-xxxxxxxx"):
        print("请先设置您的通义千问API Key")
        print("获取地址: https://dashscope.aliyuncs.com")
        return
    
    # 创建AI助手实例
    ai_assistant = SimpleFreshAI(api_key=API_KEY)
    
    # 测试用例
    test_messages = [
        "我要订10斤苹果，5斤香蕉，明天上午9点送到XX小区",
        "苹果多少钱一斤？",
        "查一下我的订单状态",
        "我要买3箱牛奶，2斤鸡蛋，下午3点送到公司"
    ]
    
    print("=== 生鲜配送AI助手测试 ===\n")
    
    for i, message in enumerate(test_messages, 1):
        print(f"测试 {i}: {message}")
        print("-" * 50)
        
        # 处理消息
        result = await ai_assistant.process_message(message)
        
        if result["success"]:
            print(f"AI回复: {result['ai_response']}")
            print(f"结构化数据: {json.dumps(result['structured_data'], ensure_ascii=False, indent=2)}")
            
            # 如果是创建订单意图，尝试创建订单
            if result["structured_data"].get("intent") == "create_order":
                order_result = ai_assistant.create_order_from_data(result["structured_data"])
                print(f"订单创建结果: {order_result}")
        else:
            print(f"处理失败: {result['error']}")
        
        print("\n")


async def interactive_chat():
    """交互式聊天测试"""
    
    # 请替换为您的通义千问API Key
    API_KEY = "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"  # 替换为您的API Key
    
    if API_KEY.startswith("sk-xxxxxxxx"):
        print("请先设置您的通义千问API Key")
        print("获取地址: https://dashscope.aliyuncs.com")
        return
    
    # 创建AI助手实例
    ai_assistant = SimpleFreshAI(api_key=API_KEY)
    
    print("=== 生鲜配送AI助手交互测试 ===")
    print("输入 '退出' 或 'quit' 结束对话")
    print("=" * 50)
    
    while True:
        try:
            # 获取用户输入
            user_input = input("\n您: ").strip()
            
            if user_input.lower() in ["退出", "quit", "exit"]:
                print("再见！")
                break
            
            if not user_input:
                continue
            
            # 处理消息
            print("AI正在处理...")
            result = await ai_assistant.process_message(user_input)
            
            if result["success"]:
                print(f"\nAI: {result['ai_response']}")
                
                # 显示结构化数据
                data = result["structured_data"]
                if data.get("intent") == "create_order" and data.get("products"):
                    print("\n[解析出的订单信息]")
                    for product in data["products"]:
                        print(f"  • {product.get('name')} {product.get('quantity')}{product.get('unit', '')}")
                    
                    if data.get("delivery_time"):
                        print(f"  配送时间: {data['delivery_time']}")
                    
                    if data.get("delivery_address"):
                        print(f"  配送地址: {data['delivery_address']}")
                    
                    # 询问是否创建订单
                    confirm = input("\n是否创建订单？(y/n): ").strip().lower()
                    if confirm == 'y':
                        order_result = ai_assistant.create_order_from_data(data)
                        print(f"\n订单创建结果: {order_result.get('message', '创建成功')}")
            else:
                print(f"\nAI: {result.get('ai_response', '抱歉，出错了')}")
                
        except KeyboardInterrupt:
            print("\n\n对话结束")
            break
        except Exception as e:
            print(f"\n错误: {e}")


if __name__ == "__main__":
    # 运行测试
    # asyncio.run(main())
    
    # 运行交互式聊天
    asyncio.run(interactive_chat())