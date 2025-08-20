/**
 * SidebarManager Class
 * Manages all UI interactions and state for the AI Assistant Sidebar.
 * This script is rewritten to match the final dual-column, overlay-style layout.
 */
class SidebarManager {
    constructor() {
        // --- State Management ---
        this.chats = []; // List of all conversations
        this.mistakes = []; // List of saved mistakes
        this.currentChatId = null; // ID of the currently active chat
        this.isLoading = false; // Flag to prevent multiple AI requests
        this.backendUrl = 'http://localhost:5000'; // Backend service URL
        this.selectedMessages = new Set(); // To track selected message IDs for saving
        this.isSelectionModeActive = false; // New state for selection mode
        this.settings = { // User settings
            aiApiKey: '',
            aiApiEndpoint: 'https://api.deepseek.com/v1/chat/completions',
            questionMode: 'objective'
        };

        // --- Initialization ---
        this.initElements(); // Cache all necessary DOM elements
        this.bindEvents();   // Set up all event listeners
        this.init();         // Load initial data and set up the initial view
    }

    /**
     * Caches all required DOM elements for quick access.
     */
    initElements() {
        // Main layout elements
        this.sidebarNav = document.getElementById('sidebarNav');
        this.mainContent = document.getElementById('mainContent');
        this.chatList = document.getElementById('chatList');

        // Icon bar buttons
        this.toggleChatListBtn = document.getElementById('toggleChatListBtn');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.mistakesBtn = document.getElementById('mistakesBtn');
        this.settingsBtn = document.getElementById('settingsBtn');

        // Views
        this.welcomeScreen = document.getElementById('welcomeScreen');
        this.chatInterface = document.getElementById('chatInterface');
        this.mistakeCollection = document.getElementById('mistakeCollection');
        this.settingsInterface = document.getElementById('settingsInterface');

        // Welcome screen elements
        this.startFirstChatBtn = document.getElementById('startFirstChat');

        // Chat interface elements
        this.currentChatTitle = document.getElementById('currentChatTitle');
        this.chatMessages = document.getElementById('chatMessages');
        this.chatInput = document.getElementById('chatInput');
        this.sendMessageBtn = document.getElementById('sendMessage');
        this.clearChatBtn = document.getElementById('clearChatBtn');
        this.enterMistakeModeBtn = document.getElementById('enterMistakeModeBtn'); // New button to enter mode
        this.saveSelectionBtn = document.getElementById('saveSelectionBtn');
        
        // Mistake collection elements
        this.backToMain = document.getElementById('backToMain');
        this.mistakeListContainer = document.getElementById('mistakeListContainer');
        this.openMistakeManagerBtn = document.getElementById('openMistakeManagerBtn');
        
        // Settings interface elements
        this.backToMainFromSettingsBtn = document.getElementById('backToMainFromSettings');
        this.aiApiKeyInput = document.getElementById('aiApiKey');
        this.aiApiEndpointInput = document.getElementById('aiApiEndpoint');
        this.questionModeSelect = document.getElementById('questionMode');
        this.saveSettingsBtn = document.getElementById('saveSettings');
    }

    /**
     * Binds all event listeners to the DOM elements.
     */
    bindEvents() {
        // Icon bar events
        this.toggleChatListBtn.addEventListener('click', () => this.toggleChatList());
        this.newChatBtn.addEventListener('click', () => this.createNewChat());
        this.mistakesBtn.addEventListener('click', () => this.showMistakeCollection());
        this.settingsBtn.addEventListener('click', () => this.showSettings());

        // Welcome screen events
        this.startFirstChatBtn.addEventListener('click', () => this.createNewChat());

        // Chat interface events
        this.sendMessageBtn.addEventListener('click', (e) => { e.preventDefault(); this.sendMessage(); });
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        this.chatInput.addEventListener('input', () => this.adjustTextareaHeight());
        this.clearChatBtn.addEventListener('click', () => this.clearCurrentChat());
        this.enterMistakeModeBtn.addEventListener('click', () => this.toggleMistakeSelectionMode());
        this.saveSelectionBtn.addEventListener('click', () => this.saveSelectionToMistakes());

        // Mistake & Settings events
        this.backToMain.addEventListener('click', () => this.showMainContent());
        this.openMistakeManagerBtn.addEventListener('click', () => this.openMistakeManager());
        this.backToMainFromSettingsBtn.addEventListener('click', () => this.showMainContent());
        this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());

        // Event delegation for message selection
        this.chatMessages.addEventListener('change', (e) => {
            if (e.target.classList.contains('message-selector')) {
                const messageElement = e.target.closest('.message');
                const messageId = messageElement.dataset.messageId;
                if (e.target.checked) {
                    this.selectedMessages.add(messageId);
                } else {
                    this.selectedMessages.delete(messageId);
                }
                this.updateSaveSelectionButtonVisibility();
            }
        });
    }

    /**
     * Initializes the application by loading data and setting the initial UI state.
     */
    async init() {
        await this.loadSettings();
        await this.loadChats();

        if (this.chats.length === 0) {
            this.showWelcomeScreen();
        } else {
            this.showChat(this.chats[0].id);
        }
    }

    // --- View Management ---

    toggleChatList() {
        this.sidebarNav.classList.toggle('expanded');
    }
    
    _showView(viewToShow) {
        [this.welcomeScreen, this.chatInterface, this.mistakeCollection, this.settingsInterface].forEach(view => {
            view.classList.add('hidden');
        });
        viewToShow.classList.remove('hidden');
    }

    showChatInterface() { this._showView(this.chatInterface); }
    showWelcomeScreen() { this._showView(this.welcomeScreen); }
    showSettings() { this._showView(this.settingsInterface); this.loadSettingsToUI(); }
    
    async showMistakeCollection() { 
        this._showView(this.mistakeCollection); 
        await this.loadMistakes(); 
    }
    
    showMainContent() {
        if (this.chats.length === 0) {
            this.showWelcomeScreen();
        } else {
            this.showChat(this.currentChatId || this.chats[0].id);
        }
    }

    openMistakeManager() {
        const url = chrome.runtime.getURL('mistake_manager.html');
        chrome.tabs.create({ url });
    }

    // --- Chat Management ---

    createNewChat() {
        const newChat = {
            id: Date.now().toString(),
            title: '新对话',
            messages: [],
            createdAt: new Date().toISOString()
        };
        this.chats.unshift(newChat);
        this.saveChats();
        this.updateChatList();
        this.showChat(newChat.id);
        if (!this.sidebarNav.classList.contains('expanded')) {
             this.toggleChatList();
        }
    }

    showChat(chatId) {
        this.currentChatId = chatId;
        const chat = this.chats.find(c => c.id === chatId);
        if (!chat) return;

        // Exit selection mode when switching chats
        if (this.isSelectionModeActive) {
            this.toggleMistakeSelectionMode();
        }

        this.updateChatListSelection(chatId);
        this.showChatInterface();
        
        this.currentChatTitle.textContent = chat.title;
        this.displayChatMessages(chat.messages);
        this.chatInput.value = '';
        this.adjustTextareaHeight();
    }

    async sendMessage() {
        const messageText = this.chatInput.value.trim();
        if (!messageText || this.isLoading || !this.currentChatId) return;

        const chat = this.chats.find(c => c.id === this.currentChatId);
        if (!chat) return;

        const userMessage = { id: `msg-${Date.now()}`, role: 'user', content: messageText };
        chat.messages.push(userMessage);
        this.displayMessage(userMessage);
        this.chatInput.value = '';
        this.adjustTextareaHeight();
        
        if (chat.messages.length === 1) {
            chat.title = messageText.substring(0, 25) + (messageText.length > 25 ? '...' : '');
            this.currentChatTitle.textContent = chat.title;
            this.updateChatList();
        }
        
        this.saveChats();
        await this.sendToAI(chat);
    }
    
    async sendToAI(chat) {
        this.isLoading = true;
        this.sendMessageBtn.disabled = true;
        this.sendMessageBtn.innerHTML = `<div class="loader"></div>`;

        const placeholderId = `msg-placeholder-${Date.now()}`;
        const aiResponsePlaceholder = this.displayMessage({ id: placeholderId, role: 'assistant', content: '思考中...' });

        try {
            const response = await fetch(`${this.backendUrl}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: chat.messages[chat.messages.length - 1].content,
                    apiKey: this.settings.aiApiKey,
                    apiEndpoint: this.settings.aiApiEndpoint
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const aiText = data.response;
            
            const aiMessage = { id: `msg-${Date.now()}`, role: 'assistant', content: aiText };
            chat.messages.push(aiMessage);
            
            const finalElement = this.createMessageElement(aiMessage);
            aiResponsePlaceholder.replaceWith(finalElement);
            this.saveChats();

        } catch (error) {
            console.error('AI request failed:', error);
            const errorElement = this.createMessageElement({ id: placeholderId, role: 'assistant', content: `抱歉，请求失败。错误: ${error.message}` });
            aiResponsePlaceholder.replaceWith(errorElement);
        } finally {
            this.isLoading = false;
            this.sendMessageBtn.disabled = false;
            this.sendMessageBtn.innerHTML = `<span class="material-symbols-outlined">arrow_upward</span>`;
        }
    }

    displayMessage(message) {
        const messageElement = this.createMessageElement(message);
        this.chatMessages.appendChild(messageElement);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        return messageElement;
    }

    displayChatMessages(messages) {
        this.chatMessages.innerHTML = '';
        messages.forEach(msg => {
            if (!msg.id) {
                msg.id = `msg-${Date.now()}-${Math.random()}`;
            }
            this.displayMessage(msg);
        });
    }

    createMessageElement(message) {
        const element = document.createElement('div');
        element.className = `message ${message.role}-message`;
        element.dataset.messageId = message.id;

        const avatarContent = message.role === 'user' ? 'U' : '';
    
        let actionsHtml = '';
        if (message.role === 'assistant' && message.content && !message.content.includes('思考中...')) {
            actionsHtml = `
                <div class="message-actions">
                    <button class="action-btn retry-btn" title="重试">
                        <span class="material-symbols-outlined">refresh</span>
                    </button>
                    <button class="action-btn like-btn" title="点赞">
                        <img src="good.png" alt="like icon" class="action-icon">
                    </button>
                    <button class="action-btn dislike-btn" title="点踩">
                        <img src="bad.png" alt="dislike icon" class="action-icon">
                    </button>
                </div>
            `;
        }
    
        element.innerHTML = `
            <input type="checkbox" class="message-selector" title="选择此消息">
            <div class="message-avatar">${avatarContent}</div>
            <div class="message-bubble-container">
                <div class="message-content">
                     <div>${message.content || ''}</div>
                </div>
                ${actionsHtml}
            </div>
        `;
    
        if (message.role === 'assistant' && actionsHtml) {
            element.querySelector('.like-btn')?.addEventListener('click', e => { e.stopPropagation(); alert('感谢您的点赞！'); });
            element.querySelector('.dislike-btn')?.addEventListener('click', e => { e.stopPropagation(); alert('感谢您的反馈！'); });
            element.querySelector('.retry-btn')?.addEventListener('click', e => { e.stopPropagation(); alert('“重试”功能待实现'); });
        }
        
        return element;
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

    // --- Chat List Management ---

    updateChatList() {
        this.chatList.innerHTML = '';
        this.chats.forEach(chat => {
            const chatItem = this.createChatItem(chat);
            this.chatList.appendChild(chatItem);
        });
    }

    createChatItem(chat) {
        const element = document.createElement('div');
        element.className = 'chat-item';
        element.dataset.chatId = chat.id;
        element.innerHTML = `
            <div class="chat-item-title">${chat.title}</div>
            <div class="chat-item-actions">
                <button class="delete-chat-btn" title="删除对话">🗑️</button>
            </div>
        `;
        element.addEventListener('click', () => this.showChat(chat.id));
        element.querySelector('.delete-chat-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteChat(chat.id);
        });
        return element;
    }

    updateChatListSelection(chatId) {
        this.chatList.querySelectorAll('.chat-item').forEach(item => {
            item.classList.toggle('active', item.dataset.chatId === chatId);
        });
    }
    
    deleteChat(chatId) {
        this.chats = this.chats.filter(c => c.id !== chatId);
        this.saveChats();
        this.updateChatList();
        
        if (this.currentChatId === chatId) {
            this.currentChatId = null;
            if (this.chats.length > 0) {
                this.showChat(this.chats[0].id);
            } else {
                this.showWelcomeScreen();
            }
        }
    }
    
    // --- Mistake Management ---

    toggleMistakeSelectionMode() {
        this.isSelectionModeActive = !this.isSelectionModeActive;
        this.chatMessages.classList.toggle('selection-mode', this.isSelectionModeActive);

        if (!this.isSelectionModeActive) {
            // Exiting mode: clear selections and hide button
            this.selectedMessages.clear();
            this.chatMessages.querySelectorAll('.message-selector:checked').forEach(cb => cb.checked = false);
            this.updateSaveSelectionButtonVisibility();
        }
    }

    updateSaveSelectionButtonVisibility() {
        const hasSelection = this.selectedMessages.size > 0;
        this.saveSelectionBtn.classList.toggle('hidden', !hasSelection);
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
        const questionContent = firstUserMessage ? firstUserMessage.content : '对话记录';
        const conversationAnswer = selectedMessagesData.map(m => `${m.role === 'user' ? '用户' : 'AI'}：\n${m.content}`).join('\n\n');

        const newMistake = {
            id: Date.now(),
            title: questionContent.substring(0, 30) + (questionContent.length > 30 ? '...' : ''),
            content: questionContent,
            answer: conversationAnswer,
            tags: ['AI对话'],
            category: '对话记录',
            difficulty: '中等',
            date: new Date().toISOString()
        };
        
        try {
            const response = await fetch(`${this.backendUrl}/mistakes`);
            if (!response.ok) throw new Error('获取现有错题失败');
            const data = await response.json();
            const currentMistakes = data.mistakes || [];

            currentMistakes.unshift(newMistake);

            const saveResponse = await fetch(`${this.backendUrl}/mistakes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mistakes: currentMistakes })
            });

            if (!saveResponse.ok) throw new Error('保存错题失败');

            alert('已成功加入错题集！');
            // Exit selection mode after saving
            this.toggleMistakeSelectionMode();

        } catch (error) {
            console.error('加入错题集失败:', error);
            alert(`加入错题集失败: ${error.message}`);
        }
    }

    async loadMistakes() { 
        try {
            const response = await fetch(`${this.backendUrl}/mistakes`);
            if (!response.ok) throw new Error('Failed to fetch mistakes');
            const data = await response.json();
            this.mistakes = data.mistakes || [];
            this.displayMistakes();
        } catch (error) {
            console.error("Failed to load mistakes:", error);
            this.mistakeListContainer.innerHTML = '<div>加载错题失败，请检查后端服务是否运行。</div>';
        }
    }

    displayMistakes() {
        this.mistakeListContainer.innerHTML = '';
        if (this.mistakes.length === 0) {
            this.mistakeListContainer.innerHTML = '<div>暂无错题记录</div>';
            return;
        }
        this.mistakes.forEach(mistake => {
            const item = document.createElement('div');
            item.className = 'mistake-item-display';
            item.innerHTML = `
                <strong class="mistake-title-display">${mistake.title}</strong>
                <p class="mistake-content-display">${mistake.content}</p>
            `;
            this.mistakeListContainer.appendChild(item);
        });
    }

    // --- Settings ---
    async loadSettings() {
        try {
            const result = await chrome.storage.local.get(['aiApiKey', 'aiApiEndpoint', 'questionMode']);
            this.settings.aiApiKey = result.aiApiKey || '';
            this.settings.aiApiEndpoint = result.aiApiEndpoint || 'https://api.deepseek.com/v1/chat/completions';
            this.settings.questionMode = result.questionMode || 'objective';
        } catch (e) { console.warn("Not in extension context, using default settings."); }
    }
    loadSettingsToUI() {
        this.aiApiKeyInput.value = this.settings.aiApiKey;
        this.aiApiEndpointInput.value = this.settings.aiApiEndpoint;
        this.questionModeSelect.value = this.settings.questionMode;
    }
    async saveSettings() {
        this.settings.aiApiKey = this.aiApiKeyInput.value;
        this.settings.aiApiEndpoint = this.aiApiEndpointInput.value;
        this.settings.questionMode = this.questionModeSelect.value;
        try {
            await chrome.storage.local.set(this.settings);
            this.saveSettingsBtn.textContent = '已保存!';
        } catch(e) {
            console.warn("Not in extension context, settings not saved.");
            this.saveSettingsBtn.textContent = '保存 (非扩展环境)';
        }
        setTimeout(() => { this.saveSettingsBtn.textContent = '保存设置'; }, 2000);
    }

    // --- Storage Management ---
    async saveChats() {
        try {
            await chrome.storage.local.set({ chats: this.chats });
        } catch (e) { console.warn("Not in extension context, chats not saved."); }
    }
    
    async loadChats() {
        try {
            const result = await chrome.storage.local.get(['chats']);
            this.chats = result.chats || [];
        } catch (e) { 
            console.warn("Not in extension context, using empty chat list.");
            this.chats = [];
        }
        this.updateChatList();
    }
    
    // --- Utilities ---
    adjustTextareaHeight() {
        this.chatInput.style.height = 'auto';
        this.chatInput.style.height = `${Math.min(this.chatInput.scrollHeight, 120)}px`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SidebarManager();
});