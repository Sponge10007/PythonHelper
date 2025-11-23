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
        
        const messageId = `msg-${Date.now()}`;
        console.log('fetchAndDisplayAiResponse', chat);
        const streamingElement = this.ui.createStreamingMessage(messageId);
        // 创建流式消息元素
        
        let accumulatedContent = '';

        try {
            // 在发送给AI之前，先进行记忆管理
            const managedMessages = this.manageConversationMemory(chat.messages);
            // console.log('managedMessages', managedMessages);
            // 使用流式API调用
            await api.fetchAiResponseStream(managedMessages, this.settings.aiApiKey, this.settings.aiApiEndpoint, (chunk) => {
                
                if (chunk.error) {
                    // 处理错误
                    accumulatedContent = chunk.content;
                    this.ui.updateStreamingMessage(messageId, accumulatedContent);
                    return;
                }
                
                if (chunk.content) {
                    accumulatedContent += chunk.content;
                    console.log('accumulatedContent', accumulatedContent);
                    this.ui.updateStreamingMessage(messageId, accumulatedContent);
                }
                
                if (chunk.done) {
                    // 流式传输完成
                    this.ui.finishStreamingMessage(messageId);
                    
                    // 保存完整的AI消息到聊天记录
                    const aiMessage = { 
                        id: messageId, 
                        role: 'assistant', 
                        content: accumulatedContent 
                    };
                    chat.messages.push(aiMessage);
                    storage.saveChats(this.chats).catch(err => console.error('保存聊天记录失败:', err));
                }
            });

        } catch (error) {
            console.error('AI流式请求失败:', error);
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
            
            // 更新流式消息显示错误
            this.ui.updateStreamingMessage(messageId, errorMessage);
            this.ui.finishStreamingMessage(messageId);
            
            // 保存错误消息到聊天记录
            const errorMsg = { 
                id: messageId, 
                role: 'assistant', 
                content: errorMessage 
            };
            chat.messages.push(errorMsg);
            storage.saveChats(this.chats).catch(err => console.error('保存聊天记录失败:', err));
        } finally {
            this.isLoading = false;
            this.ui.setLoadingState(false);
        }
    }
    
    /**
     * 重试消息 - 找到指定消息之前的最后一条用户消息，重新生成AI回复
     * @param {string} messageId - 要重试的消息ID
     */
    async retryMessage(messageId) {
        if (this.isLoading || !this.currentChatId) {
            console.warn('正在加载中或没有当前聊天，无法重试');
            return;
        }
        
        const chat = this.chats.find(c => c.id === this.currentChatId);
        if (!chat) {
            console.warn('找不到当前聊天');
            return;
        }

        // 找到要重试的消息的索引
        const messageIndex = chat.messages.findIndex(m => m.id === messageId);
        if (messageIndex === -1) {
            console.warn('找不到要重试的消息:', messageId);
            return;
        }

        // 找到该消息之前的最后一条用户消息
        let userMessageIndex = -1;
        for (let i = messageIndex - 1; i >= 0; i--) {
            if (chat.messages[i].role === 'user') {
                userMessageIndex = i;
                break;
            }
        }

        if (userMessageIndex === -1) {
            console.warn('找不到对应的用户消息');
            return;
        }

        console.log(`重试消息: 从消息索引 ${userMessageIndex} 开始重新生成`);

        // 删除从用户消息之后的所有消息（包括旧的AI回复）
        chat.messages = chat.messages.slice(0, userMessageIndex + 1);
        
        // 保存状态
        await storage.saveChats(this.chats);
        
        // 重新渲染消息列表
        this.ui.renderMessages(chat.messages);
        
        // 重新获取AI响应
        await this.fetchAndDisplayAiResponse(chat);
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
<<<<<<< HEAD
        // 明确处理keepRecent为0的情况
        if (keepRecent === 0) {
=======

        // 如果 keepRecent <= 0 则清空所有消息；否则保留最近 keepRecent 条
        if (!keepRecent || keepRecent <= 0) {
>>>>>>> 3a385a7d4401608f70f80cdf3277f30015bc033a
            chat.messages = [];
        } else {
            chat.messages = chat.messages.slice(-keepRecent);
        }
<<<<<<< HEAD
        
=======

>>>>>>> 3a385a7d4401608f70f80cdf3277f30015bc033a
        console.log(`清理对话历史: ${chatId}, 原始消息数: ${originalLength}, 保留消息数: ${chat.messages.length}`);
        
        // 保存更新
        storage.saveChats(this.chats);
        
        // 如果当前对话被清理，重新渲染
        if (this.currentChatId === chatId) {
            this.ui.renderMessages(chat.messages);
            console.log(`已更新UI，当前消息数: ${chat.messages.length}`);
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