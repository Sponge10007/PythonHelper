import os

class ProductionConfig:
    """生产环境配置"""
    DEBUG = False
    HOST = '0.0.0.0'
    PORT = 8000

    # 数据库文件
    MISTAKES_DB_FILE = 'mistakes.db'

    # PPT文件存储目录 - 生产环境使用绝对路径
    PPT_UPLOAD_FOLDER = os.environ.get('PPT_UPLOAD_FOLDER',
                                       '/var/www/pythonhelper/ppt_files')

    # 允许上传的文件类型
    ALLOWED_EXTENSIONS = {'ppt', 'pptx', 'doc', 'docx', 'pdf'}

    # 题库数据文件路径
    QUESTIONS_DB_PATH_NEW = 'database.json'

    # 服务器域名
    SERVER_DOMAIN = os.environ.get('SERVER_DOMAIN', 'your-domain.com')
    SERVER_URL = (
        f"https://{SERVER_DOMAIN}"
        if os.environ.get('USE_HTTPS', 'true').lower() == 'true'
        else f"http://{SERVER_DOMAIN}"
    )

    # 文件上传限制
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100MB

    # 静态文件目录
    STATIC_FOLDER = '/var/www/pythonhelper/static'

    # 阿里云 DirectMail SMTP 配置
    SMTP_HOST = os.environ.get('SMTP_HOST', 'smtpdm.aliyun.com')
    SMTP_PORT = int(os.environ.get('SMTP_PORT', 465))
    SMTP_USER = os.environ.get('SMTP_USER', 'py@pythonassistant.cn')
    SMTP_PASS = os.environ.get('SMTP_PASS')  # 必须设置在 .env 中
    SMTP_FROM_NAME = os.environ.get('SMTP_FROM_NAME', 'Python Helper')

    # Flask 会话密钥
    SECRET_KEY = os.environ.get('SECRET_KEY', 'python-helper-secret-key-2025')

    # 日志配置
    LOG_LEVEL = 'INFO'
    LOG_FILE = '/var/log/pythonhelper/app.log'


class DevelopmentConfig:
    """开发环境配置"""
    DEBUG = True
    HOST = 'localhost'
    PORT = 8000

    MISTAKES_DB_FILE = 'mistakes.db'
    PPT_UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ppt_files')
    ALLOWED_EXTENSIONS = {'ppt', 'pptx', 'doc', 'docx', 'pdf'}
    QUESTIONS_DB_PATH_NEW = 'database.json'

    SERVER_DOMAIN = 'localhost:8000'
    SERVER_URL = 'http://localhost:8000'

    MAX_CONTENT_LENGTH = 100 * 1024 * 1024
    LOG_LEVEL = 'DEBUG'


config_map = {
    'development': DevelopmentConfig,
    'production': ProductionConfig
}

def get_config():
    env = os.environ.get('FLASK_ENV', 'development')
    return config_map.get(env, DevelopmentConfig)
