// js/common/storage.js

/**
 * 从 chrome.storage 加载对话数据
 * @returns {Promise<Array>} - 对话列表
 */
async function loadChats() {
    try {
        const result = await chrome.storage.local.get(['chats']);
        return result.chats || [];
    } catch (e) {
        console.warn("非扩展环境，使用空聊天列表。");
        return [];
    }
}

/**
 * 将对话数据保存到 chrome.storage
 * @param {Array} chats - 要保存的对话列表
 */
async function saveChats(chats) {
    try {
        await chrome.storage.local.set({ chats: chats });
    } catch (e) {
        console.warn("非扩展环境，对话未保存。");
    }
}

/**
 * 从 chrome.storage 加载设置
 * @returns {Promise<Object>} - 设置对象
 */
async function loadSettings() {
    try {
        const result = await chrome.storage.local.get(['aiApiKey', 'questionMode']);
        return {
            aiApiKey: result.aiApiKey || '',
            questionMode: result.questionMode || 'objective'
        };
    } catch (e) {
        console.warn("非扩展环境，使用默认设置。");
        return {
            aiApiKey: '',
            questionMode: 'objective'
        };
    }
}

/**
 * 将设置保存到 chrome.storage
 * @param {Object} settings - 要保存的设置对象
 */
async function saveSettings(settings) {
    try {
        await chrome.storage.local.set(settings);
        return true;
    } catch (e) {
        console.warn("非扩展环境，设置未保存。");
        return false;
    }
}

/**
 * 从 chrome.storage 加载用户登录状态
 * @returns {Promise<Object>} - 用户状态对象
 */
async function loadUserStatus() {
    try {
        const result = await chrome.storage.local.get(['userToken', 'userEmail', 'isLoggedIn']);
        return {
            userToken: result.userToken || '',
            userEmail: result.userEmail || '',
            isLoggedIn: result.isLoggedIn || false
        };
    } catch (e) {
        console.warn("非扩展环境，用户未登录。");
        return {
            userToken: '',
            userEmail: '',
            isLoggedIn: false
        };
    }
}

/**
 * 保存用户登录状态
 * @param {Object} userStatus - 用户状态对象
 */
async function saveUserStatus(userStatus) {
    try {
        await chrome.storage.local.set(userStatus);
        return true;
    } catch (e) {
        console.warn("非扩展环境，用户状态未保存。");
        return false;
    }
}

/**
 * 清除用户登录状态（登出）
 */
async function clearUserStatus() {
    try {
        await chrome.storage.local.remove(['userToken', 'userEmail', 'isLoggedIn']);
        return true;
    } catch (e) {
        console.warn("非扩展环境，无法清除用户状态。");
        return false;
    }
}

// 将所有storage函数暴露到全局window对象
window.loadChats = loadChats;
window.saveChats = saveChats;
window.loadSettings = loadSettings;
window.saveSettings = saveSettings;
window.loadUserStatus = loadUserStatus;
window.saveUserStatus = saveUserStatus;
window.clearUserStatus = clearUserStatus;