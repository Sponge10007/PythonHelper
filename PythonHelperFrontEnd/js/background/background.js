// js/background/background.js
import { DataManager } from './DataManager.js';
import { MessageHandler } from './MessageHandler.js';

class BackgroundService {
    constructor() {
        this.dataManager = new DataManager();
        this.messageHandler = new MessageHandler(this.dataManager);
    }
    
    async run() {
        await this.dataManager.init();
        this.messageHandler.listen();
        
        // 设置点击扩展图标时打开侧边栏
        chrome.action.onClicked.addListener(async (tab) => {
            await chrome.sidePanel.open({ windowId: tab.windowId });
        });
        
        console.log('Python教学助手后台脚本已初始化 - 侧边栏模式');
    }
}

// 启动后台服务
const service = new BackgroundService();
service.run();