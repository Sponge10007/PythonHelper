from flask import Blueprint, jsonify, request
from app.database import get_db
from app.utils import parse_json_field
import logging
import json
from datetime import datetime

mistakes_bp = Blueprint('mistakes', __name__)
logger = logging.getLogger(__name__)


@mistakes_bp.route('/', methods=['GET'])
def get_mistakes():
    # ... (此路由内容与原代码相同)
    try:
        rows = get_db().execute(
            'SELECT id, title, messages, tags, category, difficulty, date FROM mistakes ORDER BY date DESC').fetchall()
        mistakes = [{
            'id': row['id'], 'title': row['title'],
            'messages': parse_json_field(row['messages'], []),
            'tags': parse_json_field(row['tags'], []),
            'category': row['category'], 'difficulty': row['difficulty'],
            'date': row['date']
        } for row in rows]
        return jsonify({'mistakes': mistakes})
    except Exception as e:
        logger.error(f"获取错题失败: {e}")
        return jsonify({'error': str(e)}), 500


@mistakes_bp.route('/', methods=['POST'])
def save_mistakes():
    # ... (此路由内容与原代码相同)
    try:
        mistakes = request.get_json().get('mistakes', [])
        db = get_db()
        cursor = db.cursor()
        cursor.execute('DELETE FROM mistakes')
        for m in mistakes:
            cursor.execute('''
                           INSERT INTO mistakes (id, title, messages, tags, category, difficulty, date)
                           VALUES (?, ?, ?, ?, ?, ?, ?)
                           ''', (
                               m.get('id'), m.get('title', ''), json.dumps(m.get('messages', []), ensure_ascii=False),
                               json.dumps(m.get('tags', []), ensure_ascii=False), m.get('category', ''),
                               m.get('difficulty', ''), m.get('date', datetime.now().isoformat())
                           ))
        db.commit()
        logger.info(f"成功保存 {len(mistakes)} 个错题")
        return jsonify({'status': 'success'})
    except Exception as e:
        logger.error(f"保存错题失败: {e}")
        return jsonify({'error': str(e)}), 500


@mistakes_bp.route('/<int:mistake_id>', methods=['PUT'])
def update_mistake(mistake_id):
    # ... (此路由内容与原代码相同)
    try:
        data = request.get_json()
        db = get_db()
        if not db.execute('SELECT id FROM mistakes WHERE id = ?', (mistake_id,)).fetchone():
            return jsonify({'error': '错题不存在'}), 404
        db.execute('''
                   UPDATE mistakes
                   SET title      = ?,
                       messages   = ?,
                       tags       = ?,
                       category   = ?,
                       difficulty = ?
                   WHERE id = ?
                   ''', (
                       data.get('title', ''), json.dumps(data.get('messages', []), ensure_ascii=False),
                       json.dumps(data.get('tags', []), ensure_ascii=False), data.get('category', ''),
                       data.get('difficulty', ''), mistake_id
                   ))
        db.commit()
        logger.info(f"成功更新错题 ID: {mistake_id}")
        return jsonify({'status': 'success'})
    except Exception as e:
        logger.error(f"更新错题失败: {e}")
        return jsonify({'error': str(e)}), 500


@mistakes_bp.route('/<int:mistake_id>', methods=['DELETE'])
def delete_mistake(mistake_id):
    # ... (此路由内容与原代码相同)
    try:
        db = get_db()
        if not db.execute('SELECT id FROM mistakes WHERE id = ?', (mistake_id,)).fetchone():
            return jsonify({'error': '错题不存在'}), 404
        db.execute('DELETE FROM mistakes WHERE id = ?', (mistake_id,))
        db.commit()
        logger.info(f"成功删除错题 ID: {mistake_id}")
        return jsonify({'status': 'success'})
    except Exception as e:
        logger.error(f"删除错题失败: {e}")
        return jsonify({'error': str(e)}), 500