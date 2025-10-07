// js/mathjax-config.js
// MathJax配置 - 符合Manifest V3要求

window.MathJax = {
    tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        displayMath: [['$$', '$$'], ['\\[', '\\]']],
        processEscapes: true,
        processEnvironments: true
    },
    svg: {
        fontCache: 'global'
    },
    startup: {
        ready: () => {
            console.log('[DEBUG] 3. MathJax config READY function has been executed.');
            window.MathJax.startup.defaultReady();
        }
    }
};