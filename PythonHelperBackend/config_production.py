import os
import secrets
from datetime import timedelta

class ProductionConfig:
    """生产环境配置"""
    DEBUG = False
    HOST = '0.0.0.0'
    PORT = 5000

    # 数据库文件
    MISTAKES_DB_FILE = os.environ.get('DATABASE_PATH', 'mistakes.db')

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
    SMTP_USER = os.environ.get('SMTP_USER', '')
    SMTP_PASS = os.environ.get('SMTP_PASS', '')
    SMTP_FROM_NAME = os.environ.get('SMTP_FROM_NAME', 'Python Helper')

    # AI 配置：只从环境变量读取
    AI_API_KEY = os.environ.get('AI_API_KEY', '')
    AI_API_ENDPOINT = os.environ.get(
        'AI_API_ENDPOINT',
        'https://api.deepseek.com/v1/chat/completions'
    )
    AI_ALLOWED_HOSTS = [
        host.strip().lower()
        for host in os.environ.get(
            'AI_ALLOWED_HOSTS',
            'api.deepseek.com,api.openai.com'
        ).split(',')
        if host.strip()
    ]

    # Flask 会话密钥：未配置时自动生成随机密钥
    SECRET_KEY = os.environ.get('SECRET_KEY') or secrets.token_hex(32)

    # Session 配置
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SECURE = os.environ.get('SESSION_COOKIE_SECURE', 'true').lower() == 'true'
    SESSION_COOKIE_SAMESITE = 'None' if SESSION_COOKIE_SECURE else 'Lax'
    SESSION_COOKIE_DOMAIN = None
    SESSION_COOKIE_PATH = '/'
    SESSION_PERMANENT = True
    PERMANENT_SESSION_LIFETIME = timedelta(days=30)

    # 日志配置
    LOG_LEVEL = 'INFO'
    LOG_FILE = '/var/log/pythonhelper/app.log'


class DevelopmentConfig:
    """开发环境配置"""
    DEBUG = True
    HOST = 'localhost'
    PORT = 5000

    MISTAKES_DB_FILE = os.environ.get('DATABASE_PATH', 'mistakes.db')
    PPT_UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ppt_files')
    ALLOWED_EXTENSIONS = {'ppt', 'pptx', 'doc', 'docx', 'pdf'}
    QUESTIONS_DB_PATH_NEW = 'database.json'

    SERVER_DOMAIN = 'localhost:5000'
    SERVER_URL = 'http://localhost:5000'

    MAX_CONTENT_LENGTH = 100 * 1024 * 1024
    LOG_LEVEL = 'DEBUG'

    SMTP_HOST = os.environ.get('SMTP_HOST', 'smtpdm.aliyun.com')
    SMTP_PORT = int(os.environ.get('SMTP_PORT', 465))
    SMTP_USER = os.environ.get('SMTP_USER', '')
    SMTP_PASS = os.environ.get('SMTP_PASS', '')
    SMTP_FROM_NAME = os.environ.get('SMTP_FROM_NAME', 'Python Helper')

    AI_API_KEY = os.environ.get('AI_API_KEY', '')
    AI_API_ENDPOINT = os.environ.get('AI_API_ENDPOINT', 'https://api.deepseek.com/v1/chat/completions')
    AI_ALLOWED_HOSTS = [
        host.strip().lower()
        for host in os.environ.get('AI_ALLOWED_HOSTS', 'api.deepseek.com,api.openai.com').split(',')
        if host.strip()
    ]

    SECRET_KEY = os.environ.get('SECRET_KEY') or secrets.token_hex(32)
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SECURE = os.environ.get('SESSION_COOKIE_SECURE', 'false').lower() == 'true'
    SESSION_COOKIE_SAMESITE = 'None' if SESSION_COOKIE_SECURE else 'Lax'
    SESSION_PERMANENT = True
    PERMANENT_SESSION_LIFETIME = timedelta(days=30)


config_map = {
    'development': DevelopmentConfig,
    'production': ProductionConfig
}

def get_config():
    env = os.environ.get('FLASK_ENV', 'development')
    return config_map.get(env, DevelopmentConfig)
