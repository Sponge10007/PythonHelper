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
        // 确保"全部"标签默认激活
        this.initializeTagFilter();
    }

    // 初始化标签筛选状态
    initializeTagFilter() {
        const allTag = document.querySelector('#tagFilter .tag-item');
        if (allTag && allTag.textContent.trim() === '全部') {
            allTag.classList.add('active');
        }
    }

    bindEvents() {
        // --- 模式切换事件 ---
        document.getElementById('mistakeModeBtn').addEventListener('click', () => this.switchMode('mistake'));
        document.getElementById('pptModeBtn').addEventListener('click', () => this.switchMode('ppt'));

        // --- 错题相关事件 ---
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.mistakeHandler.applyFilters({ search: e.target.value });
        });
        document.getElementById('sortBy').addEventListener('change', (e) => {
            this.mistakeHandler.sort(e.target.value);
        });
        
        // 标签筛选事件
        this.bindTagFilters();
        
        // --- 批量操作和编辑模式事件 ---
        this.bindBatchOperations();
        
        // --- 分页事件 ---
        this.bindPaginationEvents();
        
        // ... 绑定错题的批量删除、分页等按钮事件到 this.mistakeHandler 的方法

        // --- PPT 相关事件 ---
        // 文件上传
        const pptFileInput = document.getElementById('pptFileInput');
        if (pptFileInput) {
            pptFileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.pptHandler.uploadFiles(Array.from(e.target.files));
                    e.target.value = ''; // 清空input，允许重复上传同一文件
                }
            });
        }

        // PPT搜索功能
        const pptSearchInput = document.getElementById('pptSearchInput');
        if (pptSearchInput) {
            pptSearchInput.addEventListener('input', (e) => {
                this.pptHandler.searchFiles(e.target.value);
            });
        }

        // PPT排序功能
        const pptSortBy = document.getElementById('pptSortBy');
        if (pptSortBy) {
            pptSortBy.addEventListener('change', (e) => {
                this.pptHandler.sortFiles(e.target.value);
            });
        }

        // PPT编辑模式
        const editModePPT = document.getElementById('editModePPT');
        const cancelEditPPT = document.getElementById('cancelEditPPT');

        if (editModePPT) {
            editModePPT.addEventListener('click', () => {
                this.pptHandler.enterEditMode();
                document.getElementById('editModePPT').style.display = 'none';
                document.getElementById('batchActionsPPT').style.display = 'flex';
            });
        }

        if (cancelEditPPT) {
            cancelEditPPT.addEventListener('click', () => {
                this.pptHandler.exitEditMode();
                document.getElementById('editModePPT').style.display = 'inline-block';
                document.getElementById('batchActionsPPT').style.display = 'none';
            });
        }

        // PPT批量操作
        const selectAllPPTs = document.getElementById('selectAllPPTs');
        const deselectAllPPTs = document.getElementById('deselectAllPPTs');
        const batchDeletePPTs = document.getElementById('batchDeletePPTs');
        const clearAllPPTs = document.getElementById('clearAllPPTs');

        if (selectAllPPTs) {
            selectAllPPTs.addEventListener('click', () => {
                this.pptHandler.selectAllFiles();
            });
        }

        if (deselectAllPPTs) {
            deselectAllPPTs.addEventListener('click', () => {
                this.pptHandler.deselectAllFiles();
            });
        }

        if (batchDeletePPTs) {
            batchDeletePPTs.addEventListener('click', () => {
                this.pptHandler.batchDeleteSelected();
            });
        }

        if (clearAllPPTs) {
            clearAllPPTs.addEventListener('click', () => {
                this.pptHandler.clearAllFiles();
            });
        }

        // 调试信息按钮
        const debugInfo = document.getElementById('debugInfo');
        if (debugInfo) {
            debugInfo.addEventListener('click', () => {
                this.showDebugInfo();
            });
        }

        // 拖拽上传支持
        this.setupDragAndDrop();

        // --- 新增：模态框事件绑定 ---
        const modal = document.getElementById('modal');
        modal.querySelector('#saveMistake').addEventListener('click', () => this.mistakeHandler.saveMistake());
        modal.querySelector('#closeModal').addEventListener('click', () => this.ui.toggleModal('modal', false));
        modal.querySelector('#cancelEdit').addEventListener('click', () => this.ui.toggleModal('modal', false));

    }

    // 绑定标签筛选事件
    bindTagFilters() {
        const tagFilter = document.getElementById('tagFilter');
        if (tagFilter) {
            tagFilter.addEventListener('click', (e) => {
                if (e.target.classList.contains('tag-item')) {
                    const tagText = e.target.textContent.trim();
                    this.handleTagClick(tagText, e.target);
                }
            });
        }
    }

    // 处理标签点击
    handleTagClick(tagText, tagElement) {
        console.log('标签点击:', tagText); // 调试信息
        
        // 移除所有标签的激活状态
        const allTags = document.querySelectorAll('#tagFilter .tag-item');
        allTags.forEach(tag => tag.classList.remove('active'));
        
        // 激活当前点击的标签
        tagElement.classList.add('active');
        
        // 如果点击的是"全部"，清除所有筛选
        if (tagText === '全部') {
            console.log('显示全部错题'); // 调试信息
            this.mistakeHandler.applyFilters({ tags: new Set() });
        } else {
            // 否则按照选中的标签进行筛选
            console.log('按标签筛选:', tagText); // 调试信息
            this.mistakeHandler.applyFilters({ tags: new Set([tagText]) });
        }
    }

    // 绑定批量操作事件
    bindBatchOperations() {
        const editModeBtn = document.getElementById('editMode');
        const batchActions = document.getElementById('batchActions');
        const selectAllBtn = document.getElementById('selectAll');
        const deselectAllBtn = document.getElementById('deselectAll');
        const batchDeleteBtn = document.getElementById('batchDelete');
        const cancelEditBtn = document.getElementById('cancelEdit');

        let isEditMode = false;

        // 编辑按钮点击事件
        if (editModeBtn) {
            editModeBtn.addEventListener('click', () => {
                this.toggleEditMode(true);
            });
        }

        // 取消编辑按钮点击事件
        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', () => {
                this.toggleEditMode(false);
            });
        }

        // 全选按钮
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                this.mistakeHandler.selectAllMistakes();
            });
        }

        // 取消全选按钮
        if (deselectAllBtn) {
            deselectAllBtn.addEventListener('click', () => {
                this.mistakeHandler.deselectAllMistakes();
            });
        }

        // 批量删除按钮
        if (batchDeleteBtn) {
            batchDeleteBtn.addEventListener('click', () => {
                this.mistakeHandler.batchDeleteSelected();
            });
        }
    }

    // 切换编辑模式
    toggleEditMode(isEditMode) {
        const editModeBtn = document.getElementById('editMode');
        const batchActions = document.getElementById('batchActions');

        if (isEditMode) {
            editModeBtn.style.display = 'none';
            batchActions.style.display = 'flex';
            this.mistakeHandler.enterEditMode();
        } else {
            editModeBtn.style.display = 'block';
            batchActions.style.display = 'none';
            this.mistakeHandler.exitEditMode();
        }
    }

    // 绑定分页事件
    bindPaginationEvents() {
        const prevPageBtn = document.getElementById('prevPage');
        const nextPageBtn = document.getElementById('nextPage');

        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => {
                this.mistakeHandler.goToPage(this.mistakeHandler.currentPage - 1);
            });
        }

        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => {
                this.mistakeHandler.goToPage(this.mistakeHandler.currentPage + 1);
            });
        }
    }

    switchMode(mode) {
        this.currentMode = mode;
        
        // 更新导航按钮状态
        document.getElementById('mistakeModeBtn').classList.toggle('active', mode === 'mistake');
        document.getElementById('pptModeBtn').classList.toggle('active', mode === 'ppt');
        
        // 更新内容区域显示
        document.getElementById('mistakeModeContent').classList.toggle('active', mode === 'mistake');
        document.getElementById('pptModeContent').classList.toggle('active', mode === 'ppt');
        
        // 更新侧边栏显示
        document.getElementById('mistakeModeSidebar').classList.toggle('active', mode === 'mistake');
        document.getElementById('pptModeSidebar').classList.toggle('active', mode === 'ppt');
        
        // 如果切换到PPT模式且还未初始化，则重新加载
        if (mode === 'ppt' && this.pptHandler.allPptFiles.length === 0) {
            this.pptHandler.init();
        }
        
        console.log(`切换到${mode === 'mistake' ? '错题' : 'PPT'}管理模式`);
    }

    /**
     * 设置拖拽上传功能
     */
    setupDragAndDrop() {
        const pptModeContent = document.getElementById('pptModeContent');
        if (!pptModeContent) return;

        // 防止默认拖拽行为
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            pptModeContent.addEventListener(eventName, this.preventDefaults, false);
        });

        // 拖拽进入和悬停效果
        ['dragenter', 'dragover'].forEach(eventName => {
            pptModeContent.addEventListener(eventName, () => {
                pptModeContent.classList.add('drag-over');
            }, false);
        });

        // 拖拽离开效果
        ['dragleave', 'drop'].forEach(eventName => {
            pptModeContent.addEventListener(eventName, () => {
                pptModeContent.classList.remove('drag-over');
            }, false);
        });

        // 处理文件放置
        pptModeContent.addEventListener('drop', (e) => {
            const files = Array.from(e.dataTransfer.files);
            const allowedTypes = ['ppt', 'pptx', 'doc', 'docx', 'pdf'];
            
            const validFiles = files.filter(file => {
                const ext = file.name.split('.').pop().toLowerCase();
                return allowedTypes.includes(ext);
            });

            if (validFiles.length > 0) {
                this.pptHandler.uploadFiles(validFiles);
            } else {
                alert('请拖拽有效的文件格式 (PPT, PPTX, DOC, DOCX, PDF)');
            }
        }, false);
    }

    /**
     * 防止默认拖拽行为
     */
    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    /**
     * 显示调试信息
     */
    showDebugInfo() {
        const info = {
            '当前模式': this.currentMode,
            'PPT文件数量': this.pptHandler.allPptFiles.length,
            '已选择文件': this.pptHandler.selectedFiles.size,
            '缓存缩略图': this.pptHandler.thumbnailCache.size,
            '错题数量': this.mistakeHandler.allMistakes?.length || 0,
            '浏览器支持': {
                'File API': !!(window.File && window.FileReader && window.FileList && window.Blob),
                'Drag & Drop': 'draggable' in document.createElement('div'),
                'FormData': !!window.FormData
            }
        };
        
        console.log('调试信息:', info);
        alert(`调试信息已输出到控制台\n\n当前模式: ${this.currentMode}\nPPT文件: ${this.pptHandler.allPptFiles.length}\n选中文件: ${this.pptHandler.selectedFiles.size}`);
    }
}

// 启动页面
document.addEventListener('DOMContentLoaded', () => {
    const pageManager = new PageManager();
    
    // 将实例暴露到全局以便调试
    window.pageManager = pageManager;
    window.pptHandler = pageManager.pptHandler;
    window.mistakeHandler = pageManager.mistakeHandler;
    window.uiManager = pageManager.ui;
    
    console.log('PPT预览功能已启用 - 调试命令:');
    console.log('- pageManager: 主页面管理器');
    console.log('- pptHandler: PPT处理器');  
    console.log('- uiManager: UI管理器');
    console.log('- 示例: await pptHandler.previewPPT(1) // 预览ID为1的PPT');
});