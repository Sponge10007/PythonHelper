from datetime import timedelta
import os
import secrets

class Config:
    """应用配置文件"""
    # 数据库文件
    MISTAKES_DB_FILE = os.environ.get('DATABASE_PATH', 'mistakes.db')

    # PPT文件存储目录
    PPT_UPLOAD_FOLDER = os.environ.get('PPT_UPLOAD_FOLDER', os.path.join(os.getcwd(), 'ppt_files'))

    # 允许上传的文件类型
    ALLOWED_EXTENSIONS = {'ppt', 'pptx', 'doc', 'docx', 'pdf'}

    # 题库数据文件路径
    QUESTIONS_DB_PATH_NEW = 'database.json'
    QUESTIONS_DB_PATH_OLD = os.path.join('..', 'PythonHelperFrontEnd', 'data', 'questions.json')

    # 文件上传限制
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', 100 * 1024 * 1024))

    # 阿里云 DirectMail SMTP 配置
    SMTP_HOST = os.environ.get('SMTP_HOST', 'smtpdm.aliyun.com')
    SMTP_PORT = int(os.environ.get('SMTP_PORT', 465))  # 推荐 SSL 465
    SMTP_USER = os.environ.get('SMTP_USER', '')
    SMTP_PASS = os.environ.get('SMTP_PASS', '')
    SMTP_FROM_NAME = os.environ.get('SMTP_FROM_NAME', 'Python Helper')

    # AI 配置：只从环境变量读取，禁止在代码中写密钥
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

    # 会话密钥：优先读环境变量；未配置时自动生成随机密钥
    SECRET_KEY = os.environ.get('SECRET_KEY') or secrets.token_hex(32)

    # Session配置
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SECURE = os.environ.get('SESSION_COOKIE_SECURE', 'false').lower() == 'true'
    SESSION_COOKIE_SAMESITE = 'None' if SESSION_COOKIE_SECURE else 'Lax'
    SESSION_COOKIE_DOMAIN = None
    SESSION_COOKIE_PATH = '/'
    SESSION_PERMANENT = True
    PERMANENT_SESSION_LIFETIME = timedelta(days=30)
