import sqlite3
import os

# 数据库文件名
MISTAKES_DB_FILE = 'mistakes.db'

def create_new_db():
    """
    创建一个全新的、空的 mistakes.db 数据库文件。
    如果文件已存在，它将被删除并重新创建。
    """
    # 如果旧的数据库文件存在，先删除它
    if os.path.exists(MISTAKES_DB_FILE):
        os.remove(MISTAKES_DB_FILE)
        print(f"已删除旧的数据库文件: {MISTAKES_DB_FILE}")

    try:
        # 连接数据库（如果文件不存在，会自动创建）
        conn = sqlite3.connect(MISTAKES_DB_FILE)
        cursor = conn.cursor()
        print("已成功连接到新的数据库。")

        # 创建错题表 (mistakes) - 使用新的“消息记录”结构
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS mistakes (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                messages TEXT NOT NULL,
                tags TEXT,
                category TEXT,
                difficulty TEXT,
                date TEXT,
                ai_summary TEXT
            )
        ''')
        print("已成功创建 'mistakes' 表。")

        # 创建PPT文件表 (ppt_files)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS ppt_files (
                id INTEGER PRIMARY KEY,
                filename TEXT NOT NULL,
                original_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                file_type TEXT NOT NULL,
                upload_date TEXT NOT NULL,
                slides_count INTEGER DEFAULT 0,
                description TEXT,
                tags TEXT
            )
        ''')
        print("已成功创建 'ppt_files' 表。")

        # 提交更改并关闭连接
        conn.commit()
        conn.close()
        print(f"数据库 '{MISTAKES_DB_FILE}' 已成功创建并初始化！")

    except Exception as e:
        print(f"创建数据库时发生错误: {e}")

if __name__ == '__main__':
    create_new_db()