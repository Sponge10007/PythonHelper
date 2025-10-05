// js/mistake_manager/EditManager.js

/**
 * 编辑管理器 - 彻底重写编辑功能
 * 目标：简单、直接、可靠的编辑逻辑
 */
export class EditManager {
    constructor() {
        this.isEditMode = false;
        this.currentType = null; // 'mistake' 或 'ppt'
        this.selectedItems = new Set();
        
        this.handlers = {
            mistake: null,
            ppt: null
        };
        
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
                cancelBtn: document.getElementById('cancelEdit'),
                container: document.getElementById('mistakeList')
            },
            ppt: {
                editBtn: document.getElementById('editModePPT'),
                batchActions: document.getElementById('batchActionsPPT'),
                selectAllBtn: document.getElementById('selectAllPPTs'),
                deselectAllBtn: document.getElementById('deselectAllPPTs'),
                batchDeleteBtn: document.getElementById('batchDeletePPTs'),
                cancelBtn: document.getElementById('cancelEditPPT'),
                container: document.querySelector('.ppt-grid')
            }
        };
        
        console.log('EditManager: 元素初始化完成', this.elements);
    }
    
    /**
     * 绑定所有事件
     */
    bindEvents() {
        // 绑定错题管理事件
        this.bindTypeEvents('mistake');
        
        // 绑定PPT管理事件
        this.bindTypeEvents('ppt');
        
        console.log('EditManager: 事件绑定完成');
    }
    
    /**
     * 绑定指定类型的所有事件
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
                console.log(`${type} 取消按钮被点击`);
                this.exitEditMode();
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
     * 注册处理器
     */
    registerHandler(type, handler) {
        this.handlers[type] = handler;
        console.log(`EditManager: ${type} 处理器注册完成`);
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
        
        // 切换UI显示
        if (elements.editBtn) {
            elements.editBtn.style.display = 'none';
        }
        
        if (elements.batchActions) {
            elements.batchActions.style.display = 'flex';
        }
        
        // 添加edit-mode类来显示勾选框
        if (elements.container) {
            elements.container.classList.add('edit-mode');
        }
        
        // 更新批量删除按钮状态
        this.updateBatchDeleteButton();
        
        // 绑定勾选框事件
        this.bindCheckboxEvents(type);
        
        console.log(`${type} 编辑模式已激活`);
    }
    
    /**
     * 退出编辑模式
     */
    exitEditMode() {
        if (!this.isEditMode || !this.currentType) return;
        
        console.log(`EditManager: 退出 ${this.currentType} 编辑模式`);
        
        const type = this.currentType;
        const elements = this.elements[type];
        
        // 先清除所有选中状态
        this.clearAllSelections(type);
        
        // 切换UI显示
        if (elements.editBtn) {
            elements.editBtn.style.display = 'inline-block';
        }
        
        if (elements.batchActions) {
            elements.batchActions.style.display = 'none';
        }
        
        // 移除edit-mode类来隐藏勾选框
        if (elements.container) {
            elements.container.classList.remove('edit-mode');
        }
        
        // 清理状态
        this.isEditMode = false;
        this.currentType = null;
        this.selectedItems.clear();
        
        console.log(`${type} 编辑模式已退出`);
    }
    
    /**
     * 全选当前类型的所有项目
     */
    selectAll(type) {
        console.log(`执行 ${type} 全选`);
        
        const checkboxSelector = type === 'mistake' ? '.mistake-checkbox' : '.ppt-checkbox';
        const cardSelector = type === 'mistake' ? '.mistake-item' : '.ppt-card';
        
        // 选中所有勾选框
        const checkboxes = document.querySelectorAll(checkboxSelector);
        checkboxes.forEach(checkbox => {
            const itemId = checkbox.getAttribute(`data-${type === 'mistake' ? 'mistake' : 'ppt'}-id`);
            
            // 勾选
            checkbox.checked = true;
            
            // 添加到选中集合
            this.selectedItems.add(itemId);
            
            // 高亮卡片
            const card = checkbox.closest(cardSelector);
            if (card) {
                card.classList.add('selected');
            }
            
            console.log(`${type} ${itemId} 已选中`);
        });
        
        this.updateBatchDeleteButton();
        console.log(`${type} 全选完成，共选中 ${this.selectedItems.size} 项`);
    }
    
    /**
     * 取消全选当前类型的所有项目
     */
    deselectAll(type) {
        console.log(`执行 ${type} 取消全选`);
        
        const checkboxSelector = type === 'mistake' ? '.mistake-checkbox' : '.ppt-checkbox';
        const cardSelector = type === 'mistake' ? '.mistake-item' : '.ppt-card';
        
        // 取消选中所有勾选框
        const checkboxes = document.querySelectorAll(checkboxSelector);
        checkboxes.forEach(checkbox => {
            const itemId = checkbox.getAttribute(`data-${type === 'mistake' ? 'mistake' : 'ppt'}-id`);
            
            // 取消勾选
            checkbox.checked = false;
            
            // 从选中集合移除
            this.selectedItems.delete(itemId);
            
            // 移除卡片高亮
            const card = checkbox.closest(cardSelector);
            if (card) {
                card.classList.remove('selected');
            }
            
            console.log(`${type} ${itemId} 已取消选中`);
        });
        
        this.updateBatchDeleteButton();
        console.log(`${type} 取消全选完成`);
    }
    
    /**
     * 清除所有选中状态（用于退出编辑模式）
     */
    clearAllSelections(type) {
        const checkboxSelector = type === 'mistake' ? '.mistake-checkbox' : '.ppt-checkbox';
        const cardSelector = type === 'mistake' ? '.mistake-item' : '.ppt-card';
        
        const checkboxes = document.querySelectorAll(checkboxSelector);
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
            const card = checkbox.closest(cardSelector);
            if (card) {
                card.classList.remove('selected');
            }
        });
        
        this.selectedItems.clear();
    }
    
    /**
     * 批量删除选中的项目
     */
    async batchDelete(type) {
        if (this.selectedItems.size === 0) {
            alert('请先选择要删除的项目');
            return;
        }
        
        const itemName = type === 'mistake' ? '错题' : 'PPT文件';
        const confirmMessage = `确定要删除选中的 ${this.selectedItems.size} 个${itemName}吗？此操作不可恢复！`;
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        console.log(`执行 ${type} 批量删除，删除项目:`, Array.from(this.selectedItems));
        
        try {
            // 调用对应的处理器执行删除
            if (this.handlers[type] && this.handlers[type].batchDelete) {
                await this.handlers[type].batchDelete(Array.from(this.selectedItems));
                console.log(`${type} 批量删除成功`);
                
                // 清空选中状态
                this.selectedItems.clear();
                this.updateBatchDeleteButton();
            } else {
                console.error(`${type} 处理器未注册或缺少batchDelete方法`);
            }
        } catch (error) {
            console.error(`${type} 批量删除失败:`, error);
            alert(`批量删除失败: ${error.message}`);
        }
    }
    
    /**
     * 处理单个项目的选中状态变化
     */
    toggleItemSelection(type, itemId, isSelected) {
        console.log(`${type} ${itemId} 选中状态变化: ${isSelected}`);
        
        const checkboxSelector = `[data-${type === 'mistake' ? 'mistake' : 'ppt'}-id="${itemId}"]`;
        const cardSelector = type === 'mistake' ? '.mistake-item' : '.ppt-card';
        
        if (isSelected) {
            this.selectedItems.add(itemId);
        } else {
            this.selectedItems.delete(itemId);
        }
        
        // 更新卡片样式
        const checkbox = document.querySelector(checkboxSelector);
        if (checkbox) {
            const card = checkbox.closest(cardSelector);
            if (card) {
                if (isSelected) {
                    card.classList.add('selected');
                } else {
                    card.classList.remove('selected');
                }
            }
        }
        
        this.updateBatchDeleteButton();
        console.log(`当前选中 ${this.selectedItems.size} 个${type}`);
    }
    
    /**
     * 更新批量删除按钮状态
     */
    updateBatchDeleteButton() {
        if (!this.isEditMode || !this.currentType) return;
        
        const elements = this.elements[this.currentType];
        if (elements.batchDeleteBtn) {
            elements.batchDeleteBtn.disabled = this.selectedItems.size === 0;
        }
    }
    
    /**
     * 绑定勾选框事件（在渲染时调用）
     */
    bindCheckboxEvents(type) {
        const checkboxSelector = type === 'mistake' ? '.mistake-checkbox' : '.ppt-checkbox';
        const checkboxes = document.querySelectorAll(checkboxSelector);
        
        checkboxes.forEach(checkbox => {
            // 移除旧的事件监听器（如果存在）
            const oldHandler = checkbox._editHandler;
            if (oldHandler) {
                checkbox.removeEventListener('change', oldHandler);
            }
            
            // 添加新的事件监听器
            const newHandler = (e) => {
                if (this.isEditMode && this.currentType === type) {
                    const itemId = e.target.getAttribute(`data-${type === 'mistake' ? 'mistake' : 'ppt'}-id`);
                    this.toggleItemSelection(type, itemId, e.target.checked);
                }
            };
            
            checkbox._editHandler = newHandler;
            checkbox.addEventListener('change', newHandler);
        });
        
        console.log(`${type} 勾选框事件绑定完成，共绑定 ${checkboxes.length} 个勾选框`);
    }
    
    /**
     * 获取当前状态
     */
    getState() {
        return {
            isEditMode: this.isEditMode,
            currentType: this.currentType,
            selectedCount: this.selectedItems.size,
            selectedItems: Array.from(this.selectedItems)
        };
    }
}