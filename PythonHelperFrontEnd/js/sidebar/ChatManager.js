// js/sidebar/ChatManager.js

import * as api from '../common/api.js';
import * as storage from '../common/storage.js';

export class ChatManager {
    constructor(uiManager) {
        this.ui = uiManager; // 依赖 UIManager 来更新界面
        this.chats = [];
        this.currentChatId = null;
        this.isLoading = false;
        this.settings = {};
        
        // --- 恢复的错题相关状态 ---
        this.mistakes = [];
        this.selectedMessages = new Set();
        this.isSelectionModeActive = false;
    }

    updateSettings(newSettings) {
        this.settings = newSettings;
        console.log('ChatManager settings updated:', this.settings);
    }

    async init() {
        this.settings = await storage.loadSettings();
        this.chats = await storage.loadChats();

        if (this.chats.length > 0) {
            this.showChat(this.chats[0].id);
        } else {
            this.ui.showView(this.ui.welcomeScreen);
        }
        this.ui.renderChatList(this.chats, this.currentChatId, this.showChat.bind(this), this.deleteChat.bind(this));
    }

    // --- 原有的聊天方法 (createNewChat, showChat, deleteChat, sendMessage等) 保持不变 ---
    createNewChat() {
        const newChat = {
            id: Date.now().toString(),
            title: '新对话',
            messages: [],
            createdAt: new Date().toISOString()
        };
        this.chats.unshift(newChat);
        storage.saveChats(this.chats);
        this.ui.renderChatList(this.chats, newChat.id, this.showChat.bind(this), this.deleteChat.bind(this));
        this.showChat(newChat.id);
        this.ui.toggleChatList();
    }

    showChat(chatId) {
        if (this.isSelectionModeActive) {
            this.toggleMistakeSelectionMode();
        }
        
        this.currentChatId = chatId;
        const chat = this.chats.find(c => c.id === chatId);
        if (!chat) return;

        this.ui.updateChatListSelection(chatId);
        this.ui.showView(this.ui.chatInterface);
        this.ui.setChatTitle(chat.title);
        this.ui.renderMessages(chat.messages);
        this.ui.clearInput();
    }

    deleteChat(chatId) {
        this.chats = this.chats.filter(c => c.id !== chatId);
        storage.saveChats(this.chats);
        this.ui.renderChatList(this.chats, this.currentChatId, this.showChat.bind(this), this.deleteChat.bind(this));
        
        if (this.currentChatId === chatId) {
            this.currentChatId = null;
            if (this.chats.length > 0) {
                this.showChat(this.chats[0].id);
            } else {
                this.ui.showView(this.ui.welcomeScreen);
            }
        }
    }

    async sendMessage(messageText) {
        if (!messageText || this.isLoading || !this.currentChatId) return;

        const chat = this.chats.find(c => c.id === this.currentChatId);
        if (!chat) return;

        const userMessage = { id: `msg-${Date.now()}`, role: 'user', content: messageText };
        chat.messages.push(userMessage);
        this.ui.appendMessage(userMessage);
        this.ui.clearInput();

        if (chat.messages.length === 1) {
            chat.title = messageText.substring(0, 25) + (messageText.length > 25 ? '...' : '');
            this.ui.setChatTitle(chat.title);
            this.ui.renderChatList(this.chats, this.currentChatId, this.showChat.bind(this), this.deleteChat.bind(this));
        }

        await storage.saveChats(this.chats);
        await this.fetchAndDisplayAiResponse(chat);
    }
    
    async fetchAndDisplayAiResponse(chat) {
        this.isLoading = true;
        this.ui.setLoadingState(true);
        const placeholder = this.ui.appendMessage({ role: 'assistant', content: '思考中...' });

        try {
            const data = await api.fetchAiResponse(chat.messages, this.settings.aiApiKey, 'https://api.deepseek.com/v1/chat/completions');
            const aiMessage = { id: `msg-${Date.now()}`, role: 'assistant', content: data.response };
            chat.messages.push(aiMessage);
            
            const finalElement = this.ui.createMessageElement(aiMessage);
            placeholder.replaceWith(finalElement);
            await storage.saveChats(this.chats);

        } catch (error) {
            console.error('AI request failed:', error);
            const errorElement = this.ui.createMessageElement({ role: 'assistant', content: `抱歉，请求失败。错误: ${error.message}` });
            placeholder.replaceWith(errorElement);
        } finally {
            this.isLoading = false;
            this.ui.setLoadingState(false);
        }
    }
    
    clearCurrentChat() {
        if (!this.currentChatId) return;
        const chat = this.chats.find(c => c.id === this.currentChatId);
        if (chat) {
            chat.messages = [];
            this.ui.renderMessages([]);
            storage.saveChats(this.chats);
        }
    }

    // --- 恢复的错题相关方法 ---

    toggleMistakeSelectionMode() {
        this.isSelectionModeActive = !this.isSelectionModeActive;
        this.ui.toggleSelectionMode(this.isSelectionModeActive);

        if (!this.isSelectionModeActive) {
            this.selectedMessages.clear();
            this.ui.clearMessageSelections();
            this.ui.updateSaveSelectionButtonVisibility(false);
        }
    }
    
    handleMessageSelection(messageId, isSelected) {
        if (isSelected) {
            this.selectedMessages.add(messageId);
        } else {
            this.selectedMessages.delete(messageId);
        }
        this.ui.updateSaveSelectionButtonVisibility(this.selectedMessages.size > 0);
    }
    
    async saveSelectionToMistakes() {
        if (this.selectedMessages.size === 0) return;
        const chat = this.chats.find(c => c.id === this.currentChatId);
        if (!chat) return;

        const selectedMessagesData = chat.messages.filter(msg => this.selectedMessages.has(msg.id));
        if (selectedMessagesData.length === 0) {
            alert('未能找到选中的消息。');
            return;
        }

        const firstUserMessage = selectedMessagesData.find(m => m.role === 'user');
        const title = firstUserMessage ? firstUserMessage.content : '对话记录';

        const newMistake = {
            id: Date.now(),
            title: title.substring(0, 30) + (title.length > 30 ? '...' : ''),
            messages: selectedMessagesData,
            tags: ['AI对话'],
            category: '对话记录',
            difficulty: '中等',
            date: new Date().toISOString()
        };
        
        try {
            // 使用我们拆分出去的 api.js
            await api.saveMistake(newMistake);
            alert('已成功加入错题集！');
            this.toggleMistakeSelectionMode();
        } catch (error) {
            console.error('加入错题集失败:', error);
            alert(`加入错题集失败: ${error.message}`);
        }
    }

    async showMistakeCollection() {
        this.ui.showView(this.ui.mistakeCollection);
        try {
            this.mistakes = await api.fetchMistakes();
            this.ui.displayMistakes(this.mistakes);
        } catch (error) {
            console.error("加载错题集失败:", error);
            this.ui.displayMistakes([]); // 传递空数组以显示错误消息
        }
    }
}