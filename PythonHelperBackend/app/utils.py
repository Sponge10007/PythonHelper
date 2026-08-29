import os
import json
import logging
from datetime import datetime
from functools import wraps
from urllib.parse import urlparse

from flask import current_app, jsonify, session

logger = logging.getLogger(__name__)


def login_required(fn):
    """要求登录的 API 装饰器。"""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get('user_id'):
            return jsonify({'error': '未登录'}), 401
        return fn(*args, **kwargs)
    return wrapper


def validate_ai_endpoint(endpoint, allowed_hosts):
    """校验 AI API 地址，仅允许 HTTPS 白名单域名，防止 SSRF。"""
    if not endpoint or not isinstance(endpoint, str):
        raise ValueError('AI endpoint 不能为空')

    parsed = urlparse(endpoint)
    if parsed.scheme != 'https':
        raise ValueError('AI endpoint 必须使用 HTTPS')
    if parsed.username or parsed.password:
        raise ValueError('AI endpoint 不能包含用户名或密码')
    if not parsed.hostname:
        raise ValueError('AI endpoint 缺少有效主机名')
    if parsed.hostname.lower() not in {host.lower() for host in allowed_hosts}:
        raise ValueError('AI endpoint 不在允许的域名白名单中')
    if parsed.port not in (None, 443):
        raise ValueError('AI endpoint 仅允许默认 HTTPS 端口')

    return endpoint


def allowed_file(filename):
    """检查文件类型是否允许"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in current_app.config['ALLOWED_EXTENSIONS']


def validate_uploaded_file_content(file_path, file_type):
    """校验文件头是否与扩展名匹配，避免把HTML等伪装成课件上传。"""
    file_type = (file_type or '').lower()
    try:
        with open(file_path, 'rb') as f:
            head = f.read(8)
    except OSError:
        return False

    if file_type == 'pdf':
        return head.startswith(b'%PDF')
    if file_type in ('pptx', 'docx'):
        return head.startswith(b'PK')
    if file_type in ('ppt', 'doc'):
        return head.startswith(b'\xd0\xcf\x11\xe0')
    return True

def get_file_info(file_path):
    """获取文件信息"""
    try:
        stat = os.stat(file_path)
        return {
            'size': stat.st_size,
            'modified': datetime.fromtimestamp(stat.st_mtime).isoformat()
        }
    except Exception as e:
        logger.error(f"获取文件信息失败: {e}")
        return {'size': 0, 'modified': datetime.now().isoformat()}

def estimate_slides_count(file_path, file_type):
    """估算PPT或PDF页数"""
    try:
        file_size = os.path.getsize(file_path)
        if file_type == 'pdf':
            return max(1, file_size // 80000)  # 每50KB约1页
        else:
            return max(1, file_size // 100000) # 每100KB约1页
    except Exception as e:
        logger.error(f"估算页数失败: {e}")
        return 1

def parse_json_field(data, default_value):
    """安全地解析JSON字符串"""
    if not data:
        return default_value
    try:
        return json.loads(data)
    except json.JSONDecodeError:
        logger.warning(f"JSON解析失败，返回默认值。数据: '{data}'")
        return default_value