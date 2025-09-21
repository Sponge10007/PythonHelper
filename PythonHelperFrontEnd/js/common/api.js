// js/common/api.js

const BACKEND_URL = 'http://localhost:5000';
// const BACKEND_URL = "https://89a39c1476f74a949b6e7dddabaf7ba4--35427.ap-shanghai2.cloudstudio.club";
// const BACKEND_URL = "https://89a39c1476f74a949b6e7dddabaf7ba4--5000.ap-shanghai2.cloudstudio.club";

/**
 * 与AI后端进行对话
 * @param {Array} messages - 对话消息数组
 * @param {string} apiKey - 用户的 API Key
 * @param {string} apiEndpoint - API 端点
 * @returns {Promise<Object>} - AI的响应数据
 */
export async function fetchAiResponse(messages, apiKey, apiEndpoint) {
    const lastMessage = messages[messages.length - 1].content;
    const response = await fetch(`${BACKEND_URL}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: lastMessage,
            apiKey: apiKey,
            apiEndpoint: apiEndpoint
        })
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
}

/**
 * 获取所有错题
 * @returns {Promise<Array>} - 错题列表
 */
export async function fetchMistakes() {
    const response = await fetch(`${BACKEND_URL}/mistakes`);
    if (!response.ok) {
        throw new Error('获取错题失败');
    }
    const data = await response.json();
    return data.mistakes || [];
}

/**
 * 保存新的错题到后端
 * @param {Object} mistake - 新的错题对象
 * @returns {Promise<void>}
 */
export async function saveMistake(mistake) {
    // 这个函数用于添加一个全新的错题记录
    const currentMistakes = await fetchMistakes();
    currentMistakes.unshift(mistake);

    const response = await fetch(`${BACKEND_URL}/mistakes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mistakes: currentMistakes })
    });

    if (!response.ok) {
        throw new Error('保存错题失败');
    }
}

/**
 * 更新一个已存在的错题
 * @param {number} mistakeId - 错题的ID
 * @param {Object} updatedMistake - 更新后的错题对象
 * @returns {Promise<Object>}
 */
export async function updateMistake(mistakeId, updatedMistake) {
    const response = await fetch(`${BACKEND_URL}/mistakes/${mistakeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMistake)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '更新错题失败');
    }
    // 后端应返回更新后的完整错题对象
    return response.json(); 
}