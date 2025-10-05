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
            // 在发送给AI之前，先进行记忆管理
            const managedMessages = this.manageConversationMemory(chat.messages);
            
            const data = await api.fetchAiResponse(managedMessages, this.settings.aiApiKey, this.settings.aiApiEndpoint);
            const aiMessage = { id: `msg-${Date.now()}`, role: 'assistant', content: data.response };
            chat.messages.push(aiMessage);
            
            const finalElement = this.ui.createMessageElement(aiMessage);
            placeholder.replaceWith(finalElement);
            await storage.saveChats(this.chats);

        } catch (error) {
            console.error('AI request failed:', error);
            let errorMessage = '抱歉，请求失败。';
            
            // 针对不同错误类型给出具体提示
            if (error.message.includes('402') || error.message.includes('Payment Required')) {
                errorMessage = '❌ API账户余额不足，请检查DeepSeek账户余额或更新API Key。点击左侧设置图标可以更新API Key。';
            } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                errorMessage = '❌ API Key无效或已过期，请在设置中更新您的API Key。';
            } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
                errorMessage = '❌ API访问被拒绝，请检查API Key权限。';
            } else if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
                errorMessage = '❌ API调用频率超限，请稍后再试。';
            } else if (error.message.includes('Failed to fetch')) {
                errorMessage = '❌ 网络连接失败，请检查网络连接或稍后重试。';
            } else {
                errorMessage = `❌ 请求失败: ${error.message}`;
            }
            
            const errorElement = this.ui.createMessageElement({ role: 'assistant', content: errorMessage });
            placeholder.replaceWith(errorElement);
        } finally {
            this.isLoading = false;
            this.ui.setLoadingState(false);
        }
    }
    
    /**
     * 对话记忆管理 - 智能压缩和清理对话历史
     * @param {Array} messages - 原始消息数组
     * @returns {Array} - 管理后的消息数组
     */
    manageConversationMemory(messages) {
        if (!messages || messages.length === 0) {
            return [];
        }

        // 如果消息数量较少，直接返回
        if (messages.length <= 20) {
            return messages;
        }

        console.log(`对话记忆管理: 原始消息数 ${messages.length}，开始压缩...`);

        // 保留最近的10条消息
        const recentMessages = messages.slice(-10);
        
        // 从历史消息中提取关键信息
        const historicalMessages = messages.slice(0, -10);
        const summary = this.createConversationSummary(historicalMessages);
        
        // 构建新的消息数组：系统摘要 + 最近消息
        const managedMessages = [];
        
        // 如果有历史摘要，添加为系统消息
        if (summary) {
            managedMessages.push({
                role: 'system',
                content: `以下是之前对话的摘要，请参考这些信息来理解上下文：\n\n${summary}`
            });
        }
        
        // 添加最近的消息
        managedMessages.push(...recentMessages);
        
        console.log(`对话记忆管理完成: 压缩后消息数 ${managedMessages.length}`);
        return managedMessages;
    }
    
    /**
     * 创建对话摘要
     * @param {Array} historicalMessages - 历史消息
     * @returns {string} - 对话摘要
     */
    createConversationSummary(historicalMessages) {
        if (!historicalMessages || historicalMessages.length === 0) {
            return '';
        }

        // 提取用户问题和AI回答的关键信息
        const userQuestions = [];
        const aiAnswers = [];
        
        historicalMessages.forEach(msg => {
            if (msg.role === 'user') {
                // 提取用户问题的关键词
                const question = msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '');
                userQuestions.push(question);
            } else if (msg.role === 'assistant') {
                // 提取AI回答的关键信息
                const answer = msg.content.substring(0, 150) + (msg.content.length > 150 ? '...' : '');
                aiAnswers.push(answer);
            }
        });

        // 构建摘要
        let summary = '对话历史摘要：\n';
        
        if (userQuestions.length > 0) {
            summary += `\n用户主要问题：\n${userQuestions.slice(-5).join('\n')}`;
        }
        
        if (aiAnswers.length > 0) {
            summary += `\n\nAI主要回答：\n${aiAnswers.slice(-3).join('\n')}`;
        }
        
        return summary;
    }
    
    /**
     * 清理对话历史 - 手动清理功能
     * @param {string} chatId - 对话ID
     * @param {number} keepRecent - 保留最近的消息数量
     */
    clearChatHistory(chatId, keepRecent = 5) {
        const chat = this.chats.find(c => c.id === chatId);
        if (!chat) return;
        
        const originalLength = chat.messages.length;
        chat.messages = chat.messages.slice(-keepRecent);
        
        console.log(`清理对话历史: ${chatId}, 原始消息数: ${originalLength}, 保留消息数: ${chat.messages.length}`);
        
        // 保存更新
        storage.saveChats(this.chats);
        
        // 如果当前对话被清理，重新渲染
        if (this.currentChatId === chatId) {
            this.ui.renderMessages(chat.messages);
        }
    }
    
    /**
     * 获取对话统计信息
     * @param {string} chatId - 对话ID
     * @returns {Object} - 统计信息
     */
    getChatStatistics(chatId) {
        const chat = this.chats.find(c => c.id === chatId);
        if (!chat) return null;
        
        const userMessages = chat.messages.filter(m => m.role === 'user').length;
        const aiMessages = chat.messages.filter(m => m.role === 'assistant').length;
        const totalLength = chat.messages.reduce((sum, m) => sum + m.content.length, 0);
        
        return {
            totalMessages: chat.messages.length,
            userMessages,
            aiMessages,
            totalCharacters: totalLength,
            averageMessageLength: Math.round(totalLength / chat.messages.length) || 0,
            createdAt: chat.createdAt
        };
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