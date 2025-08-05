// 侧边栏主要逻辑
class SidebarManager {
    constructor() {
        this.selectedText = '';
        this.currentQuestion = '';
        this.currentAnswer = '';
        this.answerHistory = []; // 答案历史记录
        this.mistakes = [];
        this.isLoading = false;
        this.backendUrl = 'http://localhost:5000'; // 后端服务地址
        
        this.initElements();
        this.bindEvents();
        this.init();
        this.setupMessageListener();
    }

    initElements() {
        // 获取DOM元素
        this.selectedTextElement = document.getElementById('selectedText');
        this.askQuestionButton = document.getElementById('askQuestion');
        this.chatMessagesElement = document.getElementById('chatMessages');
        this.chatInputElement = document.getElementById('chatInput');
        this.sendMessageButton = document.getElementById('sendMessage');
        this.toggleMistakeCollectionButton = document.getElementById('toggleMistakeCollection');
        this.backToMainButton = document.getElementById('backToMain');
        this.mistakeCollectionElement = document.getElementById('mistakeCollection');
        this.mistakeListElement = document.getElementById('mistakeList');
        this.mainContentElement = document.querySelector('.main-content');
        this.currentQuestionElement = document.getElementById('currentQuestion');
        this.currentQuestionTextElement = this.currentQuestionElement.querySelector('.question-text');
        this.currentAnswerTextElement = this.currentQuestionElement.querySelector('.answer-text');
        this.undoAnswerButton = document.getElementById('undoAnswer');
        this.addToMistakesButton = document.getElementById('addToMistakes');
    }

    bindEvents() {
        // 绑定事件监听器
        this.sendMessageButton.addEventListener('click', () => this.sendMessage());
        this.chatInputElement.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.askQuestionButton.addEventListener('click', () => this.askSelectedText());
        this.undoAnswerButton.addEventListener('click', () => this.undoLastAnswer());
        this.addToMistakesButton.addEventListener('click', async () => await this.addCurrentToMistakes());
        this.toggleMistakeCollectionButton.addEventListener('click', () => this.showMistakeCollection());
        this.backToMainButton.addEventListener('click', () => this.showMainContent());
    }

    async init() {
        await this.loadMistakes();
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
        
        // 页面加载时检查是否有未处理的消息
        this.checkPendingMessages();
    }

    handleTextSelected(text) {
        this.selectedText = text.trim();
        
        if (this.selectedText) {
            this.selectedTextElement.textContent = this.selectedText;
            this.selectedTextElement.classList.add('has-content');
            this.askQuestionButton.disabled = false;
        } else {
            this.selectedTextElement.textContent = '请选中网页上的文本...';
            this.selectedTextElement.classList.remove('has-content');
            this.askQuestionButton.disabled = true;
        }
    }

    askSelectedText() {
        if (!this.selectedText) return;
        
        // 设置当前题目
        this.currentQuestion = this.selectedText;
        this.currentAnswer = '';
        this.answerHistory = []; // 重置答案历史
        this.updateCurrentQuestionDisplay();
        
        // 发送问题给AI
        this.addMessage(this.selectedText, 'user');
        this.sendMessageToAI(this.selectedText);
    }

    updateCurrentQuestionDisplay() {
        if (this.currentQuestion) {
            this.currentQuestionTextElement.textContent = this.currentQuestion;
            this.currentAnswerTextElement.textContent = this.currentAnswer;
            this.currentQuestionElement.style.display = 'block';
            
            // 更新按钮状态
            this.undoAnswerButton.disabled = this.answerHistory.length === 0;
            this.addToMistakesButton.disabled = !this.currentQuestion;
        } else {
            this.currentQuestionElement.style.display = 'none';
        }
    }



    async sendMessage() {
        const message = this.chatInputElement.value.trim();
        if (!message) return;

        // 显示用户消息
        this.addMessage(message, 'user');
        this.chatInputElement.value = '';
        
        // 使用新的发送方法
        this.sendMessageToAI(message);
    }

    addMessage(content, sender, messageId = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        let messageContent = `<div class="message-content">${this.escapeHtml(content)}</div>`;
        
        // 为AI消息添加操作按钮
        if (sender === 'ai' && this.currentQuestion) {
            const actionMessageId = Date.now();
            messageContent += `
                <div class="message-actions">
                    <button class="message-action-btn set-answer" data-message-id="${actionMessageId}">设为答案</button>
                </div>
            `;
        }
        
        messageDiv.innerHTML = messageContent;
        messageDiv.dataset.messageId = messageId || Date.now();
        
        this.chatMessagesElement.appendChild(messageDiv);
        this.chatMessagesElement.scrollTop = this.chatMessagesElement.scrollHeight;
        
        // 绑定操作按钮事件
        if (sender === 'ai' && this.currentQuestion) {
            this.bindMessageActions(messageDiv, content);
        }
    }

    bindMessageActions(messageDiv, content) {
        const setAnswerBtn = messageDiv.querySelector('.set-answer');
        
        if (setAnswerBtn) {
            setAnswerBtn.addEventListener('click', () => {
                this.setAsAnswer(content);
            });
        }
    }

    setAsAnswer(content) {
        // 添加到答案历史记录
        this.answerHistory.push(content);
        
        // 更新当前答案
        if (this.currentAnswer) {
            this.currentAnswer += '\n\n' + content;
        } else {
            this.currentAnswer = content;
        }
        
        this.updateCurrentQuestionDisplay();
        this.showNotification('已设为答案');
    }

    undoLastAnswer() {
        if (this.answerHistory.length === 0) {
            this.showNotification('没有可撤销的答案');
            return;
        }
        
        // 移除最后一个答案
        this.answerHistory.pop();
        
        // 重新构建当前答案
        this.currentAnswer = this.answerHistory.join('\n\n');
        
        this.updateCurrentQuestionDisplay();
        this.showNotification('已撤销最后一个答案');
    }

    async addCurrentToMistakes() {
        if (!this.currentQuestion) {
            this.showNotification('请先设置题目');
            return;
        }
        
        const mistake = {
            id: Date.now(),
            questionId: null,
            title: '用户题目',
            content: this.currentQuestion,
            answer: this.currentAnswer || '暂无答案',
            category: '用户添加',
            difficulty: '未知',
            addedAt: new Date().toISOString()
        };

        this.mistakes.push(mistake);
        await this.saveMistakes();
        this.updateMistakeList();
        this.showNotification('已添加到错题集');
    }

    sendMessageToAI(message) {
        this.sendMessageButton.disabled = true;
        this.isLoading = true;

        this.callBackendAI(message)
            .then(response => {
                this.displayAIResponse(response);
            })
            .catch(error => {
                console.error('AI服务调用失败:', error);
                this.showNotification('后端AI服务连接失败，尝试使用本地AI');
                
                // 如果后端失败，回退到background script
                console.log('回退到background script处理AI请求');
                chrome.runtime.sendMessage({
                    type: 'AI_REQUEST',
                    message: message,
                    selectedText: this.selectedText
                });
            });
    }

    displayAIResponse(response) {
        this.addMessage(response, 'ai');
        this.sendMessageButton.disabled = false;
        this.isLoading = false;
    }

    async callBackendAI(message) {
        // 获取API配置
        const result = await chrome.storage.local.get(['aiApiKey', 'aiApiEndpoint']);
        const apiKey = result.aiApiKey || '';
        const apiEndpoint = result.aiApiEndpoint || 'https://api.deepseek.com/v1/chat/completions';

        // 构建提示词
        let prompt = `用户问题: ${message}\n\n`;
        
        if (this.selectedText) {
            prompt += `选中的文本: ${this.selectedText}\n\n`;
        }
        
        prompt += `请根据以上信息，为用户提供详细的解答。`;

        // 调用后端API
        console.log('侧边栏调用后端API:', `${this.backendUrl}/ai/chat`);
        const response = await fetch(`${this.backendUrl}/ai/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: prompt,
                apiKey: apiKey,
                apiEndpoint: apiEndpoint
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('后端API响应错误:', response.status, errorText);
            throw new Error(`后端请求失败: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('后端API响应:', data);
        return data.response;
    }

    async addToMistakes(question) {
        const mistake = {
            id: Date.now(),
            questionId: question.id,
            title: question.title,
            content: question.content,
            answer: question.answer,
            category: question.category,
            difficulty: question.difficulty,
            addedAt: new Date().toISOString()
        };

        this.mistakes.push(mistake);
        await this.saveMistakes();
        this.updateMistakeList();

        // 显示成功提示
        this.showNotification('已添加到错题集');
    }

    async removeFromMistakes(mistakeId) {
        this.mistakes = this.mistakes.filter(m => m.id !== mistakeId);
        await this.saveMistakes();
        this.updateMistakeList();
    }

    async saveMistakes() {
        try {
            // 优先保存到后端
            const response = await fetch(`${this.backendUrl}/mistakes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ mistakes: this.mistakes })
            });
            
            if (!response.ok) {
                throw new Error('后端保存失败');
            }
            
            // 同时保存到本地存储作为备份
            chrome.storage.local.set({ mistakes: this.mistakes });
        } catch (error) {
            console.warn('后端保存失败，使用本地存储:', error);
            // 回退到本地存储
            chrome.storage.local.set({ mistakes: this.mistakes });
        }
    }

    async loadMistakes() {
        try {
            // 优先从后端加载数据
            const response = await fetch(`${this.backendUrl}/mistakes`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.mistakes = data.mistakes || [];
            } else {
                // 回退到本地存储
                const result = await chrome.storage.local.get(['mistakes']);
                this.mistakes = result.mistakes || [];
            }
        } catch (error) {
            console.warn('后端连接失败，使用本地存储:', error);
            // 回退到本地存储
            const result = await chrome.storage.local.get(['mistakes']);
            this.mistakes = result.mistakes || [];
        }
        
        this.updateMistakeList();
    }

    updateMistakeList() {
        this.mistakeListElement.innerHTML = '';

        if (this.mistakes.length === 0) {
            this.mistakeListElement.innerHTML = '<div class="no-mistakes">暂无错题记录</div>';
            return;
        }

        this.mistakes.forEach(mistake => {
            const mistakeElement = this.createMistakeElement(mistake);
            this.mistakeListElement.appendChild(mistakeElement);
        });
    }

    createMistakeElement(mistake) {
        const div = document.createElement('div');
        div.className = 'mistake-item';
        div.innerHTML = `
            <div class="mistake-item-header">
                <div class="mistake-title">${mistake.title}</div>
                <button class="remove-mistake-btn" data-id="${mistake.id}">删除</button>
            </div>
            <div class="mistake-content">${mistake.content}</div>
            <div class="mistake-answer">${mistake.answer}</div>
        `;

        // 删除错题
        const removeButton = div.querySelector('.remove-mistake-btn');
        removeButton.addEventListener('click', async () => {
            await this.removeFromMistakes(mistake.id);
        });

        return div;
    }

    showMistakeCollection() {
        this.mistakeCollectionElement.classList.remove('hidden');
        this.mainContentElement.style.display = 'none';
    }

    showMainContent() {
        this.mistakeCollectionElement.classList.add('hidden');
        this.mainContentElement.style.display = 'block';
    }



    showNotification(message) {
        // 创建临时通知
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 10px 15px;
            border-radius: 6px;
            z-index: 1000;
            font-size: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    async checkPendingMessages() {
        try {
            const result = await chrome.storage.local.get(['lastMessage']);
            if (result.lastMessage) {
                const message = result.lastMessage;
                const now = Date.now();
                
                // 只处理最近5秒内的消息
                if (now - message.timestamp < 5000) {
                    if (message.type === 'TEXT_SELECTED') {
                        this.handleTextSelected(message.text);
                    } else if (message.type === 'AI_RESPONSE') {
                        this.displayAIResponse(message.response);
                    }
                }
            }
        } catch (error) {
            console.error('检查待处理消息失败:', error);
        }
    }
}

// 初始化侧边栏
document.addEventListener('DOMContentLoaded', () => {
    new SidebarManager();
}); 