import json
import os
import re
import requests  # 引入requests库
from openai import OpenAI


# ==============================================================================
# @param prompt (str): 发送给模型的完整提示或问题。
# @return (str): 模型返回的原始文本回答。
# ==============================================================================
def call_deepseek_model(question_text: str, prompt: str) -> str:
    api_key = "sk-5967010b633c410d8bd333ea9f01b55c"
    if not api_key:
        print("错误：请先设置 DEEPSEEK_API_KEY")
        return ""  # 如果没有密钥则返回空

    # 2. API的URL和请求头
    url = "https://api.deepseek.com/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }

    # 3. 构建请求体
    payload = {
        "model": "deepseek-chat",  # 确保模型名称正确
        "messages": [
            {"role": "system", "content": prompt},
            {"role": "user", "content": question_text}
        ],
        "temperature": 0.1,  # 设置较低的温度以获得更确定的答案
        "max_tokens": 20,  # 因为只需要返回一个字母或单词，所以限制最大token
        "stream": False
    }

    print("-----------------------------------")
    print(f"正在向模型发送内容...")
    # print(f"Prompt: {prompt}") # 如果需要调试，可以取消此行注释

    try:
        response = client.chat.completions.create(**payload)
        model_answer = response.choices[0].message.content

        print(f"模型回答: {model_answer}")
        print("-----------------------------------\n")
        return model_answer

    except requests.exceptions.RequestException as e:
        print(f"请求API时发生网络错误: {e}")
        return ""
    except KeyError:
        print(f"解析API响应时出错，响应内容: {response.text}")
        return ""
    except Exception as e:
        print(f"调用API时发生未知错误: {e}")
        return ""


def parse_model_answer(response: str, question_type: str) -> str:
    """
    解析和标准化模型的原始回答。

    @param response (str): 模型的原始文本回答。
    @param question_type (str): 'single_choice' 或 'true_false'。
    @return (str): 标准化后的答案 ('A', 'B', 'True', 'False', 等)。
    """
    if not response:
        return ""

    cleaned_response = response.strip()

    if question_type == 'single_choice':
        # 提取回答中开头的A, B, C, D（不区分大小写）
        match = re.search(r"^[A-D]", cleaned_response, re.IGNORECASE)
        if match:
            return match.group(0).upper()

    elif question_type == 'true_false':
        # 判断回答中是否包含 'true' 或 'false'
        if 'true' in cleaned_response.lower():
            return 'True'
        elif 'false' in cleaned_response.lower():
            return 'False'

    return ""  # 如果无法解析，返回空字符串


def run_evaluation(questions: list, question_type: str, use_prompt: bool):
    """
    对给定的问题列表进行评估。

    @param questions (list): 问题字典的列表。
    @param question_type (str): 'single_choice' 或 'true_false'。
    @param use_prompt (bool): 是否使用引导性的Prompt。
    @return (tuple): 正确率, 正确数量, 总数量。
    """
    correct_count = 0
    total_count = len(questions)

    for q in questions:
        question_text = q['question']
        correct_answer = q['answer']
        prompt = ""

        # 根据是否使用Prompt和问题类型，构建不同的输入
        if use_prompt:
            if question_type == 'single_choice':
                prompt = f"你是一个Python编程专家。请回答下面的单项选择题，只返回正确选项的字母（例如：A）。"
            else:  # true_false
                prompt = f"你是一个Python编程专家。请判断以下说法的正误，只返回 'True' 或 'False'。  "
        # 获取模型回答并进行解析
        model_response = call_deepseek_model(question_text, prompt)
        model_answer = parse_model_answer(model_response, question_type)

        print(f"题目ID: {q['id']}, 模型解析后答案: '{model_answer}', 正确答案: '{correct_answer}'")
        if model_answer == correct_answer:
            correct_count += 1
            print(">> 结果: 正确\n")
        else:
            print(f">> 结果: 错误\n")

    accuracy = (correct_count / total_count) * 100 if total_count > 0 else 0
    return accuracy, correct_count, total_count


def main():
    # 您提供的JSON数据已内置于此
    json_content = {
        "single_choice_questions": [
            {"id": 1,
             "question": "以下代码段的输出是什么？\nx = 10\ny = 5\nif x > y:\n    if x < 20:\n        print(\"A\")\n    elif x == 10:\n        print(\"B\")\n    else:\n        print(\"C\")\nelse:\n    print(\"D\")",
             "options": {"A": "\"A\"", "B": "\"B\"", "C": "\"C\"", "D": "\"D\""}, "answer": "A"},
            {"id": 2, "question": "以下哪个选项正确地表示了if-else语句的语法？",
             "options": {"A": "if condition:\\nstatement\\nelse:\\nstatement",
                         "B": "if condition:\\nstatement;\\nelse:\\nstatement",
                         "C": "if condition\\n{ statement }\\nelse\\n{ statement }",
                         "D": "if (condition)\\n{ statement; }\\nelse\\n{ statement; }"}, "answer": "A"},
            {"id": 3, "question": "如果要检查变量 x 是否等于 10 或者 y 是否等于 20，应该使用哪个语法？",
             "options": {"A": "if x = 10 or y = 20:", "B": "if x == 10 or y == 20:", "C": "if x == 10 || y == 20:",
                         "D": "if x = 10 || y = 20:"}, "answer": "B"},
            {"id": 4, "question": "为什么在编写条件语句时，应尽量避免过度嵌套？",
             "options": {"A": "因为会降低代码的运行速度", "B": "因为会增加内存消耗", "C": "因为会使代码难以理解和维护",
                         "D": "因为Python不支持超过两层的嵌套"}, "answer": "C"},
            {"id": 5,
             "question": "如果 x = 3 和 y = 4，下面代码的输出是什么？\nif x * y > 10:\n    print(\"A\")\nelif x + y < 10:\n    print(\"B\")\nelse:\n    print(\"C\")",
             "options": {"A": "A", "B": "B", "C": "C", "D": "无"}, "answer": "A"},
            {"id": 6,
             "question": "在以下代码中，最终 y 的值是多少？\nx = 7\ny = 10\nif x > 5:\n    y += 5\nif x < 10:\n    y += 10",
             "options": {"A": "15", "B": "20", "C": "25", "D": "30"}, "answer": "C"},
            {"id": 7, "question": "若检查一个变量 x 是否在1 到 10 之间，不能选哪个选项？",
             "options": {"A": "if x >=1 and <= 10:", "B": "if x >= 1 and x <= 10:", "C": "if 1<= x <= 10:",
                         "D": "if 10 >= x >= 1:"}, "answer": "A"},
            {"id": 8, "question": "if-elif-else 语句中，哪种情况下会执行 else 语句？",
             "options": {"A": "当 if 条件为 True", "B": "当所有 if 和 elif 条件均为 False",
                         "C": "当第一个 if 条件为 False 时", "D": "当 elif 条件为 True 时"}, "answer": "B"},
            {"id": 9, "question": "在使用 if-elif-else 语句时，如何确保某个特定条件优先被评估？",
             "options": {"A": "将该条件放在 if 语句中", "B": "将该条件放在 elif 语句的最前面",
                         "C": "在 if 和 elif 语句中同时使用该条件", "D": "使用嵌套的 if 语句来优先评估该条件"},
             "answer": "A"},
            {"id": 10, "question": "下列选项中，能求出x和y中最小值，并赋值给min的是_____。",
             "options": {"A": "min = x if x < y else y", "B": "min = x < y ? x : y", "C": "if x < y: min=x",
                         "D": "if (x<y): x, y = y, x"}, "answer": "A"},
            {"id": 11, "question": "对于两个集合s1和s2，s1 < s2的意思是？",
             "options": {"A": "s1的大小小于s2的大小", "B": "s1的元素比s2的小", "C": "s1是s2的真子集",
                         "D": "s2是s1的真子集"}, "answer": "C"},
            {"id": 12, "question": "对于集合s，以下哪个操作是不存在的？",
             "options": {"A": "len(s)", "B": "s.append(1)", "C": "max(s)", "D": "s - {1}"}, "answer": "B"},
            {"id": 13, "question": "对于正确的表达式a[2]，a不可能是以下哪个类型？",
             "options": {"A": "集合", "B": "列表", "C": "元组", "D": "字典"}, "answer": "A"},
            {"id": 14, "question": "可以使用____运算符来确定一个键是否在字典中。",
             "options": {"A": "&", "B": "in", "C": "^", "D": "?"}, "answer": "B"},
            {"id": 15, "question": "你可以使用____从字典中删除元素。",
             "options": {"A": "remove", "B": "rease", "C": "delete", "D": "del"}, "answer": "D"},
            {"id": 16, "question": "返回集合中元素个数的函数是______。",
             "options": {"A": "size()", "B": "len()", "C": "elements()", "D": "count()"}, "answer": "B"},
            {"id": 17, "question": "以下哪个语句得到的 C 不是集合 A 和集合 B 的并集？",
             "options": {"A": "C = A | B", "B": "C = A.update(B)", "C": "C = set(list(A) + list(B))",
                         "D": "C = A.union(B)"}, "answer": "B"},
            {"id": 18, "question": "下面那个不是Python可以接受的变量名？",
             "options": {"A": "abc", "B": "_23ac", "C": "i", "D": "good-name"}, "answer": "D"},
            {"id": 19,
             "question": "输入10，下面程序行号为2的语句输出是多少？\nfor number in range(1,10):\n if number%2 and not number%3:\n the_sum += number",
             "options": {"A": "12", "B": "7", "C": "13", "D": "8"}, "answer": "A"},
            {"id": 20, "question": "下面定义字典的语句那个是正确的？",
             "options": {"A": "momthdays=dict(Jan=31,Feb=28,Mar=31,Apr=30)",
                         "B": "momthdays=dict(\"Jan\"=31,\"Feb\"=28,\"Mar\"=31,“Apr\"=30)",
                         "C": "momthdays={Jan:31,Feb:28,Mar:31,Apr:30}",
                         "D": "momthdays={Jan=31,Feb=28,Mar=31,Apr:30}"}, "answer": "A"},
            {"id": 21, "question": "下列程序运行输出结果为_______。",
             "explanation": "递归因式分解 18 -> 3 6 -> 2 3，输出：3 2 3",
             "options": {"A": "3 2 3", "B": "2 9 3", "C": "3 6 3", "D": "2 3 6"}, "answer": "B"},
            {"id": 22, "question": "选择下面程序的运行结果", "explanation": "number = 25，25%5==0，i=5，isPrime=False",
             "options": {"A": "i is 5 isPrime is True", "B": "i is 5 isPrime is False", "C": "i is 6 isPrime is True",
                         "D": "i is 6 isPrime is False"}, "answer": "B"},
            {"id": 23, "question": "下列程序运行输出结果为_______。", "explanation": "day=4，x=(x+1)*2 → 4 次，最终 x=46",
             "options": {"A": "22", "B": "46", "C": "47", "D": "45"}, "answer": "B"},
            {"id": 24, "question": "下列程序运行输出结果为_______。",
             "explanation": "函数内 b=1 局部，乘全局 c=4 得 b=4，函数外打印全局 b=2，c=4",
             "options": {"A": "4 4 2 4", "B": "4 4 4 4", "C": "4 2 4 4", "D": "2 4 2 4"}, "answer": "A"},
            {"id": 25, "question": "对于两个集合s1和s2，s1 < s2的意思是？",
             "options": {"A": "s1的大小小于s2的大小", "B": "s1的元素比s2的小", "C": "s1是s2的真子集",
                         "D": "s2是s1的真子集"}, "answer": "C"},
            {"id": 26, "question": "对于集合s，以下哪个操作是不存在的？",
             "options": {"A": "len(s)", "B": "s.append(1)", "C": "max(s)", "D": "s - {1}"}, "answer": "B"},
            {"id": 27, "question": "对于正确的表达式a[2]，a不可能是以下哪个类型？",
             "options": {"A": "集合", "B": "列表", "C": "元组", "D": "字典"}, "answer": "A"},
            {"id": 28, "question": "可以使用____运算符来确定一个键是否在字典中。",
             "options": {"A": "&", "B": "in", "C": "^", "D": "?"}, "answer": "B"},
            {"id": 29, "question": "你可以使用____从字典中删除元素。",
             "options": {"A": "remove", "B": "rease", "C": "delete", "D": "del"}, "answer": "D"},
            {"id": 30, "question": "返回集合中元素个数的函数是______。",
             "options": {"A": "size()", "B": "len()", "C": "elements()", "D": "count()"}, "answer": "B"},
            {"id": 31, "question": "下列程序运行输出结果为_______。",
             "explanation": "键 '2' 为字符串，2 是整数，不存在，返回 -1",
             "options": {"A": "'B'", "B": "'A'", "C": "None", "D": "-1"}, "answer": "D"},
            {"id": 32, "question": "以下程序执行的结果是()", "explanation": "遍历字典默认是遍历键：'a', 'c'",
             "options": {"A": "a:b c:d", "B": "a c", "C": "b d", "D": "以上都不对"}, "answer": "B"}
        ],
        "true_false_questions": [
            {"id": 1, "question": "第三方模块要先安装才能使用。", "answer": "True"},
            {"id": 2, "question": "len(set([0,4,5,6,0,7,8]))的结果是7。", "answer": "False"},
            {"id": 3, "question": "字符串可以使用 max() 和 min() 函数进行比较大小。", "answer": "True"},
            {"id": 4, "question": "对于元组 t = (1, 2, {3: 4})，执行 t[2][0] = 5 会报错。", "answer": "False"},
            {"id": 5, "question": "列表的 sort() 方法返回一个新的已排序列表。", "answer": "False"},
            {"id": 6, "question": "执行python语句 a=int(\"9\") 后，此刻变量 a代表的是整数类型的数据。", "answer": "True"},
            {"id": 7, "question": "该语句可以正确创立一个字典：monthdays=dict(Jan=31,Feb=28,Mar=31,Apr=30)。",
             "answer": "True"},
            {"id": 8, "question": "在 Python 中，实例方法必须包含 self 参数。", "answer": "True"},
            {"id": 9, "question": "{(1,2,[1]),10,'abc'}是一个合法的python集合。", "answer": "False"},
            {"id": 10,
             "question": "执行以下代码， numbers 的内容将变成[1, 3, 2, 4]。\nnumbers = [1, 2, 3, 2, 4]\nnumbers.pop(1)",
             "answer": "True"},
            {"id": 11, "question": "集合的元素可以是任意数据类型。", "answer": "False"},
            {"id": 12, "question": "a={},type(a)结果是<class 'set'>。", "answer": "False"},
            {"id": 13,
             "question": "下面程序的运行结果一定是：1 2 3 4\nset1={1,2,3,4}\nfor i in set1:\n    print(i,end=\" \")",
             "answer": "False"},
            {"id": 14, "question": "列表可以作为字典的键。", "answer": "False"},
            {"id": 15,
             "question": "下面程序的输出是张秀华。\ndic={\"赵洁\" : 15264771766,\"张秀华\" : 13063767486,\"胡桂珍\" : 15146046882,\"龚丽丽\" : 13606379542,\"岳瑜\" : 13611987725}\nreversedic={v:k for k,v in dic.items()}\nprint(reversedic[13063767486])",
             "answer": "True"},
            {"id": 16,
             "question": "下面程序输出的是True。\ndic1={\"赵洁\" : 15264771766,\"张秀华\" : 13063767486,\"胡桂珍\" : 15146046882,\"龚丽丽\" : 13606379542,\"岳瑜\" : 13611987725}\ndic2={\"王玉兰\" : 15619397270,\"王强\" : 15929494512,\"王桂荣\" : 13794876998,\"邓玉英\" : 18890393268,\"何小红\" : 13292597821}\ndic3={**dic1,**dic2}\ndic1.update(dic2)\nprint(dic1==dic3)",
             "answer": "True"},
            {"id": 17,
             "question": "下面程序输出的是15146046882。\ndic1={\"赵洁\" : 15264771766,\"张秀华\" : 13063767486,\"胡桂珍\" : 15146046882,\"龚丽丽\" : 13606379542,\"岳瑜\" : 13611987725}\ndic2={\"王玉兰\" : 15619397270,\"王强\" : 15929494512,\"王桂荣\" : 13794876998,\"邓玉英\" : 18890393268,\"胡桂珍\" : 13292597821}\ndic3={**dic1,**dic2}\nprint(dic3[\"胡桂珍\"])",
             "answer": "False"},
            {"id": 18, "question": "下面程序的输出是3。\ns={1,2,3}\ns1=s\ns1.remove(2)\nprint(len(s))",
             "answer": "False"},
            {"id": 19,
             "question": "下面程序输出是circle。\nd={\"color\":\"red\",\"shape\":\"circle\"}\nd1=d\nd1[\"shape\"]=\"triangle\"\nprint(\"shape\")",
             "answer": "False"},
            {"id": 20, "question": "嵌套if语句中的else分支总是与最近的未闭合的if语句匹配。", "answer": "True"},
            {"id": 21, "question": "在Python中，if语句的条件表达式可以是一个复杂的表达式，包括函数调用。",
             "answer": "True"},
            {"id": 22, "question": "在Python中，如果if语句的条件为一个空字符串，条件会被解释为True。", "answer": "False"},
            {"id": 23, "question": "在嵌套if语句中，内层的if条件表达式无法访问外层的变量。", "answer": "False"},
            {"id": 24, "question": "在if语句中，and运算符的优先级低于or运算符。", "answer": "False"},
            {"id": 25, "question": "Python的if-elif-else语句中，elif分支的数量是可以任意多个的。", "answer": "True"},
            {"id": 26, "question": "在Python中，if语句的条件表达式必须是一个布尔值。", "answer": "False"},
            {"id": 27, "question": "Python中的if-else语句可以嵌套在单行代码中，使用三元运算符实现。", "answer": "True"},
            {"id": 28,
             "question": "如下两段代码功能一样，程序结构也一样\nif a < 0:\n    print(\"<0\")\nelif a == 0:\n    print(\"=0\")\nelif a > 0:\n    print(\"a>0\")\n\nif a < 0:\n    print(\"<0\")\nif a == 0:\n    print(\"=0\")\nif a > 0:\n    print(\"a>0\")",
             "answer": "False"},
            {"id": 29, "question": "在if-elif-else结构中，else子句是可选的。", "answer": "True"}
        ]
    }

    single_choice_questions = json_content['single_choice_questions']
    true_false_questions = json_content['true_false_questions']

    # --- 无Prompt测试 ---
    print("=" * 40)
    print("           无Prompt模式测试开始           ")
    print("=" * 40 + "\n")
    sc_acc_no_prompt, sc_ok_no_prompt, sc_total = run_evaluation(single_choice_questions, 'single_choice',
                                                                 use_prompt=False)
    tf_acc_no_prompt, tf_ok_no_prompt, tf_total = run_evaluation(true_false_questions, 'true_false', use_prompt=False)

    # --- 有Prompt测试 ---
    print("\n" + "=" * 40)
    print("           有Prompt模式测试开始            ")
    print("=" * 40 + "\n")
    sc_acc_with_prompt, sc_ok_with_prompt, _ = run_evaluation(single_choice_questions, 'single_choice', use_prompt=True)
    tf_acc_with_prompt, tf_ok_with_prompt, _ = run_evaluation(true_false_questions, 'true_false', use_prompt=True)

    # --- 汇总结果 ---
    total_ok_no_prompt = sc_ok_no_prompt + tf_ok_no_prompt
    total_questions = sc_total + tf_total
    total_acc_no_prompt = (total_ok_no_prompt / total_questions) * 100 if total_questions > 0 else 0

    total_ok_with_prompt = sc_ok_with_prompt + tf_ok_with_prompt
    total_acc_with_prompt = (total_ok_with_prompt / total_questions) * 100 if total_questions > 0 else 0

    print("\n\n" + "=" * 40)
    print("               最终测试结果汇总               ")
    print("=" * 40)
    print("\n--- 无Prompt模式 ---")
    print(f"选择题: 正确 {sc_ok_no_prompt}/{sc_total}, 正确率: {sc_acc_no_prompt:.2f}%")
    print(f"判断题: 正确 {tf_ok_no_prompt}/{tf_total}, 正确率: {tf_acc_no_prompt:.2f}%")
    print(f"总计:   正确 {total_ok_no_prompt}/{total_questions}, 正确率: {total_acc_no_prompt:.2f}%\n")

    print("--- 有Prompt模式 ---")
    print(f"选择题: 正确 {sc_ok_with_prompt}/{sc_total}, 正确率: {sc_acc_with_prompt:.2f}%")
    print(f"判断题: 正确 {tf_ok_with_prompt}/{tf_total}, 正确率: {tf_acc_with_prompt:.2f}%")
    print(f"总计:   正确 {total_ok_with_prompt}/{total_questions}, 正确率: {total_acc_with_prompt:.2f}%")
    print("\n" + "=" * 40)


if __name__ == '__main__':
    main()