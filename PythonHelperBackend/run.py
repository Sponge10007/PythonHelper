import logging
from app import create_app
from app.database import init_mistakes_db

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 创建 Flask 应用实例
app = create_app()

if __name__ == '__main__':
    # 在应用启动前，确保数据库和表已创建
    with app.app_context():
        init_mistakes_db()
        logger.info("数据库初始化完成")

    logger.info("启动Python教学助手后端服务...")

    logger.info("服务包含：题库搜索、AI聊天、错题管理、PPT文件管理、标签管理功能")
    app.run(host='0.0.0.0', port=5000, debug=True)