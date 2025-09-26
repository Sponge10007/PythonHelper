import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Optional

# 全局数据库实例
_db_instance = None

def get_db():
    """获取数据库连接（兼容原有代码）"""
    global _db_instance
    if _db_instance is None:
        _db_instance = Database()
    conn = _db_instance.get_connection()
    # 设置行工厂，使查询结果可以用列名访问
    conn.row_factory = sqlite3.Row
    return conn

def init_mistakes_db():
    """初始化数据库（兼容原有代码）"""
    global _db_instance
    if _db_instance is None:
        _db_instance = Database()
    return _db_instance

class Database:
    def __init__(self, db_path: str = "mistakes.db"):
        self.db_path = db_path
        self.init_database()

    def init_database(self):
        """初始化数据库表结构"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # 创建错题表（兼容原有结构）
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS mistakes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                messages TEXT NOT NULL,
                tags TEXT,
                category TEXT,
                difficulty TEXT,
                date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ai_summary TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # 创建标签表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                category TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # 创建错题标签关联表
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS mistake_tags (
                mistake_id INTEGER,
                tag_id INTEGER,
                PRIMARY KEY (mistake_id, tag_id),
                FOREIGN KEY (mistake_id) REFERENCES mistakes (id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
            )
        ''')
        
        # 创建PPT文件表（兼容原有结构）
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS ppt_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                original_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER,
                file_type TEXT,
                upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                slides_count INTEGER,
                description TEXT,
                tags TEXT
            )
        ''')
        
        conn.commit()
        conn.close()
        
        # 初始化默认标签
        self.init_default_tags()

    def init_default_tags(self):
        """初始化默认标签"""
        default_tags = [
            # 课程标签
            ('数据类型及表达式', 'course'),
            ('复合数据类型', 'course'),
            ('面向对象', 'course'),
            ('函数', 'course'),
            ('流程控制', 'course'),
            ('文件概述', 'course'),
            ('异常处理', 'course'),
            
            # 知识点标签
            ('变量', 'knowledge'),
            ('循环', 'knowledge'),
            ('条件语句', 'knowledge'),
            ('列表', 'knowledge'),
            ('字典', 'knowledge'),
            ('字符串', 'knowledge'),
            ('文件操作', 'knowledge'),
            ('类', 'knowledge'),
            ('继承', 'knowledge'),
            
            # 难度标签
            ('简单', 'difficulty'),
            ('中等', 'difficulty'),
            ('困难', 'difficulty'),
            ('基础', 'difficulty'),
            ('进阶', 'difficulty'),
            ('高级', 'difficulty')
        ]
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        for name, category in default_tags:
            cursor.execute('''
                INSERT OR IGNORE INTO tags (name, category) 
                VALUES (?, ?)
            ''', (name, category))
        
        conn.commit()
        conn.close()

    def get_connection(self):
        """获取数据库连接"""
        return sqlite3.connect(self.db_path)

    def execute_query(self, query: str, params: tuple = ()):
        """执行查询并返回结果"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(query, params)
        result = cursor.fetchall()
        conn.close()
        return result

    def execute_update(self, query: str, params: tuple = ()):
        """执行更新操作"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(query, params)
        conn.commit()
        conn.close()

    def get_all_tags(self) -> List[Dict]:
        """获取所有标签"""
        query = "SELECT id, name, category FROM tags ORDER BY category, name"
        results = self.execute_query(query)
        return [{'id': row[0], 'name': row[1], 'category': row[2]} for row in results]

    def get_tags_by_category(self, category: str) -> List[Dict]:
        """根据类别获取标签"""
        query = "SELECT id, name FROM tags WHERE category = ? ORDER BY name"
        results = self.execute_query(query, (category,))
        return [{'id': row[0], 'name': row[1]} for row in results]

    def add_tag(self, name: str, category: str) -> int:
        """添加新标签"""
        query = "INSERT INTO tags (name, category) VALUES (?, ?)"
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute(query, (name, category))
        tag_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return tag_id

    def delete_tag(self, tag_id: int):
        """删除标签"""
        query = "DELETE FROM tags WHERE id = ?"
        self.execute_update(query, (tag_id,))

    def update_tag(self, tag_id: int, name: str, category: str):
        """更新标签"""
        query = "UPDATE tags SET name = ?, category = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        self.execute_update(query, (name, category, tag_id))

    def get_mistake_tags(self, mistake_id: int) -> List[Dict]:
        """获取错题的所有标签"""
        query = '''
            SELECT t.id, t.name, t.category 
            FROM tags t 
            JOIN mistake_tags mt ON t.id = mt.tag_id 
            WHERE mt.mistake_id = ?
            ORDER BY t.category, t.name
        '''
        results = self.execute_query(query, (mistake_id,))
        return [{'id': row[0], 'name': row[1], 'category': row[2]} for row in results]

    def set_mistake_tags(self, mistake_id: int, tag_ids: List[int]):
        """设置错题的标签"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # 删除现有关联
        cursor.execute("DELETE FROM mistake_tags WHERE mistake_id = ?", (mistake_id,))
        
        # 添加新关联
        for tag_id in tag_ids:
            cursor.execute("INSERT INTO mistake_tags (mistake_id, tag_id) VALUES (?, ?)", (mistake_id, tag_id))
        
        conn.commit()
        conn.close()

    def get_mistakes_with_tags(self) -> List[Dict]:
        """获取所有错题及其标签"""
        query = '''
            SELECT m.id, m.title, m.messages, m.created_at, m.updated_at,
                   GROUP_CONCAT(t.name) as tag_names,
                   GROUP_CONCAT(t.category) as tag_categories
            FROM mistakes m
            LEFT JOIN mistake_tags mt ON m.id = mt.mistake_id
            LEFT JOIN tags t ON mt.tag_id = t.id
            GROUP BY m.id
            ORDER BY m.updated_at DESC
        '''
        results = self.execute_query(query)
        
        mistakes = []
        for row in results:
            mistake = {
                'id': row[0],
                'title': row[1],
                'messages': json.loads(row[2]) if row[2] else [],
                'created_at': row[3],
                'updated_at': row[4],
                'tags': []
            }
            
            if row[5]:  # tag_names
                tag_names = row[5].split(',')
                tag_categories = row[6].split(',')
                mistake['tags'] = tag_names
            
            mistakes.append(mistake)
        
        return mistakes

    def add_mistake(self, title: str, messages: List[Dict], tag_ids: List[int] = None) -> int:
        """添加错题"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            "INSERT INTO mistakes (title, messages) VALUES (?, ?)",
            (title, json.dumps(messages))
        )
        mistake_id = cursor.lastrowid
        
        if tag_ids:
            for tag_id in tag_ids:
                cursor.execute(
                    "INSERT INTO mistake_tags (mistake_id, tag_id) VALUES (?, ?)",
                    (mistake_id, tag_id)
                )
        
        conn.commit()
        conn.close()
        return mistake_id

    def update_mistake(self, mistake_id: int, title: str, messages: List[Dict], tag_ids: List[int] = None):
        """更新错题"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            "UPDATE mistakes SET title = ?, messages = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (title, json.dumps(messages), mistake_id)
        )
        
        if tag_ids is not None:
            # 删除现有标签关联
            cursor.execute("DELETE FROM mistake_tags WHERE mistake_id = ?", (mistake_id,))
            
            # 添加新标签关联
            for tag_id in tag_ids:
                cursor.execute(
                    "INSERT INTO mistake_tags (mistake_id, tag_id) VALUES (?, ?)",
                    (mistake_id, tag_id)
                )
        
        conn.commit()
        conn.close()

    def delete_mistake(self, mistake_id: int):
        """删除错题"""
        query = "DELETE FROM mistakes WHERE id = ?"
        self.execute_update(query, (mistake_id,))