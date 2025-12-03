// js/common/config.js

// === 配置区域 ===
const DEV_URL = 'http://localhost:5000';
const PROD_URL = 'http://10.72.126.216:5000';

/**
 * 获取当前环境的后端 URL
 * @returns {string} 后端服务器地址
 */
export const BACKEND_URL = (function() {
    // 1. Chrome 扩展环境检测
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        // 你可以在这里通过 hardcode 强制指定，或者保留原来的逻辑
        // 如果是打包后的扩展，通常视为生产环境，但在本地调试扩展时可能是开发环境
        // 这里为了方便调试，暂时保留 localhost，你可以随时改成 PROD_URL
        return DEV_URL; 
    }

    // 2. 普通网页环境检测 (通过域名判断)
    const hostname = window.location.hostname;
    const isLocalDev = hostname === 'localhost' || 
                       hostname === '127.0.0.1' || 
                       hostname === '';

    return isLocalDev ? DEV_URL : PROD_URL;
})();

// 为了兼容可能的非模块环境（如果需要）
if (typeof window !== 'undefined') {
    window.GLOBAL_BACKEND_URL = BACKEND_URL;
}