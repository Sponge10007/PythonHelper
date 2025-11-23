// js/sidebar/UIManager.js

export class UIManager {
    constructor() {
        this.initElements();
        this.retryCallback = null; // 存储重试回调函数
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
        this.mistakeListContainer = document.getElementById('mistakeListContainer'); //侧边栏的错题列表
        this.memoryManageBtn = document.getElementById('memoryManageBtn'); //记忆管理
    }
    
    /**
     * 设置重试消息的回调函数
     * @param {Function} callback - 重试回调函数，接收 messageId 作为参数
     */
    setRetryCallback(callback) {
        this.retryCallback = callback;
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
    } // 切换聊天列表展开状态
    
    isChatListExpanded() {
        return this.sidebarNav.classList.contains('expanded');
    } // 判断聊天列表是否展开
    
    hideChatList() {
        this.sidebarNav.classList.remove('expanded');
    } // 隐藏聊天列表
    
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
    
    /**
     * 绑定消息操作按钮的事件
     * @param {string} messageId - 消息ID
     * @param {Function} onRetry - 重试回调函数
     */
    MessageClickActions(messageId, onRetry = null) {
        // 获取特定消息的容器
        const messageElement = this.chatMessages.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageElement) {
            console.warn(`Message with id ${messageId} not found`);
            return null;
        }

        // 检查是否已经绑定过事件，避免重复绑定
        if (messageElement.dataset.actionsbound === 'true') {
            return null;
        }

        // 在消息容器内查找按钮和图标（避免ID冲突）
        const LikeBtn = messageElement.querySelector('.like-btn');
        const LikeBtnImg = messageElement.querySelector('.like-btn img');
        const DislikeBtn = messageElement.querySelector('.dislike-btn');
        const DislikeBtnImg = messageElement.querySelector('.dislike-btn img');
        const RetryBtn = messageElement.querySelector('.retry-btn');
        const RetryBtnImg = messageElement.querySelector('.retry-btn img');
        const CopyBtn = messageElement.querySelector('.copy-btn');

        // 检查按钮是否存在
        if (!LikeBtn || !DislikeBtn || !RetryBtn) {
            console.warn(`Some buttons not found for message ${messageId}`);
            return null;
        }

        // 点赞按钮
        LikeBtn.addEventListener('click', () => {
            console.log(`Liked message ${messageId}`);
            if (LikeBtnImg && LikeBtnImg.src.includes('good.png')) {
                LikeBtnImg.src = '../icons/good-active.png';
                // 如果点赞，取消踩
                if (DislikeBtnImg) {
                    DislikeBtnImg.src = '../icons/bad.png';
                }
            } else if (LikeBtnImg) {
                LikeBtnImg.src = '../icons/good.png';
            }
        });

        // 点踩按钮
        DislikeBtn.addEventListener('click', () => {
            console.log(`Disliked message ${messageId}`);
            if (DislikeBtnImg && DislikeBtnImg.src.includes('bad.png')) {
                DislikeBtnImg.src = '../icons/bad-active.png';
                // 如果点踩，取消赞
                if (LikeBtnImg) {
                    LikeBtnImg.src = '../icons/good.png';
                }
            } else if (DislikeBtnImg) {
                DislikeBtnImg.src = '../icons/bad.png';
            }
        });

        // 重试按钮
        RetryBtn.addEventListener('click', () => {
            console.log(`Retry message ${messageId}`);
            
            // 添加旋转动画
            if (RetryBtnImg) {
                RetryBtnImg.classList.add('rotating');
                setTimeout(() => {
                    RetryBtnImg.classList.remove('rotating');
                }, 1000);
            }
            
            // 调用重试回调函数
            if (onRetry && typeof onRetry === 'function') {
                onRetry(messageId);
            } else {
                console.warn('No retry handler provided for message', messageId);
            }
        });

        // 复制按钮
        CopyBtn.addEventListener('click', () => {
            const messageContentElement = messageElement.querySelector('.message-content');
            if (messageContentElement) {
                const textToCopy = messageContentElement.innerText || messageContentElement.textContent;
                navigator.clipboard.writeText(textToCopy).then(() => {
                    console.log(`Copied message ${messageId} content to clipboard`);
                }).catch(err => {
                    console.error('Failed to copy text: ', err);
                });
            }
        });

        // 标记已绑定事件，防止重复绑定
        messageElement.dataset.actionsbound = 'true';

        return { LikeBtn, DislikeBtn, RetryBtn, CopyBtn };
    }

    /**
     * 创建流式消息元素 - 用于实时更新内容
     * @param {string} messageId - 消息ID
     * @returns {HTMLElement} - 消息元素
     */
    createStreamingMessage(messageId) {
        const element = document.createElement('div');
        element.className = 'message assistant-message';
        element.dataset.messageId = messageId;

        element.innerHTML = `
            <div class="message-avatar"></div>
            <div class="message-bubble-container">
                <div class="message-content"><div class="streaming-content"></div></div>
                <div class="message-actions" >
                    <button class="action-btn retry-btn" title="重试"><img class="refresh-icon action-icon" src="../icons/refresh.png" alt="refresh icon"></button>
                    <span style="color: #757373ff; font-size: 12px; margin-left: -6px; font-weight: 500; font-family: "思源宋体", "Source Han Serif SC", "宋体", SimSun, serif">重试 </span>
                    <button class="action-btn copy-btn" title="复制"><img class="copy-icon action-icon" src="../icons/copy.png" alt="copy icon"></button>
                    <span style="color: #757373ff; font-size: 12px; margin-left: -6px; font-weight: 500; font-family: "思源宋体", "Source Han Serif SC", "宋体", SimSun, serif">复制 </span>
                    <span class="separator"><img src="../icons/separator.png" alt="separator" style="width:8px; height:22px; margin-left:1px; margin-right:1px;"></span>
                    <button class="action-btn like-btn" title="点赞"><img class="like-icon action-icon" src="../icons/good.png" alt="like icon"></button>
                    <button class="action-btn dislike-btn" title="点踩"><img class="dislike-icon action-icon" src="../icons/bad.png" alt="dislike icon"></button>
                </div>
            </div>
            <input type="checkbox" class="message-selector" title="选择此消息" style= "margin-left: auto; margin-right:3px" >
        `;
        
        this.chatMessages.appendChild(element);
        this.scrollToBottom();

        // 绑定消息操作按钮的点击事件
        this.MessageClickActions(messageId, this.retryCallback);

        return element;
    }

    /**
     * 更新流式消息内容
     * @param {string} messageId - 消息ID
     * @param {string} content - 新的内容
     */
    updateStreamingMessage(messageId, content) {
        const messageElement = this.chatMessages.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageElement) return;

        const contentElement = messageElement.querySelector('.streaming-content');
        if (!contentElement) return;

        // 更新内容
        contentElement.innerHTML = this.formatMessageContent(content);
        
        // 重新渲染数学公式
        this.renderMathInElement(messageElement);
        
        // 滚动到底部
        this.scrollToBottom();
        // 不需要重复绑定事件，createStreamingMessage 时已经绑定过了
    }

    /**
     * 完成流式消息 - 显示操作按钮
     * @param {string} messageId - 消息ID
     */
    finishStreamingMessage(messageId) {
        const messageElement = this.chatMessages.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageElement) return;

        const actionsElement = messageElement.querySelector('.message-actions');
        if (actionsElement) {
            // actionsElement.style.display = 'block';
        }
        // 不需要重复绑定事件，createStreamingMessage 时已经绑定过了
    }
    // 创建AI消息气泡
    createMessageElement(message) {
        const element = document.createElement('div');
        element.className = `message ${message.role}-message`;
        element.dataset.messageId = message.id;

        const avatarContent = message.role === 'user' ? 'U' : '';
    
        let actionsHtml = '';
        if (message.role === 'assistant' && message.content && !message.content.includes('思考中...')) {
            actionsHtml = `
                <div class="message-actions">
                    <button class="action-btn retry-btn" title="重试"><img class="refresh-icon action-icon" src="../icons/refresh.png" alt="refresh icon"></button>
                    <span style="color: #757373ff; font-size: 14px; margin-left: -6px; font-weight: 500; font-family: "思源宋体", "Source Han Serif SC", "宋体", SimSun, serif">重试 </span>
                    <button class="action-btn copy-btn" title="复制"><img class="copy-icon action-icon" src="../icons/copy.png" alt="copy icon"></button>
                    <span style="color: #757373ff; font-size: 14px; margin-left: -6px; font-weight: 500; font-family: "思源宋体", "Source Han Serif SC", "宋体", SimSun, serif">复制 </span>
                    <span class="separator"><img src="../icons/separator.png" alt="separator" style="width:8px; height:24px; margin-left:1px; margin-right:1px;"></span>
                    <button class="action-btn like-btn" title="点赞"><img class="like-icon action-icon" src="../icons/good.png" alt="like icon"></button>
                    <button class="action-btn dislike-btn" title="点踩"><img class="dislike-icon action-icon" src="../icons/bad.png" alt="dislike icon"></button>
                </div>
            `;
        }
    
        element.innerHTML = `
            <input type="checkbox" class="message-selector" title="选择此消息" >
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
        // 使用setTimeout确保DOM更新完成后再渲染
        setTimeout(() => {
            if (window.MathJax && window.MathJax.typesetPromise) {
                // 使用MathJax v3的typesetPromise方法
                window.MathJax.typesetPromise([element]).catch((err) =>
                    console.log('MathJax typesetting error:', err)
                );
            } else if (window.MathJax && window.MathJax.Hub) {
                // 兼容MathJax v2
                window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub, element]);
            } else {
                console.warn('MathJax not loaded, waiting for it to be available...');
                // 如果MathJax还没加载完成，等待一段时间后重试
                setTimeout(() => {
                    this.renderMathInElement(element);
                }, 100);
            }
        }, 10);
    }


    /**
     * [MODIFIED] 格式化消息内容，处理markdown和LaTeX
     * @param {string} content - 原始消息内容
     * @returns {string} - 格式化后的HTML内容
     */
    formatMessageContent(content) {
        if (!content) return '';

        // 保护LaTeX公式块，用占位符替换
        const latexPlaceholders = [];
        const placeholder = "LATEX_PLACEHOLDER_";
        
        // 保护块级公式 $$...$$（独占一行的公式）
        // 修改正则表达式，确保只匹配真正的块级公式
        let tempContent = content.replace(/\$\$\s*([\s\S]*?)\s*\$\$/g, (match, formula) => {
            // 过滤掉空公式
            if (formula.trim() === '') return match;
            console.log('块级公式'+match);
            latexPlaceholders.push(match);
            return `${placeholder}${latexPlaceholders.length - 1}$$`;
        });
        // 保护行内公式 $...$（不独占一行的公式）
        // 修改正则表达式，避免匹配到块级公式
        tempContent = tempContent.replace(/\$(?!\$)([^$]*?)\$(?!\$)/g, (match) => {
            console.log('行内公式'+match);
            latexPlaceholders.push(match);
            return `$${placeholder}${latexPlaceholders.length - 1}`;
        });
        
        // 使用 marked.js 渲染 Markdown
        let formattedContent;
        if (window.marked) {
            // 配置 marked 选项
            marked.setOptions({
                breaks: true, // 转换 \n 为 <br>
                gfm: true,    // 启用 GitHub 风格的 Markdown
                smartypants: true // 启用智能标点符号
            });
            
            // 渲染 Markdown
            formattedContent = marked.parse(tempContent);
        } else {
            // 如果 marked.js 未加载，使用简单的替换
            console.warn('Marked.js not loaded, using fallback formatting');
            formattedContent = this.fallbackFormat(tempContent);
        }

        // 恢复LaTeX公式，让MathJax处理渲染
        // 行内公式恢复
        formattedContent = formattedContent.replace(new RegExp(`\\$${placeholder}(\\d+)`, 'g'), (match, index) => {
            return latexPlaceholders[parseInt(index, 10)];
        });
        
        // 块级公式恢复
        formattedContent = formattedContent.replace(new RegExp(`${placeholder}(\\d+)\\$\\$`, 'g'), (match, index) => {
            return latexPlaceholders[parseInt(index, 10)];
        });
        
        return formattedContent;
    }

    /**
     * 备用格式化方法，当 marked.js 未加载时使用
     * @param {string} content - 内容
     * @returns {string} - 格式化后的内容
     */
    fallbackFormat(content) {
        // 处理代码块 (```language or ```)
        let formattedContent = content.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, language, code) => {
            const lang = language ? ` class="language-${language}"` : '';
            return `<pre><code${lang}>${this.escapeHtml(code.trim())}</code></pre>`;
        });
        
        // 处理行内代码 (`code`)
        formattedContent = formattedContent.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // 处理粗体 (**text** or __text__)
        formattedContent = formattedContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formattedContent = formattedContent.replace(/__(.*?)__/g, '<strong>$1</strong>');
        
        // 处理斜体 (*text* or _text_)
        formattedContent = formattedContent.replace(/\*(.*?)\*/g, '<em>$1</em>');
        formattedContent = formattedContent.replace(/_(.*?)_/g, '<em>$1</em>');
        
        // 处理删除线 (~~text~~)
        formattedContent = formattedContent.replace(/~~(.*?)~~/g, '<del>$1</del>');
        
        // 处理链接 [text](url)
        formattedContent = formattedContent.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
        
        // 处理段落
        formattedContent = formattedContent.replace(/\n\n/g, '</p><p>');
        formattedContent = `<p>${formattedContent}</p>`;
        
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
        // 使用CSS类来控制背景图片，不再使用Material Icons
        if (isLoading) {
            this.sendMessageBtn.classList.add('loading');
            this.sendMessageBtn.classList.remove('ready');
        } else {
            this.sendMessageBtn.classList.remove('loading');
            this.sendMessageBtn.classList.add('ready');
        }
        // 清空按钮内容，依靠CSS背景图片
        this.sendMessageBtn.innerHTML = '';
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
                    <h3>记忆管理</h3>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="dialog-body">
                    <div class="memory-stats">
                        <h4>对话统计</h4>
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
                        <h4>记忆操作</h4>
                        <div class="action-buttons">
                            <button class="action-btn clear-history-btn">
                                清理历史 (保留最近5条)
                            </button>
                            <button class="action-btn clear-all-btn">
                                清空全部
                            </button>
                        </div>
                    </div>
                    <div class="memory-info">
                        <h4>记忆说明</h4>
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
            onClearHistory(10);
            document.body.removeChild(dialog);
        });
        
        dialog.querySelector('.clear-all-btn').addEventListener('click', () => {
            // 先在对话内清除所有 stat-label / stat-value 文本
            try {
                dialog.querySelectorAll('.stat-label').forEach(el => el.textContent = '');
                dialog.querySelectorAll('.stat-value').forEach(el => el.textContent = '');
                // 作为兜底，如果页面上还有其他 stat-label / stat-value，一并清空
                document.querySelectorAll('.stat-label').forEach(el => el.textContent = '');
                document.querySelectorAll('.stat-value').forEach(el => el.textContent = '');
            } catch (e) {
                console.warn('清空 stat-label/stat-value 时出错:', e);
            }

            // 调用外部传入的清理回调（0 表示清空全部）
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