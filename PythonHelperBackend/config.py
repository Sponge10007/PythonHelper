import os

class Config:
    """应用配置文件"""
    # 数据库文件
    MISTAKES_DB_FILE = 'mistakes.db'

    # PPT文件存储目录
    PPT_UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ppt_files')

    # 允许上传的文件类型
    ALLOWED_EXTENSIONS = {'ppt', 'pptx', 'doc', 'docx', 'pdf'}

    # 题库数据文件路径
    QUESTIONS_DB_PATH_NEW = 'database.json'
    QUESTIONS_DB_PATH_OLD = os.path.join('..', 'PythonHelperFrontEnd', 'data', 'questions.json')