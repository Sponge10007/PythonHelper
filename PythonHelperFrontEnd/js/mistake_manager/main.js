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
        await this.loadAllTags();
        // 初始化标签筛选功能
        this.ui.initTagFilters();
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

        // PPT批量操作
        const selectAllPPTs = document.getElementById('selectAllPPTs');
        const deselectAllPPTs = document.getElementById('deselectAllPPTs');
        const batchDeletePPTs = document.getElementById('batchDeletePPTs');
        const clearAllPPTs = document.getElementById('clearAllPPTs');

        if (selectAllPPTs) {
            selectAllPPTs.addEventListener('click', () => {
                this.pptHandler.toggleSelectAll();
            });
        }

        if (deselectAllPPTs) {
            deselectAllPPTs.addEventListener('click', () => {
                this.pptHandler.selectedFiles.clear();
                this.pptHandler.renderSelectedActions();
                this.ui.updateAllFilesSelection([]);
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