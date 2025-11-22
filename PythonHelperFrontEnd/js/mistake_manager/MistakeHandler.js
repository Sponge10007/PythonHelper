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
        this.currentSort = 'date'; // 默认排序
        
        // 标签筛选条件
        this.tagFilters = {
            course: [],
            knowledge: [],
            difficulty: []
        };
    }

    async init() {
        try {
            this.allMistakes = await api.fetchMistakes();
            this.filterAndRender();
            this.bindFilterEvents();
        } catch (error) {
            console.error("初始化错题数据失败:", error);
        }
    }

    /**
     * 检查是否有活跃的标签筛选条件
     */
    hasActiveTagFilters() {
        return this.tagFilters.course.length > 0 || 
               this.tagFilters.knowledge.length > 0 || 
               this.tagFilters.difficulty.length > 0;
    }

    /**
     * 检查错题标签是否匹配筛选条件
     */
    matchesTagFilters(mistakeTags) {
        // 检查课程标签筛选
        if (this.tagFilters.course.length > 0) {
            const hasCourseMatch = this.tagFilters.course.some(filterTag => 
                mistakeTags.includes(filterTag)
            );
            if (!hasCourseMatch) return false;
        }

        // 检查知识点标签筛选
        if (this.tagFilters.knowledge.length > 0) {
            const hasKnowledgeMatch = this.tagFilters.knowledge.some(filterTag => 
                mistakeTags.includes(filterTag)
            );
            if (!hasKnowledgeMatch) return false;
        }

        // 检查难度标签筛选
        if (this.tagFilters.difficulty.length > 0) {
            const hasDifficultyMatch = this.tagFilters.difficulty.some(filterTag => 
                mistakeTags.includes(filterTag)
            );
            if (!hasDifficultyMatch) return false;
        }

        return true;
    }

    /**
     * 绑定筛选事件
     */
    bindFilterEvents() {
        // 监听标签筛选变化事件
        document.addEventListener('tagFilterChanged', (e) => {
            this.tagFilters = e.detail.filters;
            this.filterAndRender();
        });
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
        
        // --- 新标签逻辑：以用户在编辑弹窗勾选的标签为准覆盖 ---
        const finalTags = Array.isArray(formData.tags) ? formData.tags : [];

        // 组合成最终的、完整的错题对象
        const updatedMistake = {
            ...originalMistake,
            title: formData.title,
            tags: finalTags
        };
        
        try {
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

            // --- 3. 新的标签分类筛选 ---
            if (this.hasActiveTagFilters()) {
                if (!Array.isArray(mistake.tags) || mistake.tags.length === 0) {
                    return false; // 如果要求按标签筛选，但该错题没有任何标签，则过滤掉
                }
                
                // 检查是否匹配任何选中的标签筛选条件
                const matchesFilters = this.matchesTagFilters(mistake.tags);
                if (!matchesFilters) {
                    return false;
                }
            }

            // 如果错题通过了以上所有筛选条件，则保留它
            return true;
        });

        // --- 排序逻辑 ---
        this.filteredMistakes.sort((a, b) => {
            return this.compareMistakes(a, b, this.currentSort);
        });

        // --- 渲染逻辑 ---
        const totalPages = Math.ceil(this.filteredMistakes.length / this.itemsPerPage);
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const pageMistakes = this.filteredMistakes.slice(startIndex, startIndex + this.itemsPerPage);

        this.ui.renderMistakeList(
            pageMistakes,
            (id) => this.editMistake(id),
            (id) => this.deleteMistake(id)
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
        console.log('应用筛选器:', this.currentFilters); // 调试信息
        this.currentPage = 1;
        this.filterAndRender();
    }
    
    sort(sortBy) {
        this.currentSort = sortBy;
        this.currentPage = 1;
        this.filterAndRender();
    }

    /**
     * 比较两个错题
     */
    compareMistakes(a, b, sortBy) {
        switch (sortBy) {
            case 'date':
                // 按日期降序（最新的在前）
                return new Date(b.date) - new Date(a.date);
            case 'class': // 按课程标签排序
                const courseA = this.getMistakeTagByCategory(a, 'course') || '';
                const courseB = this.getMistakeTagByCategory(b, 'course') || '';
                return courseA.localeCompare(courseB, 'zh-CN');
            case 'knowledge': // 按知识点标签排序
                return this.compareByKnowledge(a, b);
            case 'easy': // 由易到难
                return this.getDifficultyValue(a) - this.getDifficultyValue(b);
            case 'difficulty': // 由难到易
                return this.getDifficultyValue(b) - this.getDifficultyValue(a);
            default:
                return 0;
        }
    }

    /**
     * 自定义知识点排序
     */
    compareByKnowledge(a, b) {
        const order = [
            '变量', '字符串', '列表', '字典', 
            '循环', '条件语句', '文件操作', '类', '继承'
        ];
        
        const knowA = this.getMistakeTagByCategory(a, 'knowledge') || '';
        const knowB = this.getMistakeTagByCategory(b, 'knowledge') || '';
        
        const indexA = order.indexOf(knowA);
        const indexB = order.indexOf(knowB);
        
        // 如果都在列表中，按列表顺序
        if (indexA !== -1 && indexB !== -1) {
            return indexA - indexB;
        }
        
        // 如果只有一个在列表中，在列表中的排前面
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        
        // 如果都不在列表中，按拼音排序
        return knowA.localeCompare(knowB, 'zh-CN');
    }

    /**
     * 自定义课程排序
     */
    compareByCourse(a, b) {
        const order = ['函数', '复合数据类型', '异常处理', '数据类型及表达式', '文件概述', '流程控制', '面向对象'];

        const courseA = this.getMistakeTagByCategory(a, 'course') || '';
        const courseB = this.getMistakeTagByCategory(b, 'course') || '';

        const indexA = order.indexOf(courseA);
        const indexB = order.indexOf(courseB);

        // 如果都在列表中，按列表顺序
        if (indexA !== -1 && indexB !== -1) {
            return indexA - indexB;
        }
        
        // 如果只有一个在列表中，在列表中的排前面
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        
        // 如果都不在列表中，按拼音排序
        return courseA.localeCompare(courseB, 'zh-CN');
    }

    /**
     * 获取错题指定类别的标签
     */
    getMistakeTagByCategory(mistake, category) {
        if (!mistake.tags || !Array.isArray(mistake.tags)) return null;
        if (!window.tagCategories || !window.tagCategories[category]) return null;
        
        return mistake.tags.find(tag => window.tagCategories[category].has(tag));
    }

    /**
     * 获取难度值
     */
    getDifficultyValue(mistake) {
        const tag = this.getMistakeTagByCategory(mistake, 'difficulty');
        const order = { '简单': 1, '中等': 2, '困难': 3 };
        return order[tag] || 0;
    }

    async deleteMistake(mistakeId) {
        if (!confirm('确定要删除这个错题吗？')) return;
        try {
            // 调用后端API删除错题
            await api.deleteMistake(mistakeId);
            
            // 从本地数据中移除
            this.allMistakes = this.allMistakes.filter(m => m.id !== mistakeId);
            this.selectedMistakes.delete(mistakeId);
            this.filterAndRender();
        } catch (error) {
            console.error('删除错题失败:', error);
            alert('删除失败: ' + error.message);
        }
    }
    
    async editMistake(mistakeId) {
        const mistake = this.allMistakes.find(m => m.id === mistakeId);
        if (!mistake) return;
        this.editingMistakeId = mistakeId;
        
        // 先加载标签，再填充编辑模态框
        await this.ui.loadTagsForEditModal();
        this.ui.fillEditModal(mistake);
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

    /**
     * 切换单个错题的选中状态
     */
    toggleMistakeSelection(mistakeId, isSelected) {
        console.log(`切换错题 ${mistakeId} 选中状态:`, isSelected);
        
        if (isSelected) {
            this.selectedMistakes.add(mistakeId);
        } else {
            this.selectedMistakes.delete(mistakeId);
        }
        
        // 更新卡片视觉效果
        const checkbox = document.querySelector(`.mistake-checkbox[data-mistake-id="${mistakeId}"]`);
        if (checkbox) {
            const card = checkbox.closest('.mistake-item');
            if (card) {
                if (isSelected) {
                    card.classList.add('selected');
                } else {
                    card.classList.remove('selected');
                }
            }
        }
        
        this.updateSelectionUI();
        console.log(`错题 ${mistakeId} ${isSelected ? '已选中' : '取消选中'}，当前选中数量: ${this.selectedMistakes.size}`);
    }

    /**
     * 根据ID数组批量删除错题
     */
    async batchDeleteByIds(selectedIds) {
        try {
            const deletePromises = selectedIds.map(id => api.deleteMistake(id));
            await Promise.all(deletePromises);
            
            console.log(`成功删除 ${selectedIds.length} 个错题`);
            
            // 从本地数据中移除已删除的错题
            this.allMistakes = this.allMistakes.filter(mistake => 
                !selectedIds.includes(String(mistake.id))
            );
            
            // 重新渲染
            this.filterAndRender();
            
        } catch (error) {
            console.error('批量删除失败:', error);
            throw error;
        }
    }

    /**
     * 初始化编辑管理器相关的回调
     */
    initEditCallbacks(editManager) {
        editManager.registerCallbacks('mistake', {
            selectAll: () => this.selectAllMistakes(),
            deselectAll: () => this.deselectAllMistakes(),
            batchDelete: () => this.batchDeleteSelected(),
            render: () => this.filterAndRender()
        });
    }

    /**
     * 检查是否处于编辑模式
     */
    isInEditMode(editManager) {
        const state = editManager.getState();
        return state.isEditMode && state.currentType === 'mistake';
    }

    /**
     * 全选当前页错题
     */
    selectAllMistakes() {
        const currentPageMistakes = this.getCurrentPageMistakes();
        console.log('当前页错题:', currentPageMistakes);
        
        currentPageMistakes.forEach(mistake => {
            this.selectedMistakes.add(mistake.id);
            
            // 更新视觉效果
            const checkbox = document.querySelector(`.mistake-checkbox[data-mistake-id="${mistake.id}"]`);
            if (checkbox) {
                checkbox.checked = true;
                const card = checkbox.closest('.mistake-item');
                if (card) {
                    card.classList.add('selected');
                }
            }
        });
        
        this.updateSelectionUI();
        console.log(`已选择 ${this.selectedMistakes.size} 个错题`);
    }

    /**
     * 取消全选错题
     */
    deselectAllMistakes() {
        console.log('取消全选，当前选中:', this.selectedMistakes);
        
        // 先更新视觉效果
        this.selectedMistakes.forEach(mistakeId => {
            const checkbox = document.querySelector(`.mistake-checkbox[data-mistake-id="${mistakeId}"]`);
            if (checkbox) {
                checkbox.checked = false;
                const card = checkbox.closest('.mistake-item');
                if (card) {
                    card.classList.remove('selected');
                }
            }
        });
        
        this.selectedMistakes.clear();
        this.updateSelectionUI();
        console.log('已取消选择所有错题');
    }

    /**
     * 批量删除选中的错题
     */
    async batchDeleteSelected() {
        if (this.selectedMistakes.size === 0) {
            alert('请先选择要删除的错题');
            return;
        }

        const confirmMessage = `确定要删除选中的 ${this.selectedMistakes.size} 个错题吗？此操作不可恢复！`;
        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            const deletePromises = Array.from(this.selectedMistakes).map(id => 
                api.deleteMistake(id)
            );
            
            await Promise.all(deletePromises);
            
            console.log(`成功删除 ${this.selectedMistakes.size} 个错题`);
            
            // 从本地数据中移除已删除的错题
            this.allMistakes = this.allMistakes.filter(mistake => 
                !this.selectedMistakes.has(mistake.id)
            );
            
            // 清空选择并重新渲染
            this.selectedMistakes.clear();
            this.filterAndRender();
            
        } catch (error) {
            console.error('批量删除失败:', error);
        }
    }

    /**
     * 获取当前页的错题
     */
    getCurrentPageMistakes() {
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        return this.filteredMistakes.slice(startIndex, endIndex);
    }

    /**
     * 更新选择状态的UI
     */
    updateSelectionUI() {
        // 更新复选框状态
        const currentPageMistakes = this.getCurrentPageMistakes();
        currentPageMistakes.forEach(mistake => {
            const checkbox = document.querySelector(`.mistake-checkbox[data-mistake-id="${mistake.id}"]`);
            if (checkbox) {
                checkbox.checked = this.selectedMistakes.has(mistake.id);
                
                // 更新卡片视觉效果
                const card = checkbox.closest('.mistake-item');
                if (card) {
                    if (this.selectedMistakes.has(mistake.id)) {
                        card.classList.add('selected');
                    } else {
                        card.classList.remove('selected');
                    }
                }
            }
        });

        // 通知编辑管理器更新按钮状态
        if (window.editManager) {
            window.editManager.updateSelectedItems(Array.from(this.selectedMistakes));
        }
    }
}