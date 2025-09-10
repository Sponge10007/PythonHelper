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
                return Array.from(this.currentFilters.tags).some(tag => mistake.tags && mistake.tags.includes(tag));
            }
            return true;
        });

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
    }
    
    applyFilters(newFilters) {
        this.currentFilters = { ...this.currentFilters, ...newFilters };
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
        if (isChecked) {
            this.selectedMistakes.add(mistakeId);
        } else {
            this.selectedMistakes.delete(mistakeId);
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