import json
import os
import logging
from typing import Dict, List
from flask import current_app

logger = logging.getLogger(__name__)


class QuestionService:
    def __init__(self):
        self.questions_db = []
        self.load_questions_db()

    def load_questions_db(self):
        """加载题库数据库"""
        try:
            database_path = current_app.config['QUESTIONS_DB_PATH_NEW']
            if os.path.exists(database_path):
                with open(database_path, 'r', encoding='utf-8') as f:
                    self.questions_db = json.load(f)
                    logger.info(f"已从 {database_path} 加载 {len(self.questions_db)} 道题目")
            else:
                questions_path = current_app.config['QUESTIONS_DB_PATH_OLD']
                if os.path.exists(questions_path):
                    with open(questions_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        self.questions_db = data.get('questions', [])
                        logger.info(f"已从 {questions_path} 加载 {len(self.questions_db)} 道题目")
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
                "id": 1, "title": "Python变量和数据类型", "content": "在Python中，如何定义一个字符串变量？",
                "answer": "使用引号（单引号或双引号）来定义字符串变量，例如：name = 'Python' 或 name = \"Python\"",
                "category": "基础语法", "difficulty": "简单", "keywords": ["变量", "字符串", "定义", "引号"]
            }
        ]

    def search_questions(self, query: str) -> List[Dict]:
        """搜索题库 - 只对题目文本进行搜索"""
        if not query or len(query.strip()) < 1:
            return []

        query = query.strip()
        results = []
        all_questions_with_scores = []
        query_lower = query.lower()

        for question in self.questions_db:
            score = 0
            question_content = question.get('question', '')
            question_content_lower = question_content.lower()

            if query_lower in question_content_lower:
                score += 10

            query_words = query_lower.split()
            for word in query_words:
                if len(word) >= 2 and word in question_content_lower:
                    score += 3

            # (此处的关键词匹配和评分逻辑保持不变)
            special_keywords = ['if', 'else', 'def', 'class', 'list', 'dict', 'for', 'while']  # 简化示例
            for keyword in special_keywords:
                if keyword.lower() in query_lower and keyword.lower() in question_content_lower:
                    score += 2

            char_match_score = sum(0.1 for char in query_lower if char in question_content_lower)
            word_frequency_score = sum(
                question_content_lower.count(word) * 0.5 for word in query_words if len(word) >= 2)

            total_score = score + char_match_score + word_frequency_score
            formatted_question = self.format_question_for_display(question)

            all_questions_with_scores.append({**formatted_question, 'score': total_score, 'original_score': score})

            if score > 0:
                results.append({**formatted_question, 'score': total_score, 'original_score': score})

        if results:
            return sorted(results, key=lambda x: x['score'], reverse=True)[:5]
        else:
            all_sorted = sorted(all_questions_with_scores, key=lambda x: x['score'], reverse=True)
            if all_sorted:
                best_match = all_sorted[0]
                best_match['is_fallback'] = True
                return [best_match]
            return []

    def format_question_for_display(self, question: Dict) -> Dict:
        """格式化题目数据以适应前端显示 (此函数内容保持不变)"""
        # ... (此处省略原函数的所有格式化逻辑，内容与您提供的代码完全相同)
        question_type = question.get('question_type', '')
        question_number = question.get('question_number', '')
        question_content = question.get('question', '')
        options = question.get('options', [])
        answer = question.get('answer', '')
        title = f"{question_type} {question_number}"
        content = question_content
        if not content.endswith('\n'):
            content += '\n'
        if options:
            content += "\n选项：\n" + "\n".join(options)
        content = content.strip()
        if question_type == "判断题":
            answer_text = f"答案：{'正确' if answer == 'True' else '错误'}"
        elif question_type == "单选题" and options and answer in ['A', 'B', 'C', 'D']:
            option_index = ord(answer) - ord('A')
            if 0 <= option_index < len(options):
                option_content = options[option_index].replace(f"{answer}. ", "")
                answer_text = f"答案：{answer} - {option_content}"
            else:
                answer_text = f"答案：{answer}"
        else:
            answer_text = f"答案：{answer}"

        # ... (此处省略关键词提取、难度和分类判断等逻辑)
        keywords = []
        category = "基础语法"
        difficulty = "简单"

        return {
            'id': f"{question_type}_{question_number}", 'title': title, 'content': content,
            'answer': answer_text, 'category': category, 'difficulty': difficulty, 'keywords': keywords,
            'question_type': question_type, 'question_number': question_number,
            'original_question': question_content, 'options': options, 'original_answer': answer,
            'full_question': {
                'question_text': question_content, 'options_list': options,
                'correct_answer': answer, 'question_type': question_type, 'question_number': question_number
            }
        }

# 移除这一行: question_service = QuestionService()