from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
import requests
import sqlite3
from datetime import datetime
from typing import Dict, List, Optional
import logging

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 错题数据库文件
MISTAKES_DB_FILE = 'mistakes.db'

def init_mistakes_db():
    """初始化错题数据库"""
    try:
        conn = sqlite3.connect(MISTAKES_DB_FILE)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS mistakes (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                answer TEXT NOT NULL,
                tags TEXT,
                category TEXT,
                difficulty TEXT,
                date TEXT,
                ai_summary TEXT
            )
        ''')
        conn.commit()
        conn.close()
        logger.info("错题数据库初始化完成")
    except Exception as e:
        logger.error(f"错题数据库初始化失败: {e}")

class PythonHelperBackend:
    def __init__(self):
        self.questions_db = []
        self.load_questions_db()
    
    def load_questions_db(self):
        """加载题库数据库"""
        try:
            # 优先从后端目录加载新的题库数据
            database_path = os.path.join('database.json')
            if os.path.exists(database_path):
                with open(database_path, 'r', encoding='utf-8') as f:
                    self.questions_db = json.load(f)
                    logger.info(f"已从database.json加载 {len(self.questions_db)} 道题目")
            else:
                # 回退到前端目录的旧题库数据
                questions_path = os.path.join('..', 'PythonHelperFrontEnd', 'data', 'questions.json')
                if os.path.exists(questions_path):
                    with open(questions_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        self.questions_db = data.get('questions', [])
                        logger.info(f"已从questions.json加载 {len(self.questions_db)} 道题目")
                else:
                    logger.warning("题库文件不存在，使用默认数据")
                    self.questions_db = self.get_default_questions()
        except Exception as e:
            logger.error(f"加载题库失败: {e}")
            self.questions_db = self.get_default_questions()
    
    def get_default_questions(self) -> List[Dict]:
        """获取默认题库数据"""
        return [
            {
                "id": 1,
                "title": "Python变量和数据类型",
                "content": "在Python中，如何定义一个字符串变量？",
                "answer": "使用引号（单引号或双引号）来定义字符串变量，例如：name = 'Python' 或 name = \"Python\"",
                "category": "基础语法",
                "difficulty": "简单",
                "keywords": ["变量", "字符串", "定义", "引号"]
            }
        ]
    
    def search_questions(self, query: str) -> List[Dict]:
        """搜索题库 - 只对题目文本进行搜索"""
        if not query or len(query.strip()) < 1:
            return []
        
        # 清理查询字符串
        query = query.strip()
        print(f"搜索查询: '{query}'")
        
        results = []
        all_questions_with_scores = []
        query_lower = query.lower()
        
        for question in self.questions_db:
            score = 0
            
            # 只对题目内容进行搜索（主要匹配项）
            question_content = question.get('question', '')
            question_content_lower = question_content.lower()
            
            # 精确匹配
            if query_lower in question_content_lower:
                score += 10
            
            # 模糊匹配：检查查询中的每个词是否出现在题目内容中
            query_words = query_lower.split()
            for word in query_words:
                if len(word) >= 2 and word in question_content_lower:
                    score += 3
            
            # 特殊Python关键词匹配
            special_keywords = ['if', 'else', 'elif', 'for', 'while', 'def', 'class', 'list', 'dict', 'set', 'tuple', 'string', 'int', 'float', 'boolean', 'true', 'false', 'none', 'print', 'return', 'import', 'from', 'try', 'except', 'finally', 'with', 'as', 'in', 'not', 'and', 'or', 'is', 'lambda', 'map', 'filter', 'reduce', 'zip', 'enumerate', 'range', 'len', 'max', 'min', 'sum', 'sorted', 'reversed', 'type', 'isinstance', 'hasattr', 'getattr', 'setattr', 'delattr', 'dir', 'vars', 'locals', 'globals', 'eval', 'exec', 'compile', 'open', 'read', 'write', 'close', 'append', 'extend', 'insert', 'remove', 'pop', 'clear', 'copy', 'count', 'index', 'sort', 'reverse', 'keys', 'values', 'items', 'update', 'get', 'setdefault', 'popitem', 'clear', 'copy', 'fromkeys', 'add', 'discard', 'union', 'intersection', 'difference', 'symmetric_difference', 'issubset', 'issuperset', 'isdisjoint']
            
            for keyword in special_keywords:
                if keyword.lower() in query_lower and keyword.lower() in question_content_lower:
                    score += 2
            
            # 计算字符匹配度（用于兜底）
            char_match_score = 0
            for char in query_lower:
                if char in question_content_lower:
                    char_match_score += 0.1
            
            # 计算词频匹配度
            word_frequency_score = 0
            for word in query_words:
                if len(word) >= 2:
                    word_count = question_content_lower.count(word)
                    word_frequency_score += word_count * 0.5
            
            # 总分数
            total_score = score + char_match_score + word_frequency_score
            
            # 格式化题目数据以适应前端显示
            formatted_question = self.format_question_for_display(question)
            
            # 所有题目都加入列表，用于兜底
            all_questions_with_scores.append({
                **formatted_question,
                'score': total_score,
                'original_score': score
            })
            
            # 只有原始分数大于0的题目加入结果列表
            if score > 0:
                results.append({
                    **formatted_question,
                    'score': total_score,
                    'original_score': score
                })
        
        # 如果有匹配的结果，按相关性排序并返回前5个
        if results:
            sorted_results = sorted(results, key=lambda x: x['score'], reverse=True)[:5]
            print(f"找到 {len(sorted_results)} 个匹配的搜索结果")
            return sorted_results
        else:
            # 如果没有匹配的结果，返回最相关的1个题目作为兜底
            print("没有找到匹配的搜索结果，返回最相关的题目作为兜底")
            all_sorted = sorted(all_questions_with_scores, key=lambda x: x['score'], reverse=True)
            if all_sorted:
                best_match = all_sorted[0]
                best_match['is_fallback'] = True  # 标记为兜底结果
                print(f"返回兜底结果: {best_match['title']} (分数: {best_match['score']:.2f})")
                return [best_match]
            else:
                print("题库为空，无法返回结果")
                return []
    
    def format_question_for_display(self, question: Dict) -> Dict:
        """格式化题目数据以适应前端显示"""
        question_type = question.get('question_type', '')
        question_number = question.get('question_number', '')
        question_content = question.get('question', '')
        options = question.get('options', [])
        answer = question.get('answer', '')
        
        # 构建标题
        title = f"{question_type} {question_number}"
        
        # 构建内容（包含题目和选项）
        content = question_content
        
        # 确保题目内容格式清晰
        if not content.endswith('\n'):
            content += '\n'
        
        # 添加选项（如果有）
        if options:
            content += "\n选项：\n"
            for i, option in enumerate(options):
                content += f"{option}\n"
        
        # 确保内容不以多余的空行结尾
        content = content.strip()
        
        # 构建答案
        if question_type == "判断题":
            answer_text = f"答案：{'正确' if answer == 'True' else '错误'}"
        elif question_type == "单选题" and options:
            # 对于单选题，显示选项和答案
            answer_text = f"答案：{answer}"
            if answer in ['A', 'B', 'C', 'D']:
                # 找到对应的选项内容
                option_index = ord(answer) - ord('A')
                if 0 <= option_index < len(options):
                    option_content = options[option_index].replace(f"{answer}. ", "")
                    answer_text = f"答案：{answer} - {option_content}"
        else:
            answer_text = f"答案：{answer}"
        
        # 构建关键词（从题目内容中提取）
        keywords = []
        content_lower = question_content.lower()
        python_keywords = ['if', 'else', 'elif', 'for', 'while', 'def', 'class', 'list', 'dict', 'set', 'tuple', 'string', 'int', 'float', 'boolean', 'print', 'return', 'import', 'from', 'try', 'except', 'finally', 'with', 'as', 'in', 'not', 'and', 'or', 'is', 'lambda', 'map', 'filter', 'reduce', 'zip', 'enumerate', 'range', 'len', 'max', 'min', 'sum', 'sorted', 'reversed', 'type', 'isinstance', 'append', 'extend', 'insert', 'remove', 'pop', 'clear', 'copy', 'count', 'index', 'sort', 'reverse', 'keys', 'values', 'items', 'update', 'get', 'setdefault', 'popitem', 'fromkeys', 'add', 'discard', 'union', 'intersection', 'difference', 'symmetric_difference', 'issubset', 'issuperset', 'isdisjoint']
        
        for keyword in python_keywords:
            if keyword in content_lower:
                keywords.append(keyword)
        
        # 确定难度（基于题目类型和内容长度）
        if question_type == "判断题":
            difficulty = "简单"
        elif len(question_content) > 200:
            difficulty = "困难"
        elif len(question_content) > 100:
            difficulty = "中等"
        else:
            difficulty = "简单"
        
        # 确定分类（基于题目类型和内容）
        if "if" in content_lower or "else" in content_lower or "elif" in content_lower:
            category = "条件语句"
        elif "for" in content_lower or "while" in content_lower:
            category = "循环语句"
        elif "def" in content_lower or "class" in content_lower:
            category = "函数和类"
        elif "list" in content_lower or "dict" in content_lower or "set" in content_lower or "tuple" in content_lower:
            category = "数据结构"
        elif "try" in content_lower or "except" in content_lower:
            category = "异常处理"
        else:
            category = "基础语法"
        
        return {
            'id': f"{question_type}_{question_number}",
            'title': title,
            'content': content,
            'answer': answer_text,
            'category': category,
            'difficulty': difficulty,
            'keywords': keywords,
            'question_type': question_type,
            'question_number': question_number,
            'original_question': question_content,
            'options': options,
            'original_answer': answer,
            # 添加完整的题目信息
            'full_question': {
                'question_text': question_content,
                'options_list': options,
                'correct_answer': answer,
                'question_type': question_type,
                'question_number': question_number
            }
        }
    
    def call_ai_api(self, message: str, api_key: str, api_endpoint: str, system: str = '你是一个专业的Python教学助手，请用简洁明了的中文回答用户的问题。') -> str:
        """调用AI API"""
        try:
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {api_key}'
            }
            
            # 根据API端点判断使用哪个模型
            if 'deepseek' in api_endpoint.lower():
                model = 'deepseek-chat'
            elif 'openai' in api_endpoint.lower():
                model = 'gpt-3.5-turbo'
            else:
                model = 'gpt-3.5-turbo'  # 默认使用OpenAI格式
            
            data = {
                'model': model,
                'messages': [
                    {
                        'role': 'system',
                        'content': system
                    },
                    {
                        'role': 'user',
                        'content': message
                    }
                ],
                'max_tokens': 500,
                'temperature': 0.7
            }
            
            logger.info(f"调用AI API: {api_endpoint}")
            logger.info(f"使用模型: {model}")
            
            response = requests.post(api_endpoint, headers=headers, json=data, timeout=30)
            
            if not response.ok:
                logger.error(f"API响应错误: {response.status_code} - {response.text}")
                raise Exception(f"API响应错误: {response.status_code}")
            
            result = response.json()
            logger.info(f"AI API调用成功")
            
            return result['choices'][0]['message']['content']
            
        except requests.exceptions.RequestException as e:
            logger.error(f"AI API调用失败: {e}")
            raise Exception(f"AI服务调用失败: {str(e)}")
        except Exception as e:
            logger.error(f"处理AI响应失败: {e}")
            raise Exception(f"处理AI响应失败: {str(e)}")

# 创建后端实例
backend = PythonHelperBackend()

@app.route('/health', methods=['GET'])
def health_check():
    """健康检查接口"""
    # 统计题目类型
    question_types = {}
    for question in backend.questions_db:
        q_type = question.get('question_type', '未知')
        question_types[q_type] = question_types.get(q_type, 0) + 1
    
    # 统计错题数量
    mistakes_count = 0
    try:
        conn = sqlite3.connect(MISTAKES_DB_FILE)
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM mistakes')
        mistakes_count = cursor.fetchone()[0]
        conn.close()
    except Exception as e:
        logger.error(f"获取错题统计失败: {e}")
    
    return jsonify({
        'status': 'healthy',
        'message': 'Python教学助手后端服务运行正常',
        'questions_count': len(backend.questions_db),
        'mistakes_count': mistakes_count,
        'question_types': question_types,
        'database_source': 'database.json' if os.path.exists('database.json') else 'questions.json',
        'features': ['题库搜索', 'AI聊天', '错题管理']
    })

@app.route('/ai/chat', methods=['POST'])
def ai_chat():
    """AI聊天接口"""
    try:
        data = request.get_json()
        message = data.get('message', '')
        system = data.get('system', '你是一个专业的Python教学助手，请用简洁明了的中文回答用户的问题。')
        api_key = data.get('apiKey', '')
        api_endpoint = data.get('apiEndpoint', 'https://api.deepseek.com/v1/chat/completions')
        
        if not message:
            return jsonify({'error': '消息不能为空'}), 400
        
        # 如果没有提供API密钥，使用模拟回复
        if not api_key:
            logger.warning("未提供API密钥，使用模拟回复")
            mock_response = f"这是一个模拟的AI回复。\n\n用户问题: {message}\n\n由于未配置有效的API密钥，我无法提供真实的AI回复。请在插件设置中配置您的API密钥以获得更好的体验。"
            return jsonify({
                'response': mock_response,
                'status': 'success',
                'note': '使用模拟回复，请配置API密钥'
            })
        
        # 调用AI API
        response = backend.call_ai_api(message, api_key, api_endpoint, system)
        
        return jsonify({
            'response': response,
            'status': 'success'
        })
        
    except Exception as e:
        logger.error(f"AI聊天接口错误: {e}")
        return jsonify({
            'error': str(e),
            'status': 'error'
        }), 500

@app.route('/search', methods=['POST'])
def search_questions():
    """搜索题库接口"""
    try:
        data = request.get_json()
        query = data.get('query', '')
        
        print(f"收到搜索请求: '{query}'")
        
        if not query:
            return jsonify({'error': '搜索查询不能为空'}), 400
        
        results = backend.search_questions(query)
        print(f"搜索结果: {len(results)} 个")
        
        return jsonify({
            'results': results,
            'count': len(results),
            'status': 'success'
        })
        
    except Exception as e:
        logger.error(f"搜索接口错误: {e}")
        return jsonify({
            'error': str(e),
            'status': 'error'
        }), 500

@app.route('/questions', methods=['GET'])
def get_all_questions():
    """获取所有题目接口"""
    try:
        # 格式化所有题目
        formatted_questions = []
        for question in backend.questions_db:
            formatted_question = backend.format_question_for_display(question)
            formatted_questions.append(formatted_question)
        
        return jsonify({
            'questions': formatted_questions,
            'count': len(formatted_questions),
            'status': 'success'
        })
        
    except Exception as e:
        logger.error(f"获取题目接口错误: {e}")
        return jsonify({
            'error': str(e),
            'status': 'error'
        }), 500

@app.route('/questions/stats', methods=['GET'])
def get_questions_stats():
    """获取题目统计信息接口"""
    try:
        # 统计题目类型
        question_types = {}
        categories = {}
        difficulties = {}
        
        for question in backend.questions_db:
            # 题目类型统计
            q_type = question.get('question_type', '未知')
            question_types[q_type] = question_types.get(q_type, 0) + 1
            
            # 格式化题目以获取分类和难度
            formatted_question = backend.format_question_for_display(question)
            category = formatted_question.get('category', '未知')
            difficulty = formatted_question.get('difficulty', '未知')
            
            categories[category] = categories.get(category, 0) + 1
            difficulties[difficulty] = difficulties.get(difficulty, 0) + 1
        
        return jsonify({
            'total_count': len(backend.questions_db),
            'question_types': question_types,
            'categories': categories,
            'difficulties': difficulties,
            'status': 'success'
        })
        
    except Exception as e:
        logger.error(f"获取题目统计接口错误: {e}")
        return jsonify({
            'error': str(e),
            'status': 'error'
        }), 500

# 错题管理API端点
@app.route('/mistakes', methods=['GET'])
def get_mistakes():
    """获取所有错题"""
    try:
        conn = sqlite3.connect(MISTAKES_DB_FILE)
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM mistakes ORDER BY date DESC')
        rows = cursor.fetchall()
        
        mistakes = []
        for row in rows:
            mistake = {
                'id': row[0],
                'title': row[1],
                'content': row[2],
                'answer': row[3],
                'tags': json.loads(row[4]) if row[4] else [],
                'category': row[5],
                'difficulty': row[6],
                'date': row[7],
                'aiSummary': row[8] or ''
            }
            mistakes.append(mistake)
        
        conn.close()
        return jsonify({'mistakes': mistakes})
    except Exception as e:
        logger.error(f"获取错题失败: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/mistakes', methods=['POST'])
def save_mistakes():
    """保存错题数据"""
    try:
        data = request.get_json()
        mistakes = data.get('mistakes', [])
        
        conn = sqlite3.connect(MISTAKES_DB_FILE)
        cursor = conn.cursor()
        
        # 清空现有数据
        cursor.execute('DELETE FROM mistakes')
        
        # 插入新数据
        for mistake in mistakes:
            cursor.execute('''
                INSERT INTO mistakes (id, title, content, answer, tags, category, difficulty, date, ai_summary)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                mistake.get('id'),
                mistake.get('title', ''),
                mistake.get('content', ''),
                mistake.get('answer', ''),
                json.dumps(mistake.get('tags', []), ensure_ascii=False),
                mistake.get('category', ''),
                mistake.get('difficulty', ''),
                mistake.get('date', datetime.now().isoformat()),
                mistake.get('aiSummary', '')
            ))
        
        conn.commit()
        conn.close()
        logger.info(f"成功保存 {len(mistakes)} 个错题")
        return jsonify({'status': 'success'})
    except Exception as e:
        logger.error(f"保存错题失败: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/mistakes/<int:mistake_id>', methods=['PUT'])
def update_mistake(mistake_id):
    """更新单个错题"""
    try:
        data = request.get_json()
        
        conn = sqlite3.connect(MISTAKES_DB_FILE)
        cursor = conn.cursor()
        
        # 检查错题是否存在
        cursor.execute('SELECT id FROM mistakes WHERE id = ?', (mistake_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'error': '错题不存在'}), 404
        
        # 更新错题
        cursor.execute('''
            UPDATE mistakes 
            SET title = ?, content = ?, answer = ?, tags = ?, category = ?, difficulty = ?, ai_summary = ?
            WHERE id = ?
        ''', (
            data.get('title', ''),
            data.get('content', ''),
            data.get('answer', ''),
            json.dumps(data.get('tags', []), ensure_ascii=False),
            data.get('category', ''),
            data.get('difficulty', ''),
            data.get('aiSummary', ''),
            mistake_id
        ))
        
        conn.commit()
        conn.close()
        logger.info(f"成功更新错题 ID: {mistake_id}")
        return jsonify({'status': 'success'})
    except Exception as e:
        logger.error(f"更新错题失败: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/mistakes/<int:mistake_id>', methods=['DELETE'])
def delete_mistake(mistake_id):
    """删除单个错题"""
    try:
        conn = sqlite3.connect(MISTAKES_DB_FILE)
        cursor = conn.cursor()
        
        # 检查错题是否存在
        cursor.execute('SELECT id FROM mistakes WHERE id = ?', (mistake_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'error': '错题不存在'}), 404
        
        # 删除错题
        cursor.execute('DELETE FROM mistakes WHERE id = ?', (mistake_id,))
        
        conn.commit()
        conn.close()
        logger.info(f"成功删除错题 ID: {mistake_id}")
        return jsonify({'status': 'success'})
    except Exception as e:
        logger.error(f"删除错题失败: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # 初始化错题数据库
    init_mistakes_db()
    
    logger.info("启动Python教学助手后端服务...")
    logger.info("服务包含：题库搜索、AI聊天、错题管理功能")
    app.run(host='0.0.0.0', port=5000, debug=True) 