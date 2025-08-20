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
            '数据类型及表达式',
            '复合数据类型',
            '面向对象',
            '函数',
            '流程控制',
            '文件概述',
            '异常处理'
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
        console.log('开始绑定事件...');
        
        try {
            // 模式切换
            const mistakeModeBtn = document.getElementById('mistakeModeBtn');
            const pptModeBtn = document.getElementById('pptModeBtn');
            
            if (mistakeModeBtn) {
                mistakeModeBtn.addEventListener('click', () => this.switchMode('mistake'));
                console.log('错题模式按钮事件绑定成功');
            } else {
                console.error('找不到错题模式按钮');
            }
            
            if (pptModeBtn) {
                pptModeBtn.addEventListener('click', () => this.switchMode('ppt'));
                console.log('PPT模式按钮事件绑定成功');
            } else {
                console.error('找不到PPT模式按钮');
            }

            // 搜索和筛选
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    this.currentFilters.search = e.target.value;
                    this.filterMistakes();
                });
                console.log('搜索输入框事件绑定成功');
            }

            // 工具栏按钮
            const selectAllBtn = document.getElementById('selectAll');
            const deselectAllBtn = document.getElementById('deselectAll');
            const batchDeleteBtn = document.getElementById('batchDelete');
            const addTagBtn = document.getElementById('addTag');
            
            if (selectAllBtn) {
                selectAllBtn.addEventListener('click', () => this.selectAll());
                console.log('全选按钮事件绑定成功');
            }
            if (deselectAllBtn) {
                deselectAllBtn.addEventListener('click', () => this.deselectAll());
                console.log('取消全选按钮事件绑定成功');
            }
            if (batchDeleteBtn) {
                batchDeleteBtn.addEventListener('click', () => this.batchDelete());
                console.log('批量删除按钮事件绑定成功');
            }
            if (addTagBtn) {
                addTagBtn.addEventListener('click', () => this.showTagModal());
                console.log('添加标签按钮事件绑定成功');
            }

            // 排序
            const sortBySelect = document.getElementById('sortBy');
            if (sortBySelect) {
                sortBySelect.addEventListener('change', (e) => {
                    this.sortMistakes(e.target.value);
                });
                console.log('排序选择框事件绑定成功');
            }

            // 分页
            const prevPageBtn = document.getElementById('prevPage');
            const nextPageBtn = document.getElementById('nextPage');
            
            if (prevPageBtn) {
                prevPageBtn.addEventListener('click', () => this.prevPage());
                console.log('上一页按钮事件绑定成功');
            }
            if (nextPageBtn) {
                nextPageBtn.addEventListener('click', () => this.nextPage());
                console.log('下一页按钮事件绑定成功');
            }

            // 头部按钮
            const importBtn = document.getElementById('importFromExtension');
            const exportBtn = document.getElementById('exportData');
            
            if (importBtn) {
                importBtn.addEventListener('click', () => this.importFromExtension());
                console.log('导入按钮事件绑定成功');
            }
            if (exportBtn) {
                exportBtn.addEventListener('click', () => this.exportData());
                console.log('导出按钮事件绑定成功');
            }

            // 针对训练按钮
            const startTrainingBtn = document.getElementById('startTraining');
            const trainingHistoryBtn = document.getElementById('trainingHistory');
            const weaknessAnalysisBtn = document.getElementById('weaknessAnalysis');
            
            if (startTrainingBtn) {
                startTrainingBtn.addEventListener('click', () => this.startTraining());
                console.log('开始训练按钮事件绑定成功');
            }
            if (trainingHistoryBtn) {
                trainingHistoryBtn.addEventListener('click', () => this.trainingHistory());
                console.log('训练历史按钮事件绑定成功');
            }
            if (weaknessAnalysisBtn) {
                weaknessAnalysisBtn.addEventListener('click', () => this.weaknessAnalysis());
                console.log('薄弱点分析按钮事件绑定成功');
            }

            // 模拟考按钮
            const startExamBtn = document.getElementById('startExam');
            const examHistoryBtn = document.getElementById('examHistory');
            const scoreAnalysisBtn = document.getElementById('scoreAnalysis');
            
            if (startExamBtn) {
                startExamBtn.addEventListener('click', () => this.startExam());
                console.log('开始考试按钮事件绑定成功');
            }
            if (examHistoryBtn) {
                examHistoryBtn.addEventListener('click', () => this.examHistory());
                console.log('考试历史按钮事件绑定成功');
            }
            if (scoreAnalysisBtn) {
                scoreAnalysisBtn.addEventListener('click', () => this.scoreAnalysis());
                console.log('成绩分析按钮事件绑定成功');
            }

            // PPT文件上传
            const pptFileInput = document.getElementById('pptFileInput');
            if (pptFileInput) {
                pptFileInput.addEventListener('change', (e) => this.handleDocumentUpload(e));
                console.log('PPT文件输入框事件绑定成功');
            }

            // PPT文件搜索
            const pptSearchInput = document.getElementById('pptSearchInput');
            if (pptSearchInput) {
                pptSearchInput.addEventListener('input', (e) => {
                    this.filterPPTFiles(e.target.value);
                });
                console.log('PPT搜索输入框事件绑定成功');
            }

            // PPT文件拖拽上传
            this.setupDragAndDrop();

            // 文档文件选择相关
            const selectAllPPTsBtn = document.getElementById('selectAllPPTs');
            const deselectAllPPTsBtn = document.getElementById('deselectAllPPTs');
            const batchDeletePPTsBtn = document.getElementById('batchDeletePPTs');
            const pptSortBySelect = document.getElementById('pptSortBy');
            
            if (selectAllPPTsBtn) {
                selectAllPPTsBtn.addEventListener('click', () => this.selectAllDocuments());
                console.log('PPT全选按钮事件绑定成功');
            }
            if (deselectAllPPTsBtn) {
                deselectAllPPTsBtn.addEventListener('click', () => this.deselectAllDocuments());
                console.log('PPT取消全选按钮事件绑定成功');
            }
            if (batchDeletePPTsBtn) {
                batchDeletePPTsBtn.addEventListener('click', () => this.batchDeleteDocuments());
                console.log('PPT批量删除按钮事件绑定成功');
            }
            if (pptSortBySelect) {
                pptSortBySelect.addEventListener('change', (e) => this.sortPPTFiles(e.target.value));
                console.log('PPT排序选择框事件绑定成功');
            }
            
            // 调试信息按钮
            const debugInfoBtn = document.getElementById('debugInfo');
            if (debugInfoBtn) {
                debugInfoBtn.addEventListener('click', () => this.showDebugInfo());
                console.log('调试信息按钮事件绑定成功');
            }

            // 左侧边栏PPT管理操作按钮
            const clearAllPPTsBtn = document.getElementById('clearAllPPTs');
            
            if (clearAllPPTsBtn) {
                clearAllPPTsBtn.addEventListener('click', () => this.clearAllPPTs());
                console.log('清空所有PPT按钮事件绑定成功');
            }

            console.log('所有事件绑定完成');
            
        } catch (error) {
            console.error('事件绑定过程中出现错误:', error);
        }

        // 文档文件选择事件委托
        const pptGrid = document.getElementById('pptGrid');
        if (pptGrid) {
            pptGrid.addEventListener('change', (e) => {
                if (e.target.classList.contains('ppt-card-checkbox')) {
                    this.toggleDocumentSelection(parseInt(e.target.dataset.pptId));
                }
            });
            console.log('PPT网格事件委托绑定成功');
        }

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

        // MODIFIED: Improved event delegation for PPT action buttons
        // This now handles clicks inside the button (on the icon or text)
        document.addEventListener('click', (e) => {
            const button = e.target.closest('.ppt-action-btn, .ppt-card-btn');
            if (button) {
                const pptId = parseInt(button.dataset.pptId);
                if (button.title === '预览') {
                    this.previewDocument(pptId);
                } else if (button.title === '下载') {
                    this.downloadDocument(pptId);
                }
            }
        });
    }

    // 切换模式
    switchMode(mode) {
        console.log('切换模式到:', mode);
        this.currentMode = mode;
        
        // 更新导航按钮状态
        document.getElementById('mistakeModeBtn').classList.toggle('active', mode === 'mistake');
        document.getElementById('pptModeBtn').classList.toggle('active', mode === 'ppt');
        
        // 更新侧边栏内容
        const mistakeSidebar = document.getElementById('mistakeModeSidebar');
        const pptSidebar = document.getElementById('pptModeSidebar');
        
        if (mistakeSidebar && pptSidebar) {
            mistakeSidebar.classList.toggle('active', mode === 'mistake');
            pptSidebar.classList.toggle('active', mode === 'ppt');
            console.log('侧边栏切换完成 - 错题模式:', mode === 'mistake', 'PPT模式:', mode === 'ppt');
        } else {
            console.error('找不到侧边栏元素:', { mistakeSidebar, pptSidebar });
        }
        
        // 更新主内容区域
        const mistakeContent = document.getElementById('mistakeModeContent');
        const pptContent = document.getElementById('pptModeContent');
        
        if (mistakeContent && pptContent) {
            mistakeContent.classList.toggle('active', mode === 'mistake');
            pptContent.classList.toggle('active', mode === 'ppt');
            console.log('内容区域切换完成 - 错题内容:', mode === 'mistake', 'PPT内容:', mode === 'ppt');
        } else {
            console.error('找不到内容区域元素:', { mistakeContent, pptContent });
        }
        
        // 更新页面标题
        document.title = mode === 'mistake' ? 
            'Python课程AI教学助手 - 错题管理器' : 
            'Python课程AI教学助手 - PPT管理器';
        
        // 根据模式更新UI
        if (mode === 'mistake') {
            this.updateUI();
        } else {
            this.updatePPTUI();
        }
            
        console.log('模式切换完成，当前模式:', this.currentMode);
    }

    // 加载错题数据
    async loadMistakes() {
        console.log('开始加载错题数据...');
        try {
            // 优先从后端加载数据
            console.log('尝试从后端加载错题...');
            const response = await fetch('http://localhost:5000/mistakes', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('后端响应状态:', response.status);
            console.log('后端响应头:', response.headers);
            
            if (response.ok) {
                const data = await response.json();
                console.log('后端返回的原始数据:', data);
                this.mistakes = data.mistakes || [];
                console.log(`已从后端加载 ${this.mistakes.length} 个错题:`, this.mistakes);
            } else {
                console.warn('从后端加载错题失败，状态码:', response.status);
                const errorText = await response.text();
                console.warn('错误详情:', errorText);
                console.log('使用本地存储作为备选方案');
                this.loadMistakesFromStorage();
            }
        } catch (error) {
            console.error('网络错误，详细错误信息:', error);
            console.log('使用本地存储作为备选方案');
            this.loadMistakesFromStorage();
        }
        
        // 如果没有错题数据，创建一些示例数据用于测试
        if (this.mistakes.length === 0) {
            console.log('创建示例错题数据用于测试');
            this.mistakes = [
                {
                    id: 1,
                    title: 'Python变量定义',
                    messages: [
                        { role: 'user', content: '在Python中，如何定义一个字符串变量？' },
                        { role: 'assistant', content: '使用引号定义，如：name = "Python"' }
                    ],
                    tags: ['基础语法'],
                    category: '变量',
                    difficulty: '简单',
                    date: new Date().toISOString()
                },
                {
                    id: 2,
                    title: '列表操作',
                    messages: [
                        { role: 'user', content: '如何向Python列表添加元素？' },
                        { role: 'assistant', content: '使用append()方法，如：list.append(item)' }
                    ],
                    tags: ['复合数据类型'],
                    category: '数据结构',
                    difficulty: '简单',
                    date: new Date().toISOString()
                }
            ];
        }
        
        this.filteredMistakes = [...this.mistakes];
        console.log('设置filteredMistakes:', this.filteredMistakes);
        this.updateTagFilter();
    }

    // 加载PPT文件
    async loadPPTFiles() {
        console.log('开始加载PPT文件...');
        try {
            // 优先从后端加载数据
            const response = await fetch('http://localhost:5000/ppt/files', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('PPT文件加载响应状态:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('PPT文件后端数据:', data);
                this.pptFiles = data.ppt_files || [];
                console.log(`已从后端加载 ${this.pptFiles.length} 个PPT文件`);
            } else {
                console.warn('从后端加载PPT文件失败，状态码:', response.status);
                const errorText = await response.text();
                console.warn('PPT加载错误详情:', errorText);
                console.log('使用本地存储作为备选方案');
                this.loadPPTFilesFromStorage();
            }
        } catch (error) {
            console.error('PPT文件加载网络错误:', error);
            console.log('使用本地存储作为备选方案');
            this.loadPPTFilesFromStorage();
        }
        
        // 如果没有PPT文件，创建一些示例数据用于测试
        if (this.pptFiles.length === 0) {
            console.log('创建示例PPT文件数据用于测试');
            this.pptFiles = [
                {
                    id: 1,
                    filename: 'example1.pdf',
                    original_name: 'Python基础语法.pdf',
                    file_size: 1024000,
                    file_type: 'pdf',
                    upload_date: new Date().toISOString(),
                    slides_count: 25,
                    description: 'Python基础语法课程PPT',
                    tags: ['基础语法']
                },
                {
                    id: 2,
                    filename: 'example2.pptx',
                    original_name: 'Python数据结构.pptx',
                    file_size: 2048000,
                    file_type: 'pptx',
                    upload_date: new Date().toISOString(),
                    slides_count: 30,
                    description: 'Python数据结构课程PPT',
                    tags: ['复合数据类型']
                }
            ];
        }
        
        this.updatePPTUI();
    }

    // 从本地存储加载PPT文件
    loadPPTFilesFromStorage() {
        try {
            const stored = localStorage.getItem('pptFiles');
            if (stored) {
                this.pptFiles = JSON.parse(stored);
                
                // 确保所有文件都有正确的文件名字段
                this.pptFiles.forEach(ppt => {
                    if (!ppt.original_name) {
                        ppt.original_name = ppt.name;
                    }
                });
                
                console.log(`从本地存储加载了 ${this.pptFiles.length} 个PPT文件`);
            }
        } catch (error) {
            console.error('从本地存储加载PPT文件失败:', error);
            this.pptFiles = [];
        }
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
            const searchLower = this.currentFilters.search.toLowerCase();
            
            // 搜索筛选 - MODIFIED: Search in messages
            if (searchLower) {
                const titleMatch = mistake.title.toLowerCase().includes(searchLower);
                const messageMatch = mistake.messages.some(msg => msg.content.toLowerCase().includes(searchLower));
                
                if (!titleMatch && !messageMatch) {
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
        console.log('更新UI，当前错题数量:', this.mistakes.length);
        console.log('当前filteredMistakes数量:', this.filteredMistakes.length);
        this.updateMistakeList();
        this.updateStats();
        this.updatePagination();
    }

    // 更新错题列表
    updateMistakeList() {
        console.log('更新错题列表...');
        const mistakeList = document.getElementById('mistakeList');
        if (!mistakeList) {
            console.error('找不到错题列表元素');
            return;
        }

        console.log('当前页码:', this.currentPage, '每页项目数:', this.itemsPerPage);
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageMistakes = this.filteredMistakes.slice(startIndex, endIndex);
        console.log('当前页错题:', pageMistakes);

        mistakeList.innerHTML = '';

        if (pageMistakes.length === 0) {
            console.log('没有错题显示');
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

    // 创建错题元素 - MODIFIED
    createMistakeElement(mistake) {
        const div = document.createElement('div');
        div.className = 'mistake-item';
        
        const lessonTag = mistake.tags ? mistake.tags.find(tag => this.lessonTags.includes(tag)) : '';
        
        // Render messages
        const messagesHtml = (mistake.messages || []).map(msg => `
            <div class="mistake-message message-${msg.role}">
                <span class="message-role">${msg.role === 'user' ? 'You' : 'AI'}</span>
                <div class="message-content">${this.escapeHtml(msg.content)}</div>
            </div>
        `).join('');

        div.innerHTML = `
            <div class="mistake-header">
                <div>
                    <div class="mistake-title">${this.escapeHtml(mistake.title)}</div>
                    <div class="mistake-meta">
                        <span>分类: ${mistake.category || '未分类'}</span>
                        <span>难度: ${mistake.difficulty || '未设置'}</span>
                        <span>日期: ${new Date(mistake.date).toLocaleDateString()}</span>
                        ${lessonTag ? `<span>课程: ${lessonTag}</span>` : ''}
                    </div>
                </div>
                <input type="checkbox" class="mistake-checkbox" data-mistake-id="${mistake.id}">
            </div>
            <div class="mistake-conversation">${messagesHtml}</div>
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

        // 绑定编辑按钮事件
        const editBtn = div.querySelector('.edit-mistake-btn');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const mistakeId = parseInt(e.target.dataset.mistakeId);
                console.log('点击编辑按钮，错题ID:', mistakeId);
                this.editMistake(mistakeId);
            });
        }

        // 绑定删除按钮事件
        const deleteBtn = div.querySelector('.delete-mistake-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const mistakeId = parseInt(e.target.dataset.mistakeId);
                if (confirm('确定要删除这个错题吗？')) {
                    this.deleteMistake(mistakeId);
                }
            });
        }

        // 绑定复选框事件
        const checkbox = div.querySelector('.mistake-checkbox');
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                const mistakeId = parseInt(e.target.dataset.mistakeId);
                this.toggleSelection(mistakeId);
            });
        }

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
        const selectedCount = document.querySelectorAll('.mistake-checkbox:checked').length;
        
        if (batchDeleteBtn) {
            batchDeleteBtn.disabled = selectedCount === 0;
            batchDeleteBtn.textContent = `批量删除 (${selectedCount})`;
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

    // 编辑错题 - MODIFIED
    editMistake(mistakeId) {
        const mistake = this.mistakes.find(m => m.id === mistakeId);
        if (!mistake) {
            console.error('未找到错题:', mistakeId);
            return;
        }

        console.log('编辑错题数据:', mistake);

        document.getElementById('editTitle').value = mistake.title || '';
        document.getElementById('editMessages').value = JSON.stringify(mistake.messages || [], null, 2);
        document.getElementById('editCategory').value = mistake.category || '';
        document.getElementById('editDifficulty').value = mistake.difficulty || '';
        
        // 设置标签
        const lessonTag = mistake.tags ? mistake.tags.find(tag => this.lessonTags.includes(tag)) : '';
        document.getElementById('editLesson').value = lessonTag;

        document.getElementById('modal').classList.add('active');
        this.editingMistakeId = mistakeId;
        
        console.log('设置编辑表单完成，editingMistakeId:', this.editingMistakeId);
    }

    // 保存错题 - MODIFIED
    async saveMistake() {
        const title = document.getElementById('editTitle').value.trim();
        const category = document.getElementById('editCategory').value;
        const difficulty = document.getElementById('editDifficulty').value;
        const lesson = document.getElementById('editLesson').value;

        if (!title) {
            alert('请填写标题');
            return;
        }

        if (this.editingMistakeId) {
            const index = this.mistakes.findIndex(m => m.id === this.editingMistakeId);
            if (index !== -1) {
                const updatedMistake = {
                    ...this.mistakes[index],
                    title,
                    category,
                    difficulty,
                    tags: lesson ? [lesson] : [],
                };
                
                try {
                    const response = await fetch(`http://localhost:5000/mistakes/${this.editingMistakeId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updatedMistake)
                    });

                    if (response.ok) {
                        this.mistakes[index] = updatedMistake;
                        this.filterMistakes();
                        this.updateStats();
                        this.closeModal();
                        this.showNotification('保存成功', 'success');
                    } else {
                        throw new Error('保存失败');
                    }
                } catch (error) {
                    this.showNotification(`保存失败: ${error.message}`, 'error');
                }
            }
        }
    }


    // 保存错题到后端
    async saveMistakes() {
        try {
            // 调用后端保存API
            const response = await fetch('http://localhost:5000/mistakes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    mistakes: this.mistakes
                })
            });
            
            if (response.ok) {
                console.log('错题保存成功');
                this.showNotification('保存成功', 'success');
                // 同时保存到本地存储
                this.saveMistakesToStorage();
            } else {
                const errorData = await response.json();
                console.error('保存失败:', errorData);
                this.showNotification(`保存失败: ${errorData.error}`, 'error');
                // 如果后端失败，保存到本地存储
                this.saveMistakesToStorage();
            }
        } catch (error) {
            console.error('保存错题失败:', error);
            this.showNotification('保存失败: 网络错误', 'error');
            // 如果网络错误，保存到本地存储
            this.saveMistakesToStorage();
        }
    }

    // 保存错题到本地存储
    saveMistakesToStorage() {
        try {
            localStorage.setItem('mistakes', JSON.stringify(this.mistakes));
            console.log('错题已保存到本地存储');
        } catch (error) {
            console.error('保存到本地存储失败:', error);
        }
    }

    // 关闭模态框
    closeModal() {
        document.getElementById('modal').classList.remove('active');
        this.editingMistakeId = null;
        
        // 清空表单
        document.getElementById('editTitle').value = '';
        document.getElementById('editMessages').value = '';
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
        const aiSummarized = document.getElementById('aiSummarized');
        const totalPPTs = document.getElementById('totalPPTs');
        const totalSlides = document.getElementById('totalSlides');

        if (totalMistakes) totalMistakes.textContent = this.mistakes.length;
        if (taggedMistakes) {
            const taggedCount = this.mistakes.filter(m => m.tags && m.tags.length > 0).length;
            taggedMistakes.textContent = taggedCount;
        }
        if (aiSummarized) {
            const aiSummaryCount = this.mistakes.filter(m => m.aiSummary && m.aiSummary.trim()).length;
            aiSummarized.textContent = aiSummaryCount;
        }
        if (totalPPTs) totalPPTs.textContent = this.pptFiles.length;
        if (totalSlides) {
            const totalSlidesCount = this.pptFiles.reduce((sum, ppt) => sum + (ppt.slides_count || ppt.slides || 0), 0);
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

    // 处理文档文件上传
    async handleDocumentUpload(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        // 显示文件预览
        this.showFilePreview(files);

        // 显示上传进度和统计
        this.showUploadProgress();
        this.showUploadStats();
        
        // 设置初始进度和统计
        this.updateUploadProgress(0, `准备上传... 0/${files.length}`);
        this.updateUploadStats(0, 0, 0);
        
        let validFiles = 0;
        let uploadedFiles = 0;
        let failedFiles = 0;
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (this.isValidDocumentFile(file)) {
                validFiles++;
                // 更新统计
                this.updateUploadStats(validFiles, uploadedFiles, failedFiles);
                
                try {
                    const success = await this.uploadPPTFile(file);
                    if (success) {
                        uploadedFiles++;
                        // 更新进度和统计
                        this.updateUploadProgress((uploadedFiles / validFiles) * 100, `上传中... ${uploadedFiles}/${validFiles}`);
                        this.updateUploadStats(validFiles, uploadedFiles, failedFiles);
                    } else {
                        failedFiles++;
                        this.updateUploadStats(validFiles, uploadedFiles, failedFiles);
                    }
                } catch (error) {
                    console.error(`文件 ${file.name} 上传失败:`, error);
                    failedFiles++;
                    this.updateUploadStats(validFiles, uploadedFiles, failedFiles);
                }
            } else {
                console.warn(`文件 ${file.name} 不是有效的文档文件`);
                failedFiles++;
                this.updateUploadStats(validFiles, uploadedFiles, failedFiles);
            }
        }

        // 延迟隐藏上传进度和统计
        setTimeout(() => {
            this.hideUploadProgress();
            this.hideUploadStats();
        }, 3000);
        
        // 清空文件输入
        event.target.value = '';
        
        // 显示结果
        if (validFiles === 0) {
            alert('没有找到有效的文档文件');
        } else if (uploadedFiles === 0) {
            alert('所有文件上传失败');
        } else {
            alert(`成功上传 ${uploadedFiles}/${validFiles} 个文档文件`);
        }
    }

    // 显示上传进度
    showUploadProgress() {
        const progress = document.getElementById('uploadProgress');
        if (progress) {
            progress.style.display = 'block';
            // 重置进度条
            this.updateUploadProgress(0, '准备上传...');
        }
    }

    // 隐藏上传进度
    hideUploadProgress() {
        const progress = document.getElementById('uploadProgress');
        if (progress) {
            // 延迟隐藏，让用户看到完成状态
            setTimeout(() => {
                progress.style.display = 'none';
            }, 2000);
        }
    }

    // 更新上传进度
    updateUploadProgress(percentage, text) {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        if (progressFill) {
            progressFill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
            // 添加动画效果
            progressFill.style.transition = 'width 0.3s ease';
        }
        if (progressText) {
            progressText.textContent = text;
        }
        
        console.log(`上传进度: ${percentage.toFixed(1)}% - ${text}`);
    }

    // 设置拖拽上传
    setupDragAndDrop() {
        console.log('设置拖拽上传功能');
        
        const uploadArea = document.getElementById('uploadArea');
        if (!uploadArea) {
            console.error('找不到上传区域元素');
            return;
        }

        // 阻止默认拖拽行为
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        // 拖拽进入区域
        uploadArea.addEventListener('dragenter', (e) => {
            uploadArea.classList.add('drag-over');
            console.log('文件拖拽进入上传区域');
        });

        // 拖拽离开区域
        uploadArea.addEventListener('dragleave', (e) => {
            // 只有当真正离开区域时才移除样式
            if (!uploadArea.contains(e.relatedTarget)) {
                uploadArea.classList.remove('drag-over');
                console.log('文件拖拽离开上传区域');
            }
        });

        // 拖拽悬停
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        // 文件放置
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                console.log('拖拽上传文件，数量:', files.length);
                this.handleDroppedFiles(files);
            }
        });

        console.log('拖拽上传功能设置完成');
    }

    // 处理拖拽的文件
    async handleDroppedFiles(files) {
        if (!files || files.length === 0) return;

        // 显示上传进度和统计
        this.showUploadProgress();
        this.showUploadStats();
        
        // 设置初始进度和统计
        this.updateUploadProgress(0, `准备上传... 0/${files.length}`);
        this.updateUploadStats(0, 0, 0);
        
        let validFiles = 0;
        let uploadedFiles = 0;
        let failedFiles = 0;
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (this.isValidDocumentFile(file)) {
                validFiles++;
                // 更新统计
                this.updateUploadStats(validFiles, uploadedFiles, failedFiles);
                
                try {
                    const success = await this.uploadPPTFile(file);
                    if (success) {
                        uploadedFiles++;
                        // 更新进度和统计
                        this.updateUploadProgress((uploadedFiles / validFiles) * 100, `上传中... ${uploadedFiles}/${validFiles}`);
                        this.updateUploadStats(validFiles, uploadedFiles, failedFiles);
                    } else {
                        failedFiles++;
                        this.updateUploadStats(validFiles, uploadedFiles, failedFiles);
                    }
                } catch (error) {
                    console.error(`文件 ${file.name} 上传失败:`, error);
                    failedFiles++;
                    this.updateUploadStats(validFiles, uploadedFiles, failedFiles);
                }
            } else {
                console.warn(`文件 ${file.name} 不是有效的文档文件`);
                failedFiles++;
                this.updateUploadStats(validFiles, uploadedFiles, failedFiles);
            }
        }

        // 延迟隐藏上传进度和统计
        setTimeout(() => {
            this.hideUploadProgress();
            this.hideUploadStats();
        }, 3000);
        
        // 显示结果
        if (validFiles === 0) {
            alert('没有找到有效的文档文件');
        } else if (uploadedFiles === 0) {
            alert('所有文件上传失败');
        } else {
            alert(`成功上传 ${uploadedFiles}/${validFiles} 个文档文件`);
        }
    }

    // 更新PPT UI
    updatePPTUI() {
        console.log('更新PPT UI，当前PPT文件数量:', this.pptFiles.length);
        this.updatePPTList();
        this.updatePPTGrid();
        this.updatePPTStats();
    }

    // 更新PPT统计信息
    updatePPTStats() {
        const totalPPTs = document.getElementById('totalPPTs');
        const totalSlides = document.getElementById('totalSlides');
        
        if (totalPPTs) {
            totalPPTs.textContent = this.pptFiles.length;
            console.log('更新PPT总数:', this.pptFiles.length);
        }
        if (totalSlides) {
            const totalSlidesCount = this.pptFiles.reduce((sum, ppt) => sum + (ppt.slides_count || ppt.slides || 0), 0);
            totalSlides.textContent = totalSlidesCount;
            console.log('更新PPT总页数:', totalSlidesCount);
        }
    }

    // 筛选PPT文件
    filterPPTFiles(searchTerm) {
        console.log('筛选PPT文件，搜索词:', searchTerm);
        const searchLower = searchTerm.toLowerCase();
        const filteredFiles = this.pptFiles.filter(ppt => {
            const fileName = (ppt.original_name || ppt.name || '').toLowerCase();
            const fileType = (ppt.file_type || ppt.type || '').toLowerCase();
            const description = (ppt.description || '').toLowerCase();
            return fileName.includes(searchLower) || fileType.includes(searchLower) || description.includes(searchLower);
        });
        
        console.log('筛选结果:', filteredFiles.length, '个文件');
        this.updatePPTList(filteredFiles);
        this.updatePPTGrid(filteredFiles);
    }

    // 更新PPT列表
    updatePPTList(files = null) {
        const pptList = document.getElementById('pptList');
        if (!pptList) {
            console.warn('找不到PPT列表元素');
            return;
        }

        const displayFiles = files || this.pptFiles;
        console.log('更新PPT列表，显示文件数量:', displayFiles.length);
        pptList.innerHTML = '';
        
        if (displayFiles.length === 0) {
            pptList.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">暂无PPT文件</div>';
            return;
        }

        displayFiles.forEach(ppt => {
            const pptItem = document.createElement('div');
            pptItem.className = 'ppt-item';
            pptItem.innerHTML = `
                <span class="ppt-icon">📊</span>
                <span class="ppt-name">${ppt.original_name || ppt.name || '未命名文件'}</span>
                <div class="ppt-item-actions">
                    <button class="ppt-action-btn" title="下载" data-ppt-id="${ppt.id}">⬇️</button>
                </div>
            `;
            pptList.appendChild(pptItem);
        });
    }

    // 更新PPT网格
    updatePPTGrid(files = null) {
        const pptGrid = document.getElementById('pptGrid');
        if (!pptGrid) {
            console.error('找不到PPT网格元素');
            return;
        }

        const displayFiles = files || this.pptFiles;
        console.log('更新PPT网格，显示文件数量:', displayFiles.length);
        pptGrid.innerHTML = '';
        
        if (displayFiles.length === 0) {
            pptGrid.innerHTML = '<div style="text-align: center; color: #999; padding: 40px;">暂无PPT文件，请上传</div>';
            return;
        }

        displayFiles.forEach(ppt => {
            const pptCard = document.createElement('div');
            pptCard.className = 'ppt-card';
            pptCard.dataset.pptId = ppt.id;
            
            // 获取文件信息，优先使用后端数据
            const fileName = ppt.original_name || ppt.name || '未命名文件';
            const fileSize = ppt.file_size || ppt.size || 0;
            const uploadDate = ppt.upload_date || ppt.uploadDate || new Date().toISOString();
            const slidesCount = ppt.slides_count || ppt.slides || 0;
            const fileType = ppt.file_type || ppt.type || 'unknown';
            const description = ppt.description || '';
            
            // 根据文件类型选择图标
            const getFileIcon = (fileType) => {
                switch (fileType.toLowerCase()) {
                    case 'ppt':
                    case 'pptx':
                        return '📊';
                    case 'doc':
                    case 'docx':
                        return '📄';
                    case 'pdf':
                        return '📕';
                    default:
                        return '📁';
                }
            };
            
            // 格式化文件大小
            const formatFileSize = (bytes) => {
                if (bytes === 0) return '0 Bytes';
                const k = 1024;
                const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
            };
            
            // 格式化日期
            const formatDate = (dateString) => {
                try {
                    const date = new Date(dateString);
                    return date.toLocaleDateString('zh-CN');
                } catch (e) {
                    return '未知日期';
                }
            };
            
            // MODIFIED: Added specific classes for button coloring
            pptCard.innerHTML = `
                <input type="checkbox" class="ppt-card-checkbox" data-ppt-id="${ppt.id}">
                <div class="ppt-card-header">
                    <span class="ppt-card-icon">${getFileIcon(fileType)}</span>
                    <div class="ppt-card-info">
                        <div class="ppt-card-title">${fileName}</div>
                        <div class="ppt-card-meta">
                            <span>类型: ${fileType.toUpperCase()}</span>
                            <span>大小: ${formatFileSize(fileSize)}</span>
                            <span>页数: ${slidesCount}</span>
                            <span>上传: ${formatDate(uploadDate)}</span>
                        </div>
                        ${description ? `<div class="ppt-card-description">${description}</div>` : ''}
                    </div>
                </div>
                <div class="ppt-card-actions">
                    <button class="ppt-card-btn btn-preview" title="预览" data-ppt-id="${ppt.id}">👁️ 预览</button>
                    <button class="ppt-card-btn btn-download" title="下载" data-ppt-id="${ppt.id}">⬇️ 下载</button>
                </div>
            `;
            
            pptGrid.appendChild(pptCard);
        });
        
        console.log('PPT网格更新完成');
    }

    // 预览文档
    async previewDocument(pptId) {
        console.log('预览文档，ID:', pptId);
        try {
            const response = await fetch(`http://localhost:5000/ppt/files/${pptId}/preview`, {
                method: 'GET'
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success') {
                    alert(`预览信息: ${data.message}\n\n建议: ${data.suggestion || '请下载后查看'}`);
                } else {
                    // 如果是PDF文件，直接在新窗口打开
                    const ppt = this.pptFiles.find(p => p.id === pptId);
                    if (ppt && ppt.file_type === 'pdf') {
                        window.open(`http://localhost:5000/ppt/files/${pptId}/preview`, '_blank');
                    } else {
                        alert('预览功能开发中，请下载后查看');
                    }
                }
            } else {
                alert('预览失败，请稍后重试');
            }
        } catch (error) {
            console.error('预览文档失败:', error);
            alert('预览失败，请检查网络连接');
        }
    }

    // 下载文档
    async downloadDocument(pptId) {
        console.log('下载文档，ID:', pptId);
        try {
            const ppt = this.pptFiles.find(p => p.id === pptId);
            if (!ppt) {
                alert('文档不存在');
                return;
            }
            
            console.log('找到PPT文件:', ppt);
            
            // 显示下载状态
            this.showDownloadStatus(`正在下载 ${ppt.original_name || ppt.name || 'document'}...`, 'info');
            
            // 构建下载URL
            const downloadUrl = `http://localhost:5000/ppt/files/${pptId}/download`;
            console.log('下载URL:', downloadUrl);
            
            // 使用fetch API下载文件
            const response = await fetch(downloadUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            // 获取文件blob
            const blob = await response.blob();
            console.log('文件下载完成，大小:', blob.size, '字节');
            
            // 创建下载链接
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = ppt.original_name || ppt.name || 'document';
            
            // 触发下载
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // 清理blob URL
            window.URL.revokeObjectURL(url);
            
            console.log('下载已开始');
            this.showDownloadStatus(`${ppt.original_name || ppt.name || 'document'} 下载完成！`, 'success');
            
        } catch (error) {
            console.error('下载文档失败:', error);
            this.showDownloadStatus(`下载失败: ${error.message}`, 'error');
        }
    }

    // 删除文档
    async deleteDocument(pptId) {
        console.log('删除文档，ID:', pptId);
        if (!confirm('确定要删除这个文档吗？此操作不可恢复。')) {
            return;
        }
        
        try {
            const response = await fetch(`http://localhost:5000/ppt/files/${pptId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                // 从本地数组中移除
                this.pptFiles = this.pptFiles.filter(p => p.id !== pptId);
                this.updatePPTUI();
                alert('文档删除成功');
            } else {
                const errorData = await response.json();
                alert(`删除失败: ${errorData.error || '未知错误'}`);
            }
        } catch (error) {
            console.error('删除文档失败:', error);
            alert('删除失败，请检查网络连接');
        }
    }

    // 显示调试信息
    showDebugInfo() {
        console.log('=== 调试信息 ===');
        console.log('当前模式:', this.currentMode);
        console.log('错题数量:', this.mistakes.length);
        console.log('PPT文件数量:', this.pptFiles.length);
        console.log('筛选后的错题数量:', this.filteredMistakes.length);
        console.log('选中的错题:', Array.from(this.selectedMistakes));
        console.log('当前页码:', this.currentPage);
        console.log('每页项目数:', this.itemsPerPage);
        
        // 检查DOM元素
        const elements = {
            '错题模式按钮': document.getElementById('mistakeModeBtn'),
            'PPT模式按钮': document.getElementById('pptModeBtn'),
            '错题侧边栏': document.getElementById('mistakeModeSidebar'),
            'PPT侧边栏': document.getElementById('pptModeSidebar'),
            '错题内容': document.getElementById('mistakeModeContent'),
            'PPT内容': document.getElementById('pptModeContent'),
            '错题列表': document.getElementById('mistakeList'),
            'PPT网格': document.getElementById('pptGrid')
        };
        
        console.log('DOM元素状态:', elements);
        
        alert('调试信息已输出到控制台，请按F12查看');
    }

    // 添加缺失的函数实现
    importFromExtension() {
        console.log('导入功能被调用');
        alert('导入功能开发中，敬请期待');
    }

    exportData() {
        console.log('导出功能被调用');
        alert('导出功能开发中，敬请期待');
    }

    startTraining() {
        console.log('开始训练功能被调用');
        alert('训练功能开发中，敬请期待');
    }

    trainingHistory() {
        console.log('训练历史功能被调用');
        alert('训练历史功能开发中，敬请期待');
    }

    weaknessAnalysis() {
        console.log('薄弱点分析功能被调用');
        alert('薄弱点分析功能开发中，敬请期待');
    }

    startExam() {
        console.log('开始考试功能被调用');
        alert('考试功能开发中，敬请期待');
    }

    examHistory() {
        console.log('考试历史功能被调用');
        alert('考试历史功能开发中，敬请期待');
    }

    scoreAnalysis() {
        console.log('成绩分析功能被调用');
        alert('成绩分析功能开发中，敬请期待');
    }

    showTagModal() {
        console.log('显示标签管理模态框');
        const tagModal = document.getElementById('tagModal');
        if (tagModal) {
            tagModal.classList.add('active');
        }
    }

    closeTagModal() {
        const tagModal = document.getElementById('tagModal');
        if (tagModal) {
            tagModal.classList.remove('active');
        }
    }

    addNewTag() {
        const newTagInput = document.getElementById('newTagName');
        if (newTagInput && newTagInput.value.trim()) {
            const newTag = newTagInput.value.trim();
            if (!this.lessonTags.includes(newTag)) {
                this.lessonTags.push(newTag);
                this.updateTagFilter();
                newTagInput.value = '';
                alert(`标签"${newTag}"添加成功`);
            } else {
                alert('标签已存在');
            }
        } else {
            alert('请输入标签名称');
        }
    }

    deleteSelectedTag() {
        // 这里可以实现删除选中标签的逻辑
        alert('删除标签功能开发中');
    }

    selectAllDocuments() {
        console.log('全选PPT文档');
        const checkboxes = document.querySelectorAll('.ppt-card-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
        });
        this.updatePPTBatchDeleteButton();
    }

    deselectAllDocuments() {
        console.log('取消全选PPT文档');
        const checkboxes = document.querySelectorAll('.ppt-card-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        this.updatePPTBatchDeleteButton();
    }

    batchDeleteDocuments() {
        const selectedCheckboxes = document.querySelectorAll('.ppt-card-checkbox:checked');
        if (selectedCheckboxes.length === 0) {
            alert('请先选择要删除的文档');
            return;
        }
        
        if (confirm(`确定要删除选中的 ${selectedCheckboxes.length} 个文档吗？此操作不可恢复。`)) {
            console.log('开始批量删除PPT文档，数量:', selectedCheckboxes.length);
            
            // 获取选中的PPT ID列表
            const selectedIds = Array.from(selectedCheckboxes).map(checkbox => 
                parseInt(checkbox.dataset.pptId)
            );
            
            // 执行批量删除
            this.executeBatchDelete(selectedIds);
        }
    }

    // 执行批量删除
    async executeBatchDelete(pptIds) {
        console.log('执行批量删除，ID列表:', pptIds);
        
        try {
            // 使用批量删除API
            const response = await fetch('http://localhost:5000/ppt/files/batch-delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ppt_ids: pptIds })
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('批量删除结果:', result);
                
                // 从本地数组中移除成功删除的文件
                this.pptFiles = this.pptFiles.filter(p => !pptIds.includes(p.id));
                
                // 更新UI
                this.updatePPTUI();
                this.updatePPTStats();
                this.updatePPTBatchDeleteButton();
                
                // 显示删除结果
                if (result.fail_count === 0) {
                    alert(`批量删除完成！成功删除 ${result.success_count} 个文档。`);
                } else {
                    alert(`批量删除完成！成功删除 ${result.success_count} 个文档，失败 ${result.fail_count} 个。`);
                }
                
            } else {
                const errorData = await response.json();
                console.error('批量删除失败:', errorData);
                alert(`批量删除失败: ${errorData.error || '未知错误'}`);
            }
            
        } catch (error) {
            console.error('批量删除过程中发生错误:', error);
            alert('批量删除过程中发生错误，请检查网络连接');
        }
    }

    sortPPTFiles(sortBy) {
        console.log('PPT文件排序:', sortBy);
        // 实现排序逻辑
        alert('排序功能开发中');
    }

    toggleDocumentSelection(pptId) {
        console.log('切换PPT文档选择状态:', pptId);
        
        // 更新选中状态
        const checkbox = document.querySelector(`.ppt-card-checkbox[data-ppt-id="${pptId}"]`);
        if (checkbox) {
            const isSelected = checkbox.checked;
            console.log(`PPT文档 ${pptId} 选择状态:`, isSelected);
            
            // 更新批量删除按钮状态
            this.updatePPTBatchDeleteButton();
        }
    }

    updateBatchDeleteButton() {
        const batchDeleteBtn = document.getElementById('batchDelete');
        const selectedCount = document.querySelectorAll('.mistake-checkbox:checked').length;
        
        if (batchDeleteBtn) {
            batchDeleteBtn.disabled = selectedCount === 0;
            batchDeleteBtn.textContent = `批量删除 (${selectedCount})`;
        }
    }

    // 更新PPT批量删除按钮状态
    updatePPTBatchDeleteButton() {
        const batchDeletePPTsBtn = document.getElementById('batchDeletePPTs');
        const selectedCount = document.querySelectorAll('.ppt-card-checkbox:checked').length;
        
        if (batchDeletePPTsBtn) {
            batchDeletePPTsBtn.disabled = selectedCount === 0;
            batchDeletePPTsBtn.textContent = `批量删除 (${selectedCount})`;
        }
    }



    // 验证PPT文件
    isValidDocumentFile(file) {
        // 支持的文件类型
        const validTypes = [
            'application/vnd.ms-powerpoint',                                    // .ppt
            'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
            'application/msword',                                               // .doc
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
            'application/pdf'                                                   // .pdf
        ];
        
        // 支持的文件扩展名
        const validExtensions = ['.ppt', '.pptx', '.doc', '.docx', '.pdf'];
        
        // 检查文件大小（限制为100MB）
        const maxSize = 100 * 1024 * 1024; // 100MB
        if (file.size > maxSize) {
            console.warn(`文件 ${file.name} 过大: ${(file.size / 1024 / 1024).toFixed(2)}MB，最大支持100MB`);
            return false;
        }
        
        // 检查文件类型
        const isValidType = validTypes.includes(file.type) || 
                           validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
        
        if (!isValidType) {
            console.warn(`文件 ${file.name} 类型不支持: ${file.type}`);
        }
        
        return isValidType;
    }

    // 获取文件类型描述
    getFileTypeDescription(file) {
        const extension = file.name.toLowerCase().split('.').pop();
        const typeMap = {
            'ppt': 'PowerPoint 97-2003',
            'pptx': 'PowerPoint 2007+',
            'doc': 'Word 97-2003',
            'docx': 'Word 2007+',
            'pdf': 'PDF文档'
        };
        return typeMap[extension] || '未知类型';
    }

    // 上传PPT文件到后端
    async uploadPPTFile(file) {
        console.log(`开始上传文件: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            // 添加文件描述和标签
            const description = `上传时间: ${new Date().toLocaleString()}`;
            const tags = ['Python课程', this.getFileTypeDescription(file)];
            
            formData.append('description', description);
            formData.append('tags', JSON.stringify(tags));

            // 显示上传状态
            this.showUploadStatus(`正在上传 ${file.name}...`, 'info');

            const response = await fetch('http://localhost:5000/ppt/upload', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                console.log(`PPT文件上传成功: ${file.name}`, result);
                
                // 显示成功状态
                this.showUploadStatus(`${file.name} 上传成功！`, 'success');
                
                // 重新加载PPT文件列表
                await this.loadPPTFiles();
                this.updatePPTUI();
                
                return true; // 返回成功状态
            } else {
                const error = await response.json();
                console.error('上传失败:', error);
                
                // 显示错误状态
                this.showUploadStatus(`${file.name} 上传失败: ${error.error || '未知错误'}`, 'error');
                
                throw new Error(error.error || '上传失败');
            }
        } catch (error) {
            console.error('上传PPT文件失败:', error);
            
            // 显示错误状态
            this.showUploadStatus(`${file.name} 上传失败: ${error.message}`, 'error');
            
            // 如果后端不可用，回退到本地存储
            try {
                console.log('尝试回退到本地存储...');
                this.addPPTFileToLocal(file);
                this.showUploadStatus(`${file.name} 已保存到本地存储`, 'warning');
                return true; // 本地存储成功也算成功
            } catch (localError) {
                console.error('本地存储也失败:', localError);
                this.showUploadStatus(`${file.name} 本地存储失败`, 'error');
                throw new Error('上传和本地存储都失败');
            }
        }
    }

    // 添加PPT文件到本地存储（回退方案）
    addPPTFileToLocal(file) {
        const pptFile = {
            id: Date.now() + Math.random(),
            name: file.name,
            original_name: file.name,  // 添加原始文件名字段
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

        console.log(`已添加PPT文件到本地存储: ${file.name}`);
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
                original_name: ppt.original_name || ppt.name,  // 保存原始文件名
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

    // 删除选中的PPT文件（左侧边栏功能）
    deleteSelectedPPTs() {
        const selectedCheckboxes = document.querySelectorAll('.ppt-card-checkbox:checked');
        if (selectedCheckboxes.length === 0) {
            alert('请先选择要删除的文档');
            return;
        }
        
        if (confirm(`确定要删除选中的 ${selectedCheckboxes.length} 个文档吗？此操作不可恢复。`)) {
            console.log('左侧边栏删除选中PPT文档，数量:', selectedCheckboxes.length);
            
            // 获取选中的PPT ID列表
            const selectedIds = Array.from(selectedCheckboxes).map(checkbox => 
                parseInt(checkbox.dataset.pptId)
            );
            
            // 执行批量删除
            this.executeBatchDelete(selectedIds);
        }
    }

    // 清空所有PPT文件（左侧边栏功能）
    async clearAllPPTs() {
        if (this.pptFiles.length === 0) {
            alert('当前没有PPT文件');
            return;
        }
        
        if (confirm(`确定要删除所有 ${this.pptFiles.length} 个PPT文件吗？此操作不可恢复。`)) {
            console.log('左侧边栏清空所有PPT文件，数量:', this.pptFiles.length);
            
            // 获取所有PPT ID列表
            const allIds = this.pptFiles.map(ppt => ppt.id);
            
            // 执行批量删除
            await this.executeBatchDelete(allIds);
        }
    }

    // 显示上传状态
    showUploadStatus(message, type = 'info') {
        // 创建状态提示元素
        let statusElement = document.getElementById('uploadStatus');
        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.id = 'uploadStatus';
            statusElement.className = 'upload-status';
            document.body.appendChild(statusElement);
        }
        
        statusElement.textContent = message;
        statusElement.className = `upload-status upload-status-${type}`;
        statusElement.style.display = 'block';
        
        // 3秒后自动隐藏
        setTimeout(() => {
            statusElement.style.display = 'none';
        }, 3000);
    }

    // 隐藏上传进度
    hideUploadProgress() {
        const progress = document.getElementById('uploadProgress');
        if (progress) {
            // 延迟隐藏，让用户看到完成状态
            setTimeout(() => {
                progress.style.display = 'none';
            }, 2000);
        }
    }

    // 显示上传统计
    showUploadStats() {
        const stats = document.getElementById('uploadStats');
        if (stats) {
            stats.style.display = 'flex';
        }
    }

    // 隐藏上传统计
    hideUploadStats() {
        const stats = document.getElementById('uploadStats');
        if (stats) {
            stats.style.display = 'none';
        }
    }

    // 更新上传统计
    updateUploadStats(total, success, failed) {
        const totalElement = document.getElementById('totalFiles');
        const successElement = document.getElementById('successFiles');
        const failedElement = document.getElementById('failedFiles');
        
        if (totalElement) totalElement.textContent = total;
        if (successElement) successElement.textContent = success;
        if (failedElement) failedElement.textContent = failed;
    }

    // 显示文件预览
    showFilePreview(files) {
        console.log('显示文件预览，文件数量:', files.length);
        
        // 创建预览HTML
        let previewHTML = '<div class="file-preview-header">📋 即将上传的文件</div>';
        
        Array.from(files).forEach((file, index) => {
            const isValid = this.isValidDocumentFile(file);
            const fileSize = (file.size / 1024 / 1024).toFixed(2);
            const fileType = this.getFileTypeDescription(file);
            const statusClass = isValid ? 'file-valid' : 'file-invalid';
            const statusIcon = isValid ? '✅' : '❌';
            
            previewHTML += `
                <div class="file-preview-item ${statusClass}">
                    <div class="file-preview-info">
                        <span class="file-preview-name">${file.name}</span>
                        <span class="file-preview-details">${fileType} • ${fileSize}MB</span>
                    </div>
                    <span class="file-preview-status">${statusIcon}</span>
                </div>
            `;
        });
        
        // 显示预览
        this.showUploadStatus(previewHTML, 'info');
    }

    // 显示下载状态
    showDownloadStatus(message, type = 'info') {
        // 创建下载状态提示元素
        let statusElement = document.getElementById('downloadStatus');
        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.id = 'downloadStatus';
            statusElement.className = 'upload-status'; // 复用上传状态的样式
            document.body.appendChild(statusElement);
        }
        
        statusElement.textContent = message;
        statusElement.className = `upload-status upload-status-${type}`;
        statusElement.style.display = 'block';
        
        // 3秒后自动隐藏
        setTimeout(() => {
            statusElement.style.display = 'none';
        }, 3000);
    }
}

// 等待DOM加载完成后再创建错题管理器实例
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM加载完成，开始初始化错题管理器...');
    const mistakeManager = new MistakeManager();
    console.log('错题管理器初始化完成');
});