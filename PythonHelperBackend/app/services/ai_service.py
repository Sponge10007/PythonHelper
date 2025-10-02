import requests
import logging
import markdown
from typing import Dict, List

logger = logging.getLogger(__name__)

# d3f4ebk44jevfv89d6e0 浙大智能体密钥
def convert_markdown_to_html(markdown_text: str) -> str:
    """将markdown文本转换为HTML"""
    try:
        # 使用markdown库转换，启用常用扩展
        html = markdown.markdown(
            markdown_text,
            extensions=[
                'markdown.extensions.tables',  # 表格支持
                'markdown.extensions.fenced_code',  # 代码块支持
                'markdown.extensions.codehilite',  # 代码高亮
                'markdown.extensions.toc',  # 目录支持
                'markdown.extensions.nl2br',  # 换行支持
            ]
        )
        return html
    except Exception as e:
        logger.warning(f"Markdown转换失败，返回原始文本: {e}")
        return markdown_text


def call_ai_api_with_memory(messages: List[Dict], api_key: str, api_endpoint: str, system: str) -> str:
    """调用AI API - 支持持久记忆的完整对话历史"""
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

        # 构建完整的消息历史，包含系统提示词
        full_messages = [{'role': 'system', 'content': system}]
        
        # 添加对话历史，确保格式正确
        for msg in messages:
            if isinstance(msg, dict) and 'role' in msg and 'content' in msg:
                full_messages.append({
                    'role': msg['role'],
                    'content': msg['content']
                })

        data = {
            'model': model,
            'messages': full_messages,
            'max_tokens': 4096,
            'temperature': 0.7
        }

        logger.info(f"调用AI API (持久记忆): {api_endpoint} with model: {model}, messages count: {len(full_messages)}, timeout: 600s")
        response = requests.post(api_endpoint, headers=headers, json=data, timeout=600)

        response.raise_for_status()
        result = response.json()
        logger.info("AI API调用成功 (持久记忆)")
        
        # 获取AI回复内容
        ai_response = result['choices'][0]['message']['content']
        
        # 将markdown转换为HTML
        html_response = convert_markdown_to_html(ai_response)
        
        return html_response

    except requests.exceptions.RequestException as e:
        logger.error(f"AI API调用失败 (持久记忆): {e}")
        raise Exception(f"AI服务调用失败: {str(e)}")
    except (KeyError, IndexError) as e:
        logger.error(f"处理AI响应失败 (持久记忆): {e} - Response: {response.text}")
        raise Exception(f"处理AI响应失败，无效的响应格式")


def call_ai_api(message: str, api_key: str, api_endpoint: str, system: str) -> str:
    """调用AI API"""
    try:
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}'
        }

        if 'deepseek' in api_endpoint.lower():
            model = 'deepseek-reasoner'
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
        
        # 获取AI回复内容
        ai_response = result['choices'][0]['message']['content']
        
        # 将markdown转换为HTML
        html_response = convert_markdown_to_html(ai_response)
        
        return html_response

    except requests.exceptions.RequestException as e:
        logger.error(f"AI API调用失败: {e}")
        raise Exception(f"AI服务调用失败: {str(e)}")
    except (KeyError, IndexError) as e:
        logger.error(f"处理AI响应失败: {e} - Response: {response.text}")
        raise Exception(f"处理AI响应失败，无效的响应格式")