#!/usr/bin/env python3
"""
生产环境启动文件
"""

import os
import sys
from config_production import get_config

# 添加应用目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app

# 获取配置
config_class = get_config()

# 创建应用
app = create_app(config_class)

if __name__ == '__main__':
    # 从配置获取主机和端口
    host = getattr(config_class, 'HOST', '0.0.0.0')
    port = getattr(config_class, 'PORT', 8000)
    debug = getattr(config_class, 'DEBUG', False)
    
    print(f"启动服务器: http://{host}:{port}")
    print(f"调试模式: {debug}")
    print(f"环境: {os.environ.get('FLASK_ENV', 'development')}")
    
    app.run(
        host=host,
        port=port,
        debug=debug,
        threaded=True
    )