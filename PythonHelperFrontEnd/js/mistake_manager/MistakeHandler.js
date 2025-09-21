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
    
    isLessonTag(tag) {
        const lessonTags = ['数据类型及表达式', '复合数据类型', '面向对象', '函数', '流程控制', '文件概述', '异常处理'];
        return lessonTags.includes(tag);
    }

    async saveMistake() {
        if (!this.editingMistakeId) return;

        const index = this.allMistakes.findIndex(m => m.id === this.editingMistakeId);
        if (index === -1) {
            console.error("错误：无法找到要保存的错题。");
            return;
        }

        const originalMistake = this.allMistakes[index];
        // 从UI模态框获取用户输入
        const formData = this.ui.getEditModalData();

        if (!formData.title) {
            alert('标题不能为空');
            return;
        }
        
        // --- 标签管理逻辑 ---
        // 1. 保留原始错题中所有非课程标签
        const otherTags = (originalMistake.tags || []).filter(tag => !this.isLessonTag(tag));
        
        // 2. 从表单数据中获取新的课程标签 (formData.tags 是一个只包含新课程标签的数组)
        const newLessonTag = formData.tags[0] || null;

        // 3. 组合成最终的标签数组
        const finalTags = [...otherTags];
        if (newLessonTag) {
            finalTags.push(newLessonTag);
        }
        // --- 结束标签管理 ---

        // 组合成最终的、完整的错题对象
        const updatedMistake = {
            ...originalMistake,
            title: formData.title,
            category: formData.category,
            difficulty: formData.difficulty,
            tags: finalTags
        };
        
        try {
            // **核心修复：执行“乐观更新”**
            // 1. 立即用我们刚刚构造好的新对象来更新本地的题目列表
            this.allMistakes[index] = updatedMistake;

            // 2. 立即基于更新后的本地数据重新渲染界面
            //    这会立刻、正确地显示出修改后的题目，解决了“消失”的问题
            this.filterAndRender();
            this.ui.toggleModal('modal', false);
            
            // 3. 在后台将更新发送到服务器
            await api.updateMistake(this.editingMistakeId, updatedMistake);
            
            // 4. 清理编辑状态
            this.editingMistakeId = null;

        } catch (error) {
            alert(`保存失败: ${error.message}`);
            // 如果API调用失败，可以考虑回滚UI的改动（可选）
            // this.allMistakes[index] = originalMistake;
            // this.filterAndRender();
        }
    }

    filterAndRender() {
        // 筛选逻辑
        this.filteredMistakes = this.allMistakes.filter(mistake => {
            // 确保 mistake 对象是有效的
            if (!mistake || typeof mistake.title === 'undefined') {
                return false;
            }

            // --- 1. 搜索框筛选 ---
            const searchLower = this.currentFilters.search.toLowerCase();
            if (searchLower) { // 仅当搜索框有内容时才进行匹配
                const titleMatch = mistake.title.toLowerCase().includes(searchLower);
                // 确保 messages 存在且是数组
                const messageMatch = Array.isArray(mistake.messages) && mistake.messages.some(msg => 
                    msg.content && msg.content.toLowerCase().includes(searchLower)
                );
                // 如果搜索框有内容，但标题和消息都不匹配，则过滤掉该项
                if (!titleMatch && !messageMatch) {
                    return false;
                }
            }

            // --- 2. 标签筛选 ---
            if (this.currentFilters.tags.size > 0) {
                // 确保 mistake.tags 存在且是数组
                if (!Array.isArray(mistake.tags) || mistake.tags.length === 0) {
                    return false; // 如果要求按标签筛选，但该错题没有任何标签，则过滤掉
                }
                
                // 检查错题的标签是否至少包含一个当前选中的筛选标签
                const hasMatchingTag = Array.from(this.currentFilters.tags).some(filterTag => mistake.tags.includes(filterTag));
                if (!hasMatchingTag) {
                    return false; // 如果该错题的标签与筛选标签无一匹配，则过滤掉
                }
            }

            // 如果错题通过了以上所有筛选条件，则保留它
            return true;
        });

        // --- 渲染逻辑 ---
        const totalPages = Math.ceil(this.filteredMistakes.length / this.itemsPerPage);
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const pageMistakes = this.filteredMistakes.slice(startIndex, startIndex + this.itemsPerPage);

        this.ui.renderMistakeList(
            pageMistakes,
            this.isLessonTag.bind(this), // 关键调用
            (id) => this.editMistake(id),
            (id) => this.deleteMistake(id),
            (id, isChecked) => this.toggleSelection(id, isChecked)
        );
        this.ui.updatePagination(this.currentPage, totalPages);
        
        const stats = { 
            total: this.allMistakes.length, 
            tagged: this.allMistakes.filter(m => m && Array.isArray(m.tags) && m.tags.length > 0).length,
            summarized: this.allMistakes.filter(m => m && m.ai_summary).length
        };
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
        this.ui.fillEditModal(mistake, this.isLessonTag.bind(this)); // 新增isLessonTag函数调用
        this.ui.toggleModal('modal', true);
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