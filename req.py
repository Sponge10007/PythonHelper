import asyncio
import json
from playwright.async_api import async_playwright

# 使用字典来分类存储捕获到的数据
captured_data = {
    "problems": None,
    "answers": None,
    "submissions": None
}


async def handle_response(response):
    """
    升级版的响应处理器（“监听器”）。
    现在它会精确匹配你找到的三种API请求。
    """
    # 规则1: 仍然只关心 XHR (Fetch) 类型的请求
    if response.request.resource_type != "xhr":
        return  # 如果不是XHR，直接忽略

    url = response.url
    data_captured = False

    try:
        # 规则2: 精确匹配不同的API端点
        if "/exam-problems" in url:
            print(f"✅ 捕获到【题目列表】API: {url}")
            captured_data["problems"] = await response.json()
            data_captured = True

        elif "/standard-answers" in url:
            print(f"✅ 捕获到【标准答案】API: {url}")
            captured_data["answers"] = await response.json()
            data_captured = True

        elif "/last-submissions" in url:
            print(f"✅ 捕获到【最后提交】API: {url}")
            captured_data["submissions"] = await response.json()
            data_captured = True

        if data_captured:
            print("   -- 数据已成功解析并分类存储。")

    except Exception as e:
        print(f"   -- 解析JSON时发生错误: {e}")


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()

        page.on("response", handle_response)

        print(">>> 正在打开登录页面...")
        await page.goto("https://pintia.cn/auth/login")

        print("\n*** 请在打开的浏览器窗口中手动登录 ***")
        print("--- 登录成功后，脚本将在30秒后自动继续 ---")
        await page.wait_for_timeout(30000)

        # ======================= 请在这里修改 =======================
        # 把浏览器导航到你发现这些API请求的那个具体页面
        # 这通常是一个考试页面或题目集页面
        exam_url = "https://pintia.cn/problem-sets/1871092684895178752/exam/problems/type/1"  # 这是一个示例URL，请替换成你的目标页面
        # ==========================================================

        print(f"\n>>> 登录完成，正在导航到目标页面: {exam_url}")
        await page.goto(exam_url)

        print(">>> 页面加载中，正在等待API请求被自动触发...")
        # 通常进入页面后，题目和答案的API就会被自动调用
        # 我们在这里多等待一会儿，确保所有请求都加载完毕
        await page.wait_for_timeout(10000)

        print(">>> 数据捕获阶段完成，正在关闭浏览器...")
        await browser.close()

        print("\n\n================ 🚀 最终捕获结果 🚀 ================")
        if captured_data["problems"]:
            print("\n--- 题目列表 ---")
            print(json.dumps(captured_data["problems"], indent=2, ensure_ascii=False))
        else:
            print("\n--- 未能捕获到题目列表 ---")

        if captured_data["answers"]:
            print("\n--- 标准答案 ---")
            print(json.dumps(captured_data["answers"], indent=2, ensure_ascii=False))
        else:
            print("\n--- 未能捕获到标准答案 ---")

        if captured_data["submissions"]:
            print("\n--- 最后提交记录 ---")
            print(json.dumps(captured_data["submissions"], indent=2, ensure_ascii=False))
        else:
            print("\n--- 未能捕获到提交记录 ---")


if __name__ == "__main__":
    asyncio.run(main())