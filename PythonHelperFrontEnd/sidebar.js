// 侧边栏主要逻辑
class SidebarManager {
    constructor() {
        this.chats = []; // 对话列表
        this.currentChatId = null; // 当前对话ID
        this.mistakes = []; // 错题列表
        this.isLoading = false;
        this.backendUrl = 'http://localhost:5000'; // 后端服务地址
        this.settings = {
            aiApiKey: '',
            aiApiEndpoint: 'https://api.deepseek.com/v1/chat/completions',
            questionMode: 'objective'
        };
        
        this.initElements();
        this.bindEvents();
        this.init();
        this.setupMessageListener();
    }

    initElements() {
        // 获取DOM元素
        this.newChatBtn = document.getElementById('newChatBtn');
        this.mistakesBtn = document.getElementById('mistakesBtn');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.chatList = document.getElementById('chatList');
        this.mainContent = document.getElementById('mainContent');
        this.welcomeScreen = document.getElementById('welcomeScreen');
        this.chatInterface = document.getElementById('chatInterface');
        this.mistakeCollection = document.getElementById('mistakeCollection');
        this.settingsInterface = document.getElementById('settingsInterface');
        
        // 欢迎界面元素
        this.startFirstChatBtn = document.getElementById('startFirstChat');
        
        // 对话界面元素
        this.currentChatTitle = document.getElementById('currentChatTitle');
        this.chatMessages = document.getElementById('chatMessages');
        this.chatInput = document.getElementById('chatInput');
        this.sendMessageBtn = document.getElementById('sendMessage');
        this.clearChatBtn = document.getElementById('clearChat');
        
        // 错题集元素
        this.backToMainBtn = document.getElementById('backToMain');
        this.mistakeList = document.getElementById('mistakeList');
        
        // 设置界面元素
        this.backToMainFromSettingsBtn = document.getElementById('backToMainFromSettings');
        this.aiApiKeyInput = document.getElementById('aiApiKey');
        this.aiApiEndpointInput = document.getElementById('aiApiEndpoint');
        this.questionModeSelect = document.getElementById('questionMode');
        this.saveSettingsBtn = document.getElementById('saveSettings');
    }

    bindEvents() {
        // 工具栏按钮事件
        this.newChatBtn.addEventListener('click', () => this.createNewChat());
        this.mistakesBtn.addEventListener('click', () => this.showMistakeCollection());
        this.settingsBtn.addEventListener('click', () => this.showSettings());
        
        // 欢迎界面事件
        this.startFirstChatBtn.addEventListener('click', () => this.createNewChat());
        
        // 对话界面事件
        this.sendMessageBtn.addEventListener('click', () => this.sendMessage());
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        this.chatInput.addEventListener('input', () => this.adjustTextareaHeight());
        this.clearChatBtn.addEventListener('click', () => this.clearCurrentChat());
        
        // 错题集事件
        this.backToMainBtn.addEventListener('click', () => this.showMainContent());
        
        // 错题集管理按钮事件
        this.openMistakeManagerBtn = document.getElementById('openMistakeManager');
        if (this.openMistakeManagerBtn) {
            this.openMistakeManagerBtn.addEventListener('click', () => this.openMistakeManager());
        }
        
        // 设置界面事件
        this.backToMainFromSettingsBtn.addEventListener('click', () => this.showMainContent());
        this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
    }

    async init() {
        await this.loadSettings();
        await this.loadMistakes();
        this.loadChats();
        
        // 如果没有对话，显示欢迎界面
        if (this.chats.length === 0) {
            this.showWelcomeScreen();
        } else {
            this.showChat(this.chats[0].id);
        }
    }

    setupMessageListener() {
        // 监听来自background script的消息
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'TEXT_SELECTED') {
                this.handleTextSelected(message.text);
            } else if (message.type === 'AI_RESPONSE') {
                this.displayAIResponse(message.response);
            }
        });
        
        // 监听storage变化作为备选方案
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && changes.lastMessage) {
                const message = changes.lastMessage.newValue;
                if (message && message.type === 'TEXT_SELECTED') {
                    this.handleTextSelected(message.text);
                } else if (message && message.type === 'AI_RESPONSE') {
                    this.displayAIResponse(message.response);
                }
            }
        });
    }

    // 对话管理
    createNewChat() {
        const chatId = Date.now().toString();
        const newChat = {
            id: chatId,
            title: '新对话',
            messages: [],
            createdAt: new Date().toISOString()
        };
        
        this.chats.unshift(newChat);
        this.saveChats();
        this.updateChatList();
        this.showChat(chatId);
    }

    showChat(chatId) {
        this.currentChatId = chatId;
        const chat = this.chats.find(c => c.id === chatId);
        
        if (!chat) return;
        
        // 更新对话列表选中状态
        this.updateChatListSelection(chatId);
        
        // 显示对话界面
        this.showChatInterface();
        
        // 更新对话标题
        this.currentChatTitle.textContent = chat.title;
        
        // 显示消息
        this.displayChatMessages(chat.messages);
        
        // 清空输入框
        this.chatInput.value = '';
    }

    showChatInterface() {
        this.welcomeScreen.classList.add('hidden');
        this.chatInterface.classList.remove('hidden');
        this.mistakeCollection.classList.add('hidden');
        this.settingsInterface.classList.add('hidden');
    }

    showWelcomeScreen() {
        this.welcomeScreen.classList.remove('hidden');
        this.chatInterface.classList.add('hidden');
        this.mistakeCollection.classList.add('hidden');
        this.settingsInterface.classList.add('hidden');
    }

    showMistakeCollection() {
        this.welcomeScreen.classList.add('hidden');
        this.chatInterface.classList.add('hidden');
        this.mistakeCollection.classList.remove('hidden');
        this.settingsInterface.classList.add('hidden');
        this.loadMistakes();
    }

    showSettings() {
        this.welcomeScreen.classList.add('hidden');
        this.chatInterface.classList.add('hidden');
        this.mistakeCollection.classList.add('hidden');
        this.settingsInterface.classList.remove('hidden');
        this.loadSettingsToUI();
    }

    showMainContent() {
        if (this.chats.length === 0) {
            this.showWelcomeScreen();
        } else {
            this.showChat(this.currentChatId || this.chats[0].id);
        }
    }

    // 消息管理
    async sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message || !this.currentChatId) return;
        
        const chat = this.chats.find(c => c.id === this.currentChatId);
        if (!chat) return;
        
        // 添加用户消息
        const userMessage = {
            id: Date.now().toString(),
            type: 'user',
            content: message,
            timestamp: new Date().toISOString()
        };
        
        chat.messages.push(userMessage);
        this.displayChatMessages(chat.messages);
        this.chatInput.value = '';
        
        // 更新对话标题（使用第一条消息的前20个字符）
        if (chat.messages.length === 1) {
            chat.title = message.substring(0, 20) + (message.length > 20 ? '...' : '');
            this.currentChatTitle.textContent = chat.title;
            this.updateChatList();
        }
        
        // 发送到AI
        await this.sendToAI(message, chat);
        
        this.saveChats();
    }

    async sendToAI(message, chat) {
        try {
            this.isLoading = true;
            this.sendMessageBtn.disabled = true;
            this.sendMessageBtn.textContent = '发送中...';
            
            // 调用后端AI服务
            const response = await fetch(`${this.backendUrl}/ai/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    system: this.getSystemPrompt(),
                    apiKey: this.settings.aiApiKey,
                    apiEndpoint: this.settings.aiApiEndpoint
                })
            });
            
            if (!response.ok) {
                throw new Error(`AI服务调用失败: ${response.status}`);
            }
            
            const data = await response.json();
            const aiMessage = {
                id: (Date.now() + 1).toString(),
                type: 'ai',
                content: data.response,
                timestamp: new Date().toISOString()
            };
            
            chat.messages.push(aiMessage);
            this.displayChatMessages(chat.messages);
            
        } catch (error) {
            console.error('AI请求失败:', error);
            const errorMessage = {
                id: (Date.now() + 1).toString(),
                type: 'ai',
                content: `抱歉，AI服务暂时不可用。错误信息：${error.message}`,
                timestamp: new Date().toISOString()
            };
            
            chat.messages.push(errorMessage);
            this.displayChatMessages(chat.messages);
        } finally {
            this.isLoading = false;
            this.sendMessageBtn.disabled = false;
            this.sendMessageBtn.textContent = '发送';
        }
    }

    getSystemPrompt() {
        const modePrompts = {
            'function': '你是一个专业的Python函数编程助手。请帮助用户编写符合要求的函数。',
            'programming': '你是一个专业的Python编程助手。请帮助用户编写完整的程序来解决特定问题。',
            'objective': '你是一个专业的Python教学助手。请帮助用户理解和解答Python相关的选择题和判断题。'
        };
        
        return modePrompts[this.settings.questionMode] || modePrompts['objective'];
    }

    displayChatMessages(messages) {
        this.chatMessages.innerHTML = '';
        
        messages.forEach(msg => {
            const messageElement = this.createMessageElement(msg);
            this.chatMessages.appendChild(messageElement);
        });
        
        // 滚动到底部
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    createMessageElement(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.type}-message`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = message.type === 'user' ? 'U' : 'AI';
        
        const content = document.createElement('div');
        content.className = 'message-content';
        
        const text = document.createElement('div');
        text.className = 'message-text';
        text.textContent = message.content;
        
        content.appendChild(text);
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);
        
        return messageDiv;
    }

    clearCurrentChat() {
        if (!this.currentChatId) return;
        
        const chat = this.chats.find(c => c.id === this.currentChatId);
        if (chat) {
            chat.messages = [];
            this.displayChatMessages([]);
            this.saveChats();
        }
    }

    // 对话列表管理
    updateChatList() {
        this.chatList.innerHTML = '';
        
        this.chats.forEach(chat => {
            const chatItem = this.createChatItem(chat);
            this.chatList.appendChild(chatItem);
        });
    }

    createChatItem(chat) {
        const chatDiv = document.createElement('div');
        chatDiv.className = 'chat-item';
        chatDiv.dataset.chatId = chat.id;
        
        if (chat.id === this.currentChatId) {
            chatDiv.classList.add('active');
        }
        
        const icon = document.createElement('div');
        icon.className = 'chat-item-icon';
        icon.textContent = '💬';
        
        const title = document.createElement('div');
        title.className = 'chat-item-title';
        title.textContent = chat.title;
        
        const actions = document.createElement('div');
        actions.className = 'chat-item-actions';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'chat-item-action';
        deleteBtn.textContent = '🗑️';
        deleteBtn.title = '删除对话';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteChat(chat.id);
        });
        
        actions.appendChild(deleteBtn);
        
        chatDiv.appendChild(icon);
        chatDiv.appendChild(title);
        chatDiv.appendChild(actions);
        
        chatDiv.addEventListener('click', () => this.showChat(chat.id));
        
        return chatDiv;
    }

    updateChatListSelection(chatId) {
        // 移除所有选中状态
        this.chatList.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // 添加当前选中状态
        const currentItem = this.chatList.querySelector(`[data-chat-id="${chatId}"]`);
        if (currentItem) {
            currentItem.classList.add('active');
        }
    }

    deleteChat(chatId) {
        const index = this.chats.findIndex(c => c.id === chatId);
        if (index === -1) return;
        
        this.chats.splice(index, 1);
        this.saveChats();
        this.updateChatList();
        
        // 如果删除的是当前对话，切换到其他对话或显示欢迎界面
        if (chatId === this.currentChatId) {
            if (this.chats.length > 0) {
                this.showChat(this.chats[0].id);
            } else {
                this.showWelcomeScreen();
            }
        }
    }

    // 错题管理
    async loadMistakes() {
        try {
            const response = await fetch(`${this.backendUrl}/mistakes`);
            if (response.ok) {
                const data = await response.json();
                this.mistakes = data.mistakes || [];
                this.displayMistakes();
            }
        } catch (error) {
            console.error('加载错题失败:', error);
            this.mistakes = [];
        }
    }

    displayMistakes() {
        if (this.mistakes.length === 0) {
            this.mistakeList.innerHTML = '<div class="no-mistakes">暂无错题记录</div>';
            return;
        }
        
        this.mistakeList.innerHTML = '';
        this.mistakes.forEach(mistake => {
            const mistakeElement = this.createMistakeElement(mistake);
            this.mistakeList.appendChild(mistakeElement);
        });
    }

    createMistakeElement(mistake) {
        const mistakeDiv = document.createElement('div');
        mistakeDiv.className = 'mistake-item';
        mistakeDiv.style.cssText = `
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 12px;
        `;
        
        const title = document.createElement('div');
        title.style.cssText = 'font-weight: 600; color: #856404; margin-bottom: 8px;';
        title.textContent = mistake.title;
        
        const content = document.createElement('div');
        content.style.cssText = 'font-size: 12px; color: #856404; margin-bottom: 8px;';
        content.textContent = mistake.content;
        
        const answer = document.createElement('div');
        answer.style.cssText = 'font-size: 12px; color: #155724; background: #d4edda; padding: 8px; border-radius: 4px;';
        answer.textContent = mistake.answer;
        
        mistakeDiv.appendChild(title);
        mistakeDiv.appendChild(content);
        mistakeDiv.appendChild(answer);
        
        return mistakeDiv;
    }

    // 设置管理
    async loadSettings() {
        try {
            const result = await chrome.storage.local.get(['aiApiKey', 'aiApiEndpoint', 'questionMode']);
            this.settings = {
                aiApiKey: result.aiApiKey || '',
                aiApiEndpoint: result.aiApiEndpoint || 'https://api.deepseek.com/v1/chat/completions',
                questionMode: result.questionMode || 'objective'
            };
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    }

    loadSettingsToUI() {
        this.aiApiKeyInput.value = this.settings.aiApiKey;
        this.aiApiEndpointInput.value = this.settings.aiApiEndpoint;
        this.questionModeSelect.value = this.settings.questionMode;
    }

    async saveSettings() {
        this.settings = {
            aiApiKey: this.aiApiKeyInput.value,
            aiApiEndpoint: this.aiApiEndpointInput.value,
            questionMode: this.questionModeSelect.value
        };
        
        try {
            await chrome.storage.local.set(this.settings);
            console.log('设置已保存');
            
            // 显示成功提示
            this.saveSettingsBtn.textContent = '已保存';
            setTimeout(() => {
                this.saveSettingsBtn.textContent = '保存设置';
            }, 2000);
        } catch (error) {
            console.error('保存设置失败:', error);
            this.saveSettingsBtn.textContent = '保存失败';
            setTimeout(() => {
                this.saveSettingsBtn.textContent = '保存设置';
            }, 2000);
        }
    }

    // 存储管理
    saveChats() {
        chrome.storage.local.set({ chats: this.chats }).catch(error => {
            console.error('保存对话失败:', error);
        });
    }

    loadChats() {
        chrome.storage.local.get(['chats']).then(result => {
            this.chats = result.chats || [];
            this.updateChatList();
        }).catch(error => {
            console.error('加载对话失败:', error);
            this.chats = [];
        });
    }

    // 文本选择处理
    handleTextSelected(text) {
        // 如果有当前对话，将选中的文本添加到输入框
        if (this.currentChatId && text.trim()) {
            // 如果输入框已有内容，在末尾添加换行和选中的文本
            if (this.chatInput.value.trim()) {
                this.chatInput.value += '\n\n' + text.trim();
            } else {
                this.chatInput.value = text.trim();
            }
            this.chatInput.focus();
            
            // 自动调整文本框高度
            this.adjustTextareaHeight();
        }
    }

    // 调整文本框高度
    adjustTextareaHeight() {
        this.chatInput.style.height = 'auto';
        this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 120) + 'px';
    }

    displayAIResponse(response) {
        // 这个方法现在由sendToAI处理
        console.log('收到AI回复:', response);
    }

    // 打开错题集管理网站
    openMistakeManager() {
        try {
            // 在新标签页中打开错题集管理网站
            chrome.tabs.create({
                url: 'mistake_manager.html'
            });
            console.log('已打开错题集管理网站');
        } catch (error) {
            console.error('打开错题集管理网站失败:', error);
            // 如果chrome.tabs不可用，尝试使用window.open
            try {
                window.open('mistake_manager.html', '_blank');
            } catch (fallbackError) {
                console.error('备用方法也失败:', fallbackError);
            }
        }
    }
}

// 初始化侧边栏管理器
new SidebarManager(); 