"""
意图识别服务
功能：识别用户对话中的意图
"""

import json
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)


class IntentRecognitionService:
    def __init__(self, llm_client):
        """
        初始化意图识别服务
        
        Args:
            llm_client: LLM客户端实例
        """
        self.llm = llm_client
        self.intent_prompt = """
        你是一个生鲜配送系统的AI助手，请识别用户的意图。
        支持的意图包括：
        - create_order: 创建订单（用户要下单购买商品）
        - query_order: 查询订单（用户要查看订单状态）
        - modify_order: 修改订单（用户要修改已存在的订单）
        - cancel_order: 取消订单（用户要取消订单）
        - query_price: 查询价格（用户要查询商品价格）
        - query_inventory: 查询库存（用户要查询商品库存）
        - generate_report: 生成报表（用户要生成统计报表）
        - other: 其他意图（闲聊、咨询等）

        用户输入: {user_input}
        
        请以JSON格式返回，包含以下字段：
        - intent: 识别出的意图
        - confidence: 置信度（0-1之间的小数）
        - reason: 识别理由（简要说明为什么是这个意图）
        """

    async def recognize_intent(self, user_input: str) -> Dict[str, Any]:
        """
        识别用户意图
        
        Args:
            user_input: 用户输入文本
            
        Returns:
            Dict包含意图、置信度等信息
        """
        logger.info(f"开始识别意图，用户输入: {user_input}")
        
        prompt = self.intent_prompt.format(user_input=user_input)
        
        try:
            # 调用LLM进行意图识别
            response = await self.llm.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,  # 低温度，确保结果稳定
                max_tokens=100
            )
            
            # 解析LLM响应
            result_text = response.choices[0].message.content
            logger.debug(f"LLM原始响应: {result_text}")
            
            # 尝试解析JSON
            try:
                result = json.loads(result_text)
            except json.JSONDecodeError:
                logger.warning(f"LLM返回的不是有效JSON: {result_text}")
                # 尝试提取JSON部分
                result = self._extract_json_from_text(result_text)
            
            return {
                "intent": result.get("intent", "other"),
                "confidence": float(result.get("confidence", 0.0)),
                "reason": result.get("reason", ""),
                "raw_response": result_text
            }
            
        except Exception as e:
            logger.error(f"意图识别失败: {e}", exc_info=True)
            # 降级到规则匹配
            return self._fallback_intent_recognition(user_input)

    def _fallback_intent_recognition(self, user_input: str) -> Dict[str, Any]:
        """
        规则匹配降级方案
        
        Args:
            user_input: 用户输入文本
            
        Returns:
            降级识别结果
        """
        user_input_lower = user_input.lower()
        
        # 创建订单的关键词
        order_keywords = ["下单", "订购", "要买", "订", "购买", "买", "要", "需要"]
        if any(word in user_input_lower for word in order_keywords):
            return {
                "intent": "create_order",
                "confidence": 0.7,
                "reason": "检测到下单相关关键词",
                "raw_response": "规则匹配"
            }
        
        # 查询订单的关键词
        query_keywords = ["查询", "查看", "订单状态", "订单号", "查一下", "看看"]
        if any(word in user_input_lower for word in query_keywords):
            return {
                "intent": "query_order",
                "confidence": 0.7,
                "reason": "检测到查询相关关键词",
                "raw_response": "规则匹配"
            }
        
        # 修改订单的关键词
        modify_keywords = ["修改", "改一下", "调整", "更改", "变动"]
        if any(word in user_input_lower for word in modify_keywords):
            return {
                "intent": "modify_order",
                "confidence": 0.7,
                "reason": "检测到修改相关关键词",
                "raw_response": "规则匹配"
            }
        
        # 取消订单的关键词
        cancel_keywords = ["取消", "不要了", "退掉", "撤销"]
        if any(word in user_input_lower for word in cancel_keywords):
            return {
                "intent": "cancel_order",
                "confidence": 0.7,
                "reason": "检测到取消相关关键词",
                "raw_response": "规则匹配"
            }
        
        # 查询价格的关键词
        price_keywords = ["价格", "多少钱", "单价", "报价", "价"]
        if any(word in user_input_lower for word in price_keywords):
            return {
                "intent": "query_price",
                "confidence": 0.7,
                "reason": "检测到价格相关关键词",
                "raw_response": "规则匹配"
            }
        
        # 查询库存的关键词
        inventory_keywords = ["库存", "有没有货", "有货吗", "现货", "存货"]
        if any(word in user_input_lower for word in inventory_keywords):
            return {
                "intent": "query_inventory",
                "confidence": 0.7,
                "reason": "检测到库存相关关键词",
                "raw_response": "规则匹配"
            }
        
        # 生成报表的关键词
        report_keywords = ["报表", "统计", "数据", "报告", "汇总"]
        if any(word in user_input_lower for word in report_keywords):
            return {
                "intent": "generate_report",
                "confidence": 0.7,
                "reason": "检测到报表相关关键词",
                "raw_response": "规则匹配"
            }
        
        # 默认返回其他意图
        return {
            "intent": "other",
            "confidence": 0.5,
            "reason": "未识别到特定意图",
            "raw_response": "规则匹配"
        }

    def _extract_json_from_text(self, text: str) -> Dict[str, Any]:
        """
        从文本中提取JSON
        
        Args:
            text: 包含JSON的文本
            
        Returns:
            提取的JSON字典
        """
        try:
            # 查找第一个{和最后一个}
            start = text.find('{')
            end = text.rfind('}')
            
            if start != -1 and end != -1 and end > start:
                json_str = text[start:end+1]
                return json.loads(json_str)
        except Exception as e:
            logger.warning(f"提取JSON失败: {e}")
        
        # 如果提取失败，返回默认值
        return {"intent": "other", "confidence": 0.0, "reason": "JSON解析失败"}


# 测试代码
if __name__ == "__main__":
    # 模拟LLM客户端
    class MockLLMClient:
        async def chat_completion(self, messages, temperature, max_tokens):
            class Choice:
                class Message:
                    content = '{"intent": "create_order", "confidence": 0.95, "reason": "用户明确表示要下单"}'
                message = Message()
            class Response:
                choices = [Choice()]
            return Response()
    
    import asyncio
    
    async def test():
        llm = MockLLMClient()
        service = IntentRecognitionService(llm)
        
        test_inputs = [
            "我要订10斤苹果",
            "查一下我的订单",
            "苹果多少钱一斤？",
            "今天天气怎么样"
        ]
        
        for input_text in test_inputs:
            result = await service.recognize_intent(input_text)
            print(f"输入: {input_text}")
            print(f"结果: {result}")
            print()
    
    asyncio.run(test())