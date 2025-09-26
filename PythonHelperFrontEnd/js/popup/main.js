// js/popup/main.js

import { UIManager } from './UIManager.js';
import * as storage from '../common/storage.js';
import * as api from '../common/api.js'; // 假设api.js中有获取题库统计的函数

class PopupManager {
    constructor() {
        this.ui = new UIManager();
        this.init();
        this.bindEvents();
    }

    async init() {
        this.loadStats();
        this.loadAndDisplaySettings();
        
        const settings = await storage.loadSettings();
        this.ui.updateCurrentModeDisplay(settings.questionMode);
    }
    
    bindEvents() {
        document.getElementById('openSidebar').addEventListener('click', () => this.openSidebar());
        document.getElementById('openMistakeManager').addEventListener('click', () => this.openMistakeManager());
        document.getElementById('toggleSettings').addEventListener('click', () => this.ui.toggleSettings());
        document.getElementById('saveSettings').addEventListener('click', () => this.saveAndApplySettings());
        
        this.ui.selectQuestionModeButton.addEventListener('click', () => this.ui.toggleQuestionModes());
        document.querySelectorAll('.mode-item').forEach(item => {
            item.addEventListener('click', () => this.selectQuestionMode(item.dataset.mode));
        });
    }

    async loadStats() {
        // 假设 api.js 有一个 fetchStats 方法
        // const stats = await api.fetchStats(); 
        const { questions } = await (await fetch(chrome.runtime.getURL('data/questions.json'))).json();
        const questionCount = questions?.length || 0;
        
        const result = await chrome.storage.local.get(['mistakes']);
        const mistakeCount = result.mistakes?.length || 0;

        this.ui.updateStats({ questionCount, mistakeCount });
    }

    async loadAndDisplaySettings() {
        const settings = await storage.loadSettings();
        this.ui.updateSettingsForm(settings);
    }

    async saveAndApplySettings() {
        const newSettings = {
            aiApiKey: this.ui.apiKeyInput.value.trim(),
            aiApiEndpoint: this.ui.apiEndpointInput.value.trim()
        };
        const success = await storage.saveSettings(newSettings);
        if (success) {
            this.ui.showStatus('设置已保存', 'success');
            chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED', settings: newSettings });
        } else {
            this.ui.showStatus('保存失败', 'error');
        }
    }

    async selectQuestionMode(mode) {
        const settings = await storage.loadSettings();
        settings.questionMode = mode;
        await storage.saveSettings(settings);

        this.ui.updateCurrentModeDisplay(mode);
        this.ui.toggleQuestionModes();
        chrome.runtime.sendMessage({ type: 'QUESTION_MODE_CHANGED', mode });
    }

    async openSidebar() {
        const currentWindow = await chrome.windows.getCurrent();
        await chrome.sidePanel.open({ windowId: currentWindow.id });
        window.close();
    }
    
    openMistakeManager() {
        chrome.tabs.create({ url: chrome.runtime.getURL('html/mistake_manager.html') });
        window.close();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});