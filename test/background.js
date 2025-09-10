// 监听用户点击插件图标的事件
chrome.action.onClicked.addListener((tab) => {
  console.log("插件图标被点击，开始获取PTA数据...");
  fetchPtaData();
});

async function fetchPtaData() {
  const domain = "https://pintia.cn";

  // 1. 获取指定域名的所有Cookie
  try {
    const cookies = await chrome.cookies.getAll({ url: domain });
    
    if (cookies.length === 0) {
      console.error(`在 ${domain} 上没有找到任何Cookie。请确保您已在该网站上登录。`);
      return;
    }

    // 2. 将Cookie数组转换成一个单一的字符串，用于请求头
    const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

    // 3. 定义API的URL (使用你之前找到的URL)
    const problemsApiUrl = "https://pintia.cn/api/problem-sets/1871092684895178752/exam-problems?exam_id=1873271590445719552&problem_type=MULTIPLE_CHOICE";
    const answersApiUrl = "https://pintia.cn/api/problem-sets/1871092684895178752/standard-answers?problem_type=MULTIPLE_CHOICE";

    // 4. 使用fetch API带上Cookie发起请求
    const requestOptions = {
      method: 'GET',
      headers: {
        'Cookie': cookieString // <-- 关键在这里！
      }
    };
    
    console.log("正在获取题目列表...");
    const problemsResponse = await fetch(problemsApiUrl, requestOptions);
    const problemsData = await problemsResponse.json();
    console.log("成功获取题目数据:", problemsData);

    console.log("正在获取标准答案...");
    const answersResponse = await fetch(answersApiUrl, requestOptions);
    const answersData = await answersResponse.json();
    console.log("成功获取答案数据:", answersData);

  } catch (error) {
    console.error("获取数据时发生错误:", error);
  }
}