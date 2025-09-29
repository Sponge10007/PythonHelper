// js/sidebar/SettingsManager.js

import * as storage from '../common/storage.js';

export class SettingsManager {
    constructor(uiManager) {
        this.ui = uiManager;
        this.settings = {};

        // 从 UIManager 获取设置相关的 DOM 元素
        this.aiApiKeyInput = this.ui.settingsInterface.querySelector('#aiApiKey');
        this.questionModeSelect = this.ui.settingsInterface.querySelector('#questionMode');
        this.saveSettingsBtn = this.ui.settingsInterface.querySelector('#saveSettings');
    }

    async init() {
        this.settings = await storage.loadSettings();
        this.loadSettingsToUI();
    }

    loadSettingsToUI() {
        this.aiApiKeyInput.value = this.settings.aiApiKey;
        this.questionModeSelect.value = this.settings.questionMode;
    }

    async saveSettings() {
        const newSettings = {
            aiApiKey: this.aiApiKeyInput.value.trim(),
            questionMode: this.questionModeSelect.value
        };

        const success = await storage.saveSettings(newSettings);
        
        if (success) {
            this.settings = newSettings;
            this.saveSettingsBtn.textContent = '已保存!';
            setTimeout(() => { this.saveSettingsBtn.textContent = '保存设置'; }, 2000);
            return newSettings; // 返回新设置，以便其他模块更新
        } else {
            this.saveSettingsBtn.textContent = '保存失败';
            setTimeout(() => { this.saveSettingsBtn.textContent = '保存设置'; }, 2000);
            return null;
        }
    }
}