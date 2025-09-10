// js/mistake_manager/main.js

import { UIManager } from './UIManager.js';
import { MistakeHandler } from './MistakeHandler.js';
import { PPTHandler } from './PPTHandler.js';

class PageManager {
    constructor() {
        this.ui = new UIManager();
        this.mistakeHandler = new MistakeHandler(this.ui);
        this.pptHandler = new PPTHandler(this.ui);
        
        this.currentMode = 'mistake'; // 默认是错题模式

        this.bindEvents();
        this.init();
    }

    async init() {
        await this.mistakeHandler.init();
        await this.pptHandler.init();
    }

    bindEvents() {
        // --- 模式切换事件 ---
        document.getElementById('mistakeModeBtn').addEventListener('click', () => this.switchMode('mistake'));
        document.getElementById('pptModeBtn').addEventListener('click', () => this.switchMode('ppt'));

        // --- 错题相关事件 ---
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.mistakeHandler.filter({ search: e.target.value });
        });
        document.getElementById('sortBy').addEventListener('change', (e) => {
            this.mistakeHandler.sort(e.target.value);
        });
        // ... 绑定错题的批量删除、分页等按钮事件到 this.mistakeHandler 的方法

        // --- PPT 相关事件 ---
        document.getElementById('pptFileInput').addEventListener('change', (e) => {
            this.pptHandler.uploadFiles(e.target.files);
        });
        // ... 绑定PPT的搜索、排序、批量删除等按钮事件到 this.pptHandler 的方法

        // --- 新增：模态框事件绑定 ---
        const modal = document.getElementById('modal');
        modal.querySelector('#saveMistake').addEventListener('click', () => this.mistakeHandler.saveMistake());
        modal.querySelector('#closeModal').addEventListener('click', () => this.ui.toggleModal('modal', false));
        modal.querySelector('#cancelEdit').addEventListener('click', () => this.ui.toggleModal('modal', false));

    }

    switchMode(mode) {
        this.currentMode = mode;
        // ... (从原 mistake_manager.js 中复制 switchMode 的UI切换逻辑) ...
        document.getElementById('mistakeModeBtn').classList.toggle('active', mode === 'mistake');
        document.getElementById('pptModeBtn').classList.toggle('active', mode === 'ppt');
        document.getElementById('mistakeModeContent').classList.toggle('active', mode === 'mistake');
        document.getElementById('pptModeContent').classList.toggle('active', mode === 'ppt');
        // ...
    }
}

// 启动页面
document.addEventListener('DOMContentLoaded', () => {
    new PageManager();
});