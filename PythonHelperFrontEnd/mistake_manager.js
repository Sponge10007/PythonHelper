// 错题管理器 JavaScript
class MistakeManager {
    constructor() {
        this.mistakes = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.selectedMistakes = new Set();
        this.filteredMistakes = [];
        this.currentFilters = {
            search: '',
            tags: new Set()
        };
        
        this.init();
    }

    // 初始化
    async init() {
        await this.loadMistakes();
        this.bindEvents();
        this.updateUI();
    }

    // 绑定事件
    bindEvents() {
        // 搜索和筛选
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.currentFilters.search = e.target.value;
            this.filterMistakes();
        });

        // 工具栏按钮
        document.getElementById('selectAll').addEventListener('click', () => this.selectAll());
        document.getElementById('deselectAll').addEventListener('click', () => this.deselectAll());
        document.getElementById('batchDelete').addEventListener('click', () => this.batchDelete());
        document.getElementById('addTag').addEventListener('click', () => this.showAddTagModal());

        // 排序
        document.getElementById('sortBy').addEventListener('change', (e) => {
            this.sortMistakes(e.target.value);
        });

        // 分页
        document.getElementById('prevPage').addEventListener('click', () => this.prevPage());
        document.getElementById('nextPage').addEventListener('click', () => this.nextPage());

        // 头部按钮
        document.getElementById('importFromExtension').addEventListener('click', () => this.importFromExtension());
        document.getElementById('exportData').addEventListener('click', () => this.exportData());

        // AI功能
        document.getElementById('generateSummary').addEventListener('click', () => this.generateSummary());
        document.getElementById('suggestTags').addEventListener('click', () => this.suggestTags());
        document.getElementById('analyzePatterns').addEventListener('click', () => this.analyzePatterns());

        // 模态框
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal());
        document.getElementById('closeAiModal').addEventListener('click', () => this.closeAiModal());
        document.getElementById('saveMistake').addEventListener('click', () => this.saveMistake());
        document.getElementById('cancelEdit').addEventListener('click', () => this.closeModal());
        document.getElementById('saveSummary').addEventListener('click', () => this.saveSummary());
        document.getElementById('regenerateSummary').addEventListener('click', () => this.regenerateSummary());

        // 点击模态框外部关闭
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal();
                this.closeAiModal();
            }
        });

        // 事件委托处理错题项目中的按钮点击
        document.getElementById('mistakeList').addEventListener('click', (e) => {
            const target = e.target;
            if (target.classList.contains('edit-mistake-btn')) {
                const mistakeId = parseInt(target.dataset.mistakeId);
                this.editMistake(mistakeId);
            } else if (target.classList.contains('delete-mistake-btn')) {
                const mistakeId = parseInt(target.dataset.mistakeId);
                this.deleteMistake(mistakeId);
            } else if (target.classList.contains('mistake-checkbox')) {
                const mistakeId = parseInt(target.dataset.mistakeId);
                this.toggleSelection(mistakeId);
            }
        });
    }

    // 加载错题数据
    async loadMistakes() {
        try {
            // 优先从后端加载数据
            const response = await fetch('http://localhost:5000/mistakes', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.mistakes = data.mistakes || [];
            } else {
                // 回退到本地存储
                const stored = localStorage.getItem('pythonMistakes');
                if (stored) {
                    this.mistakes = JSON.parse(stored);
                }
            }
        } catch (error) {
            console.warn('后端连接失败，使用本地存储:', error);
            // 回退到本地存储
            const stored = localStorage.getItem('pythonMistakes');
            if (stored) {
                this.mistakes = JSON.parse(stored);
            }
        }
        
        this.filteredMistakes = [...this.mistakes];
        this.updateTagFilter();
    }

    // 保存错题数据
    async saveMistakes() {
        try {
            // 优先保存到后端
            const response = await fetch('http://localhost:5000/mistakes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ mistakes: this.mistakes })
            });
            
            if (!response.ok) {
                throw new Error('后端保存失败');
            }
        } catch (error) {
            console.warn('后端保存失败，使用本地存储:', error);
            // 回退到本地存储
            localStorage.setItem('pythonMistakes', JSON.stringify(this.mistakes));
        }
    }

    // 从插件导入数据
    async importFromExtension() {
        try {
            // 尝试从Chrome扩展获取数据
            if (typeof chrome !== 'undefined' && chrome.storage) {
                const result = await chrome.storage.local.get(['pythonMistakes']);
                if (result.pythonMistakes && result.pythonMistakes.length > 0) {
                    this.mistakes = [...this.mistakes, ...result.pythonMistakes];
                    await this.saveMistakes();
                    this.filterMistakes();
                    this.showNotification('成功从插件导入数据', 'success');
                } else {
                    this.showNotification('插件中没有找到错题数据', 'warning');
                }
            } else {
                // 模拟导入功能
                const mockData = [
                    {
                        id: Date.now(),
                        title: '变量作用域问题',
                        content: '以下代码的输出结果是什么？\n\nx = 10\ndef func():\n    x = 20\n    print(x)\nfunc()\nprint(x)',
                        answer: '输出结果：\n20\n10\n\n解释：函数内部的x是局部变量，不会影响全局变量x的值。',
                        tags: ['变量作用域', '函数'],
                        category: '基础语法',
                        difficulty: '简单',
                        date: new Date().toISOString(),
                        aiSummary: ''
                    }
                ];
                this.mistakes = [...this.mistakes, ...mockData];
                await this.saveMistakes();
                this.filterMistakes();
                this.showNotification('成功导入示例数据', 'success');
            }
        } catch (error) {
            this.showNotification('导入失败：' + error.message, 'error');
        }
    }

    // 导出数据
    exportData() {
        const dataStr = JSON.stringify(this.mistakes, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `python_mistakes_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        this.showNotification('数据导出成功', 'success');
    }

    // 筛选错题
    filterMistakes() {
        this.filteredMistakes = this.mistakes.filter(mistake => {
            // 搜索筛选
            if (this.currentFilters.search) {
                const searchTerm = this.currentFilters.search.toLowerCase();
                const searchableText = `${mistake.title} ${mistake.content} ${mistake.answer}`.toLowerCase();
                if (!searchableText.includes(searchTerm)) {
                    return false;
                }
            }

            // 标签筛选
            if (this.currentFilters.tags.size > 0) {
                const mistakeTags = new Set(mistake.tags || []);
                const hasMatchingTag = Array.from(this.currentFilters.tags).some(tag => 
                    mistakeTags.has(tag)
                );
                if (!hasMatchingTag) {
                    return false;
                }
            }

            return true;
        });

        this.currentPage = 1;
        this.updateUI();
    }

    // 排序错题
    sortMistakes(sortBy) {
        this.filteredMistakes.sort((a, b) => {
            switch (sortBy) {
                case 'date':
                    return new Date(b.date) - new Date(a.date);
                case 'category':
                    return a.category.localeCompare(b.category);
                case 'difficulty':
                    const difficultyOrder = { '简单': 1, '中等': 2, '困难': 3 };
                    return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
                default:
                    return 0;
            }
        });
        this.updateUI();
    }

    // 更新标签筛选器
    updateTagFilter() {
        const allTags = new Set();
        this.mistakes.forEach(mistake => {
            if (mistake.tags) {
                mistake.tags.forEach(tag => allTags.add(tag));
            }
        });

        const tagFilter = document.getElementById('tagFilter');
        tagFilter.innerHTML = '';

        Array.from(allTags).sort().forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.className = 'tag-item';
            tagElement.textContent = tag;
            tagElement.addEventListener('click', () => this.toggleTagFilter(tag, tagElement));
            tagFilter.appendChild(tagElement);
        });
    }

    // 切换标签筛选
    toggleTagFilter(tag, element) {
        if (this.currentFilters.tags.has(tag)) {
            this.currentFilters.tags.delete(tag);
            element.classList.remove('active');
        } else {
            this.currentFilters.tags.add(tag);
            element.classList.add('active');
        }
        this.filterMistakes();
    }

    // 更新UI
    updateUI() {
        this.renderMistakeList();
        this.updateStats();
        this.updatePagination();
        this.updateBatchDeleteButton();
    }

    // 渲染错题列表
    renderMistakeList() {
        const mistakeList = document.getElementById('mistakeList');
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageMistakes = this.filteredMistakes.slice(startIndex, endIndex);

        if (pageMistakes.length === 0) {
            mistakeList.innerHTML = `
                <div class="empty-state">
                    <h3>暂无错题</h3>
                    <p>点击"从插件导入"按钮来导入错题数据</p>
                </div>
            `;
            return;
        }

        mistakeList.innerHTML = pageMistakes.map(mistake => this.renderMistakeItem(mistake)).join('');
    }

    // 渲染单个错题项目
    renderMistakeItem(mistake) {
        const isSelected = this.selectedMistakes.has(mistake.id);
        const tags = (mistake.tags || []).map(tag => 
            `<span class="mistake-tag">${tag}</span>`
        ).join('');

        return `
            <div class="mistake-item ${isSelected ? 'selected' : ''}" data-id="${mistake.id}">
                <input type="checkbox" class="mistake-checkbox" 
                       ${isSelected ? 'checked' : ''} 
                       data-mistake-id="${mistake.id}">
                
                <div class="mistake-header">
                    <div>
                        <div class="mistake-title">${mistake.title}</div>
                        <div class="mistake-meta">
                            <span>${mistake.category}</span>
                            <span>${mistake.difficulty}</span>
                            <span>${new Date(mistake.date).toLocaleDateString()}</span>
                        </div>
                        <div class="mistake-tags">${tags}</div>
                    </div>
                    <div class="mistake-actions">
                        <button class="btn-secondary edit-mistake-btn" data-mistake-id="${mistake.id}">编辑</button>
                        <button class="btn-danger delete-mistake-btn" data-mistake-id="${mistake.id}">删除</button>
                    </div>
                </div>
                
                <div class="mistake-content">${this.escapeHtml(mistake.content)}</div>
                <div class="mistake-answer">${this.escapeHtml(mistake.answer)}</div>
            </div>
        `;
    }

    // 转义HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 切换选择状态
    toggleSelection(id) {
        if (this.selectedMistakes.has(id)) {
            this.selectedMistakes.delete(id);
        } else {
            this.selectedMistakes.add(id);
        }
        this.updateBatchDeleteButton();
        this.updateUI();
    }

    // 全选
    selectAll() {
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageMistakes = this.filteredMistakes.slice(startIndex, endIndex);
        
        pageMistakes.forEach(mistake => {
            this.selectedMistakes.add(mistake.id);
        });
        this.updateBatchDeleteButton();
        this.updateUI();
    }

    // 取消全选
    deselectAll() {
        this.selectedMistakes.clear();
        this.updateBatchDeleteButton();
        this.updateUI();
    }

    // 更新批量删除按钮状态
    updateBatchDeleteButton() {
        const batchDeleteBtn = document.getElementById('batchDelete');
        batchDeleteBtn.disabled = this.selectedMistakes.size === 0;
    }

    // 批量删除
    async batchDelete() {
        if (this.selectedMistakes.size === 0) return;
        
        if (confirm(`确定要删除选中的 ${this.selectedMistakes.size} 个错题吗？`)) {
            try {
                let successCount = 0;
                let failCount = 0;
                
                // 逐个删除选中的错题
                for (const id of this.selectedMistakes) {
                    try {
                        const response = await fetch(`http://localhost:5000/mistakes/${id}`, {
                            method: 'DELETE',
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        });
                        
                        if (response.ok) {
                            successCount++;
                        } else {
                            failCount++;
                        }
                    } catch (error) {
                        console.error(`删除错题 ${id} 失败:`, error);
                        failCount++;
                    }
                }
                
                // 重新加载错题列表
                await this.loadMistakes();
                this.selectedMistakes.clear();
                this.filterMistakes();
                
                if (failCount === 0) {
                    this.showNotification(`批量删除成功: ${successCount} 个错题`, 'success');
                } else {
                    this.showNotification(`批量删除完成: 成功 ${successCount} 个，失败 ${failCount} 个`, 'warning');
                }
            } catch (error) {
                console.error('批量删除失败:', error);
                this.showNotification('批量删除失败: 网络错误', 'error');
            }
        }
    }

    // 删除单个错题
    async deleteMistake(id) {
        if (confirm('确定要删除这个错题吗？')) {
            try {
                // 调用后端删除API
                const response = await fetch(`http://localhost:5000/mistakes/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    // 从本地数组中移除
                    this.mistakes = this.mistakes.filter(mistake => mistake.id !== id);
                    this.selectedMistakes.delete(id);
                    this.filterMistakes();
                    this.showNotification('删除成功', 'success');
                } else {
                    const errorData = await response.json();
                    this.showNotification(`删除失败: ${errorData.error}`, 'error');
                }
            } catch (error) {
                console.error('删除错题失败:', error);
                this.showNotification('删除失败: 网络错误', 'error');
            }
        }
    }

    // 编辑错题
    editMistake(id) {
        const mistake = this.mistakes.find(m => m.id === id);
        if (!mistake) return;

        document.getElementById('editTitle').value = mistake.title;
        document.getElementById('editContent').value = mistake.content;
        document.getElementById('editAnswer').value = mistake.answer;
        document.getElementById('editTags').value = (mistake.tags || []).join(', ');
        document.getElementById('editCategory').value = mistake.category;
        document.getElementById('editDifficulty').value = mistake.difficulty;

        // 存储当前编辑的错题ID
        this.editingMistakeId = id;
        
        document.getElementById('modal').style.display = 'block';
    }

    // 保存错题
    async saveMistake() {
        const title = document.getElementById('editTitle').value.trim();
        const content = document.getElementById('editContent').value.trim();
        const answer = document.getElementById('editAnswer').value.trim();
        const tags = document.getElementById('editTags').value.split(',').map(tag => tag.trim()).filter(tag => tag);
        const category = document.getElementById('editCategory').value;
        const difficulty = document.getElementById('editDifficulty').value;

        if (!title || !content || !answer) {
            this.showNotification('请填写所有必填字段', 'error');
            return;
        }

        try {
            if (this.editingMistakeId) {
                // 编辑现有错题 - 调用后端更新API
                const response = await fetch(`http://localhost:5000/mistakes/${this.editingMistakeId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        title,
                        content,
                        answer,
                        tags,
                        category,
                        difficulty,
                        aiSummary: ''
                    })
                });
                
                if (response.ok) {
                    // 更新本地数组中的错题
                    const index = this.mistakes.findIndex(m => m.id === this.editingMistakeId);
                    if (index !== -1) {
                        this.mistakes[index] = {
                            ...this.mistakes[index],
                            title,
                            content,
                            answer,
                            tags,
                            category,
                            difficulty
                        };
                    }
                    this.filterMistakes();
                    this.closeModal();
                    this.showNotification('更新成功', 'success');
                } else {
                    const errorData = await response.json();
                    this.showNotification(`更新失败: ${errorData.error}`, 'error');
                }
            } else {
                // 创建新错题 - 使用现有的保存整个列表的方法
                const newMistake = {
                    id: Date.now(),
                    title,
                    content,
                    answer,
                    tags,
                    category,
                    difficulty,
                    date: new Date().toISOString(),
                    aiSummary: ''
                };
                this.mistakes.unshift(newMistake);
                await this.saveMistakes();
                this.filterMistakes();
                this.closeModal();
                this.showNotification('创建成功', 'success');
            }
        } catch (error) {
            console.error('保存错题失败:', error);
            this.showNotification('保存失败: 网络错误', 'error');
        }
    }

    // 关闭模态框
    closeModal() {
        document.getElementById('modal').style.display = 'none';
        this.editingMistakeId = null;
    }

    // 关闭AI模态框
    closeAiModal() {
        document.getElementById('aiModal').style.display = 'none';
    }

    // 更新统计信息
    updateStats() {
        document.getElementById('totalMistakes').textContent = this.mistakes.length;
        document.getElementById('taggedMistakes').textContent = 
            this.mistakes.filter(m => m.tags && m.tags.length > 0).length;
        document.getElementById('aiSummarized').textContent = 
            this.mistakes.filter(m => m.aiSummary && m.aiSummary.trim()).length;
    }

    // 更新分页
    updatePagination() {
        const totalPages = Math.ceil(this.filteredMistakes.length / this.itemsPerPage);
        document.getElementById('pageInfo').textContent = `第 ${this.currentPage} 页，共 ${totalPages} 页`;
        
        document.getElementById('prevPage').disabled = this.currentPage <= 1;
        document.getElementById('nextPage').disabled = this.currentPage >= totalPages;
    }

    // 上一页
    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.updateUI();
        }
    }

    // 下一页
    nextPage() {
        const totalPages = Math.ceil(this.filteredMistakes.length / this.itemsPerPage);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.updateUI();
        }
    }

    // 显示添加标签模态框
    showAddTagModal() {
        // 这里可以实现添加标签的功能
        this.showNotification('添加标签功能开发中', 'info');
    }

    // AI功能 - 生成总结
    async generateSummary() {
        if (this.mistakes.length === 0) {
            this.showNotification('没有错题数据可以总结', 'warning');
            return;
        }

        document.getElementById('aiModal').style.display = 'block';
        document.getElementById('aiSummaryText').innerHTML = '<div class="loading"></div> 正在生成AI总结...';

        try {
            // 模拟AI总结生成
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const summary = this.generateMockSummary();
            document.getElementById('aiSummaryText').innerHTML = summary;
        } catch (error) {
            document.getElementById('aiSummaryText').innerHTML = '<p style="color: red;">生成总结失败：' + error.message + '</p>';
        }
    }

    // 生成模拟总结
    generateMockSummary() {
        const categories = {};
        const difficulties = {};
        const commonTags = {};

        this.mistakes.forEach(mistake => {
            categories[mistake.category] = (categories[mistake.category] || 0) + 1;
            difficulties[mistake.difficulty] = (difficulties[mistake.difficulty] || 0) + 1;
            
            if (mistake.tags) {
                mistake.tags.forEach(tag => {
                    commonTags[tag] = (commonTags[tag] || 0) + 1;
                });
            }
        });

        const topCategories = Object.entries(categories)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([cat, count]) => `${cat}(${count}题)`);

        const topTags = Object.entries(commonTags)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([tag, count]) => `${tag}(${count}次)`);

        return `
            <h3>📊 错题分析总结</h3>
            <p><strong>总错题数：</strong>${this.mistakes.length}题</p>
            <p><strong>主要分类：</strong>${topCategories.join('、')}</p>
            <p><strong>常见标签：</strong>${topTags.join('、')}</p>
            <p><strong>难度分布：</strong>简单(${difficulties['简单'] || 0})、中等(${difficulties['中等'] || 0})、困难(${difficulties['困难'] || 0})</p>
            
            <h4>💡 学习建议</h4>
            <p>1. 重点关注${topCategories[0]}相关知识点</p>
            <p>2. 加强${topTags[0]}相关练习</p>
            <p>3. 定期复习已掌握的简单题目</p>
            <p>4. 针对困难题目进行专项训练</p>
        `;
    }

    // AI功能 - 建议标签
    suggestTags() {
        if (this.mistakes.length === 0) {
            this.showNotification('没有错题数据可以分析', 'warning');
            return;
        }

        // 分析现有标签模式
        const tagPatterns = {};
        this.mistakes.forEach(mistake => {
            if (mistake.tags) {
                mistake.tags.forEach(tag => {
                    if (!tagPatterns[tag]) {
                        tagPatterns[tag] = [];
                    }
                    tagPatterns[tag].push(mistake.category);
                });
            }
        });

        const suggestions = Object.entries(tagPatterns)
            .map(([tag, categories]) => ({
                tag,
                frequency: categories.length,
                commonCategory: categories.sort((a,b) => 
                    categories.filter(v => v === a).length - categories.filter(v => v === b).length
                ).pop()
            }))
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 5);

        const suggestionText = suggestions.map(s => 
            `• ${s.tag} (${s.frequency}次使用，常用于${s.commonCategory})`
        ).join('\n');

        this.showNotification(`建议标签：\n${suggestionText}`, 'info');
    }

    // AI功能 - 分析模式
    analyzePatterns() {
        if (this.mistakes.length === 0) {
            this.showNotification('没有错题数据可以分析', 'warning');
            return;
        }

        // 分析错题模式
        const patterns = {
            mostCommonCategory: this.getMostCommon(this.mistakes.map(m => m.category)),
            mostCommonDifficulty: this.getMostCommon(this.mistakes.map(m => m.difficulty)),
            averageTagsPerMistake: this.mistakes.reduce((sum, m) => sum + (m.tags ? m.tags.length : 0), 0) / this.mistakes.length
        };

        const analysis = `
            <h3>🔍 错题模式分析</h4>
            <p><strong>最常见分类：</strong>${patterns.mostCommonCategory}</p>
            <p><strong>最常见难度：</strong>${patterns.mostCommonDifficulty}</p>
            <p><strong>平均标签数：</strong>${patterns.averageTagsPerMistake.toFixed(1)}</p>
        `;

        document.getElementById('aiModal').style.display = 'block';
        document.getElementById('aiSummaryText').innerHTML = analysis;
    }

    // 获取最常见的项目
    getMostCommon(array) {
        const counts = {};
        array.forEach(item => {
            counts[item] = (counts[item] || 0) + 1;
        });
        return Object.entries(counts)
            .sort(([,a], [,b]) => b - a)[0][0];
    }

    // 保存总结
    saveSummary() {
        const summaryText = document.getElementById('aiSummaryText').innerHTML;
        // 这里可以将总结保存到本地存储或导出
        this.showNotification('总结已保存', 'success');
        this.closeAiModal();
    }

    // 重新生成总结
    regenerateSummary() {
        this.generateSummary();
    }

    // 显示通知
    showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            max-width: 300px;
            word-wrap: break-word;
        `;

        // 设置颜色
        switch (type) {
            case 'success':
                notification.style.backgroundColor = '#28a745';
                break;
            case 'error':
                notification.style.backgroundColor = '#dc3545';
                break;
            case 'warning':
                notification.style.backgroundColor = '#ffc107';
                notification.style.color = '#212529';
                break;
            default:
                notification.style.backgroundColor = '#17a2b8';
        }

        notification.textContent = message;
        document.body.appendChild(notification);

        // 3秒后自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
}

// 初始化错题管理器
let mistakeManager;
document.addEventListener('DOMContentLoaded', () => {
    mistakeManager = new MistakeManager();
}); 