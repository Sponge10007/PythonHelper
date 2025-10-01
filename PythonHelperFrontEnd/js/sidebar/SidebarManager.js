// js/sidebar/SidebarManager.js

import { UIManager } from './UIManager.js';
import { ChatManager } from './ChatManager.js';
// 导入 SettingsManager 来处理设置逻辑
import { SettingsManager } from './SettingsManager.js';

class SidebarManager {
    constructor() {
        this.ui = new UIManager();
        this.chatManager = new ChatManager(this.ui);
        // 新增：实例化 SettingsManager
        this.settingsManager = new SettingsManager(this.ui);

        this.bindEvents();
        this.init();
    }

    async init() {
        await this.chatManager.init();
        await this.settingsManager.init();
    }
    
    bindEvents() {
        // --- 聊天相关事件 ---
        this.ui.welcomeScreen.querySelector('#startFirstChat').addEventListener('click', () => this.chatManager.createNewChat());
        this.ui.sendMessageBtn.addEventListener('click', (e) => { e.preventDefault(); this.chatManager.sendMessage(this.ui.chatInput.value.trim()); });
        this.ui.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.chatManager.sendMessage(this.ui.chatInput.value.trim());
            }
        });
        this.ui.chatInput.addEventListener('input', () => this.ui.adjustTextareaHeight());
        document.getElementById('clearChatBtn').addEventListener('click', () => this.chatManager.clearCurrentChat());
        
        // --- 记忆管理事件绑定 ---
        document.getElementById('memoryManageBtn').addEventListener('click', () => {
            if (this.chatManager.currentChatId) {
                const stats = this.chatManager.getChatStatistics(this.chatManager.currentChatId);
                if (stats) {
                    this.ui.showMemoryManageDialog(stats, (keepRecent) => {
                        this.chatManager.clearChatHistory(this.chatManager.currentChatId, keepRecent);
                        this.ui.showMemoryStatusMessage(
                            keepRecent === 0 ? '已清空全部对话历史' : `已清理历史，保留最近${keepRecent}条消息`,
                            'success'
                        );
                    });
                }
            }
        });

        // --- 错题事件绑定 ---
        document.getElementById('enterMistakeModeBtn').addEventListener('click', () => this.chatManager.toggleMistakeSelectionMode());
        document.getElementById('saveSelectionBtn').addEventListener('click', () => this.chatManager.saveSelectionToMistakes());
        this.ui.chatMessages.addEventListener('change', (e) => {
            if (e.target.classList.contains('message-selector')) {
                const messageElement = e.target.closest('.message');
                const messageId = messageElement.dataset.messageId;
                this.chatManager.handleMessageSelection(messageId, e.target.checked);
            }
        });

        // --- 图标与视图切换事件 ---
        document.getElementById('toggleChatListBtn').addEventListener('click', () => this.ui.toggleChatList());
        document.getElementById('newChatBtn').addEventListener('click', () => this.chatManager.createNewChat());
        document.getElementById('mistakesBtn').addEventListener('click', () => this.chatManager.showMistakeCollection());
        
        // --- 设置事件绑定 ---
        document.getElementById('settingsBtn').addEventListener('click', () => this.ui.showView(this.ui.settingsInterface));
        this.ui.settingsInterface.querySelector('#saveSettings').addEventListener('click', () => this.handleSaveSettings());

        // --- PTA题目分析事件绑定 ---
        document.getElementById('ptaBtn').addEventListener('click', () => this.ui.showView(this.ui.ptaAnalysisInterface));
        document.getElementById('startPtaAnalysisBtn').addEventListener('click', () => this.handlePtaAnalysis());
        
        // --- 返回按钮事件 ---
        this.bindBackButtons();
        
        // 打开错题管理器页面的按钮
        const openMistakeManagerBtn = document.getElementById('openMistakeManagerBtn');
        if(openMistakeManagerBtn) {
            openMistakeManagerBtn.addEventListener('click', () => {
                 chrome.tabs.create({ url: chrome.runtime.getURL('html/mistake_manager.html') });
            });
        }
    }

    // 新增：处理PTA分析请求
    handlePtaAnalysis() {
        const urlInput = document.getElementById('ptaUrlInput');
        const url = urlInput.value.trim();

        if (!url.startsWith('https://pintia.cn/problem-sets/')) {
            alert('请输入一个有效的拼题A题目集网址！');
            return;
        }

        const analysisBtn = document.getElementById('startPtaAnalysisBtn');
        analysisBtn.textContent = '分析中...';
        analysisBtn.disabled = true;

        console.log('正在请求后台脚本进行PTA分析...');
        chrome.runtime.sendMessage({ type: 'FETCH_PTA_DATA', url: url }, (response) => {
            analysisBtn.textContent = '开始分析';
            analysisBtn.disabled = false;
            
            if (response && response.status === 'success') {
                console.log('成功接收到HTML报告，正在打开新标签页...');
                // response.data 现在是HTML字符串
                const reportHtml = response.data;
                const blob = new Blob([reportHtml], { type: 'text/html' });
                const reportUrl = URL.createObjectURL(blob);
                chrome.tabs.create({ url: reportUrl });
                
                // 成功后可以返回主界面
                this.showMainView();
            } else {
                alert(`分析失败: ${response ? response.error : '未知错误'}`);
            }
        });
    }

    // 新增：处理保存设置的逻辑
    async handleSaveSettings() {
        const newSettings = await this.settingsManager.saveSettings();
        if (newSettings) {
            // 通知 ChatManager 更新其内部的 settings
            this.chatManager.updateSettings(newSettings);
            // 通知 background script
            chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED', settings: newSettings });
        }
    }
    
    // 辅助方法，用于确定返回的主视图
    showMainView() {
        if (this.chatManager.chats.length > 0) {
            this.chatManager.showChat(this.chatManager.currentChatId || this.chatManager.chats[0].id);
        } else {
            this.ui.showView(this.ui.welcomeScreen);
        }
    }

    // 辅助方法，用于绑定所有返回按钮
    bindBackButtons() {
        const backToMain = () => {
           this.showMainView();
        };
        document.getElementById('backToMain').addEventListener('click', backToMain);
        document.getElementById('backToMainFromSettings').addEventListener('click', backToMain);
        document.getElementById('backToMainFromPta').addEventListener('click', backToMain); // 新增
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SidebarManager();
});