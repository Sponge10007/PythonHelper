// js/sidebar/UIManager.js

export class UIManager {
    constructor() {
        this.initElements();
    }

    initElements() {
        this.sidebarNav = document.getElementById('sidebarNav');
        this.chatList = document.getElementById('chatList');
        this.mainContent = document.getElementById('mainContent');
        this.welcomeScreen = document.getElementById('welcomeScreen');
        this.chatInterface = document.getElementById('chatInterface');
        this.mistakeCollection = document.getElementById('mistakeCollection');
        this.settingsInterface = document.getElementById('settingsInterface');
        this.ptaAnalysisInterface = document.getElementById('ptaAnalysisInterface'); // 新增
        this.currentChatTitle = document.getElementById('currentChatTitle');
        this.chatMessages = document.getElementById('chatMessages');
        this.chatInput = document.getElementById('chatInput');
        this.sendMessageBtn = document.getElementById('sendMessage');
        this.saveSelectionBtn = document.getElementById('saveSelectionBtn');
        this.mistakeListContainer = document.getElementById('mistakeListContainer');
    }
    
    showView(viewToShow) {
        // 更新视图列表
        [this.welcomeScreen, this.chatInterface, this.mistakeCollection, this.settingsInterface, this.ptaAnalysisInterface].forEach(view => {
            view.classList.add('hidden');
        });
        viewToShow.classList.remove('hidden');
    }

    // --- 恢复的错题UI相关方法 ---
    toggleSelectionMode(isActive) {
        this.chatMessages.classList.toggle('selection-mode', isActive);
    }

    clearMessageSelections() {
        this.chatMessages.querySelectorAll('.message-selector:checked').forEach(cb => cb.checked = false);
    }

    updateSaveSelectionButtonVisibility(isVisible) {
        this.saveSelectionBtn.classList.toggle('hidden', !isVisible);
    }
    
    displayMistakes(mistakes) {
        this.mistakeListContainer.innerHTML = '';
        if (!mistakes || mistakes.length === 0) {
            this.mistakeListContainer.innerHTML = '<div>暂无错题记录或加载失败。</div>';
            return;
        }
        mistakes.forEach(mistake => {
            const item = document.createElement('div');
            item.className = 'mistake-item-display';
            item.innerHTML = `
                <strong class="mistake-title-display">${mistake.title}</strong>
                <p class="mistake-content-display">${mistake.messages[0]?.content || '...'}</p>
            `;
            this.mistakeListContainer.appendChild(item);
        });
    }
    
    // --- 原有的聊天UI方法保持不变 ---
    toggleChatList() {
        this.sidebarNav.classList.toggle('expanded');
    }
    
    renderChatList(chats, currentChatId, onChatSelect, onChatDelete) {
        this.chatList.innerHTML = '';
        chats.forEach(chat => {
            const chatItem = this.createChatItem(chat);
            chatItem.addEventListener('click', () => onChatSelect(chat.id));
            chatItem.querySelector('.delete-chat-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                onChatDelete(chat.id);
            });
            this.chatList.appendChild(chatItem);
        });
        this.updateChatListSelection(currentChatId);
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
        return element;
    }
    
    updateChatListSelection(chatId) {
        this.chatList.querySelectorAll('.chat-item').forEach(item => {
            item.classList.toggle('active', item.dataset.chatId === chatId);
        });
    }

    renderMessages(messages) {
        this.chatMessages.innerHTML = '';
        messages.forEach(msg => {
            if (!msg.id) msg.id = `msg-${Date.now()}-${Math.random()}`;
            this.appendMessage(msg);
        });
    }

    appendMessage(message) {
        const messageElement = this.createMessageElement(message);
        this.chatMessages.appendChild(messageElement);
        this.scrollToBottom();
        return messageElement;
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
                    <button class="action-btn retry-btn" title="重试"><span class="material-symbols-outlined">refresh</span></button>
                    <button class="action-btn like-btn" title="点赞"><img src="../icons/good.png" alt="like icon" class="action-icon"></button>
                    <button class="action-btn dislike-btn" title="点踩"><img src="../icons/bad.png" alt="dislike icon" class="action-icon"></button>
                </div>
            `;
        }
    
        element.innerHTML = `
            <input type="checkbox" class="message-selector" title="选择此消息">
            <div class="message-avatar">${avatarContent}</div>
            <div class="message-bubble-container">
                <div class="message-content"><div>${message.content || ''}</div></div>
                ${actionsHtml}
            </div>
        `;
        return element;
    }
    
    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
    
    setChatTitle(title) {
        this.currentChatTitle.textContent = title;
    }
    
    clearInput() {
        this.chatInput.value = '';
        this.adjustTextareaHeight();
    }
    
    adjustTextareaHeight() {
        this.chatInput.style.height = 'auto';
        this.chatInput.style.height = `${Math.min(this.chatInput.scrollHeight, 120)}px`;
    }
    
    setLoadingState(isLoading) {
        this.sendMessageBtn.disabled = isLoading;
        this.sendMessageBtn.innerHTML = isLoading ? `<div class="loader"></div>` : `<span class="material-symbols-outlined">arrow_upward</span>`;
    }
}