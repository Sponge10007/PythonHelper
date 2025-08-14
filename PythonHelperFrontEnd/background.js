// 后台脚本 - 插件的核心逻辑
class BackgroundManager {
    constructor() {
        this.questions = [];
        this.currentTabId = null;
        this.backendUrl = 'http://localhost:5000'; // 后端服务地址
        this.aiApiEndpoint = 'https://api.deepseek.com/v1/chat/completions'; // DeepSeek API端点
        this.aiApiKey = ''; // 需要用户配置API密钥
        this.currentQuestionMode = 'objective'; // 默认客观题模式
        
        this.init();
    }

    async init() {
        // 加载题库数据
        await this.loadQuestions();
        
        // 加载设置
        await this.loadSettings();
        
        // 设置消息监听器
        this.setupMessageListeners();
        
        // 设置标签页监听器
        this.setupTabListeners();
        
        console.log('Python教学助手后台脚本已初始化');
    }

    async loadQuestions() {
        try {
            // 优先从后端加载新的数据库
            const response = await fetch(`${this.backendUrl}/questions`);
            if (response.ok) {
                const data = await response.json();
                this.questions = data.questions || [];
                console.log(`已从后端加载 ${this.questions.length} 道题目`);
            } else {
                // 回退到本地题库
                const localResponse = await fetch(chrome.runtime.getURL('data/questions.json'));
                const localData = await localResponse.json();
                this.questions = localData.questions || [];
                console.log(`已从本地加载 ${this.questions.length} 道题目`);
            }
        } catch (error) {
            console.error('加载题库失败:', error);
            this.questions = [];
        }
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.local.get(['aiApiKey', 'aiApiEndpoint', 'currentQuestionMode']);
            this.aiApiKey = result.aiApiKey || '';
            this.aiApiEndpoint = result.aiApiEndpoint || 'https://api.deepseek.com/v1/chat/completions';
            this.currentQuestionMode = result.currentQuestionMode || 'objective';
            console.log('设置已加载，当前题目模式:', this.currentQuestionMode);
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    }

    setupMessageListeners() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.type) {
                case 'TEXT_SELECTED':
                    this.handleTextSelected(message, sender);
                    break;
                case 'SEARCH_QUESTIONS':
                    this.handleSearchQuestions(message, sender);
                    break;
                case 'AI_REQUEST':
                    this.handleAIRequest(message, sender);
                    break;
                case 'SETTINGS_UPDATED':
                    this.handleSettingsUpdated(message, sender);
                    break;
                case 'QUESTION_MODE_CHANGED':
                    this.handleQuestionModeChanged(message, sender);
                    break;
                case 'CONTENT_SCRIPT_LOADED':
                    this.handleContentScriptLoaded(sender);
                    break;
                default:
                    console.log('未知消息类型:', message.type);
            }
        });
    }

    setupTabListeners() {
        // 监听标签页激活事件
        chrome.tabs.onActivated.addListener((activeInfo) => {
            this.currentTabId = activeInfo.tabId;
        });

        // 监听标签页更新事件
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.active) {
                this.currentTabId = tabId;
            }
        });

        // 监听插件图标点击事件，打开侧边栏
        chrome.action.onClicked.addListener(async (tab) => {
            try {
                // 打开侧边栏
                await chrome.sidePanel.open({ tabId: tab.id });
                console.log('侧边栏已打开');
            } catch (error) {
                console.error('打开侧边栏失败:', error);
            }
        });
    }

    handleTextSelected(message, sender) {
        // 将选中的文本转发到侧边栏
        this.sendToSidebar({
            type: 'TEXT_SELECTED',
            text: message.text
        });
    }

    handleSearchQuestions(message, sender) {
        const query = message.query;
        const results = this.searchQuestions(query);
        
        // 发送搜索结果到侧边栏
        this.sendToSidebar({
            type: 'SEARCH_RESULTS',
            results: results
        });
    }

    async handleAIRequest(message, sender) {
        try {
            const response = await this.callAI(message);
            
            // 发送AI回复到侧边栏
            this.sendToSidebar({
                type: 'AI_RESPONSE',
                response: response
            });
        } catch (error) {
            console.error('AI请求失败:', error);
            this.sendToSidebar({
                type: 'AI_RESPONSE',
                error: error.message
            });
        }
    }

    handleSettingsUpdated(message, sender) {
        const { settings } = message;
        this.aiApiKey = settings.apiKey || '';
        this.aiApiEndpoint = settings.apiEndpoint || 'https://api.deepseek.com/v1/chat/completions';
        console.log('设置已更新');
    }

    handleContentScriptLoaded(sender) {
        console.log('内容脚本已加载:', sender.tab?.url);
    }

    searchQuestions(query) {
        if (!query || query.length < 2) {
            return [];
        }

        const results = [];
        const queryLower = query.toLowerCase();

        // 搜索算法：基于关键词匹配和相关性评分
        this.questions.forEach(question => {
            let score = 0;
            
            // 标题匹配
            if (question.title && question.title.toLowerCase().includes(queryLower)) {
                score += 10;
            }
            
            // 内容匹配
            if (question.content && question.content.toLowerCase().includes(queryLower)) {
                score += 8;
            }
            
            // 原始题目内容匹配（新数据库格式）
            if (question.original_question && question.original_question.toLowerCase().includes(queryLower)) {
                score += 8;
            }
            
            // 关键词匹配
            if (question.keywords) {
                question.keywords.forEach(keyword => {
                    if (keyword.toLowerCase().includes(queryLower) || 
                        queryLower.includes(keyword.toLowerCase())) {
                        score += 5;
                    }
                });
            }
            
            // 答案匹配
            if (question.answer && question.answer.toLowerCase().includes(queryLower)) {
                score += 3;
            }
            
            // 原始答案匹配（新数据库格式）
            if (question.original_answer && question.original_answer.toLowerCase().includes(queryLower)) {
                score += 3;
            }

            if (score > 0) {
                results.push({
                    ...question,
                    score: score
                });
            }
        });

        // 按相关性排序并返回前5个结果
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map(item => {
                const { score, ...question } = item;
                return question;
            });
    }

    async callAI(message) {
        // 如果没有配置API密钥，尝试使用后端服务
        if (!this.aiApiKey) {
            try {
                console.log('使用后端AI服务（无API密钥）');
                return await this.callBackendAI(message);
            } catch (error) {
                console.error('后端AI服务调用失败:', error);
                return this.getMockAIResponse(message);
            }
        }

        try {
            const promptData = this.buildAIPrompt(message);
            
            const response = await fetch(this.aiApiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.aiApiKey}`
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [
                        {
                            role: 'system',
                            content: promptData.system
                        },
                        {
                            role: 'user',
                            content: promptData.user
                        }
                    ],
                    max_tokens: 500,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                throw new Error(`API请求失败: ${response.status}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            console.error('AI API调用失败:', error);
            // 如果直接API调用失败，尝试使用后端服务
            try {
                return await this.callBackendAI(message);
            } catch (backendError) {
                console.error('后端AI服务也失败:', backendError);
                return this.getMockAIResponse(message);
            }
        }
    }

    async callBackendAI(message) {
        const promptData = this.buildAIPrompt(message);
        
        console.log('调用后端AI服务:', `${this.backendUrl}/ai/chat`);
        console.log('请求数据:', {
            message: promptData.user,
            system: promptData.system,
            apiKey: this.aiApiKey ? '***' : '(未配置)',
            apiEndpoint: this.aiApiEndpoint
        });
        
        const response = await fetch(`${this.backendUrl}/ai/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: promptData.user,
                system: promptData.system,
                apiKey: this.aiApiKey,
                apiEndpoint: this.aiApiEndpoint
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('后端响应错误:', response.status, errorText);
            throw new Error(`后端请求失败: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('后端AI响应:', data);
        return data.response;
    }

    buildAIPrompt(message) {
        // 使用模式特定的提示构建
        const modePrompt = this.buildModeSpecificPrompt(message.message, message.selectedText);
        
        let prompt = modePrompt.user;
        
        // 如果有搜索结果，添加到提示中
        if (message.searchResults && message.searchResults.length > 0) {
            prompt += `\n\n相关参考题目:\n`;
            message.searchResults.forEach((result, index) => {
                const title = result.title || `题目 ${result.question_number || result.id}`;
                const content = result.content || result.original_question || '';
                const answer = result.answer || '';
                
                prompt += `${index + 1}. ${title}\n`;
                prompt += `   问题: ${content}\n`;
                prompt += `   答案: ${answer}\n\n`;
            });
        }
        
        return {
            system: modePrompt.system,
            user: prompt
        };
    }

    getMockAIResponse(message) {
        const responses = [
            '这是一个很好的Python问题！根据你选中的文本，我建议你...',
            '在Python中，这个问题通常可以通过以下方式解决...',
            '让我为你详细解释这个Python概念...',
            '这个问题涉及到Python的多个重要概念，我来为你逐一分析...',
            '根据你提供的信息，我推荐以下解决方案...'
        ];
        
        return responses[Math.floor(Math.random() * responses.length)] + 
               '\n\n(注：这是模拟回复，请配置真实的AI API密钥以获得更好的体验)';
    }

    sendToSidebar(message) {
        // 发送消息到侧边栏
        // 在Manifest V3中，侧边栏可以通过chrome.runtime.onMessage接收消息
        // 但需要确保侧边栏页面已经加载
        chrome.runtime.sendMessage(message).catch(error => {
            console.log('发送消息到侧边栏失败:', error);
        });
        
        // 同时尝试通过storage API传递消息（作为备选方案）
        chrome.storage.local.set({ 
            lastMessage: {
                ...message,
                timestamp: Date.now()
            }
        });
    }

    // 错题集管理方法
    async addToMistakes(question) {
        try {
            const result = await chrome.storage.local.get(['mistakes']);
            const mistakes = result.mistakes || [];
            
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
            
            mistakes.push(mistake);
            await chrome.storage.local.set({ mistakes: mistakes });
            
            return true;
        } catch (error) {
            console.error('添加错题失败:', error);
            return false;
        }
    }

    async getMistakes() {
        try {
            const result = await chrome.storage.local.get(['mistakes']);
            return result.mistakes || [];
        } catch (error) {
            console.error('获取错题集失败:', error);
            return [];
        }
    }

    async removeFromMistakes(mistakeId) {
        try {
            const result = await chrome.storage.local.get(['mistakes']);
            const mistakes = result.mistakes || [];
            
            const updatedMistakes = mistakes.filter(m => m.id !== mistakeId);
            await chrome.storage.local.set({ mistakes: updatedMistakes });
            
            return true;
        } catch (error) {
            console.error('删除错题失败:', error);
            return false;
        }
    }

    // 题目模式相关方法
    handleQuestionModeChanged(message, sender) {
        this.currentQuestionMode = message.mode;
        console.log('题目模式已更改为:', this.currentQuestionMode);
        
        // 保存到存储
        chrome.storage.local.set({ currentQuestionMode: this.currentQuestionMode });
    }

    buildModeSpecificPrompt(message, selectedText = '') {
        const modePrompts = {
            'function': {
                system: '你是一个专业的Python函数编程助手。请帮助用户编写符合要求的函数。',
                user: `请根据以下要求编写Python函数：

题目要求：${message}
${selectedText ? `相关代码：${selectedText}` : ''}

请提供：
1. 函数定义和参数说明
2. 完整的函数实现
3. 使用示例
4. 时间复杂度分析（如果适用）
5. 可能的边界情况处理

请确保代码简洁、高效且符合Python最佳实践。`
            },
            'programming': {
                system: '你是一个专业的Python编程助手。请帮助用户编写完整的程序来解决特定问题。',
                user: `请根据以下要求编写完整的Python程序：

题目要求：${message}
${selectedText ? `相关代码：${selectedText}` : ''}

请提供：
1. 程序整体思路和算法说明
2. 完整的程序代码
3. 输入输出示例
4. 程序运行说明
5. 可能的优化建议

请确保程序结构清晰、功能完整且易于理解。`
            },
            'objective': {
                system: '你是一个专业的Python教学助手。请帮助用户理解和解答Python相关的选择题和判断题。',
                user: `请根据以下题目提供详细的解答：

题目：${message}
${selectedText ? `相关背景：${selectedText}` : ''}

请提供：
1. 题目分析
2. 正确答案及解释
3. 相关知识点说明
4. 类似题目推荐
5. 学习建议

请用简洁明了的中文回答，帮助用户深入理解相关概念。`
            }
        };

        const prompt = modePrompts[this.currentQuestionMode] || modePrompts['objective'];
        
        return {
            system: prompt.system,
            user: prompt.user
        };
    }

    getModeDisplayName(mode) {
        const modeNames = {
            'function': '函数题',
            'programming': '编程题',
            'objective': '客观题'
        };
        return modeNames[mode] || '未知模式';
    }
}

// 初始化后台管理器
new BackgroundManager(); 