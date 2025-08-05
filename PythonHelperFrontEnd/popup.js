// 弹出窗口逻辑
class PopupManager {
    constructor() {
        this.initElements();
        this.bindEvents();
        this.loadData();
        this.loadSettings();
    }

    initElements() {
        // 获取DOM元素
        this.selectQuestionModeButton = document.getElementById('selectQuestionMode');
        this.questionModes = document.getElementById('questionModes');
        this.currentMode = document.getElementById('currentMode');
        this.currentModeText = document.getElementById('currentModeText');
        this.openSidebarButton = document.getElementById('openSidebar');
        this.viewMistakesButton = document.getElementById('viewMistakes');
        this.openMistakeManagerButton = document.getElementById('openMistakeManager');
        this.toggleSettingsButton = document.getElementById('toggleSettings');
        this.settingsSection = document.getElementById('settingsSection');
        this.apiKeyInput = document.getElementById('apiKeyInput');
        this.apiEndpointInput = document.getElementById('apiEndpointInput');
        this.saveSettingsButton = document.getElementById('saveSettings');
        this.settingsStatus = document.getElementById('settingsStatus');
        this.questionCountElement = document.getElementById('questionCount');
        this.mistakeCountElement = document.getElementById('mistakeCount');
        
        // 题目模式选项
        this.modeItems = document.querySelectorAll('.mode-item');
    }

    bindEvents() {
        // 绑定事件监听器
        this.selectQuestionModeButton.addEventListener('click', () => this.toggleQuestionModes());
        this.openSidebarButton.addEventListener('click', () => this.openSidebar());
        this.viewMistakesButton.addEventListener('click', () => this.viewMistakes());
        this.openMistakeManagerButton.addEventListener('click', () => this.openMistakeManager());
        this.toggleSettingsButton.addEventListener('click', () => this.toggleSettings());
        this.saveSettingsButton.addEventListener('click', () => this.saveSettings());
        
        // 绑定题目模式选择事件
        this.modeItems.forEach(item => {
            item.addEventListener('click', () => this.selectQuestionMode(item.dataset.mode));
        });
    }

    async loadData() {
        try {
            // 优先从后端加载题库统计
            try {
                const response = await fetch('http://localhost:5000/questions/stats');
                if (response.ok) {
                    const data = await response.json();
                    this.questionCountElement.textContent = data.total_count || 0;
                } else {
                    // 回退到本地题库
                    const localResponse = await fetch(chrome.runtime.getURL('data/questions.json'));
                    const localData = await localResponse.json();
                    this.questionCountElement.textContent = localData.questions?.length || 0;
                }
            } catch (error) {
                // 回退到本地题库
                const localResponse = await fetch(chrome.runtime.getURL('data/questions.json'));
                const localData = await localResponse.json();
                this.questionCountElement.textContent = localData.questions?.length || 0;
            }

            // 加载错题统计
            const result = await chrome.storage.local.get(['mistakes']);
            const mistakes = result.mistakes || [];
            this.mistakeCountElement.textContent = mistakes.length;

            // 检查后端连接状态
            await this.checkBackendStatus();
            
            // 加载当前题目模式
            await this.loadCurrentMode();
        } catch (error) {
            console.error('加载数据失败:', error);
        }
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.local.get(['aiApiKey', 'aiApiEndpoint']);
            this.apiKeyInput.value = result.aiApiKey || '';
            this.apiEndpointInput.value = result.aiApiEndpoint || 'https://api.deepseek.com/v1/chat/completions';
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    }

    async saveSettings() {
        try {
            const apiKey = this.apiKeyInput.value.trim();
            const apiEndpoint = this.apiEndpointInput.value.trim();

            await chrome.storage.local.set({
                aiApiKey: apiKey,
                aiApiEndpoint: apiEndpoint
            });

            this.showStatus('设置已保存', 'success');
            
            // 通知background script更新设置
            chrome.runtime.sendMessage({
                type: 'SETTINGS_UPDATED',
                settings: { apiKey, apiEndpoint }
            });
        } catch (error) {
            console.error('保存设置失败:', error);
            this.showStatus('保存失败，请重试', 'error');
        }
    }

    showStatus(message, type = 'info') {
        this.settingsStatus.textContent = message;
        this.settingsStatus.style.color = type === 'success' ? '#90EE90' : 
                                         type === 'error' ? '#FFB6C1' : 'rgba(255, 255, 255, 0.8)';
        
        setTimeout(() => {
            this.settingsStatus.textContent = '';
        }, 3000);
    }

    toggleSettings() {
        const isHidden = this.settingsSection.classList.contains('hidden');
        this.settingsSection.classList.toggle('hidden', !isHidden);
        
        if (!isHidden) {
            this.toggleSettingsButton.querySelector('.feature-title').textContent = '⚙️ 设置';
        } else {
            this.toggleSettingsButton.querySelector('.feature-title').textContent = '✕ 关闭设置';
        }
    }

    async openSidebar() {
        try {
            // 打开侧边栏
            await chrome.sidePanel.open({ windowId: await this.getCurrentWindowId() });
            
            // 关闭弹出窗口
            window.close();
        } catch (error) {
            console.error('打开侧边栏失败:', error);
            this.showNotification('无法打开侧边栏，请确保浏览器支持侧边栏功能');
        }
    }

    async viewMistakes() {
        try {
            // 打开侧边栏并切换到错题集视图
            await chrome.sidePanel.open({ windowId: await this.getCurrentWindowId() });
            
            // 发送消息到侧边栏切换到错题集
            chrome.runtime.sendMessage({
                type: 'SHOW_MISTAKE_COLLECTION'
            });
            
            // 关闭弹出窗口
            window.close();
        } catch (error) {
            console.error('打开错题集失败:', error);
            this.showNotification('无法打开错题集，请重试');
        }
    }

    async openMistakeManager() {
        try {
            // 打开错题管理页面
            const url = chrome.runtime.getURL('mistake_manager.html');
            await chrome.tabs.create({ url: url });
            
            // 关闭弹出窗口
            window.close();
        } catch (error) {
            console.error('打开错题管理器失败:', error);
            this.showNotification('无法打开错题管理器，请重试');
        }
    }

    async getCurrentWindowId() {
        const currentWindow = await chrome.windows.getCurrent();
        return currentWindow.id;
    }

    showNotification(message) {
        // 创建临时通知
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: #dc3545;
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 11px;
            z-index: 1000;
            white-space: nowrap;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    async checkBackendStatus() {
        try {
            const response = await fetch('http://localhost:5000/health', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                console.log('后端服务连接正常');
            } else {
                console.warn('后端服务连接异常');
            }
        } catch (error) {
            console.warn('后端服务未启动或连接失败:', error);
        }
    }

    // 题目模式相关方法
    toggleQuestionModes() {
        const isHidden = this.questionModes.classList.contains('hidden');
        
        if (isHidden) {
            this.questionModes.classList.remove('hidden');
            this.selectQuestionModeButton.querySelector('.feature-title').textContent = '🎯 隐藏模式选择';
        } else {
            this.questionModes.classList.add('hidden');
            this.selectQuestionModeButton.querySelector('.feature-title').textContent = '🎯 选择题目模式';
        }
    }

    async selectQuestionMode(mode) {
        try {
            // 保存选择的模式
            await chrome.storage.local.set({ currentQuestionMode: mode });
            
            // 更新UI显示
            this.updateCurrentModeDisplay(mode);
            
            // 隐藏模式选择区域
            this.questionModes.classList.add('hidden');
            this.selectQuestionModeButton.querySelector('.feature-title').textContent = '🎯 选择题目模式';
            
            // 显示成功提示
            this.showNotification(`已选择${this.getModeDisplayName(mode)}模式`);
            
            // 通知background script更新模式
            chrome.runtime.sendMessage({
                type: 'QUESTION_MODE_CHANGED',
                mode: mode
            });
            
        } catch (error) {
            console.error('选择题目模式失败:', error);
            this.showNotification('选择模式失败，请重试');
        }
    }

    updateCurrentModeDisplay(mode) {
        if (mode) {
            this.currentMode.classList.remove('hidden');
            this.currentModeText.textContent = this.getModeDisplayName(mode);
        } else {
            this.currentMode.classList.add('hidden');
            this.currentModeText.textContent = '未选择';
        }
    }

    getModeDisplayName(mode) {
        const modeNames = {
            'function': '函数题',
            'programming': '编程题',
            'objective': '客观题'
        };
        return modeNames[mode] || '未知模式';
    }

    async loadCurrentMode() {
        try {
            const result = await chrome.storage.local.get(['currentQuestionMode']);
            const currentMode = result.currentQuestionMode;
            this.updateCurrentModeDisplay(currentMode);
        } catch (error) {
            console.error('加载当前模式失败:', error);
        }
    }
}

// 初始化弹出窗口
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
}); 