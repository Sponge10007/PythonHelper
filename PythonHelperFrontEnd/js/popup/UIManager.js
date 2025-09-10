// js/popup/UIManager.js

export class UIManager {
    constructor() {
        this.initElements();
    }

    initElements() {
        this.selectQuestionModeButton = document.getElementById('selectQuestionMode');
        this.questionModes = document.getElementById('questionModes');
        this.currentMode = document.getElementById('currentMode');
        this.currentModeText = document.getElementById('currentModeText');
        this.settingsSection = document.getElementById('settingsSection');
        this.settingsStatus = document.getElementById('settingsStatus');
        this.questionCountElement = document.getElementById('questionCount');
        this.mistakeCountElement = document.getElementById('mistakeCount');
        this.apiKeyInput = document.getElementById('apiKeyInput');
        this.apiEndpointInput = document.getElementById('apiEndpointInput');
    }

    // 更新统计数据
    updateStats({ questionCount, mistakeCount }) {
        this.questionCountElement.textContent = questionCount;
        this.mistakeCountElement.textContent = mistakeCount;
    }

    // 更新设置表单
    updateSettingsForm({ apiKey, apiEndpoint }) {
        this.apiKeyInput.value = apiKey || '';
        this.apiEndpointInput.value = apiEndpoint || 'https://api.deepseek.com/v1/chat/completions';
    }
    
    // 切换设置区域的可见性
    toggleSettings() {
        this.settingsSection.classList.toggle('hidden');
    }
    
    // 显示状态消息
    showStatus(message, type = 'info') {
        this.settingsStatus.textContent = message;
        this.settingsStatus.style.color = type === 'success' ? '#90EE90' : 
                                         type === 'error' ? '#FFB6C1' : 'rgba(255, 255, 255, 0.8)';
        setTimeout(() => { this.settingsStatus.textContent = ''; }, 3000);
    }
    
    // 切换题目模式选择区域的可见性
    toggleQuestionModes() {
        this.questionModes.classList.toggle('hidden');
    }

    // 更新当前选择的题目模式显示
    updateCurrentModeDisplay(mode) {
        const modeNames = {
            'function': '函数题',
            'programming': '编程题',
            'objective': '客观题'
        };
        if (mode && modeNames[mode]) {
            this.currentMode.classList.remove('hidden');
            this.currentModeText.textContent = modeNames[mode];
        } else {
            this.currentMode.classList.add('hidden');
            this.currentModeText.textContent = '未选择';
        }
    }
}