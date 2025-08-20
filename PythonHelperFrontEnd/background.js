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

        // **MODIFIED: 使用新的API来处理图标点击事件**
        // 确保只有一个激活的tab可以打开侧边栏
        chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
            .catch(error => console.error(error));
        
        console.log('Python教学助手后台脚本已初始化');
    }

    async loadQuestions() {
        try {
            const response = await fetch(`${this.backendUrl}/questions`);
            if (response.ok) {
                const data = await response.json();
                this.questions = data.questions || [];
                console.log(`已从后端加载 ${this.questions.length} 道题目`);
            } else {
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
            console.log('收到消息:', message.type);
            
            switch (message.type) {
                case 'TEXT_SELECTED':
                    this.handleTextSelected(message, sender);
                    break;
                case 'SETTINGS_UPDATED':
                    this.handleSettingsUpdated(message, sender);
                    break;
                case 'QUESTION_MODE_CHANGED':
                    this.handleQuestionModeChanged(message, sender);
                    break;
                // 注意：其他消息类型由侧边栏直接处理或已移除
            }
            // 返回true表示可能会异步发送响应
            return true;
        });
    }

    setupTabListeners() {
        chrome.tabs.onActivated.addListener(activeInfo => {
            this.currentTabId = activeInfo.tabId;
        });
    }
    
    // **REMOVED: 不再需要旧的onClicked监听器**
    // chrome.action.onClicked.addListener(...)

    handleTextSelected(message, sender) {
        chrome.runtime.sendMessage({
            type: 'TEXT_SELECTED',
            text: message.text
        }).catch(e => console.log("无法将选中文本发送到侧边栏，可能侧边栏未打开。"));
    }

    handleSettingsUpdated(message, sender) {
        const { settings } = message;
        this.aiApiKey = settings.apiKey || '';
        this.aiApiEndpoint = settings.apiEndpoint || 'https://api.deepseek.com/v1/chat/completions';
        console.log('后台设置已更新');
    }

    handleQuestionModeChanged(message, sender) {
        this.currentQuestionMode = message.mode;
        console.log('后台题目模式已更改为:', this.currentQuestionMode);
        chrome.storage.local.set({ currentQuestionMode: this.currentQuestionMode });
    }
}

// 初始化后台管理器
new BackgroundManager();