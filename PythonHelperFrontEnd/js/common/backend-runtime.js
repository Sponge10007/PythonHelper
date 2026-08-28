// 在模块加载前同步读取用户配置的后端地址。
// 用户可在扩展页控制台执行：
//   localStorage.setItem('pythonHelperBackendUrl', 'http://your-server:5000')
(function () {
    try {
        const savedUrl = localStorage.getItem('pythonHelperBackendUrl');
        if (savedUrl && /^https?:\/\//i.test(savedUrl)) {
            globalThis.GLOBAL_BACKEND_URL = savedUrl.replace(/\/+$/, '');
        }
    } catch (e) {
        // 后台 Service Worker 没有 localStorage，忽略即可
    }
})();
