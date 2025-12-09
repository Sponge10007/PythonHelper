// js/mistake_manager/EditManager_simple.js

import * as api from '../common/api.js';

/**
 * 简化的编辑管理器 - 完全独立工作
 */
export class EditManager {
    constructor() {
        this.isEditMode = false;
        this.currentType = null; // 'mistake' 或 'ppt'
        this.selectedItems = new Set();
        
        this.initElements();
        this.bindEvents();
    }
    
    /**
     * 初始化所有必要的DOM元素引用
     */
    initElements() {
        this.elements = {
            mistake: {
                editBtn: document.getElementById('editMode'),
                batchActions: document.getElementById('batchActions'),
                selectAllBtn: document.getElementById('selectAll'),
                deselectAllBtn: document.getElementById('deselectAll'),
                batchDeleteBtn: document.getElementById('batchDelete'),
                cancelBtn: document.getElementById('cancelEdit')
            },
            ppt: {
                editBtn: document.getElementById('editModePPT'),
                batchActions: document.getElementById('batchActionsPPT'),
                selectAllBtn: document.getElementById('selectAllPPTs'),
                deselectAllBtn: document.getElementById('deselectAllPPTs'),
                batchDeleteBtn: document.getElementById('batchDeletePPTs'),
                cancelBtn: document.getElementById('cancelEditPPT')
            }
        };
    }
    
    /**
     * 绑定所有事件
     */
    bindEvents() {
        Object.keys(this.elements).forEach(type => {
            this.bindTypeEvents(type);
        });
    }
    
    /**
     * 绑定特定类型的事件
     */
    bindTypeEvents(type) {
        const elements = this.elements[type];
        
        if (elements.editBtn) {
            elements.editBtn.addEventListener('click', () => {
                console.log(`${type} 编辑按钮被点击`);
                this.enterEditMode(type);
            });
        }
        
        if (elements.cancelBtn) {
            elements.cancelBtn.addEventListener('click', () => {
                console.log(`${type} 取消编辑按钮被点击`);
                this.exitEditMode(type);
            });
        }
        
        if (elements.selectAllBtn) {
            elements.selectAllBtn.addEventListener('click', () => {
                console.log(`${type} 全选按钮被点击`);
                this.selectAll(type);
            });
        }
        
        if (elements.deselectAllBtn) {
            elements.deselectAllBtn.addEventListener('click', () => {
                console.log(`${type} 取消全选按钮被点击`);
                this.deselectAll(type);
            });
        }
        
        if (elements.batchDeleteBtn) {
            elements.batchDeleteBtn.addEventListener('click', () => {
                console.log(`${type} 批量删除按钮被点击`);
                this.batchDelete(type);
            });
        }
    }
    
    /**
     * 进入编辑模式
     */
    enterEditMode(type) {
        console.log(`EditManager: 进入 ${type} 编辑模式`);
        
        this.isEditMode = true;
        this.currentType = type;
        this.selectedItems.clear();
        
        const elements = this.elements[type];
        if (elements.editBtn) elements.editBtn.style.display = 'none';
        if (elements.batchActions) elements.batchActions.style.display = 'flex';
        
        // 给容器添加 edit-mode 类，显示复选框
        const container = type === 'mistake' ? document.getElementById('mistakeList') : document.getElementById('pptGrid');
        if (container) {
            container.classList.add('edit-mode');
        }
        
        this.updateBatchDeleteButton();
        this.bindCheckboxEvents(type);
    }
    
    /**
     * 退出编辑模式
     */
    exitEditMode(type) {
        console.log(`EditManager: 退出 ${type} 编辑模式`);
        
        this.isEditMode = false;
        this.currentType = null;
        this.selectedItems.clear();
        
        const elements = this.elements[type];
        if (elements.editBtn) elements.editBtn.style.display = 'inline-block';
        if (elements.batchActions) elements.batchActions.style.display = 'none';
        
        // 移除 edit-mode 类，隐藏复选框
        const container = type === 'mistake' ? document.getElementById('mistakeList') : document.getElementById('pptGrid');
        if (container) {
            container.classList.remove('edit-mode');
        }
        
        this.clearAllSelections(type);
    }
    
    /**
     * 同步选中状态到Handler
     */
    _syncToHandler(type) {
        if (type === 'ppt' && window.pptHandler) {
            // 同步Set
            window.pptHandler.selectedFiles = new Set(this.selectedItems);
            // 更新统计信息
            window.pptHandler.updateStatistics();
        } else if (type === 'mistake' && window.mistakeHandler) {
             window.mistakeHandler.selectedMistakes = new Set(this.selectedItems);
             // 错题管理器可能也需要更新UI，如果有相关统计的话
             if (window.mistakeHandler.updateSelectionUI) {
                 // 注意：updateSelectionUI可能会尝试更新checkbox，这可能会有冲突，
                 // 但我们主要目的是同步状态。
                 // 实际上，MistakeHandler没有显式的updateStatistics方法用于选中计数，
                 // 但保持状态同步是个好习惯。
             }
        }
    }

    /**
     * 全选
     */
    selectAll(type) {
        console.log(`全选 ${type}，开始查找复选框`);
        const selector = type === 'mistake' 
            ? 'input.mistake-checkbox[data-mistake-id]' 
            : 'input.ppt-checkbox[data-ppt-id]';
        const checkboxes = document.querySelectorAll(selector);
        console.log(`找到 ${checkboxes.length} 个复选框`);
        
        checkboxes.forEach(checkbox => {
            const itemId = checkbox.getAttribute(`data-${type === 'mistake' ? 'mistake' : 'ppt'}-id`);
            checkbox.checked = true;
            this.selectedItems.add(itemId);
            
            // 添加选中状态的视觉效果（给卡片添加 selected 类）
            const card = checkbox.closest(type === 'mistake' ? '.mistake-item' : '.ppt-card');
            if (card) {
                card.classList.add('selected');
            }
        });
        this.updateBatchDeleteButton();
        this._syncToHandler(type);
    }
    
    /**
     * 取消全选
     */
    deselectAll(type) {
        console.log(`取消全选 ${type}`);
        const selector = type === 'mistake' 
            ? 'input.mistake-checkbox[data-mistake-id]' 
            : 'input.ppt-checkbox[data-ppt-id]';
        const checkboxes = document.querySelectorAll(selector);
        
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
            
            // 移除选中状态的视觉效果（移除卡片的 selected 类）
            const card = checkbox.closest(type === 'mistake' ? '.mistake-item' : '.ppt-card');
            if (card) {
                card.classList.remove('selected');
            }
        });
        
        this.selectedItems.clear();
        this.updateBatchDeleteButton();
        this._syncToHandler(type);
    }
    
    /**
     * 批量删除选中项
     */
    async batchDelete(type) {
        if (this.selectedItems.size === 0) {
            alert(`请先选择要删除的${type === 'mistake' ? '错题' : 'PPT文件'}`);
            return;
        }
        
        const count = this.selectedItems.size;
        const confirmMessage = `确定要删除选中的 ${count} 个${type === 'mistake' ? '错题' : 'PPT文件'}吗？\n\n此操作不可撤销！`;
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        console.log(`执行 ${type} 批量删除，删除项目:`, Array.from(this.selectedItems));
        
        try {
            if (type === 'ppt') {
                console.log('调用api.batchDeletePPTFiles');
                await api.batchDeletePPTFiles(Array.from(this.selectedItems));
            } else if (type === 'mistake') {
                console.log('错题逐个删除');
                // 错题没有批量删除API，逐个删除
                const deletePromises = Array.from(this.selectedItems).map(id => 
                    api.deleteMistake(id)
                );
                await Promise.all(deletePromises);
            }
            
            console.log(`${type} 批量删除成功`);
            
            // 清空选中状态
            this.selectedItems.clear();
            this.updateBatchDeleteButton();
            this._syncToHandler(type);
            
            // 刷新页面重新加载数据
            // window.location.reload();
            
            if (type === 'ppt' && window.pptHandler) {
                await window.pptHandler.init();
            } else if (type === 'mistake' && window.mistakeHandler) {
                await window.mistakeHandler.init();
            } else {
                window.location.reload();
            }

            // 保持编辑模式，重新绑定事件
            this.enterEditMode(type);
            
        } catch (error) {
            console.error(`${type} 批量删除失败:`, error);
            alert(`批量删除失败: ${error.message}`);
        }
    }
    
    /**
     * 处理单个项目的选中状态变化
     */
    toggleItemSelection(type, itemId, isSelected, checkbox) {
        console.log(`${type} ${itemId} 选中状态变化: ${isSelected}`);
        
        if (isSelected) {
            this.selectedItems.add(itemId);
        } else {
            this.selectedItems.delete(itemId);
        }
        
        // 切换卡片的 selected 类
        if (checkbox) {
            const card = checkbox.closest(type === 'mistake' ? '.mistake-item' : '.ppt-card');
            if (card) {
                if (isSelected) {
                    card.classList.add('selected');
                } else {
                    card.classList.remove('selected');
                }
            }
        }
        
        this.updateBatchDeleteButton();
        this._syncToHandler(type);
    }
    
    /**
     * 更新选中项（供外部调用，如PPTHandler）
     */
    updateSelectedItems(items) {
        this.selectedItems = new Set(items);
        this.updateBatchDeleteButton();
    }

    /**
     * 更新批量删除按钮状态
     */
    updateBatchDeleteButton() {
        const hasSelected = this.selectedItems.size > 0;
        
        Object.keys(this.elements).forEach(type => {
            const batchDeleteBtn = this.elements[type].batchDeleteBtn;
            if (batchDeleteBtn) {
                batchDeleteBtn.disabled = !hasSelected;
                batchDeleteBtn.textContent = hasSelected 
                    ? `删除选中 (${this.selectedItems.size})` 
                    : '批量删除';
            }
        });
    }
    
    /**
     * 绑定复选框事件
     */
    bindCheckboxEvents(type) {
        const selector = type === 'mistake' 
            ? 'input.mistake-checkbox[data-mistake-id]' 
            : 'input.ppt-checkbox[data-ppt-id]';
        const checkboxes = document.querySelectorAll(selector);
        console.log(`绑定 ${type} 复选框事件，找到 ${checkboxes.length} 个复选框`);
        
        checkboxes.forEach(checkbox => {
            // 移除旧的事件监听器（如果有）
            const newCheckbox = checkbox.cloneNode(true);
            checkbox.parentNode.replaceChild(newCheckbox, checkbox);
            
            // 添加新的事件监听器
            newCheckbox.addEventListener('change', (e) => {
                const itemId = e.target.getAttribute(`data-${type === 'mistake' ? 'mistake' : 'ppt'}-id`);
                this.toggleItemSelection(type, itemId, e.target.checked, e.target);
            });
        });
    }
    
    /**
     * 清除所有选择状态
     */
    clearAllSelections(type) {
        const selector = type === 'mistake' 
            ? 'input.mistake-checkbox[data-mistake-id]' 
            : 'input.ppt-checkbox[data-ppt-id]';
        const checkboxes = document.querySelectorAll(selector);
        
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
            
            // 移除卡片的 selected 类
            const card = checkbox.closest(type === 'mistake' ? '.mistake-item' : '.ppt-card');
            if (card) {
                card.classList.remove('selected');
            }
        });
    }
    
    /**
     * 获取当前状态
     */
    getState() {
        return {
            isEditMode: this.isEditMode,
            currentType: this.currentType,
            selectedCount: this.selectedItems.size
        };
    }
}