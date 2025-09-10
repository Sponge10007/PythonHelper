import sqlite3
import logging
from flask import g, current_app

logger = logging.getLogger(__name__)


def get_db():
    """获取数据库连接"""
    if 'db' not in g:
        g.db = sqlite3.connect(
            current_app.config['MISTAKES_DB_FILE'],
            detect_types=sqlite3.PARSE_DECLTYPES
        )
        g.db.row_factory = sqlite3.Row
    return g.db


def close_db(e=None):
    """关闭数据库连接"""
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_mistakes_db():
    """初始化错题和PPT数据库表"""
    try:
        conn = sqlite3.connect(current_app.config['MISTAKES_DB_FILE'])
        cursor = conn.cursor()

        # 错题表
        cursor.execute('''
                       CREATE TABLE IF NOT EXISTS mistakes
                       (
                           id
                           INTEGER
                           PRIMARY
                           KEY,
                           title
                           TEXT
                           NOT
                           NULL,
                           messages
                           TEXT
                           NOT
                           NULL,
                           tags
                           TEXT,
                           category
                           TEXT,
                           difficulty
                           TEXT,
                           date
                           TEXT,
                           ai_summary
                           TEXT
                       )
                       ''')

        # PPT文件表
        cursor.execute('''
                       CREATE TABLE IF NOT EXISTS ppt_files
                       (
                           id
                           INTEGER
                           PRIMARY
                           KEY,
                           filename
                           TEXT
                           NOT
                           NULL,
                           original_name
                           TEXT
                           NOT
                           NULL,
                           file_path
                           TEXT
                           NOT
                           NULL,
                           file_size
                           INTEGER
                           NOT
                           NULL,
                           file_type
                           TEXT
                           NOT
                           NULL,
                           upload_date
                           TEXT
                           NOT
                           NULL,
                           slides_count
                           INTEGER
                           DEFAULT
                           0,
                           description
                           TEXT,
                           tags
                           TEXT
                       )
                       ''')

        conn.commit()
        conn.close()
        logger.info("数据库初始化完成")
    except Exception as e:
        logger.error(f"数据库初始化失败: {e}")