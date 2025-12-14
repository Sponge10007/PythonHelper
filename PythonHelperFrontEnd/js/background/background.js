// js/background/background.js
import { DataManager } from './DataManager.js';
import { MessageHandler } from './MessageHandler.js';

class BackgroundService {
    constructor() {
        this.dataManager = new DataManager();
        this.messageHandler = new MessageHandler(this.dataManager);
        this.bindlistener(); // 必须马上绑定监听器，否则会因为数据无法初始化，导致侧边栏展开无限推迟
    }
    
    bindlistener() {
        this.messageHandler.listen();
        
        // 设置点击扩展图标时打开侧边栏
        chrome.action.onClicked.addListener(async (tab) => {
            await chrome.sidePanel.open({ windowId: tab.windowId });
        });
        
    }
    async run() {
        await this.dataManager.init();
        console.log('Python教学助手后台脚本已初始化 - 侧边栏模式');
    }
}

// 启动后台服务
const service = new BackgroundService();
service.run();