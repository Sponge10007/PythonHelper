from flask import Flask
from flask_cors import CORS
import os
import logging
from config import Config
from .services.question_service import QuestionService

def create_app(config_class=Config):
    """创建并配置 Flask 应用实例"""
    app = Flask(__name__)
    app.config.from_object(config_class)

    # 初始化 CORS - 支持Chrome扩展和跨域访问
    CORS(app, origins=[
        "http://localhost:*",
        "http://127.0.0.1:*",
        "chrome-extension://*",
        "moz-extension://*",
        "*"  # 生产环境允许所有域名访问
    ], supports_credentials=True)

    # 确保 PPT 上传目录存在
    ppt_folder = app.config['PPT_UPLOAD_FOLDER']
    if not os.path.exists(ppt_folder):
        os.makedirs(ppt_folder)
        logging.info(f"创建PPT上传目录: {ppt_folder}")
    else:
        logging.info(f"PPT上传目录已存在: {ppt_folder}")

    # 在应用上下文中初始化服务
    with app.app_context():
        app.question_service = QuestionService()

    # 注册蓝图
    from .routes.main_routes import main_bp
    from .routes.mistakes_routes import mistakes_bp
    from .routes.ppt_routes import ppt_bp
    from .routes.pta_routes import pta_bp
    from .routes.auth_routes import auth_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(mistakes_bp, url_prefix='/mistakes')
    app.register_blueprint(ppt_bp, url_prefix='/ppt')
    app.register_blueprint(pta_bp, url_prefix='/pta')
    app.register_blueprint(auth_bp, url_prefix='/auth')

    return app