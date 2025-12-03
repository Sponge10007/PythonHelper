from datetime import timedelta
import os

class Config:
    """应用配置文件"""
    # 数据库文件
    MISTAKES_DB_FILE = 'mistakes.db'

    # PPT文件存储目录
    PPT_UPLOAD_FOLDER = os.environ.get('PPT_UPLOAD_FOLDER', os.path.join(os.getcwd(), 'ppt_files'))

    # 允许上传的文件类型
    ALLOWED_EXTENSIONS = {'ppt', 'pptx', 'doc', 'docx', 'pdf'}

    # 题库数据文件路径
    QUESTIONS_DB_PATH_NEW = 'database.json'
    QUESTIONS_DB_PATH_OLD = os.path.join('..', 'PythonHelperFrontEnd', 'data', 'questions.json')

    # 阿里云 DirectMail SMTP 配置
    SMTP_HOST = os.environ.get('SMTP_HOST', 'smtpdm.aliyun.com')
    SMTP_PORT = int(os.environ.get('SMTP_PORT', 465))  # 推荐 SSL 465
    SMTP_USER = os.environ.get('SMTP_USER', 'py@pythonassistant.cn')
    SMTP_PASS = os.environ.get('SMTP_PASS', 'pythonTA123456')
    SMTP_FROM_NAME = os.environ.get('SMTP_FROM_NAME', 'Python Helper')


    # 会话密钥
    SECRET_KEY = os.environ.get('SECRET_KEY', 'python-helper-secret-key-2025')
    
    # Session配置
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SECURE = True  # 开发环境使用HTTP
    SESSION_COOKIE_SAMESITE = 'None'
    SESSION_COOKIE_DOMAIN = None  # 允许localhost
    SESSION_COOKIE_PATH = '/'
    SESSION_PERMANENT = True
    PERMANENT_SESSION_LIFETIME = timedelta(days=30)
