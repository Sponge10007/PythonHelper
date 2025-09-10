from flask import Blueprint, jsonify, request
from app.services.question_service import question_service
from app.services.ai_service import call_ai_api
from app.database import get_db
import logging
import os

main_bp = Blueprint('main', __name__)
logger = logging.getLogger(__name__)


@main_bp.route('/health', methods=['GET'])
def health_check():
    # ... (此路由内容与原代码相同)
    question_types = {q.get('question_type', '未知'): 0 for q in question_service.questions_db}
    for q in question_service.questions_db:
        question_types[q.get('question_type', '未知')] += 1

    mistakes_count = 0
    ppt_files_count = 0
    try:
        db = get_db()
        mistakes_count = db.execute('SELECT COUNT(*) FROM mistakes').fetchone()[0]
        ppt_files_count = db.execute('SELECT COUNT(*) FROM ppt_files').fetchone()[0]
    except Exception as e:
        logger.error(f"获取统计信息失败: {e}")

    return jsonify({
        'status': 'healthy', 'message': 'Python教学助手后端服务运行正常',
        'questions_count': len(question_service.questions_db),
        'mistakes_count': mistakes_count, 'ppt_files_count': ppt_files_count,
        'question_types': question_types,
        'database_source': 'database.json' if os.path.exists('database.json') else 'questions.json',
        'features': ['题库搜索', 'AI聊天', '错题管理', 'PPT文件管理']
    })


@main_bp.route('/ai/chat', methods=['POST'])
def ai_chat():
    # ... (此路由内容与原代码相同)
    try:
        data = request.get_json()
        message = data.get('message', '')
        api_key = data.get('apiKey', '')
        if not message: return jsonify({'error': '消息不能为空'}), 400
        if not api_key:
            logger.warning("未提供API密钥，使用模拟回复")
            mock_response = f"这是一个模拟的AI回复。\n\n用户问题: {message}\n\n由于未配置有效的API密钥，我无法提供真实的AI回复。"
            return jsonify({'response': mock_response, 'status': 'success', 'note': '使用模拟回复，请配置API密钥'})

        system = data.get('system', '你是一个专业的Python教学助手，请用简洁明了的中文回答用户的问题。')
        api_endpoint = data.get('apiEndpoint', 'https://api.deepseek.com/v1/chat/completions')
        response = call_ai_api(message, api_key, api_endpoint, system)
        return jsonify({'response': response, 'status': 'success'})
    except Exception as e:
        logger.error(f"AI聊天接口错误: {e}")
        return jsonify({'error': str(e), 'status': 'error'}), 500


@main_bp.route('/search', methods=['POST'])
def search_questions_route():
    # ... (此路由内容与原代码相同)
    try:
        query = request.get_json().get('query', '')
        if not query: return jsonify({'error': '搜索查询不能为空'}), 400
        results = question_service.search_questions(query)
        return jsonify({'results': results, 'count': len(results), 'status': 'success'})
    except Exception as e:
        logger.error(f"搜索接口错误: {e}")
        return jsonify({'error': str(e), 'status': 'error'}), 500


@main_bp.route('/questions', methods=['GET'])
def get_all_questions():
    # ... (此路由内容与原代码相同)
    try:
        formatted_questions = [question_service.format_question_for_display(q) for q in question_service.questions_db]
        return jsonify({'questions': formatted_questions, 'count': len(formatted_questions), 'status': 'success'})
    except Exception as e:
        logger.error(f"获取题目接口错误: {e}")
        return jsonify({'error': str(e), 'status': 'error'}), 500


@main_bp.route('/questions/stats', methods=['GET'])
def get_questions_stats():
    # ... (此路由内容与原代码相同)
    try:
        stats = {'question_types': {}, 'categories': {}, 'difficulties': {}}
        for question in question_service.questions_db:
            q_type = question.get('question_type', '未知')
            stats['question_types'][q_type] = stats['question_types'].get(q_type, 0) + 1
            formatted = question_service.format_question_for_display(question)
            category = formatted.get('category', '未知')
            difficulty = formatted.get('difficulty', '未知')
            stats['categories'][category] = stats['categories'].get(category, 0) + 1
            stats['difficulties'][difficulty] = stats['difficulties'].get(difficulty, 0) + 1

        return jsonify({
            'total_count': len(question_service.questions_db), **stats, 'status': 'success'
        })
    except Exception as e:
        logger.error(f"获取题目统计接口错误: {e}")
        return jsonify({'error': str(e), 'status': 'error'}), 500