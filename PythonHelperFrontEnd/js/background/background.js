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
        this.setupSidePanel();
        console.log('Python教学助手后台脚本已初始化');
    }

    setupSidePanel() {
        // 确保只有一个激活的tab可以打开侧边栏
        chrome.sidePanel
            .setPanelBehavior({ openPanelOnActionClick: true })
            .catch(error => console.error(error));
    }
}

// 启动后台服务
const service = new BackgroundService();
service.run();