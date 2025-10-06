// js/mistake_manager/main.js

import { UIManager } from './UIManager.js';
import { MistakeHandler } from './MistakeHandler.js';
import { PPTHandler } from './PPTHandler.js';
import { EditManager } from './EditManager.js';

// 获取后端URL函数
function getBackendUrl() {
    return 'http://localhost:5000';
}

// 将函数添加到全局作用域，供其他模块使用
window.getBackendUrl = getBackendUrl;

class PageManager {
    constructor() {
        this.ui = new UIManager();
        this.mistakeHandler = new MistakeHandler(this.ui);
        this.pptHandler = new PPTHandler(this.ui);
        this.editManager = new EditManager();
        
        // 将EditManager暴露到全局，供其他模块使用
        window.editManager = this.editManager;
        
        this.currentMode = 'mistake'; // 默认是错题模式

        // 等待DOM加载完成后再绑定事件和初始化
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.bindEvents();
                this.init();
            });
        } else {
            this.bindEvents();
            this.init();
        }
    }

    async init() {
        console.log('=== PageManager 初始化开始 ===');
        
        try {
            await this.mistakeHandler.init();
            console.log('错题处理器初始化完成');
            
            await this.pptHandler.init();
            console.log('PPT处理器初始化完成');
            
            console.log('编辑管理器初始化完成');
            
            await this.loadAllTags();
            console.log('标签加载完成');
            
            // 初始化标签筛选功能
            this.ui.initTagFilters();
            
            // 注意：PPT上传事件现在由 simple_upload.js 处理
            console.log('PPT上传功能由独立模块处理');
            
        } catch (error) {
            console.error('初始化失败:', error);
        }
        
        console.log('=== PageManager 初始化完成 ===');
    }

    bindEvents() {
        console.log('开始绑定事件...');
        
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
        
        // --- 标签筛选事件 ---
        this.bindTagFilters();
        
        // --- 分页事件 ---
        this.bindPaginationEvents();
        
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
        console.log('PPT编辑模式按钮:', { editModePPT, cancelEditPPT });

        if (editModePPT) {
            console.log('绑定PPT编辑模式事件');
            editModePPT.addEventListener('click', () => {
                console.log('进入PPT编辑模式');
                this.pptHandler.enterEditMode();
                document.getElementById('editModePPT').style.display = 'none';
                document.getElementById('batchActionsPPT').style.display = 'flex';
            });
        } else {
            console.error('未找到PPT编辑模式按钮');
        }

        if (cancelEditPPT) {
            console.log('绑定退出PPT编辑模式事件');
            cancelEditPPT.addEventListener('click', () => {
                console.log('退出PPT编辑模式');
                this.pptHandler.exitEditMode();
                document.getElementById('editModePPT').style.display = 'inline-block';
                document.getElementById('batchActionsPPT').style.display = 'none';
            });
        } else {
            console.error('未找到退出PPT编辑模式按钮');
        }

        // PPT批量操作
        const selectAllPPTs = document.getElementById('selectAllPPTs');
        const deselectAllPPTs = document.getElementById('deselectAllPPTs');
        const batchDeletePPTs = document.getElementById('batchDeletePPTs');
        const clearAllPPTs = document.getElementById('clearAllPPTs');
        console.log('PPT批量操作按钮:', { selectAllPPTs, deselectAllPPTs, batchDeletePPTs, clearAllPPTs });

        if (selectAllPPTs) {
            console.log('绑定全选PPT事件');
            selectAllPPTs.addEventListener('click', () => {
                console.log('PPT全选事件触发');
                this.pptHandler.selectAllFiles();
            });
        } else {
            console.error('未找到全选PPT按钮');
        }

        if (deselectAllPPTs) {
            console.log('绑定取消全选PPT事件');
            deselectAllPPTs.addEventListener('click', () => {
                console.log('PPT取消全选事件触发');
                this.pptHandler.deselectAllFiles();
            });
        } else {
            console.error('未找到取消全选PPT按钮');
        }

        if (batchDeletePPTs) {
            console.log('绑定批量删除PPT事件');
            batchDeletePPTs.addEventListener('click', () => {
                console.log('PPT批量删除事件触发');
                this.pptHandler.batchDeleteSelected();
            });
        } else {
            console.error('未找到批量删除PPT按钮');
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

        // --- 添加标签按钮事件绑定 ---
        const addTagBtn = document.getElementById('addTag');
        if (addTagBtn) {
            addTagBtn.addEventListener('click', () => this.openTagModal());
        }

        // --- 标签模态框事件绑定 ---
        const tagModal = document.getElementById('tagModal');
        if (tagModal) {
            tagModal.querySelector('#closeTagModal').addEventListener('click', () => this.ui.toggleModal('tagModal', false));
            tagModal.querySelector('#cancelTagEdit').addEventListener('click', () => this.ui.toggleModal('tagModal', false));
            tagModal.querySelector('#addNewTag').addEventListener('click', () => this.addNewTag());
            tagModal.querySelector('#deleteSelectedTags').addEventListener('click', () => this.deleteSelectedTags());
            
            // 标签类别切换
            tagModal.querySelectorAll('.category-tab').forEach(tab => {
                tab.addEventListener('click', () => this.switchTagCategory(tab.dataset.category));
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
        const uploadArea = document.getElementById('uploadArea');
        
        if (!pptModeContent) {
            console.error('未找到PPT模式内容区域');
            return;
        }

        console.log('设置拖拽上传功能...');

        // 防止默认拖拽行为
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            [pptModeContent, uploadArea].forEach(element => {
                if (element) {
                    element.addEventListener(eventName, this.preventDefaults, false);
                }
            });
        });

        // 拖拽进入和悬停效果
        ['dragenter', 'dragover'].forEach(eventName => {
            [pptModeContent, uploadArea].forEach(element => {
                if (element) {
                    element.addEventListener(eventName, () => {
                        console.log(`拖拽${eventName}事件触发`);
                        pptModeContent.classList.add('drag-over');
                        if (uploadArea) uploadArea.classList.add('drag-over');
                    }, false);
                }
            });
        });

        // 拖拽离开效果
        ['dragleave', 'drop'].forEach(eventName => {
            [pptModeContent, uploadArea].forEach(element => {
                if (element) {
                    element.addEventListener(eventName, () => {
                        console.log(`拖拽${eventName}事件触发`);
                        pptModeContent.classList.remove('drag-over');
                        if (uploadArea) uploadArea.classList.remove('drag-over');
                    }, false);
                }
            });
        });

        // 处理文件放置
        const handleDrop = (e) => {
            console.log('=== 拖拽文件放置事件触发 ===');
            console.log('拖拽的文件:', e.dataTransfer.files);
            
            const files = Array.from(e.dataTransfer.files);
            const allowedTypes = ['ppt', 'pptx', 'doc', 'docx', 'pdf'];
            
            const validFiles = files.filter(file => {
                const ext = file.name.split('.').pop().toLowerCase();
                const isValid = allowedTypes.includes(ext);
                console.log(`文件 ${file.name} (${ext}): ${isValid ? '有效' : '无效'}`);
                return isValid;
            });

            console.log(`有效文件数量: ${validFiles.length}/${files.length}`);

            if (validFiles.length > 0) {
                console.log('拖拽上传功能暂时禁用，请使用文件选择按钮');
            } else {
                console.log('没有有效文件');
            }
        };

        pptModeContent.addEventListener('drop', handleDrop, false);
        if (uploadArea) {
            uploadArea.addEventListener('drop', handleDrop, false);
        }

        // 添加拖拽样式
        this.addDragDropStyles();
    }

    /**
     * 防止默认拖拽行为
     */
    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    /**
     * 添加拖拽相关样式
     */
    addDragDropStyles() {
        if (document.getElementById('drag-drop-styles')) return;

        const style = document.createElement('style');
        style.id = 'drag-drop-styles';
        style.textContent = `
            .drag-over {
                background-color: rgba(0, 123, 255, 0.1) !important;
                border: 2px dashed #007bff !important;
                border-radius: 8px !important;
            }
            
            #uploadArea.drag-over {
                background-color: rgba(0, 123, 255, 0.2) !important;
                transform: scale(1.02);
                box-shadow: 0 4px 20px rgba(0, 123, 255, 0.3);
            }
            
            #uploadArea {
                transition: all 0.3s ease;
                border: 2px dashed #ddd;
                border-radius: 8px;
                padding: 20px;
                text-align: center;
                cursor: pointer;
            }
            
            #uploadArea:hover {
                border-color: #007bff;
                background-color: rgba(0, 123, 255, 0.05);
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 打开标签管理模态框
     */
    openTagModal() {
        this.currentTagCategory = 'course'; // 默认选择课程标签
        this.ui.toggleModal('tagModal', true);
        this.loadAllTags();
        this.switchTagCategory('course');
    }

    /**
     * 切换标签类别
     */
    switchTagCategory(category) {
        this.currentTagCategory = category;
        
        // 更新标签页状态
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.category === category);
        });
        
        // 更新标签区域显示
        document.querySelectorAll('.tag-category-section').forEach(section => {
            section.classList.toggle('active', section.id === `${category}Tags`);
        });
    }

    /**
     * 加载所有标签
     */
    async loadAllTags() {
        try {
            const response = await fetch('http://localhost:5000/api/tags/categories');
            const result = await response.json();
            
            if (result.success) {
                const { course, knowledge, difficulty } = result.data;
                
                // 初始化标签数据结构
                this.tagCategories = {
                    course: new Set(course.map(tag => tag.name)),
                    knowledge: new Set(knowledge.map(tag => tag.name)),
                    difficulty: new Set(difficulty.map(tag => tag.name))
                };
                
                // 设置为全局变量，供UIManager使用
                window.tagCategories = this.tagCategories;
                
                // 渲染所有类别的标签
                this.renderTagCategory('course');
                this.renderTagCategory('knowledge');
                this.renderTagCategory('difficulty');
            }
        } catch (error) {
            console.error('加载标签失败:', error);
            // 如果API失败，使用默认标签
            this.addDefaultTags();
            this.renderTagCategory('course');
            this.renderTagCategory('knowledge');
            this.renderTagCategory('difficulty');
        }
    }

    /**
     * 添加默认标签
     */
    addDefaultTags() {
        // 默认课程标签
        const defaultCourseTags = ['数据类型及表达式', '复合数据类型', '面向对象', '函数', '流程控制', '文件概述', '异常处理'];
        defaultCourseTags.forEach(tag => this.tagCategories.course.add(tag));

        // 默认知识点标签
        const defaultKnowledgeTags = ['变量', '循环', '条件语句', '列表', '字典', '字符串', '文件操作', '类', '继承'];
        defaultKnowledgeTags.forEach(tag => this.tagCategories.knowledge.add(tag));

        // 默认难度标签
        const defaultDifficultyTags = ['简单', '中等', '困难', '基础', '进阶', '高级'];
        defaultDifficultyTags.forEach(tag => this.tagCategories.difficulty.add(tag));
        
        // 设置为全局变量，供UIManager使用
        window.tagCategories = this.tagCategories;
    }

    /**
     * 根据标签内容判断类别
     */
    categorizeTag(tag) {
        const courseKeywords = ['数据类型', '复合数据类型', '面向对象', '函数', '流程控制', '文件概述', '异常处理'];
        const difficultyKeywords = ['简单', '中等', '困难', '基础', '进阶', '高级'];
        
        if (courseKeywords.some(keyword => tag.includes(keyword))) {
            return 'course';
        } else if (difficultyKeywords.some(keyword => tag.includes(keyword))) {
            return 'difficulty';
        } else {
            return 'knowledge';
        }
    }

    /**
     * 渲染指定类别的标签
     */
    renderTagCategory(category) {
        const container = document.getElementById(`${category}TagsList`);
        if (!container) return;

        container.innerHTML = '';
        
        if (this.tagCategories[category].size === 0) {
            container.innerHTML = '<div style="text-align: center; color: #666; padding: 20px; grid-column: 1/-1;">暂无标签</div>';
            return;
        }

        Array.from(this.tagCategories[category]).forEach(tag => {
            const tagItem = document.createElement('div');
            tagItem.className = 'tag-item';
            tagItem.textContent = tag;
            tagItem.dataset.category = category;
            tagItem.dataset.tagName = tag;
            
            tagItem.addEventListener('click', () => {
                tagItem.classList.toggle('selected');
            });
            
            container.appendChild(tagItem);
        });
    }

    /**
     * 添加新标签
     */
    async addNewTag() {
        const newTagNameInput = document.getElementById('newTagName');
        const newTagName = newTagNameInput.value.trim();
        
        if (!newTagName) {
            alert('请输入标签名称');
            return;
        }

        // 检查标签是否已存在
        const allExistingTags = new Set([
            ...this.tagCategories.course,
            ...this.tagCategories.knowledge,
            ...this.tagCategories.difficulty
        ]);
        
        if (allExistingTags.has(newTagName)) {
            alert('标签已存在');
            return;
        }

        try {
            // 调用API添加标签
            const response = await fetch('http://localhost:5000/api/tags', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: newTagName,
                    category: this.currentTagCategory
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                // 添加到当前类别
                this.tagCategories[this.currentTagCategory].add(newTagName);
                
                // 重新渲染当前类别的标签
                this.renderTagCategory(this.currentTagCategory);
                
                // 清空输入框
                newTagNameInput.value = '';
                
                alert(`标签 "${newTagName}" 已添加到${this.getCategoryDisplayName(this.currentTagCategory)}`);
            } else {
                alert('添加标签失败: ' + result.error);
            }
        } catch (error) {
            console.error('添加标签失败:', error);
            alert('添加标签失败: ' + error.message);
        }
    }

    /**
     * 获取类别显示名称
     */
    getCategoryDisplayName(category) {
        const names = {
            course: '课程标签',
            knowledge: '知识点标签',
            difficulty: '难度标签'
        };
        return names[category] || category;
    }

    /**
     * 删除选中的标签
     */
    async deleteSelectedTags() {
        const selectedTags = document.querySelectorAll('.tag-item.selected');
        
        if (selectedTags.length === 0) {
            alert('请先选择要删除的标签');
            return;
        }

        const tagNames = Array.from(selectedTags).map(item => item.textContent);
        const confirmMessage = `确定要删除以下标签吗？\n${tagNames.join('\n')}\n\n注意：这将从所有使用这些标签的错题中移除该标签。`;
        
        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            // 获取所有标签信息以获取ID
            const response = await fetch('http://localhost:5000/api/tags');
            const result = await response.json();
            
            if (result.success) {
                const allTags = result.data;
                const tagNameToId = {};
                allTags.forEach(tag => {
                    tagNameToId[tag.name] = tag.id;
                });
                
                // 删除选中的标签
                const deletePromises = tagNames.map(tagName => {
                    const tagId = tagNameToId[tagName];
                    if (tagId) {
                        return fetch(`http://localhost:5000/api/tags/${tagId}`, {
                            method: 'DELETE'
                        });
                    }
                    return Promise.resolve();
                });
                
                await Promise.all(deletePromises);
                
                // 从标签分类中移除
                tagNames.forEach(tagName => {
                    Object.keys(this.tagCategories).forEach(category => {
                        this.tagCategories[category].delete(tagName);
                    });
                });
                
                // 重新渲染所有类别的标签
                this.renderTagCategory('course');
                this.renderTagCategory('knowledge');
                this.renderTagCategory('difficulty');
                
                // 重新渲染错题列表
                this.mistakeHandler.filterAndRender();
                
                alert(`已删除 ${tagNames.length} 个标签`);
            }
        } catch (error) {
            console.error('删除标签失败:', error);
            alert('删除标签失败: ' + error.message);
        }
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
    
    // 将实例暴露到全局以便调试和模块间通信
    window.pageManager = pageManager;
    window.pptHandler = pageManager.pptHandler;
    window.mistakeHandler = pageManager.mistakeHandler;
    window.uiManager = pageManager.ui;
    window.editManager = pageManager.editManager;
    
    console.log('所有管理器初始化完成');
    console.log('- pageManager: 主页面管理器');
    console.log('- pptHandler: PPT处理器');  
    console.log('- uiManager: UI管理器');
    console.log('- editManager: 编辑管理器');
});