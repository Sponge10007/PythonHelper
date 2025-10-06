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
        this.ptaAnalysisInterface = document.getElementById('ptaAnalysisInterface');
        this.loginInterface = document.getElementById('loginInterface'); // 添加登录界面
        this.userProfileInterface = document.getElementById('userProfileInterface'); // 添加用户信息界面
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
        [this.welcomeScreen, this.chatInterface, this.mistakeCollection, this.settingsInterface, this.ptaAnalysisInterface, this.loginInterface, this.userProfileInterface].forEach(view => {
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
        // Render math for the entire chat history
        this.renderMathInElement(this.chatMessages);
    }

    appendMessage(message) {
        const messageElement = this.createMessageElement(message);
        this.chatMessages.appendChild(messageElement);
        this.scrollToBottom();
        
        // After appending, render math in the new message
        this.renderMathInElement(messageElement);
        
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
                    <button class="action-btn retry-btn" title="重试"><img src="../侧边栏icon/33.png" alt="refresh icon" class="action-icon"></button>
                    <span style="color: #3c3c3c; font-size: 14px; margin-left: -6px; font-weight: 500; font-family: "思源宋体", "Source Han Serif SC", "宋体", SimSun, serif">重试 </span>
                    <span style="padding-bottom:4px">|</span>
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
     * Renders LaTeX math expressions in a given HTML element using MathJax.
     * @param {HTMLElement} element - The element to render math in.
     */
    renderMathInElement(element) {
        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise([element]).catch((err) =>
                console.log('MathJax typesetting error:', err)
            );
        } else if (window.MathJax && window.MathJax.Hub) {
            // 兼容MathJax v2
            window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub, element]);
        } else {
            console.warn('MathJax not loaded or typesetPromise method not available');
        }
    }

    /**
     * 格式化消息内容，处理markdown代码块
     * @param {string} content - 原始消息内容
     * @returns {string} - 格式化后的HTML内容
     */
 /**
     * [MODIFIED] 格式化消息内容，处理markdown和LaTeX
     * @param {string} content - 原始消息内容
     * @returns {string} - 格式化后的HTML内容
     */
    formatMessageContent(content) {
        if (!content) return '';

        const latexPlaceholders = [];
        const placeholder = "LATEX_PLACEHOLDER_";

        // 1. 保护LaTeX公式块，用占位符替换
        let tempContent = content.replace(/\$\$([\s\S]*?)\$\$/g, (match) => {
            latexPlaceholders.push(match);
            return `${placeholder}${latexPlaceholders.length - 1}`;
        });
        tempContent = tempContent.replace(/\$([^$]*?)\$/g, (match) => {
            latexPlaceholders.push(match);
            return `${placeholder}${latexPlaceholders.length - 1}`;
        });

        // 2. 现在可以安全地处理Markdown格式了
        // 处理代码块 (```language or ```)
        let formattedContent = tempContent.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, language, code) => {
            const lang = language ? ` class="language-${language}"` : '';
            return `<pre><code${lang}>${this.escapeHtml(code.trim())}</code></pre>`;
        });
        
        // 处理行内代码 (`code`)
        formattedContent = formattedContent.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // 改进的换行处理：
        // 1. 先将3个或更多连续换行替换为2个换行（限制最大空行）
        formattedContent = formattedContent.replace(/\n{3,}/g, '\n\n');
        // 2. 将2个连续换行替换为段落分隔
        formattedContent = formattedContent.replace(/\n\n/g, '</p><p>');
        // 3. 将单个换行替换为<br>
        formattedContent = formattedContent.replace(/\n/g, '<br>');
        // 4. 包装在段落标签中
        formattedContent = '<p>' + formattedContent + '</p>';
        // 5. 清理空段落
        formattedContent = formattedContent.replace(/<p><\/p>/g, '').replace(/<p><br><\/p>/g, '');

        // 3. 恢复LaTeX公式
        formattedContent = formattedContent.replace(new RegExp(`${placeholder}(\\d+)`, 'g'), (match, index) => {
            return latexPlaceholders[parseInt(index, 10)];
        });
        console.log(formattedContent)
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