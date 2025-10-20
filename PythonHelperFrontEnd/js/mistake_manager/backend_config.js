// js/mistake_manager/backend_config.js

/**
 * 后端配置模块
 * 为非模块环境提供getBackendUrl函数
 */

// 为非模块环境提供getBackendUrl函数
window.getBackendUrl = function() {
    // 在非Chrome扩展环境中检测
    const isLocalDev = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname === '';
    return isLocalDev ? 'http://localhost:8000' : 'http://47.98.249.0:8888';
};

// 导出函数供模块使用
export function getBackendUrl() {
    return window.getBackendUrl();
}
