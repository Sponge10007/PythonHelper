// js/mistake_manager/backend_config.js

/**
 * 核心逻辑函数：判断并返回后端地址
 * 独立定义，不依赖外部环境
 */
function getUrlLogic() {
    // 在非Chrome扩展环境中检测
    if(window.location.protocol == 'chrome-extension:') {
        return 'http://localhost:5000';
    }
    const isLocalDev = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname === '';
    return isLocalDev ? 'http://localhost:5000' : 'http://47.98.249.0:8888';
}

// 1. 为非模块环境提供全局函数 (作为兜底)
// 即使被 main.js 覆盖，也不影响下面导出的函数
window.getBackendUrl = getUrlLogic;

// 2. 导出函数供模块使用
// 关键修复：直接调用内部逻辑函数，而不是调用 window.getBackendUrl()
export function getBackendUrl() {
    return getUrlLogic();
}