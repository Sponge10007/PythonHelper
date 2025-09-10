import requests
import logging
from typing import Dict

logger = logging.getLogger(__name__)


def call_ai_api(message: str, api_key: str, api_endpoint: str, system: str) -> str:
    """调用AI API"""
    try:
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}'
        }

        if 'deepseek' in api_endpoint.lower():
            model = 'deepseek-chat'
        else:
            # 默认使用兼容OpenAI的 gpt-3.5-turbo 模型
            model = 'gpt-3.5-turbo'

        data = {
            'model': model,
            'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': message}],
            'max_tokens': 4096,  # 增加最大token数以容纳更长的报告
            'temperature': 0.7
        }

        logger.info(f"调用AI API: {api_endpoint} with model: {model}, timeout: 600s")
        # --- 关键修改：将timeout延长至600秒 ---
        response = requests.post(api_endpoint, headers=headers, json=data, timeout=600)

        response.raise_for_status()  # 如果状态码不是 2xx，则抛出异常

        result = response.json()
        logger.info("AI API调用成功")
        return result['choices'][0]['message']['content']

    except requests.exceptions.RequestException as e:
        logger.error(f"AI API调用失败: {e}")
        raise Exception(f"AI服务调用失败: {str(e)}")
    except (KeyError, IndexError) as e:
        logger.error(f"处理AI响应失败: {e} - Response: {response.text}")
        raise Exception(f"处理AI响应失败，无效的响应格式")