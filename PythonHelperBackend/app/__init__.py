from flask import Flask
from flask_cors import CORS
import os
import logging
from config import Config
from .database import close_db
from .services.question_service import QuestionService

def create_app(config_class=Config):
    """创建并配置 Flask 应用实例"""
    app = Flask(__name__)
    app.config.from_object(config_class)
    app.teardown_appcontext(close_db)

    # 初始化 CORS - 只允许配置过的来源，禁止 "*" + credentials
    cors_origins = [
        origin.strip()
        for origin in os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',')
        if origin.strip()
    ]
    if not cors_origins:
        cors_origins = [
            r"http://localhost:\d+",
            r"http://127\.0\.0\.1:\d+",
            r"chrome-extension://[a-z]+",
            r"moz-extension://[a-f0-9\-]+",
        ]
    CORS(app, origins=cors_origins, supports_credentials=True)

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
    from .routes.tag_routes import tag_routes

    app.register_blueprint(main_bp)
    app.register_blueprint(mistakes_bp, url_prefix='/mistakes')
    app.register_blueprint(ppt_bp, url_prefix='/ppt')
    app.register_blueprint(pta_bp, url_prefix='/pta')
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(tag_routes)

    return app