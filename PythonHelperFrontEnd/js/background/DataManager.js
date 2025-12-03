// js/background/DataManager.js
import * as storage from '../common/storage.js';
import { BACKEND_URL } from '../common/config.js';

export class DataManager {
    constructor() {
        this.questions = [];
        this.settings = {};
    }

    async init() {
        await this.loadSettings();
        await this.loadQuestions();
    }
    
    async loadSettings() {
        this.settings = await storage.loadSettings();
        console.log('后台设置已加载:', this.settings);
    }
    
    async loadQuestions() {
        try {
            const response = await fetch(`${BACKEND_URL}/questions`);
            console.log('后端题目接口返回:', response);
            if (!response.ok) throw new Error('Backend request failed');
            const data = await response.json();
            this.questions = data.questions || [];
            console.log(`已从后端加载 ${this.questions.length} 道题目`);
        } catch (error) {
            console.warn('从后端加载题库失败，回退到本地文件。', error);
            const response = await fetch(chrome.runtime.getURL('data/questions.json'));
            const data = await response.json();
            this.questions = data.questions || [];
            console.log(`已从本地加载 ${this.questions.length} 道题目`);
        }
    }
    
    updateSettings(newSettings) {
        // 参照原始 background.js 的逻辑
        if (newSettings.apiKey) {
            this.settings.aiApiKey = newSettings.apiKey;
        }
        // API endpoint 使用硬编码的 DeepSeek API
        this.settings.aiApiEndpoint = 'https://api.deepseek.com/v1/chat/completions';
        // 更新完整的设置对象
        this.settings = { ...this.settings, ...newSettings };
        console.log('后台设置已更新:', this.settings);
    }
    
    updateQuestionMode(mode) {
        this.settings.questionMode = mode;
        storage.saveSettings(this.settings); // 持久化
        console.log('后台题目模式已更改为:', mode);
    }
}