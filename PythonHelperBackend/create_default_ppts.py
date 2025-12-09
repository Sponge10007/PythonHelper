#!/usr/bin/env python3
"""
使用现有PPT文件为所有用户创建默认PPT记录
"""

import sqlite3
import os
import sys
from datetime import datetime
import json


def get_db_connection():
    """获取数据库连接"""
    db_path = "mistakes.db"
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def get_all_users():
    """获取所有用户"""
    conn = get_db_connection()
    users = conn.execute("SELECT id, email FROM users").fetchall()
    conn.close()
    return users


def get_available_ppt_templates():
    """获取可用的PPT模板（没有用户ID的PPT文件）"""
    conn = get_db_connection()
    
    # 查找没有用户ID的PPT文件，这些可以作为模板
    templates = conn.execute('''
        SELECT id, filename, original_name, file_path, file_size, file_type,
               slides_count, description, tags
        FROM ppt_files
        WHERE user_id IS NULL AND file_path IS NOT NULL
    ''').fetchall()
    
    conn.close()
    return templates


def create_display_name_from_original(original_name):
    """从原始文件名创建显示名称"""
    # 移除文件扩展名
    name = original_name.rsplit('.', 1)[0] if '.' in original_name else original_name
    
    # 移除年份前缀（如2025）
    if name.startswith('2025'):
        name = name[4:]
    
    # 映射到标准显示名称
    name_mapping = {
        '函数': '函数',
        '文件概述': '文件概述', 
        '数据类型及表达式': '数据类型及表达式',
        '面向对象': '面向对象',
        '流程控制': '流程控制',
        '复合数据类型': '复合数据类型',
        '异常处理': '异常处理'
    }
    
    # 查找匹配的标准名称
    for key, value in name_mapping.items():
        if key in name:
            return value
    
    return name


def get_description_for_ppt(display_name):
    """根据显示名称获取描述"""
    descriptions = {
        '数据类型及表达式': 'Python基础：变量、数据类型、运算符',
        '流程控制': '条件语句、循环结构、分支结构',
        '函数': '函数定义、参数传递、返回值',
        '复合数据类型': '列表、元组、字典、集合',
        '面向对象': '类、对象、继承、多态',
        '文件概述': '文件读写、文件操作',
        '异常处理': 'try-except、异常类型、异常处理'
    }
    return descriptions.get(display_name, '')


def create_default_ppts_for_all_users():
    """为所有用户创建默认PPT记录"""
    
    print("开始为所有用户创建默认PPT...")
    
    # 获取所有用户
    users = get_all_users()
    if not users:
        print("未找到任何用户")
        return
    
    print(f"找到 {len(users)} 个用户:")
    for user in users:
        print(f"  - 用户ID {user['id']}: {user['email']}")
    
    # 获取可用的PPT模板
    templates = get_available_ppt_templates()
    if not templates:
        print("未找到可用的PPT模板")
        return
    
    print(f"\n找到 {len(templates)} 个PPT模板:")
    for template in templates:
        print(f"  - {template['original_name']}")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    success_count = 0
    
    for user in users:
        user_id = user['id']
        user_email = user['email']
        
        print(f"\n为用户 {user_id} ({user_email}) 创建默认PPT...")
        
        for template in templates:
            # 检查文件是否存在
            if not os.path.exists(template['file_path']):
                print(f"  - 跳过不存在的文件: {template['original_name']}")
                continue
            
            display_name = create_display_name_from_original(template['original_name'])
            description = get_description_for_ppt(display_name)
            
            # 检查是否已经存在该默认PPT
            existing = cursor.execute('''
                SELECT id FROM ppt_files
                WHERE user_id = ? AND original_name = ? AND is_default = 1
            ''', (user_id, display_name)).fetchone()
            
            if existing:
                print(f"  - 跳过已存在的默认PPT: {display_name}")
                continue
            
            # 插入默认PPT记录
            try:
                cursor.execute('''
                    INSERT INTO ppt_files (
                        filename, original_name, file_path, file_size, file_type,
                        upload_date, slides_count, description, tags,
                        user_id, is_default
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                ''', (
                    template['filename'],
                    display_name,  # 使用标准化的显示名称
                    template['file_path'],
                    template['file_size'],
                    template['file_type'],
                    datetime.now().isoformat(),
                    template['slides_count'] or 0,
                    description,
                    json.dumps([]),  # 空的标签数组
                    user_id
                ))
                
                print(f"  - 成功添加默认PPT: {display_name}")
                success_count += 1
                
            except Exception as e:
                print(f"  - 添加默认PPT失败: {display_name}, 错误: {e}")
    
    conn.commit()
    conn.close()
    
    print(f"\n创建完成！总共成功添加 {success_count} 个默认PPT记录")


def clean_invalid_default_ppts():
    """清理无效的默认PPT记录（文件不存在的）"""
    print("开始清理无效的默认PPT记录...")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 查找所有默认PPT记录
    default_ppts = cursor.execute('''
        SELECT id, filename, file_path, original_name, user_id
        FROM ppt_files
        WHERE is_default = 1
    ''').fetchall()
    
    deleted_count = 0
    
    for ppt in default_ppts:
        if not os.path.exists(ppt['file_path']):
            print(f"删除无效记录: ID={ppt['id']}, 文件={ppt['original_name']}, 用户={ppt['user_id']}")
            cursor.execute('DELETE FROM ppt_files WHERE id = ?', (ppt['id'],))
            deleted_count += 1
        else:
            print(f"保留有效记录: {ppt['original_name']} (用户 {ppt['user_id']})")
    
    conn.commit()
    conn.close()
    
    print(f"清理完成！删除了 {deleted_count} 个无效记录")


def show_current_status():
    """显示当前状态"""
    print("\n当前状态:")
    print("-" * 30)
    
    conn = get_db_connection()
    
    # 显示所有用户
    users = conn.execute("SELECT id, email FROM users").fetchall()
    print(f"用户总数: {len(users)}")
    
    # 显示每个用户的默认PPT数量
    for user in users:
        count = conn.execute('''
            SELECT COUNT(*) as count FROM ppt_files
            WHERE user_id = ? AND is_default = 1
        ''', (user['id'],)).fetchone()
        print(f"  - 用户 {user['id']} ({user['email']}): {count['count']} 个默认PPT")
    
    # 显示可用模板
    templates = conn.execute('''
        SELECT COUNT(*) as count FROM ppt_files
        WHERE user_id IS NULL
    ''').fetchone()
    print(f"可用PPT模板: {templates['count']} 个")
    
    conn.close()


def main():
    """主函数"""
    print("PPT默认文件初始化工具（基于现有文件）")
    print("=" * 50)
    
    # 显示当前状态
    show_current_status()
    
    # 先清理无效记录
    clean_invalid_default_ppts()
    
    # 为所有用户创建默认PPT
    create_default_ppts_for_all_users()
    
    # 再次显示状态
    show_current_status()
    
    print("\n所有操作完成！")


if __name__ == "__main__":
    main()
