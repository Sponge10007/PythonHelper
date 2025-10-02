from flask import Blueprint, jsonify, request, current_app
from app.services.ai_service import call_ai_api, call_ai_api_with_memory
from app.database import get_db
import logging
import os

main_bp = Blueprint('main', __name__)
logger = logging.getLogger(__name__)


@main_bp.route('/health', methods=['GET'])
def health_check():
    # ... (此路由内容与原代码相同)
    question_service = current_app.question_service
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
    """AI聊天接口 - 支持持久记忆"""
    try:
        data = request.get_json()
        messages = data.get('messages', [])  # 接收完整对话历史
        api_key = data.get('apiKey', '')
        
        if not messages or len(messages) == 0:
            return jsonify({'error': '消息不能为空'}), 400
            
        if not api_key:
            logger.warning("未提供API密钥，使用模拟回复")
            last_message = messages[-1].get('content', '') if messages else ''
            mock_response = f"这是一个模拟的AI回复。\n\n用户问题: {last_message}\n\n由于未配置有效的API密钥，我无法提供真实的AI回复。"
            return jsonify({'response': mock_response, 'status': 'success', 'note': '使用模拟回复，请配置API密钥'})

        system = data.get('system', 
                            """
                            #浙大python助手
                            你是一个教导学生们学习Python的人工智能
                            ##目标 
                            你的目标是在不告知学生题目答案的前提下，帮助学生们梳理思路，掌握知识，来引导他们更好地学习python
                            ##技能和流程说明
                            1. 你需要有python相关的语法、特色知识，对python无比熟悉
                            2. 你需要能够用精简、巧妙的方式完成代码撰写
                            3. 第一步，你需要分析用户发来的信息是题目还是询问。
                            4. 如果是题目，请你分析其中包含的知识点、难点。然后你需要识别用户发出的是编程题、函数题还是客观题，如果是编程题，需要给出思维导图和整体架构；如果是函数题，需要给出几个样例输入输出，实现函数变量可视化；如果是客观题，请你详细地讲一下考察知识。
                            5. 如果是询问，请你正常的与用户进行谈话。
                            ## 输出格式 
                            如果对角色的输出格式有特定要求，可以在这里强调并举例说明想要的输出格式
                            1. 请你按照以下格式输出：
                                知识点：，
                                难点：，
                                整体架构：，
                                伪代码：，
                                样例输入输出：，
                                考察知识解释：
                            2. 请你给你的输出加上LaTeX数学公式,并且在公式前后加上"$$"，遵循严格的markdown格式
                                比如，当你的输出里存在"\\(x^2 + y^2 = z^2\\)"，请你将其转换为"$$x^2 + y^2 = z^2$$"
                            ##限制 
                            在与用户交互的过程中涉及代码的时候，请你不要给出直接给出代码，而是给出伪代码；
                            当用户问你选择题的题目时，请你不要将答案告诉用户，这样会让用户失去思考空间，所以在你的回答中不能出现诸如"正确答案是..."等提及题目答案的字眼。
                            当用户询问你某道题目时，请你分析后不要告诉用户题目答案是什么（非常重要，不要给出答案）。
                            """
                        )
        api_endpoint = data.get('apiEndpoint', 'https://api.deepseek.com/v1/chat/completions')
        
        # 使用新的持久记忆API调用
        response = call_ai_api_with_memory(messages, api_key, api_endpoint, system)
        print(response)
        return jsonify({'response': response, 'status': 'success'})
    except Exception as e:
        logger.error(f"AI聊天接口错误: {e}")
        return jsonify({'error': str(e), 'status': 'error'}), 500


@main_bp.route('/search', methods=['POST'])
def search_questions_route():
    # ... (此路由内容与原代码相同)
    try:
        question_service = current_app.question_service
        query = request.get_json().get('query', '')
        if not query: return jsonify({'error': '搜索查询不能为空'}), 400
        results = question_service.search_questions(query)
        return jsonify({'results': results, 'count': len(results), 'status': 'success'})
    except Exception as e:
        logger.error(f"搜索接口错误: {e}")
        return jsonify({'error': str(e), 'status': 'error'}), 500


@main_bp.route('/questions', methods=['GET'])
def get_all_questions():
    try:
        question_service = current_app.question_service
        formatted_questions = [question_service.format_question_for_display(q) for q in question_service.questions_db]
        return jsonify({'questions': formatted_questions, 'count': len(formatted_questions), 'status': 'success'})
    except Exception as e:
        logger.error(f"获取题目接口错误: {e}")
        return jsonify({'error': str(e), 'status': 'error'}), 500


@main_bp.route('/questions/stats', methods=['GET'])
def get_questions_stats():
    try:
        question_service = current_app.question_service
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