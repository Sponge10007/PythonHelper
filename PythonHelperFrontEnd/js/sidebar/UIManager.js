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
        this.memoryManageBtn = document.getElementById('memoryManageBtn');
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
                <div class="message-content"><div>${this.formatMessageContent(message.content || '')}</div></div>
                ${actionsHtml}
            </div>
        `;
        return element;
    }

    /**
     * 格式化消息内容，处理markdown代码块
     * @param {string} content - 原始消息内容
     * @returns {string} - 格式化后的HTML内容
     */
    formatMessageContent(content) {
        if (!content) return '';
        
        // 处理代码块 (```language 或 ```)
        let formattedContent = content.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, language, code) => {
            const lang = language ? ` class="language-${language}"` : '';
            return `<pre><code${lang}>${this.escapeHtml(code.trim())}</code></pre>`;
        });
        
        // 处理行内代码 (`code`)
        formattedContent = formattedContent.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // 处理换行
        formattedContent = formattedContent.replace(/\n/g, '<br>');
        
        return formattedContent;
    }

    /**
     * 转义HTML特殊字符
     * @param {string} text - 需要转义的文本
     * @returns {string} - 转义后的文本
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
    
    /**
     * 显示记忆管理对话框
     * @param {Object} chatStats - 对话统计信息
     * @param {Function} onClearHistory - 清理历史回调
     */
    showMemoryManageDialog(chatStats, onClearHistory) {
        const dialog = document.createElement('div');
        dialog.className = 'memory-manage-dialog';
        dialog.innerHTML = `
            <div class="dialog-content">
                <div class="dialog-header">
                    <h3>🧠 记忆管理</h3>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="dialog-body">
                    <div class="memory-stats">
                        <h4>📊 对话统计</h4>
                        <div class="stats-grid">
                            <div class="stat-item">
                                <span class="stat-label">总消息数:</span>
                                <span class="stat-value">${chatStats.totalMessages}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">用户消息:</span>
                                <span class="stat-value">${chatStats.userMessages}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">AI回复:</span>
                                <span class="stat-value">${chatStats.aiMessages}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">总字符数:</span>
                                <span class="stat-value">${chatStats.totalCharacters}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">平均长度:</span>
                                <span class="stat-value">${chatStats.averageMessageLength}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">创建时间:</span>
                                <span class="stat-value">${new Date(chatStats.createdAt).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                    <div class="memory-actions">
                        <h4>🔧 记忆操作</h4>
                        <div class="action-buttons">
                            <button class="action-btn clear-history-btn">
                                <span class="material-symbols-outlined">delete_sweep</span>
                                清理历史 (保留最近5条)
                            </button>
                            <button class="action-btn clear-all-btn">
                                <span class="material-symbols-outlined">clear_all</span>
                                清空全部
                            </button>
                        </div>
                    </div>
                    <div class="memory-info">
                        <h4>💡 记忆说明</h4>
                        <p>• 当对话超过20条消息时，系统会自动压缩历史记忆</p>
                        <p>• 压缩会保留最近10条消息，并生成历史摘要</p>
                        <p>• 这样可以保持AI的记忆能力，同时控制token消耗</p>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // 绑定事件
        dialog.querySelector('.close-btn').addEventListener('click', () => {
            document.body.removeChild(dialog);
        });
        
        dialog.querySelector('.clear-history-btn').addEventListener('click', () => {
            onClearHistory(5);
            document.body.removeChild(dialog);
        });
        
        dialog.querySelector('.clear-all-btn').addEventListener('click', () => {
            onClearHistory(0);
            document.body.removeChild(dialog);
        });
        
        // 点击背景关闭
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                document.body.removeChild(dialog);
            }
        });
    }
    
    /**
     * 显示记忆管理状态提示
     * @param {string} message - 提示消息
     * @param {string} type - 提示类型 (info, success, warning)
     */
    showMemoryStatusMessage(message, type = 'info') {
        const statusDiv = document.createElement('div');
        statusDiv.className = `memory-status-message ${type}`;
        statusDiv.textContent = message;
        
        // 添加到聊天界面顶部
        const chatInterface = document.getElementById('chatInterface');
        chatInterface.insertBefore(statusDiv, chatInterface.firstChild);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (statusDiv.parentNode) {
                statusDiv.parentNode.removeChild(statusDiv);
            }
        }, 3000);
    }
}