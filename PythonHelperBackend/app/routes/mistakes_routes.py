from flask import Blueprint, jsonify, request, session, current_app
from app.database import get_db
from app.utils import parse_json_field, validate_ai_endpoint
import logging
import json
from datetime import datetime
from app.services.ai_service import call_ai_api
import re

mistakes_bp = Blueprint('mistakes', __name__)
logger = logging.getLogger(__name__)

ANALYSIS_SYSTEM_PROMPT = """
你是一个专业的Python教学助手。你的任务是分析一段学生与AI助教的对话记录，并提取错题信息。

请分析对话，并返回且仅返回以下 JSON 格式的数据：
{
    "suggested_title": "请根据对话内容，总结出一个简练、准确的题目（Problem Title）。不要超过20个字。",
    "suggested_tags": ["从可用标签列表中选择1-4个最合适的标签"],
    "analysis": "请提供详细的解析（Analysis）。包括：1. 题目原文（不能有任何删减）；2. 考察知识点以及逻辑分析；3. 正确解题思路。请使用Markdown格式排版，例如标题、列表、代码块等。"
}

注意：
1. 不要输出任何Markdown代码块标记（如 ```json），直接输出纯文本的JSON字符串。
2. 确保JSON格式合法。
3. 不要使用HTML格式，最外层格式仅为json格式。
4. suggested_tags 只能从用户消息中提供的可用标签列表中选择，禁止创造新标签；如果没有合适的标签，返回空数组 []。
5. analysis 字段必须使用 Markdown 语法，便于前端可视化展示。
"""

@mistakes_bp.route('/', methods=['GET'])
def get_mistakes():
    user_id = session.get('user_id') #获取当前登录用户的ID
    if not user_id:
        return jsonify({'error': '未登录'}), 401
    try:
        rows = get_db().execute(
            'SELECT id, title, messages, tags, category, difficulty, date, ai_summary FROM mistakes WHERE user_id = ? ORDER BY date DESC',
            (user_id,)
        ).fetchall()
        mistakes = [{
            'id': row['id'], 'title': row['title'],
            'messages': parse_json_field(row['messages'], []),
            'tags': parse_json_field(row['tags'], []),
            'category': row['category'], 'difficulty': row['difficulty'],
            'date': row['date'],
            'ai_summary': row['ai_summary'] or ''
        } for row in rows]
        return jsonify({'mistakes': mistakes})
    except Exception as e:
        logger.error(f"获取错题失败: {e}")
        return jsonify({'error': str(e)}), 500


@mistakes_bp.route('/', methods=['POST'])
def save_mistakes():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': '未登录'}), 401
    try:
        payload = request.get_json(silent=True) or {}
        mistakes = payload.get('mistakes')
        if not isinstance(mistakes, list):
            return jsonify({'error': 'mistakes 必须是数组'}), 400

        db = get_db()
        cursor = db.cursor()
        saved = 0

        for m in mistakes:
            if not isinstance(m, dict):
                continue
            title = str(m.get('title', '')).strip()
            if not title:
                continue
            messages_json = json.dumps(m.get('messages', []), ensure_ascii=False)
            tags_json = json.dumps(m.get('tags', []), ensure_ascii=False)
            category = m.get('category', '')
            difficulty = m.get('difficulty', '')
            date_value = m.get('date') or datetime.now().isoformat()
            mistake_id = m.get('id')

            if mistake_id is not None and cursor.execute(
                'SELECT id FROM mistakes WHERE id = ? AND user_id = ?',
                (mistake_id, user_id)
            ).fetchone():
                cursor.execute('''
                    UPDATE mistakes
                    SET title = ?, messages = ?, tags = ?, category = ?,
                        difficulty = ?, date = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ? AND user_id = ?
                ''', (
                    title, messages_json, tags_json, category,
                    difficulty, date_value, mistake_id, user_id
                ))
            else:
                if mistake_id is None:
                    cursor.execute('''
                        INSERT INTO mistakes
                            (title, messages, tags, category, difficulty, date, user_id)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        title, messages_json, tags_json, category,
                        difficulty, date_value, user_id
                    ))
                else:
                    cursor.execute('''
                        INSERT INTO mistakes
                            (id, title, messages, tags, category, difficulty, date, user_id)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        mistake_id, title, messages_json, tags_json, category,
                        difficulty, date_value, user_id
                    ))
            saved += 1

        db.commit()
        logger.info(f"用户{user_id}成功保存 {saved} 个错题")
        return jsonify({'status': 'success', 'saved': saved})
    except Exception as e:
        logger.error(f"保存错题失败: {e}")
        return jsonify({'error': str(e)}), 500


@mistakes_bp.route('/<int:mistake_id>', methods=['PUT'])
def update_mistake(mistake_id):
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': '未登录'}), 401
    try:
        data = request.get_json(silent=True) or {}
        db = get_db()
        if not db.execute('SELECT id FROM mistakes WHERE id = ? AND user_id = ?', (mistake_id, user_id)).fetchone():
            return jsonify({'error': f'用户{user_id}的错题不存在'}), 404
        db.execute('''
                   UPDATE mistakes
                   SET title      = ?,
                       messages   = ?,
                       tags       = ?,
                       category   = ?,
                       difficulty = ?
                   WHERE id = ? AND user_id = ?
                   ''', (
                       data.get('title', ''), json.dumps(data.get('messages', []), ensure_ascii=False),
                       json.dumps(data.get('tags', []), ensure_ascii=False), data.get('category', ''),
                       data.get('difficulty', ''), mistake_id, user_id
                   ))
        db.commit()
        logger.info(f"用户{user_id}成功更新错题 ID: {mistake_id}")
        return jsonify({'status': 'success'})
    except Exception as e:
        logger.error(f"更新错题失败: {e}")
        return jsonify({'error': str(e)}), 500


@mistakes_bp.route('/<int:mistake_id>', methods=['DELETE'])
def delete_mistake(mistake_id):
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': '未登录'}), 401
    try:
        db = get_db()
        if not db.execute('SELECT id FROM mistakes WHERE id = ? AND user_id = ?', (mistake_id, user_id)).fetchone():
            return jsonify({'error': f'用户{user_id}的错题不存在'}), 404
        db.execute('DELETE FROM mistakes WHERE id = ? AND user_id = ?', (mistake_id, user_id))
        db.commit()
        logger.info(f"用户{user_id}成功删除错题 ID: {mistake_id}")
        return jsonify({'status': 'success'})
    except Exception as e:
        logger.error(f"删除错题失败: {e}")
        return jsonify({'error': str(e)}), 500
    
@mistakes_bp.route('/<int:mistake_id>/analyze', methods=['POST'])
def analyze_mistake_route(mistake_id):
    """使用AI分析错题对话，生成题目和解析"""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': '未登录'}), 401
    try:
        db = get_db()
        # 1. 获取错题信息
        mistake = db.execute('SELECT * FROM mistakes WHERE id = ? AND user_id = ?', (mistake_id, user_id)).fetchone()
        if not mistake:
            return jsonify({'error': f'用户{user_id}的错题不存在'}), 404
            
        messages = json.loads(mistake['messages'])

        # 2. 获取系统已有的标签，作为AI自动贴标签的候选集合
        tag_rows = db.execute(
            'SELECT name, category FROM tags ORDER BY category, name'
        ).fetchall()
        available_tag_names = [row['name'] for row in tag_rows]
        available_tags_text = "\n".join(
            f"- [{row['category']}] {row['name']}" for row in tag_rows
        ) or "（暂无可用标签）"

        # 3. 构造发送给AI的消息内容
        conversation_text = ""
        for msg in messages:
            role = "学生" if msg['role'] == 'user' else "助教"
            conversation_text += f"{role}: {msg['content']}\n\n"

        user_prompt = (
            f"请分析以下对话记录，并给出题目总结、自动标签和Markdown解析：\n\n"
            f"{conversation_text}\n"
            f"可用标签列表：\n{available_tags_text}\n\n"
            f"请从上面的可用标签列表中为错题选择1-4个最合适的标签，"
            f"并将标签名称放入 suggested_tags 数组。"
        )

        logger.info(f"聊天记录{conversation_text}")
        # 3. 调用 AI：优先使用服务端配置的 Key，其次使用请求头中的 Key
        api_key = current_app.config.get('AI_API_KEY') or request.headers.get('X-API-Key', '')
        if not api_key:
            return jsonify({'error': '未配置AI API密钥'}), 503
        api_endpoint = validate_ai_endpoint(
            current_app.config.get('AI_API_ENDPOINT'),
            current_app.config.get('AI_ALLOWED_HOSTS', [])
        )
        
        ai_response = call_ai_api(user_prompt, api_key, api_endpoint, ANALYSIS_SYSTEM_PROMPT)
        
        # 4. 解析 AI 返回的 JSON（解析失败时回退为原文，不再引用未定义变量）
        new_title = mistake['title']
        analysis_content = ai_response
        suggested_tags = []
        result = {}

        try:
            clean_response = ai_response.strip()
            if clean_response.startswith('```json'):
                clean_response = clean_response[7:]
            if clean_response.endswith('```'):
                clean_response = clean_response[:-3]

            json_match = re.search(r'\{[\s\S]*\}', clean_response)
            if json_match:
                result = json.loads(json_match.group())
                if result.get('suggested_title'):
                    new_title = str(result['suggested_title']).strip()
                if result.get('analysis'):
                    analysis_content = result['analysis']

                raw_tags = result.get('suggested_tags', [])
                if isinstance(raw_tags, list):
                    seen = set()
                    for tag in raw_tags:
                        tag_name = str(tag).strip()
                        if tag_name in available_tag_names and tag_name not in seen:
                            seen.add(tag_name)
                            suggested_tags.append(tag_name)
                            if len(suggested_tags) >= 4:
                                break
        except Exception as e:
            logger.warning(f"AI响应JSON解析失败，使用原始文本: {e}")
            analysis_content = ai_response

        # 如果AI没有给出有效标签，保留错题原有标签
        final_tags = suggested_tags if suggested_tags else parse_json_field(mistake['tags'], [])
        final_tags = [str(tag) for tag in final_tags][:4]

        # 5. 更新数据库：同时更新 legacy tags 字段和 mistake_tags 关联表
        db.execute(
            'UPDATE mistakes SET title = ?, ai_summary = ?, tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
            (new_title, analysis_content, json.dumps(final_tags, ensure_ascii=False), mistake_id, user_id)
        )

        db.execute('DELETE FROM mistake_tags WHERE mistake_id = ?', (mistake_id,))
        for tag_name in final_tags:
            tag_row = db.execute(
                'SELECT id FROM tags WHERE name = ?',
                (tag_name,)
            ).fetchone()
            if tag_row:
                db.execute(
                    'INSERT OR IGNORE INTO mistake_tags (mistake_id, tag_id) VALUES (?, ?)',
                    (mistake_id, tag_row['id'])
                )
        db.commit()

        return jsonify({
            'success': True,
            'title': new_title,
            'ai_summary': analysis_content,
            'tags': final_tags
        })

    except Exception as e:
        logger.error(f"分析错题失败: {e}")
        return jsonify({'error': str(e)}), 500