from flask import Blueprint, jsonify, request, session
from app.database import get_db
from app.utils import parse_json_field
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
    "analysis": "请提供详细的解析（Analysis）。包括：1. 题目原文（不能有任何删减）；2. 考察知识点以及逻辑分析；3. 正确解题思路。请使用Markdown格式排版。"
}

注意：
1. 不要输出任何Markdown代码块标记（如 ```json），直接输出纯文本的JSON字符串。
2. 确保JSON格式合法。
3. 不要使用HTML格式，最外层格式仅为json格式。
"""

@mistakes_bp.route('/', methods=['GET'])
def get_mistakes():
    user_id = session.get('user_id') #获取当前登录用户的ID
    if not user_id:
        return jsonify({'error': '未登录'}), 401
    try:
        rows = get_db().execute(
            'SELECT id, title, messages, tags, category, difficulty, date FROM mistakes WHERE user_id = ? ORDER BY date DESC',
            (user_id,)
        ).fetchall()
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
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': '未登录'}), 401
    try:
        mistakes = request.get_json().get('mistakes', [])
        db = get_db()
        cursor = db.cursor()

        cursor.execute('DELETE FROM mistakes WHERE user_id = ?', (user_id,))

        for m in mistakes:
            cursor.execute('''
                           INSERT INTO mistakes (id, title, messages, tags, category, difficulty, date, user_id)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                           ''', (
                               m.get('id'), m.get('title', ''), json.dumps(m.get('messages', []), ensure_ascii=False),
                               json.dumps(m.get('tags', []), ensure_ascii=False), m.get('category', ''),
                               m.get('difficulty', ''), m.get('date', datetime.now().isoformat()),
                               user_id
                           ))
        db.commit()
        logger.info(f"用户{user_id}成功保存 {len(mistakes)} 个错题")
        return jsonify({'status': 'success'})
    except Exception as e:
        logger.error(f"保存错题失败: {e}")
        return jsonify({'error': str(e)}), 500


@mistakes_bp.route('/<int:mistake_id>', methods=['PUT'])
def update_mistake(mistake_id):
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': '未登录'}), 401
    try:
        data = request.get_json()
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
        
        # 2. 构造发送给AI的消息内容
        # 将对话历史转换为纯文本供AI阅读
        conversation_text = ""
        for msg in messages:
            role = "学生" if msg['role'] == 'user' else "助教"
            conversation_text += f"{role}: {msg['content']}\n\n"
            
        user_prompt = f"请分析以下对话记录，并给出题目总结和解析：\n\n{conversation_text}"
        
        logger.info(f"聊天记录{conversation_text}")
        # 3. 调用 AI (假设使用配置好的 Key)
        # 注意：这里需要获取 API Key，生产环境建议从 Config 或环境变量获取，或者请求中携带
        # 临时解决方案：使用测试 Key 或从请求头获取（如果前端传了）
        api_key = request.headers.get('X-API-Key') or 'sk-5967010b633c410d8bd333ea9f01b55c' # 使用你的 Key
        api_endpoint = 'https://api.deepseek.com/v1/chat/completions'
        
        ai_response = call_ai_api(user_prompt, api_key, api_endpoint, ANALYSIS_SYSTEM_PROMPT)
        
        # 4. 解析 AI 返回的 JSON (关键修改：强化解析逻辑)
        new_title = mistake['title'] # 默认保留原标题
        analysis_content = ai_response # 默认全文本作为解析

        try:
            # 尝试清洗数据，去掉可能的 ```json 包裹
            clean_response = ai_response.strip()
            if clean_response.startswith('```json'):
                clean_response = clean_response[7:]
            if clean_response.endswith('```'):
                clean_response = clean_response[:-3]
            logger.info(clean_response)
            # 尝试提取 JSON 对象
            json_match = re.search(r'\{[\s\S]*\}', clean_response)
            logger.info("\njson_match:",json_match)
            if json_match:
                result = json.loads(json_match.group())
                
                # --- 核心逻辑：字段映射 ---
                # 将 'suggested_title' 填入 题目 (title)
                if 'suggested_title' in result:
                    new_title = result['suggested_title']
                
                # 将 'analysis' 填入 解析 (ai_summary)
                if 'analysis' in result:
                    analysis_content = result['analysis']
                    
        except Exception as e:
            logger.warning(f"AI响应JSON解析失败，使用原始文本: {e}")
            # 如果解析失败，则不修改标题，只把所有回复当作解析
            analysis_content = ai_response

        # 5. 更新数据库
        new_title = result.get('suggested_title', mistake['title'])
        analysis_content = result.get('analysis', '')
        
        db.execute('''
            UPDATE mistakes 
            SET title = ?, ai_summary = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ? AND user_id = ?
        ''', (new_title, analysis_content, mistake_id, user_id))
        db.commit()
        
        return jsonify({
            'success': True,
            'title': new_title,
            'ai_summary': analysis_content
        })

    except Exception as e:
        logger.error(f"分析错题失败: {e}")
        return jsonify({'error': str(e)}), 500