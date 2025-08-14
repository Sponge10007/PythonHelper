// 错题管理器 JavaScript
class MistakeManager {
    constructor() {
        this.mistakes = [];
        this.pptFiles = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.selectedMistakes = new Set();
        this.filteredMistakes = [];
        this.currentFilters = {
            search: '',
            tags: new Set()
        };
        this.currentMode = 'mistake'; // 'mistake' 或 'ppt'
        this.lessonTags = [
            '第一课：Python基础入门',
            '第二课：变量和数据类型',
            '第三课：控制流程',
            '第四课：函数定义',
            '第五课：数据结构',
            '第六课：面向对象编程',
            '第七课：文件操作',
            '第八课：异常处理',
            '第九课：模块和包',
            '第十课：项目实战'
        ];
        
        this.init();
    }

    // 初始化
    async init() {
        await this.loadMistakes();
        await this.loadPPTFiles();
        this.bindEvents();
        this.updateUI();
        this.updateTagFilter();
    }

    // 绑定事件
    bindEvents() {
        // 模式切换
        document.getElementById('mistakeModeBtn').addEventListener('click', () => this.switchMode('mistake'));
        document.getElementById('pptModeBtn').addEventListener('click', () => this.switchMode('ppt'));

        // 搜索和筛选
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.currentFilters.search = e.target.value;
            this.filterMistakes();
        });

        // 工具栏按钮
        document.getElementById('selectAll').addEventListener('click', () => this.selectAll());
        document.getElementById('deselectAll').addEventListener('click', () => this.deselectAll());
        document.getElementById('batchDelete').addEventListener('click', () => this.batchDelete());
        document.getElementById('addTag').addEventListener('click', () => this.showTagModal());

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

        // 针对训练按钮
        document.getElementById('startTraining').addEventListener('click', () => this.startTraining());
        document.getElementById('trainingHistory').addEventListener('click', () => this.trainingHistory());
        document.getElementById('weaknessAnalysis').addEventListener('click', () => this.weaknessAnalysis());

        // 模拟考按钮
        document.getElementById('startExam').addEventListener('click', () => this.startExam());
        document.getElementById('examHistory').addEventListener('click', () => this.examHistory());
        document.getElementById('scoreAnalysis').addEventListener('click', () => this.scoreAnalysis());

        // PPT文件上传
        document.getElementById('pptFileInput').addEventListener('change', (e) => this.handlePPTUpload(e));

        // 模态框
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal());
        document.getElementById('closeTagModal').addEventListener('click', () => this.closeTagModal());
        document.getElementById('closeAiModal').addEventListener('click', () => this.closeAiModal());
        document.getElementById('saveMistake').addEventListener('click', () => this.saveMistake());
        document.getElementById('cancelEdit').addEventListener('click', () => this.closeModal());
        document.getElementById('saveSummary').addEventListener('click', () => this.saveSummary());
        document.getElementById('regenerateSummary').addEventListener('click', () => this.regenerateSummary());

        // 标签管理
        document.getElementById('addNewTag').addEventListener('click', () => this.addNewTag());
        document.getElementById('deleteTag').addEventListener('click', () => this.deleteSelectedTag());
        document.getElementById('cancelTagEdit').addEventListener('click', () => this.closeTagModal());

        // 点击模态框外部关闭
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal();
                this.closeTagModal();
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

    // 切换模式
    switchMode(mode) {
        this.currentMode = mode;
        
        // 更新导航按钮状态
        document.getElementById('mistakeModeBtn').classList.toggle('active', mode === 'mistake');
        document.getElementById('pptModeBtn').classList.toggle('active', mode === 'ppt');
        
        // 更新侧边栏内容
        document.getElementById('mistakeModeSidebar').classList.toggle('active', mode === 'mistake');
        document.getElementById('pptModeSidebar').classList.toggle('active', mode === 'ppt');
        
        // 更新主内容区域
        document.getElementById('mistakeModeContent').classList.toggle('active', mode === 'mistake');
        document.getElementById('pptModeContent').classList.toggle('active', mode === 'ppt');
        
        // 更新页面标题
        document.title = mode === 'mistake' ? 
            'Python课程AI教学助手 - 错题管理器' : 
            'Python课程AI教学助手 - PPT管理器';
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
                console.log(`已加载 ${this.mistakes.length} 个错题`);
            } else {
                console.warn('从后端加载错题失败，使用本地存储');
                this.loadMistakesFromStorage();
            }
        } catch (error) {
            console.warn('网络错误，使用本地存储:', error);
            this.loadMistakesFromStorage();
        }
        
        this.filteredMistakes = [...this.mistakes];
        this.updateTagFilter();
    }

    // 加载PPT文件
    async loadPPTFiles() {
        try {
            const stored = localStorage.getItem('pptFiles');
            if (stored) {
                this.pptFiles = JSON.parse(stored);
                console.log(`已加载 ${this.pptFiles.length} 个PPT文件`);
            }
        } catch (error) {
            console.error('加载PPT文件失败:', error);
            this.pptFiles = [];
        }
        this.updatePPTUI();
    }

    // 从本地存储加载错题
    loadMistakesFromStorage() {
        try {
            const stored = localStorage.getItem('mistakes');
            if (stored) {
                this.mistakes = JSON.parse(stored);
                console.log(`从本地存储加载了 ${this.mistakes.length} 个错题`);
            }
        } catch (error) {
            console.error('从本地存储加载错题失败:', error);
            this.mistakes = [];
        }
    }

    // 更新标签筛选器
    updateTagFilter() {
        const tagFilter = document.getElementById('tagFilter');
        if (!tagFilter) return;

        tagFilter.innerHTML = '';
        
        // 添加"全部"选项
        const allTag = document.createElement('div');
        allTag.className = 'tag-item active';
        allTag.textContent = '全部';
        allTag.addEventListener('click', () => this.filterByTag(''));
        tagFilter.appendChild(allTag);

        // 添加课程标签
        this.lessonTags.forEach(tag => {
            const tagElement = document.createElement('div');
            tagElement.className = 'tag-item';
            tagElement.textContent = tag;
            tagElement.addEventListener('click', () => this.filterByTag(tag));
            tagFilter.appendChild(tagElement);
        });
    }

    // 按标签筛选
    filterByTag(tag) {
        // 更新标签状态
        document.querySelectorAll('#tagFilter .tag-item').forEach(item => {
            item.classList.toggle('active', item.textContent === (tag || '全部'));
        });

        // 更新筛选器
        if (tag) {
            this.currentFilters.tags.add(tag);
        } else {
            this.currentFilters.tags.clear();
        }

        this.filterMistakes();
    }

    // 筛选错题
    filterMistakes() {
        this.filteredMistakes = this.mistakes.filter(mistake => {
            // 搜索筛选
            if (this.currentFilters.search) {
                const searchLower = this.currentFilters.search.toLowerCase();
                const contentMatch = mistake.content.toLowerCase().includes(searchLower);
                const titleMatch = mistake.title.toLowerCase().includes(searchLower);
                const answerMatch = mistake.answer.toLowerCase().includes(searchLower);
                
                if (!contentMatch && !titleMatch && !answerMatch) {
                    return false;
                }
            }

            // 标签筛选
            if (this.currentFilters.tags.size > 0) {
                const hasMatchingTag = Array.from(this.currentFilters.tags).some(tag => 
                    mistake.tags && mistake.tags.includes(tag)
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
        switch (sortBy) {
            case 'date':
                this.filteredMistakes.sort((a, b) => new Date(b.date) - new Date(a.date));
                break;
            case 'category':
                this.filteredMistakes.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
                break;
            case 'difficulty':
                const difficultyOrder = { '简单': 1, '中等': 2, '困难': 3 };
                this.filteredMistakes.sort((a, b) => 
                    (difficultyOrder[a.difficulty] || 0) - (difficultyOrder[b.difficulty] || 0)
                );
                break;
            case 'lesson':
                this.filteredMistakes.sort((a, b) => {
                    const aTag = a.tags ? a.tags.find(tag => this.lessonTags.includes(tag)) : '';
                    const bTag = b.tags ? b.tags.find(tag => this.lessonTags.includes(tag)) : '';
                    return aTag.localeCompare(bTag);
                });
                break;
        }
        this.updateUI();
    }

    // 更新UI
    updateUI() {
        this.updateMistakeList();
        this.updateStats();
        this.updatePagination();
    }

    // 更新错题列表
    updateMistakeList() {
        const mistakeList = document.getElementById('mistakeList');
        if (!mistakeList) return;

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageMistakes = this.filteredMistakes.slice(startIndex, endIndex);

        mistakeList.innerHTML = '';

        if (pageMistakes.length === 0) {
            mistakeList.innerHTML = `
                <div class="no-mistakes">
                    ${this.currentFilters.search || this.currentFilters.tags.size > 0 ? 
                        '没有找到匹配的错题' : '暂无错题记录'}
                </div>
            `;
            return;
        }

        pageMistakes.forEach(mistake => {
            const mistakeElement = this.createMistakeElement(mistake);
            mistakeList.appendChild(mistakeElement);
        });
    }

    // 创建错题元素
    createMistakeElement(mistake) {
        const div = document.createElement('div');
        div.className = 'mistake-item';
        
        const lessonTag = mistake.tags ? mistake.tags.find(tag => this.lessonTags.includes(tag)) : '';
        
        div.innerHTML = `
            <div class="mistake-header">
                <div>
                    <div class="mistake-title">${mistake.title}</div>
                    <div class="mistake-meta">
                        <span>分类: ${mistake.category || '未分类'}</span>
                        <span>难度: ${mistake.difficulty || '未设置'}</span>
                        <span>日期: ${new Date(mistake.date).toLocaleDateString()}</span>
                        ${lessonTag ? `<span>课程: ${lessonTag}</span>` : ''}
                    </div>
                </div>
                <input type="checkbox" class="mistake-checkbox" data-mistake-id="${mistake.id}">
            </div>
            <div class="mistake-content">${mistake.content}</div>
            <div class="mistake-answer">${mistake.answer}</div>
            ${mistake.tags && mistake.tags.length > 0 ? `
                <div class="mistake-tags">
                    ${mistake.tags.map(tag => `<span class="mistake-tag">${tag}</span>`).join('')}
                </div>
            ` : ''}
            <div class="mistake-actions">
                <button class="edit-mistake-btn btn-secondary" data-mistake-id="${mistake.id}">编辑</button>
                <button class="delete-mistake-btn btn-danger" data-mistake-id="${mistake.id}">删除</button>
            </div>
        `;

        return div;
    }

    // 转义HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 切换选择状态
    toggleSelection(mistakeId) {
        if (this.selectedMistakes.has(mistakeId)) {
            this.selectedMistakes.delete(mistakeId);
        } else {
            this.selectedMistakes.add(mistakeId);
        }
        this.updateBatchDeleteButton();
    }

    // 全选
    selectAll() {
        const checkboxes = document.querySelectorAll('.mistake-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            this.selectedMistakes.add(parseInt(checkbox.dataset.mistakeId));
        });
        this.updateBatchDeleteButton();
    }

    // 取消全选
    deselectAll() {
        const checkboxes = document.querySelectorAll('.mistake-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        this.selectedMistakes.clear();
        this.updateBatchDeleteButton();
    }

    // 更新批量删除按钮状态
    updateBatchDeleteButton() {
        const batchDeleteBtn = document.getElementById('batchDelete');
        if (batchDeleteBtn) {
            batchDeleteBtn.disabled = this.selectedMistakes.size === 0;
        }
    }

    // 批量删除
    batchDelete() {
        if (this.selectedMistakes.size === 0) return;
        
        if (confirm(`确定要删除选中的 ${this.selectedMistakes.size} 个错题吗？`)) {
            this.mistakes = this.mistakes.filter(mistake => 
                !this.selectedMistakes.has(mistake.id)
            );
            this.selectedMistakes.clear();
            this.filterMistakes();
            this.saveMistakes();
            this.updateBatchDeleteButton();
        }
    }

    // 删除单个错题
    async deleteMistake(mistakeId) {
        if (confirm('确定要删除这个错题吗？')) {
            try {
                // 调用后端删除API
                const response = await fetch(`http://localhost:5000/mistakes/${mistakeId}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    // 从本地数组中移除
                    this.mistakes = this.mistakes.filter(mistake => mistake.id !== mistakeId);
                    this.selectedMistakes.delete(mistakeId);
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
    editMistake(mistakeId) {
        const mistake = this.mistakes.find(m => m.id === mistakeId);
        if (!mistake) return;

        document.getElementById('editTitle').value = mistake.title || '';
        document.getElementById('editContent').value = mistake.content || '';
        document.getElementById('editAnswer').value = mistake.answer || '';
        document.getElementById('editCategory').value = mistake.category || '';
        document.getElementById('editDifficulty').value = mistake.difficulty || '';
        
        // 设置课程标签
        const lessonTag = mistake.tags ? mistake.tags.find(tag => this.lessonTags.includes(tag)) : '';
        document.getElementById('editLesson').value = lessonTag;

        document.getElementById('modal').classList.add('active');
        this.editingMistakeId = mistakeId;
    }

    // 保存错题
    saveMistake() {
        const title = document.getElementById('editTitle').value.trim();
        const content = document.getElementById('editContent').value.trim();
        const answer = document.getElementById('editAnswer').value.trim();
        const category = document.getElementById('editCategory').value;
        const difficulty = document.getElementById('editDifficulty').value;
        const lesson = document.getElementById('editLesson').value;

        if (!title || !content || !answer) {
            alert('请填写完整的错题信息');
            return;
        }

        const mistakeData = {
            title,
            content,
            answer,
            category,
            difficulty,
            tags: lesson ? [lesson] : []
        };

        if (this.editingMistakeId) {
            // 编辑现有错题
            const index = this.mistakes.findIndex(m => m.id === this.editingMistakeId);
            if (index !== -1) {
                this.mistakes[index] = { ...this.mistakes[index], ...mistakeData };
            }
        } else {
            // 添加新错题
            const newMistake = {
                id: Date.now(),
                ...mistakeData,
                date: new Date().toISOString()
            };
            this.mistakes.push(newMistake);
        }

        this.saveMistakes();
        this.filterMistakes();
        this.closeModal();
    }

    // 关闭模态框
    closeModal() {
        document.getElementById('modal').classList.remove('active');
        this.editingMistakeId = null;
        
        // 清空表单
        document.getElementById('editTitle').value = '';
        document.getElementById('editContent').value = '';
        document.getElementById('editAnswer').value = '';
        document.getElementById('editCategory').value = '';
        document.getElementById('editDifficulty').value = '';
        document.getElementById('editLesson').value = '';
    }

    // 关闭AI模态框
    closeAiModal() {
        document.getElementById('aiModal').classList.remove('active');
    }

    // 更新统计信息
    updateStats() {
        const totalMistakes = document.getElementById('totalMistakes');
        const taggedMistakes = document.getElementById('taggedMistakes');
        const aiSummarized = document.getElementById('totalPPTs');
        const totalSlides = document.getElementById('totalSlides');

        if (totalMistakes) totalMistakes.textContent = this.mistakes.length;
        if (taggedMistakes) {
            const taggedCount = this.mistakes.filter(m => m.tags && m.tags.length > 0).length;
            taggedMistakes.textContent = taggedCount;
        }
        if (aiSummarized) aiSummarized.textContent = this.pptFiles.length;
        if (totalSlides) {
            const totalSlidesCount = this.pptFiles.reduce((sum, ppt) => sum + (ppt.slides || 0), 0);
            totalSlides.textContent = totalSlidesCount;
        }
    }

    // 更新分页
    updatePagination() {
        const totalPages = Math.ceil(this.filteredMistakes.length / this.itemsPerPage);
        const pageInfo = document.getElementById('pageInfo');
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');

        if (pageInfo) pageInfo.textContent = `第 ${this.currentPage} 页，共 ${totalPages} 页`;
        if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = this.currentPage >= totalPages;
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
    showTagModal() {
        const modal = document.getElementById('tagModal');
        modal.classList.add('active');
        this.updateExistingTagsList();
    }

    // 关闭标签管理模态框
    closeTagModal() {
        const modal = document.getElementById('tagModal');
        modal.classList.remove('active');
        document.getElementById('newTagName').value = '';
    }

    // 更新现有标签列表
    updateExistingTagsList() {
        const existingTagsList = document.getElementById('existingTagsList');
        if (!existingTagsList) return;

        existingTagsList.innerHTML = '';
        
        this.lessonTags.forEach(tag => {
            const tagElement = document.createElement('div');
            tagElement.className = 'tag-item';
            tagElement.textContent = tag;
            tagElement.addEventListener('click', () => {
                existingTagsList.querySelectorAll('.tag-item').forEach(item => 
                    item.classList.remove('selected')
                );
                tagElement.classList.add('selected');
            });
            existingTagsList.appendChild(tagElement);
        });
    }

    // 添加新标签
    addNewTag() {
        const newTagName = document.getElementById('newTagName').value.trim();
        if (!newTagName) {
            alert('请输入标签名称');
            return;
        }

        if (this.lessonTags.includes(newTagName)) {
            alert('标签已存在');
            return;
        }

        this.lessonTags.push(newTagName);
        this.updateTagFilter();
        this.updateExistingTagsList();
        document.getElementById('newTagName').value = '';
        
        console.log(`已添加新标签: ${newTagName}`);
    }

    // 删除选中的标签
    deleteSelectedTag() {
        const selectedTag = document.querySelector('#existingTagsList .tag-item.selected');
        if (!selectedTag) {
            alert('请先选择要删除的标签');
            return;
        }

        const tagName = selectedTag.textContent;
        if (confirm(`确定要删除标签"${tagName}"吗？`)) {
            this.lessonTags = this.lessonTags.filter(tag => tag !== tagName);
            this.updateTagFilter();
            this.updateExistingTagsList();
            
            console.log(`已删除标签: ${tagName}`);
        }
    }

    // 针对训练功能
    startTraining() {
        alert('针对训练功能开发中...\n将根据错题分析结果，生成个性化训练计划');
    }

    trainingHistory() {
        alert('训练历史功能开发中...\n将显示用户的训练记录和进度');
    }

    weaknessAnalysis() {
        alert('薄弱点分析功能开发中...\n将分析用户在哪些知识点上容易出错');
    }

    // 模拟考功能
    startExam() {
        alert('模拟考功能开发中...\n将根据错题生成模拟考试题目');
    }

    examHistory() {
        alert('考试历史功能开发中...\n将显示用户的考试记录和成绩');
    }

    scoreAnalysis() {
        alert('成绩分析功能开发中...\n将分析用户的考试成绩趋势和薄弱环节');
    }

    // AI功能 - 生成总结
    generateSummary() {
        alert('AI总结功能开发中...\n将使用AI分析错题并生成总结');
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
        alert('AI标签建议功能开发中...\n将使用AI为错题推荐合适的标签');
    }

    // AI功能 - 分析模式
    analyzePatterns() {
        alert('AI模式分析功能开发中...\n将使用AI分析错题的模式和规律');
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
        alert('保存AI总结功能开发中...');
        this.closeAiModal();
    }

    // 重新生成总结
    regenerateSummary() {
        alert('重新生成AI总结功能开发中...');
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

    // 处理PPT文件上传
    handlePPTUpload(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        Array.from(files).forEach(file => {
            if (this.isValidPPTFile(file)) {
                this.addPPTFile(file);
            } else {
                alert(`文件 ${file.name} 不是有效的PPT文件`);
            }
        });

        // 清空文件输入
        event.target.value = '';
    }

    // 验证PPT文件
    isValidPPTFile(file) {
        const validTypes = [
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/pdf'
        ];
        const validExtensions = ['.ppt', '.pptx', '.pdf'];
        
        return validTypes.includes(file.type) || 
               validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    }

    // 添加PPT文件
    addPPTFile(file) {
        const pptFile = {
            id: Date.now() + Math.random(),
            name: file.name,
            size: file.size,
            type: file.type,
            uploadDate: new Date().toISOString(),
            slides: this.estimateSlides(file),
            file: file
        };

        this.pptFiles.push(pptFile);
        this.savePPTFiles();
        this.updatePPTUI();
        this.updateStats();

        console.log(`已添加PPT文件: ${file.name}`);
    }

    // 估算PPT页数
    estimateSlides(file) {
        // 简单估算，实际项目中可能需要更复杂的逻辑
        if (file.type === 'application/pdf') {
            return Math.max(1, Math.floor(file.size / 50000)); // 每50KB约1页
        } else {
            return Math.max(1, Math.floor(file.size / 100000)); // 每100KB约1页
        }
    }

    // 保存PPT文件到本地存储
    savePPTFiles() {
        try {
            // 注意：这里只保存元数据，不保存实际文件内容
            const pptData = this.pptFiles.map(ppt => ({
                id: ppt.id,
                name: ppt.name,
                size: ppt.size,
                type: ppt.type,
                uploadDate: ppt.uploadDate,
                slides: ppt.slides
            }));
            localStorage.setItem('pptFiles', JSON.stringify(pptData));
        } catch (error) {
            console.error('保存PPT文件失败:', error);
        }
    }

    // 预览PPT
    previewPPT(pptId) {
        const ppt = this.pptFiles.find(p => p.id === pptId);
        if (!ppt) return;

        // 这里可以实现PPT预览功能
        // 对于PDF文件，可以使用PDF.js
        // 对于PPT文件，可能需要转换为PDF或使用在线预览服务
        alert(`预览功能开发中...\n文件: ${ppt.name}`);
    }

    // 下载PPT
    downloadPPT(pptId) {
        const ppt = this.pptFiles.find(p => p.id === pptId);
        if (!ppt || !ppt.file) return;

        const url = URL.createObjectURL(ppt.file);
        const a = document.createElement('a');
        a.href = url;
        a.download = ppt.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // 删除PPT
    deletePPT(pptId) {
        if (confirm('确定要删除这个PPT文件吗？')) {
            this.pptFiles = this.pptFiles.filter(p => p.id !== pptId);
            this.savePPTFiles();
            this.updatePPTUI();
            this.updateStats();
        }
    }

    // 格式化文件大小
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 更新PPT UI
    updatePPTUI() {
        this.updatePPTList();
        this.updatePPTGrid();
    }

    // 更新PPT列表
    updatePPTList() {
        const pptList = document.getElementById('pptList');
        if (!pptList) return;

        pptList.innerHTML = '';
        
        if (this.pptFiles.length === 0) {
            pptList.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">暂无PPT文件</div>';
            return;
        }

        this.pptFiles.forEach(ppt => {
            const pptItem = document.createElement('div');
            pptItem.className = 'ppt-item';
            pptItem.innerHTML = `
                <span class="ppt-icon">📊</span>
                <span class="ppt-name">${ppt.name}</span>
                <div class="ppt-actions">
                    <button class="ppt-action-btn" title="预览" onclick="mistakeManager.previewPPT(${ppt.id})">👁️</button>
                    <button class="ppt-action-btn" title="删除" onclick="mistakeManager.deletePPT(${ppt.id})">🗑️</button>
                </div>
            `;
            pptList.appendChild(pptItem);
        });
    }

    // 更新PPT网格
    updatePPTGrid() {
        const pptGrid = document.getElementById('pptGrid');
        if (!pptGrid) return;

        pptGrid.innerHTML = '';
        
        if (this.pptFiles.length === 0) {
            pptGrid.innerHTML = '<div style="text-align: center; color: #999; padding: 40px;">暂无PPT文件，请上传</div>';
            return;
        }

        this.pptFiles.forEach(ppt => {
            const pptCard = document.createElement('div');
            pptCard.className = 'ppt-card';
            pptCard.innerHTML = `
                <div class="ppt-card-header">
                    <span class="ppt-card-icon">📊</span>
                    <span class="ppt-card-title">${ppt.name}</span>
                </div>
                <div class="ppt-card-info">
                    <span class="ppt-card-size">${this.formatFileSize(ppt.size)}</span>
                    <span class="ppt-card-date">${new Date(ppt.uploadDate).toLocaleDateString()}</span>
                </div>
                <div class="ppt-card-actions">
                    <button class="ppt-card-btn" onclick="mistakeManager.previewPPT(${ppt.id})">预览</button>
                    <button class="ppt-card-btn primary" onclick="mistakeManager.downloadPPT(${ppt.id})">下载</button>
                </div>
            `;
            pptGrid.appendChild(pptCard);
        });
    }
}

// 初始化错题管理器
let mistakeManager;
document.addEventListener('DOMContentLoaded', function() {
    mistakeManager = new MistakeManager();
}); 