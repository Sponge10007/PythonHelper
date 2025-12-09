from flask import Blueprint, jsonify, request, Response
from app.services.ai_service import call_ai_api
import json
import logging
import re

pta_bp = Blueprint('pta', __name__)
logger = logging.getLogger(__name__)

# --- AI指令：直接输出HTML ---
SYSTEM_PROMPT_PTA_HTML_GENERATOR = """
你是一个顶级的Python编程教师和前端开发专家。你的任务是接收一个包含多道PTA题目的JSON数组，然后生成一个完整、美观、可以直接在浏览器中打开的HTML页面来展示对所有题目的专业解析。

**你的输出必须是一个完整的HTML文档字符串，不能有任何额外的解释或代码块标记。**

**HTML结构和样式要求:**

1.  **基础结构**: 使用标准的 `<!DOCTYPE html>`, `<html>`, `<head>`, `<body>` 标签。
2.  **样式 (`<style>`)**:
    * 在 `<head>` 中嵌入 `<style>` 标签。
    * **整体页面**: `body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #333; margin: 0; padding: 20px; background-color: #f8f9fa; }`
    * **主容器**: `.container { max-width: 900px; margin: auto; background: #fff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); overflow: hidden; }`
    * **头部**: `.header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; text-align: center; }`
    * **题目卡片**: `.question-card { border-bottom: 1px solid #eee; padding: 25px 30px; }`
    * **题目标题 (H2)**: `{ font-size: 1.4em; color: #3a3a3a; border-bottom: 2px solid #667eea; padding-bottom: 8px; margin-top: 0; }`
    * **代码块 (`<pre>`)**: `{ background-color: #2d2d2d; color: #f8f8f2; padding: 15px; border-radius: 5px; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word; }`
    * **解析部分标题 (H4)**: `{ color: #667eea; margin-bottom: 8px; border-left: 3px solid #764ba2; padding-left: 10px; }`
3.  **内容 (`<body>`)**:
    * 遍历输入的JSON数组中的 **每一道题**。
    * 为每一道题创建一个 class 为 `question-card` 的 `<div>`。
    * 在卡片中，清晰地展示 **题目内容** (放在 `<pre><code>` 标签中)、**标准答案**。
    * 接着，为每一道题生成包含以下五个部分的解析，并使用 `<h4>` 作为各部分标题：
        * 知识点考察
        * 题目解析
        * 解题思路
        * 代码画廊/选项分析
        * 易错警示

**输入会是一个JSON数组，你只需要处理它并返回一个HTML字符串。**
"""


def _combine_data(raw_data):
    """将从前端捕获的原始JSON字符串合并成一个结构化的题目列表"""
    problems_map = {}

    for problems_json_str in raw_data.get('problems', []):
        try:
            problems_data = json.loads(problems_json_str)
            problem_type = problems_data.get('problemSetProblemType')
            for p in problems_data.get('problemSetProblems', []):
                p['type'] = problem_type
                problems_map[p['id']] = p
        except json.JSONDecodeError:
            logger.warning("解析题目JSON时出错，已跳过。")
            continue

    for answers_json_str in raw_data.get('answers', []):
        try:
            answers_data = json.loads(answers_json_str)
            for pid, answer_info in answers_data.get('problemStandardAnswers', {}).items():
                if pid in problems_map:
                    problems_map[pid]['correctAnswer'] = answer_info.get('answer')
        except json.JSONDecodeError:
            logger.warning("解析答案JSON时出错，已跳过。")
            continue

    for submissions_json_str in raw_data.get('submissions', []):
        try:
            submissions_data = json.loads(submissions_json_str)
            for pid, sub_info in submissions_data.get('lastSubmissions', {}).items():
                if pid in problems_map:
                    problems_map[pid]['lastSubmission'] = sub_info
        except json.JSONDecodeError:
            logger.warning("解析提交记录JSON时出错，已跳过。")
            continue

    return list(problems_map.values())


@pta_bp.route('/analyze', methods=['POST'])
def analyze_pta_questions():
    try:
        data = request.get_json()
        raw_data = data.get('rawData')
        api_key = data.get('apiKey')
        api_endpoint = data.get('apiEndpoint')

        if not all([raw_data, api_key, api_endpoint]):
            return jsonify({'error': '缺少必要参数 (rawData, apiKey, apiEndpoint)'}), 400

        # 1. 合并前端发来的原始数据
        questions = _combine_data(raw_data)
        if not questions:
            return jsonify({'error': '未能从原始数据中解析出任何题目'}), 400

        logger.info(f"成功合并 {len(questions)} 道题目，准备请求AI生成HTML报告...")

        print(questions)
        # 2. 直接将题目列表转换为JSON字符串，一次性发送给AI
        # AI API需要字符串格式的输入，JSON是表示复杂数据结构最清晰的方式。
        ai_input_string = json.dumps(
            [{
                "label": q.get('label'),
                "type": q.get('type'),
                "content": q.get('content'),
                "options": q.get('choices', []),
                "correctAnswer": q.get('correctAnswer')
            } for q in questions],
            ensure_ascii=False,
            indent=2
        )

        # 3. 调用AI生成HTML报告
        try:
            html_report = call_ai_api(questions, api_key, api_endpoint, SYSTEM_PROMPT_PTA_HTML_GENERATOR)

            if not html_report.strip().lower().startswith('<!doctype html>'):
                raise Exception("AI未返回有效的HTML文档。")

            logger.info("成功从AI接收到HTML分析报告。")
            return Response(html_report, mimetype='text/html')

        except Exception as ai_error:
            logger.error(f"AI分析或HTML生成过程中发生错误: {ai_error}")
            error_html = f"<h1>AI 分析失败</h1><p>错误详情: {ai_error}</p><pre>{ai_response_text}</pre>"
            return Response(error_html, mimetype='text/html', status=500)

    except Exception as e:
        logger.error(f"PTA分析接口错误: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500