// js/mistake_manager/MistakeHandler.js

import * as api from '../common/api.js';

export class MistakeHandler {
    constructor(uiManager) {
        this.ui = uiManager;
        this.allMistakes = [];
        this.filteredMistakes = [];
        this.selectedMistakes = new Set();
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.editingMistakeId = null;
        this.currentFilters = { search: '', tags: new Set() };
    }

    async init() {
        try {
            this.allMistakes = await api.fetchMistakes();
            this.filterAndRender();
        } catch (error) {
            console.error("初始化错题数据失败:", error);
        }
    }
    
    filterAndRender() {
        // 筛选逻辑
        this.filteredMistakes = this.allMistakes.filter(mistake => {
            // 确保 mistake 对象存在且有 title 属性
            if (!mistake || typeof mistake.title === 'undefined') {
                return false;
            }
            const searchLower = this.currentFilters.search.toLowerCase();
            const titleMatch = mistake.title.toLowerCase().includes(searchLower);
            const messageMatch = mistake.messages && mistake.messages.some(msg => msg.content.toLowerCase().includes(searchLower));
            
            const searchCondition = !searchLower || (titleMatch || messageMatch);
            if (!searchCondition) return false;

            if (this.currentFilters.tags.size > 0) {
                const hasMatchingTag = Array.from(this.currentFilters.tags).some(tag => mistake.tags && mistake.tags.includes(tag));
                console.log(`错题 "${mistake.title}" 标签:`, mistake.tags, '筛选标签:', Array.from(this.currentFilters.tags), '匹配:', hasMatchingTag); // 调试信息
                return hasMatchingTag;
            }
            return true;
        });

        console.log(`筛选结果: ${this.filteredMistakes.length} / ${this.allMistakes.length} 条错题`); // 调试信息

        // 渲染逻辑
        const totalPages = Math.ceil(this.filteredMistakes.length / this.itemsPerPage);
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const pageMistakes = this.filteredMistakes.slice(startIndex, startIndex + this.itemsPerPage);

        this.ui.renderMistakeList(
            pageMistakes,
            (id) => this.editMistake(id),
            (id) => this.deleteMistake(id),
            (id, isChecked) => this.toggleSelection(id, isChecked)
        );
        this.ui.updatePagination(this.currentPage, totalPages);
        
        const stats = { 
            total: this.allMistakes.length, 
            tagged: this.allMistakes.filter(m => m && m.tags && m.tags.length > 0).length,
            summarized: this.allMistakes.filter(m => m && m.ai_summary).length
        };
        // 假设pptStats是一个空对象，因为这个模块不处理PPT
        this.ui.updateStats(stats, { total: 0, slides: 0 });
        
        // 更新复选框状态以保持选中状态同步
        setTimeout(() => this.updateCheckboxes(), 0);
    }
    
    applyFilters(newFilters) {
        this.currentFilters = { ...this.currentFilters, ...newFilters };
        console.log('应用筛选器:', this.currentFilters); // 调试信息
        this.currentPage = 1;
        this.filterAndRender();
    }
    
    sort(sortBy) {
        this.filteredMistakes.sort((a, b) => {
            switch (sortBy) {
                case 'date': return new Date(b.date) - new Date(a.date);
                case 'category': return (a.category || '').localeCompare(b.category || '');
                case 'difficulty':
                    const order = { '简单': 1, '中等': 2, '困难': 3 };
                    return (order[a.difficulty] || 0) - (order[b.difficulty] || 0);
                default: return 0;
            }
        });
        this.currentPage = 1;
        this.filterAndRender();
    }

    async deleteMistake(mistakeId) {
        if (!confirm('确定要删除这个错题吗？')) return;
        try {
            // await api.deleteMistake(mistakeId); // 在生产环境中，您需要一个后端的删除API
            this.allMistakes = this.allMistakes.filter(m => m.id !== mistakeId);
            this.selectedMistakes.delete(mistakeId);
            this.filterAndRender();
        } catch (error) {
            alert('删除失败: ' + error.message);
        }
    }
    
    editMistake(mistakeId) {
        const mistake = this.allMistakes.find(m => m.id === mistakeId);
        if (!mistake) return;
        this.editingMistakeId = mistakeId;
        this.ui.fillEditModal(mistake);
        this.ui.toggleModal('modal', true);
    }
    
    async saveMistake() {
        if (!this.editingMistakeId) return;
        const originalMistake = this.allMistakes.find(m => m.id === this.editingMistakeId);
        if (!originalMistake) return;

        const formData = this.ui.getEditModalData();
        if (!formData.title) {
            alert('标题不能为空');
            return;
        }

        const updatedMistakeData = { ...originalMistake, ...formData };
        
        try {
            const responseData = await api.updateMistake(this.editingMistakeId, updatedMistakeData);
            
            const index = this.allMistakes.findIndex(m => m.id === this.editingMistakeId);
            if (index !== -1) {
                // *** 这是关键的修复 ***
                // 将原来的 responseData.mistake 修改为 responseData
                // 因为后端直接返回了更新后的错题对象
                this.allMistakes[index] = responseData; 
            }
            
            this.filterAndRender();
            this.ui.toggleModal('modal', false);
            this.editingMistakeId = null;
        } catch (error) {
            alert(`保存失败: ${error.message}`);
        }
    }

    toggleSelection(mistakeId, isChecked) {
        // 确保mistakeId是字符串类型
        mistakeId = String(mistakeId);
        
        if (isChecked) {
            this.selectedMistakes.add(mistakeId);
        } else {
            this.selectedMistakes.delete(mistakeId);
        }
        
        // 立即更新对应错题项的选中状态样式
        const checkbox = document.querySelector(`.mistake-checkbox[data-mistake-id="${mistakeId}"]`);
        if (checkbox) {
            const mistakeItem = checkbox.closest('.mistake-item');
            if (mistakeItem) {
                if (isChecked) {
                    mistakeItem.classList.add('selected');
                } else {
                    mistakeItem.classList.remove('selected');
                }
            }
        }
        
        this.updateBatchDeleteButton();
    }

    // 进入编辑模式
    enterEditMode() {
        this.selectedMistakes.clear();
        document.querySelector('.mistake-list').classList.add('edit-mode');
        this.filterAndRender();
        this.updateBatchDeleteButton();
    }

    // 退出编辑模式
    exitEditMode() {
        this.selectedMistakes.clear();
        document.querySelector('.mistake-list').classList.remove('edit-mode');
        this.filterAndRender();
    }

    // 全选错题
    selectAllMistakes() {
        const currentPageMistakes = this.getCurrentPageMistakes();
        currentPageMistakes.forEach(mistake => {
            this.selectedMistakes.add(String(mistake.id));
        });
        this.updateCheckboxes();
        this.updateBatchDeleteButton();
    }

    // 取消全选错题
    deselectAllMistakes() {
        this.selectedMistakes.clear();
        this.updateCheckboxes();
        this.updateBatchDeleteButton();
    }

    // 批量删除选中的错题
    async batchDeleteSelected() {
        if (this.selectedMistakes.size === 0) {
            alert('请先选择要删除的错题');
            return;
        }

        if (!confirm(`确定要删除选中的 ${this.selectedMistakes.size} 个错题吗？`)) {
            return;
        }

        try {
            const selectedIds = Array.from(this.selectedMistakes);
            // 逐个删除错题
            for (const mistakeId of selectedIds) {
                this.allMistakes = this.allMistakes.filter(m => m.id !== mistakeId);
            }
            
            this.selectedMistakes.clear();
            this.filterAndRender();
            this.updateBatchDeleteButton();
            
            alert(`成功删除 ${selectedIds.length} 个错题`);
        } catch (error) {
            alert('批量删除失败: ' + error.message);
        }
    }

    // 获取当前页的错题
    getCurrentPageMistakes() {
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        return this.filteredMistakes.slice(startIndex, startIndex + this.itemsPerPage);
    }

    // 更新复选框状态
    updateCheckboxes() {
        const checkboxes = document.querySelectorAll('.mistake-checkbox');
        checkboxes.forEach(checkbox => {
            const mistakeId = String(checkbox.getAttribute('data-mistake-id'));
            const isSelected = this.selectedMistakes.has(mistakeId);
            checkbox.checked = isSelected;
            
            // 更新错题项的选中状态样式
            const mistakeItem = checkbox.closest('.mistake-item');
            if (mistakeItem) {
                if (isSelected) {
                    mistakeItem.classList.add('selected');
                } else {
                    mistakeItem.classList.remove('selected');
                }
            }
        });
    }

    // 更新批量删除按钮状态
    updateBatchDeleteButton() {
        const batchDeleteBtn = document.getElementById('batchDelete');
        if (batchDeleteBtn) {
            batchDeleteBtn.disabled = this.selectedMistakes.size === 0;
        }
    }

    goToPage(pageNumber) {
        const totalPages = Math.ceil(this.filteredMistakes.length / this.itemsPerPage);
        if (pageNumber > 0 && pageNumber <= totalPages) {
            this.currentPage = pageNumber;
            this.filterAndRender();
        }
    }
}