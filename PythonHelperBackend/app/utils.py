import os
import json
import logging
from datetime import datetime
from flask import current_app

logger = logging.getLogger(__name__)

def allowed_file(filename):
    """检查文件类型是否允许"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in current_app.config['ALLOWED_EXTENSIONS']

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