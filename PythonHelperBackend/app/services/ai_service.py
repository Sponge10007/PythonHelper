import requests
import logging
import markdown
import json
from typing import Dict, List, Generator

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
        
        # # 将markdown转换为HTML
        # html_response = convert_markdown_to_html(ai_response)
        
        # return html_response
        return ai_response
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

        return ai_response
    except requests.exceptions.RequestException as e:
        logger.error(f"AI API调用失败: {e}")
        raise Exception(f"AI服务调用失败: {str(e)}")
    except (KeyError, IndexError) as e:
        logger.error(f"处理AI响应失败: {e} - Response: {response.text}")
        raise Exception(f"处理AI响应失败，无效的响应格式")


def call_ai_api_stream(messages: List[Dict], api_key: str, api_endpoint: str, system: str) -> Generator[Dict, None, None]:
    """调用AI API - 支持流式传输"""
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
            'temperature': 0.7,
            'stream': True  # 启用流式传输
        }

        logger.info(f"调用AI API (流式): {api_endpoint} with model: {model}, messages count: {len(full_messages)}, timeout: 600s")
        
        # 发送流式请求
        response = requests.post(api_endpoint, headers=headers, json=data, timeout=600, stream=True)
        response.raise_for_status()
        
        logger.info("AI API流式调用成功")
        # 处理流式响应
        for line in response.iter_lines():
            if line:
                line = line.decode('utf-8')
                if line.startswith('data: '):
                    data_str = line[6:]  # 移除 'data: ' 前缀
                    if data_str.strip() == '[DONE]':
                        # 流式传输结束
                        yield {'content': '', 'done': True}
                        break
                    try:
                        chunk_data = json.loads(data_str)
                        if 'choices' in chunk_data and len(chunk_data['choices']) > 0:
                            choice = chunk_data['choices'][0]
                            if 'delta' in choice and 'content' in choice['delta']:
                                content = choice['delta']['content']
                                yield {'content': content, 'done': False}
                            elif choice.get('finish_reason'):
                                # 传输完成
                                yield {'content': '', 'done': True}
                                break
                    except json.JSONDecodeError:
                        # 忽略无效的JSON数据
                        continue

    except requests.exceptions.RequestException as e:
        logger.error(f"AI API流式调用失败: {e}")
        yield {'content': f'AI服务调用失败: {str(e)}', 'done': True, 'error': True}
    except Exception as e:
        logger.error(f"处理AI流式响应失败: {e}")
        yield {'content': f'处理AI响应失败: {str(e)}', 'done': True, 'error': True}