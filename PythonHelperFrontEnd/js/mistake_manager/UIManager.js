// js/mistake_manager/UIManager.js

export class UIManager {
    constructor() {
        this.mistakeList = document.getElementById('mistakeList');
        this.pptGrid = document.getElementById('pptGrid');
        this.pageInfo = document.getElementById('pageInfo');
        this.prevPageBtn = document.getElementById('prevPage');
        this.nextPageBtn = document.getElementById('nextPage');
        
        this.editModal = document.getElementById('modal');
        this.editTitle = document.getElementById('editTitle');
        this.editMessages = document.getElementById('editMessages');
        this.editCategory = document.getElementById('editCategory');
        this.editDifficulty = document.getElementById('editDifficulty');
        this.editLesson = document.getElementById('editLesson');
    }

    renderMistakeList(mistakes, isLessonTag, onEdit, onDelete, onToggleSelect) {
        this.mistakeList.innerHTML = '';
        if (mistakes.length === 0) {
            this.mistakeList.innerHTML = `<div class="no-mistakes">暂无错题记录</div>`;
            return;
        }
        mistakes.forEach(mistake => {
            const mistakeElement = this.createMistakeElement(mistake, isLessonTag);
            mistakeElement.querySelector('.edit-mistake-btn').addEventListener('click', () => onEdit(mistake.id));
            mistakeElement.querySelector('.delete-mistake-btn').addEventListener('click', () => onDelete(mistake.id));
            mistakeElement.querySelector('.mistake-checkbox').addEventListener('change', (e) => onToggleSelect(mistake.id, e.target.checked));
            this.mistakeList.appendChild(mistakeElement);
        });
    }

    createMistakeElement(mistake, isLessonTag) {
        const div = document.createElement('div');
        div.className = 'mistake-item';
        
        // 将所有需要作为标签展示的信息统一处理
        const tagsToShow = [];
        if (mistake.category) {
            tagsToShow.push({ text: `分类: ${mistake.category}`, class: 'tag-category' });
        }
        if (mistake.difficulty) {
            tagsToShow.push({ text: `难度: ${mistake.difficulty}`, class: 'tag-difficulty' });
        }
        // 处理课程标签
        const lessonTag = mistake.tags ? mistake.tags.find(tag => isLessonTag(tag)) : '';
        if (lessonTag) {
            tagsToShow.push({ text: `课程: ${lessonTag}`, class: 'tag-lesson' });
        }
        
        const messagesHtml = (mistake.messages || []).map(msg => `
            <div class="mistake-message message-${msg.role}">
                <span class="message-role">${msg.role === 'user' ? 'You' : 'AI'}</span>
                <div class="message-content">${this.escapeHtml(msg.content)}</div>
            </div>
        `).join('');

        // 使用处理后的标签数组生成HTML
        const tagsHtml = tagsToShow.length > 0 ? `
            <div class="mistake-tags">
                ${tagsToShow.map(tag => `<span class="mistake-tag ${tag.class}">${tag.text}</span>`).join('')}
            </div>
        ` : '';

        div.innerHTML = `
            <div class="mistake-header">
                <div>
                    <div class="mistake-title">${this.escapeHtml(mistake.title)}</div>
                    <div class="mistake-meta">
                        <span>日期: ${new Date(mistake.date).toLocaleDateString()}</span>
                    </div>
                </div>
                <input type="checkbox" class="mistake-checkbox" data-mistake-id="${mistake.id}">
            </div>
            <div class="mistake-conversation">${messagesHtml}</div>
            ${tagsHtml}
            <div class="mistake-actions">
                <button class="edit-mistake-btn btn-secondary" data-mistake-id="${mistake.id}">编辑</button>
                <button class="delete-mistake-btn btn-danger" data-mistake-id="${mistake.id}">删除</button>
            </div>
        `;
        return div;
    }

    // isLessonTag(tag) {
    //     const lessonTags = ['数据类型及表达式', '复合数据类型', '面向对象', '函数', '流程控制', '文件概述', '异常处理'];
    //     return lessonTags.includes(tag);
    // }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    fillEditModal(mistake, isLessonTag) {
        this.editTitle.value = mistake.title || '';
        this.editMessages.value = JSON.stringify(mistake.messages || [], null, 2);
        
        // 清空所有下拉框
        this.editLesson.value = '';
        this.editCategory.value = '';
        this.editDifficulty.value = '';
        
        // 根据错题的标签设置下拉框的选中状态
        if (mistake.tags && Array.isArray(mistake.tags)) {
            mistake.tags.forEach(tag => {
                // 检查课程标签
                for (let option of this.editLesson.options) {
                    if (option.value === tag) {
                        this.editLesson.value = tag;
                        break;
                    }
                }
                // 检查知识点标签
                for (let option of this.editCategory.options) {
                    if (option.value === tag) {
                        this.editCategory.value = tag;
                        break;
                    }
                }
                // 检查难度标签
                for (let option of this.editDifficulty.options) {
                    if (option.value === tag) {
                        this.editDifficulty.value = tag;
                        break;
                    }
                }
            });
        }
    }

    getEditModalData() {
        // 收集所有下拉框的选中值
        const selectedTags = [];
        
        // 收集课程标签
        if (this.editLesson.value) {
            selectedTags.push(this.editLesson.value);
        }
        
        // 收集知识点标签
        if (this.editCategory.value) {
            selectedTags.push(this.editCategory.value);
        }
        
        // 收集难度标签
        if (this.editDifficulty.value) {
            selectedTags.push(this.editDifficulty.value);
        }

        return {
            title: this.editTitle.value.trim(),
            tags: selectedTags,
        };
    }

    async loadTagsForEditModal() {
        try {
            const response = await fetch('http://localhost:5000/api/tags/categories');
            const result = await response.json();
            
            if (result.success) {
                const { course, knowledge, difficulty } = result.data;
                
                // 清空现有选项（保留第一个空选项）
                this.editLesson.innerHTML = '<option value="">选择课程标签...</option>';
                this.editCategory.innerHTML = '<option value="">选择知识点标签...</option>';
                this.editDifficulty.innerHTML = '<option value="">选择难度标签...</option>';
                
                // 添加课程标签
                course.forEach(tag => {
                    const option = document.createElement('option');
                    option.value = tag.name;
                    option.textContent = tag.name;
                    this.editLesson.appendChild(option);
                });
                
                // 添加知识点标签
                knowledge.forEach(tag => {
                    const option = document.createElement('option');
                    option.value = tag.name;
                    option.textContent = tag.name;
                    this.editCategory.appendChild(option);
                });
                
                // 添加难度标签
                difficulty.forEach(tag => {
                    const option = document.createElement('option');
                    option.value = tag.name;
                    option.textContent = tag.name;
                    this.editDifficulty.appendChild(option);
                });
            }
        } catch (error) {
            console.error('加载标签失败:', error);
        }
    }

    updatePagination(currentPage, totalPages) {
        this.pageInfo.textContent = `第 ${currentPage} 页，共 ${totalPages} 页`;
        this.prevPageBtn.disabled = currentPage <= 1;
        this.nextPageBtn.disabled = currentPage >= totalPages;
    }

    updateStats(mistakeStats, pptStats) {
        document.getElementById('totalMistakes').textContent = mistakeStats.total;
        document.getElementById('taggedMistakes').textContent = mistakeStats.tagged;
        document.getElementById('aiSummarized').textContent = mistakeStats.summarized;
        
        if (pptStats) {
            document.getElementById('totalPPTs').textContent = pptStats.total;
            document.getElementById('totalSlides').textContent = pptStats.slides;
        }
    }
    
    toggleModal(modalId, show = true) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.toggle('active', show);
        }
    }

    // ================================
    // PPT 预览相关 UI 方法
    // ================================

    renderPPTGrid(pptFiles, onPreview, onDownload, onDelete, onToggleSelect) {
        this.pptGrid.innerHTML = '';
        if (pptFiles.length === 0) {
            this.pptGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📁</div>
                    <div class="empty-text">暂无PPT文件</div>
                    <div class="empty-hint">点击上传按钮添加课程PPT</div>
                </div>
            `;
            return;
        }

        pptFiles.forEach(ppt => {
            const pptCard = this.createPPTCardElement(ppt);
            
            // 绑定事件
            const previewBtn = pptCard.querySelector('.btn-preview');
            const downloadBtn = pptCard.querySelector('.btn-download');
            const deleteBtn = pptCard.querySelector('.btn-delete');
            const newWindowBtn = pptCard.querySelector('.btn-new-window');
            const selectCheckbox = pptCard.querySelector('.ppt-checkbox');

            if (previewBtn) previewBtn.addEventListener('click', () => onPreview(ppt.id));
            if (downloadBtn) downloadBtn.addEventListener('click', () => onDownload(ppt.id));
            if (deleteBtn) deleteBtn.addEventListener('click', () => onDelete(ppt.id));
            if (newWindowBtn) newWindowBtn.addEventListener('click', () => this.previewInNewWindow(ppt.id));
            if (selectCheckbox) selectCheckbox.addEventListener('change', (e) => onToggleSelect(ppt.id));

            this.pptGrid.appendChild(pptCard);
        });
    }
    
    createPPTCardElement(ppt) {
        const pptCard = document.createElement('div');
        pptCard.className = 'ppt-card';
        pptCard.setAttribute('data-ppt-id', ppt.id);
        
        // 获取文件类型图标
        const fileIcon = this.getFileIcon(ppt.file_type);
        
        // 格式化文件大小
        const fileSize = this.formatFileSize(ppt.file_size || 0);
        
        // 格式化上传时间
        const uploadDate = new Date(ppt.upload_date).toLocaleDateString();

        pptCard.innerHTML = `
            <div class="ppt-card-header">
                <input type="checkbox" class="ppt-checkbox" data-ppt-id="${ppt.id}">
                <div class="ppt-type-badge">${ppt.file_type.toUpperCase()}</div>
            </div>
            
            <div class="ppt-thumbnail" id="ppt-thumb-${ppt.id}">
                <div class="thumbnail-placeholder">
                    <div class="file-icon">${fileIcon}</div>
                    <div class="loading-spinner">加载中...</div>
                </div>
            </div>
            
            <div class="ppt-info">
                <div class="ppt-title" title="${ppt.original_name}">${this.truncateText(ppt.original_name, 30)}</div>
                <div class="ppt-meta">
                    <span class="ppt-size">${fileSize}</span>
                    <span class="ppt-slides">${ppt.slides_count || 0}页</span>
                    <span class="ppt-date">${uploadDate}</span>
                </div>
                ${ppt.description ? `<div class="ppt-description">${this.escapeHtml(ppt.description)}</div>` : ''}
                ${this.renderPPTTags(ppt.tags)}
            </div>
            
            <div class="ppt-actions">
                <button class="btn-preview btn-primary" title="预览">
                    <span class="icon">👁️</span> 预览
                </button>
                <button class="btn-new-window btn-secondary" title="新窗口预览">
                    <span class="icon">🔗</span>
                </button>
                <button class="btn-download btn-secondary" title="下载">
                    <span class="icon">⬇️</span>
                </button>
                <button class="btn-delete btn-danger" title="删除">
                    <span class="icon">🗑️</span>
                </button>
            </div>
        `;
        
        return pptCard;
    }

    /**
     * 显示预览模态框
     */
    showPreviewModal(file) {
        // 创建或获取预览模态框
        let previewModal = document.getElementById('ppt-preview-modal');
        if (!previewModal) {
            previewModal = this.createPreviewModal();
            document.body.appendChild(previewModal);
        }

        // 更新模态框内容
        const modalTitle = previewModal.querySelector('.preview-modal-title');
        const modalSubtitle = previewModal.querySelector('.preview-modal-subtitle');
        
        if (modalTitle) modalTitle.textContent = file.original_name;
        if (modalSubtitle) {
            modalSubtitle.innerHTML = `
                <span>${file.file_type.toUpperCase()}</span> • 
                <span>${this.formatFileSize(file.file_size || 0)}</span> • 
                <span>${file.slides_count || 0}页</span>
            `;
        }

        // 显示模态框
        previewModal.classList.add('active');
        document.body.classList.add('modal-open');
        
        // 加载预览内容
        this.loadPreviewContent(file);
    }

    /**
     * 加载预览内容
     */
    async loadPreviewContent(file) {
        const previewContainer = document.querySelector('.preview-container');
        const previewLoading = document.querySelector('.preview-loading');
        const previewError = document.querySelector('.preview-error');
        
        if (!previewContainer) return;

        try {
            // 显示加载状态
            this.showPreviewLoading();
            
            const fileType = file.file_type.toLowerCase();
            const previewUrl = `http://localhost:5000/ppt/files/${file.id}/preview?type=direct`;
            
            // 根据文件类型创建不同的预览内容
            if (fileType === 'pdf') {
                // PDF预览
                previewContainer.innerHTML = `
                    <iframe 
                        src="${previewUrl}" 
                        style="width: 100%; height: 600px; border: none;"
                        title="PDF预览">
                    </iframe>
                `;
            } else if (['ppt', 'pptx'].includes(fileType)) {
                // PPT预览 - 使用Google Docs Viewer
                const googleViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(window.location.origin + previewUrl)}&embedded=true`;
                previewContainer.innerHTML = `
                    <div class="ppt-preview-wrapper">
                        <iframe 
                            src="${googleViewerUrl}" 
                            style="width: 100%; height: 600px; border: none;"
                            title="PPT预览">
                        </iframe>
                        <div class="preview-fallback">
                            <p>如果预览无法显示，可以尝试:</p>
                            <button class="btn-primary" onclick="window.open('${previewUrl}', '_blank')">
                                在新窗口中打开
                            </button>
                            <button class="btn-secondary" onclick="this.closest('.preview-modal').querySelector('.btn-close-preview').click(); 
                                     document.querySelector('[data-ppt-id=&quot;${file.id}&quot;] .btn-download').click();">
                                直接下载
                            </button>
                        </div>
                    </div>
                `;
            } else {
                // 其他文件类型
                previewContainer.innerHTML = `
                    <div class="unsupported-preview">
                        <div class="preview-icon">📄</div>
                        <h3>不支持预览此文件类型</h3>
                        <p>文件类型: ${fileType.toUpperCase()}</p>
                        <div class="preview-actions">
                            <button class="btn-primary" onclick="window.open('${previewUrl}', '_blank')">
                                在新窗口中打开
                            </button>
                            <button class="btn-secondary" onclick="this.closest('.preview-modal').querySelector('.btn-close-preview').click(); 
                                     document.querySelector('[data-ppt-id=&quot;${file.id}&quot;] .btn-download').click();">
                                下载文件
                            </button>
                        </div>
                    </div>
                `;
            }
            
            // 隐藏加载状态
            this.hidePreviewLoading();
            
        } catch (error) {
            console.error('加载预览内容失败:', error);
            this.showPreviewError(`预览加载失败: ${error.message}`);
        }
    }

    /**
     * 创建预览模态框
     */
    createPreviewModal() {
        const modal = document.createElement('div');
        modal.id = 'ppt-preview-modal';
        modal.className = 'preview-modal';
        
        modal.innerHTML = `
            <div class="preview-modal-backdrop"></div>
            <div class="preview-modal-content">
                <div class="preview-modal-header">
                    <div class="preview-modal-info">
                        <h3 class="preview-modal-title">文件预览</h3>
                        <div class="preview-modal-subtitle"></div>
                    </div>
                    <div class="preview-modal-actions">
                        <button class="btn-fullscreen" title="全屏">🔲</button>
                        <button class="btn-new-tab" title="新标签页打开">🔗</button>
                        <button class="btn-close-preview" title="关闭">✕</button>
                    </div>
                </div>
                <div class="preview-modal-body">
                    <div class="preview-container"></div>
                    <div class="preview-loading">
                        <div class="loading-spinner"></div>
                        <div class="loading-text">正在加载预览...</div>
                    </div>
                    <div class="preview-error hidden">
                        <div class="error-icon">⚠️</div>
                        <div class="error-text"></div>
                        <button class="btn-retry">重试</button>
                    </div>
                </div>
            </div>
        `;

        // 绑定关闭事件
        modal.querySelector('.btn-close-preview').addEventListener('click', () => {
            this.hidePreviewModal();
        });
        
        modal.querySelector('.preview-modal-backdrop').addEventListener('click', () => {
            this.hidePreviewModal();
        });

        // ESC键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                this.hidePreviewModal();
            }
        });

        return modal;
    }

    /**
     * 隐藏预览模态框
     */
    hidePreviewModal() {
        const previewModal = document.getElementById('ppt-preview-modal');
        if (previewModal) {
            previewModal.classList.remove('active');
            document.body.classList.remove('modal-open');
            
            // 清理预览内容
            const container = previewModal.querySelector('.preview-container');
            if (container) container.innerHTML = '';
        }
    }

    /**
     * 显示预览加载状态
     */
    showPreviewLoading() {
        const modal = document.getElementById('ppt-preview-modal');
        if (!modal) return;
        
        const loading = modal.querySelector('.preview-loading');
        const error = modal.querySelector('.preview-error');
        const container = modal.querySelector('.preview-container');
        
        if (loading) loading.classList.remove('hidden');
        if (error) error.classList.add('hidden');
        if (container) container.style.display = 'none';
    }

    /**
     * 隐藏预览加载状态
     */
    hidePreviewLoading() {
        const modal = document.getElementById('ppt-preview-modal');
        if (!modal) return;
        
        const loading = modal.querySelector('.preview-loading');
        const container = modal.querySelector('.preview-container');
        
        if (loading) loading.classList.add('hidden');
        if (container) container.style.display = 'block';
    }

    /**
     * 显示预览错误
     */
    showPreviewError(errorMessage) {
        const modal = document.getElementById('ppt-preview-modal');
        if (!modal) return;
        
        const loading = modal.querySelector('.preview-loading');
        const error = modal.querySelector('.preview-error');
        const container = modal.querySelector('.preview-container');
        const errorText = modal.querySelector('.error-text');
        
        if (loading) loading.classList.add('hidden');
        if (container) container.style.display = 'none';
        if (error) error.classList.remove('hidden');
        if (errorText) errorText.textContent = errorMessage;
    }
    /**
     * 更新缩略图
     */
    updateThumbnail(pptId, thumbnailData) {
        const thumbElement = document.getElementById(`ppt-thumb-${pptId}`);
        if (!thumbElement) return;

        const placeholder = thumbElement.querySelector('.thumbnail-placeholder');
        if (placeholder) {
            placeholder.innerHTML = `<img src="${thumbnailData}" alt="缩略图" class="thumbnail-image" />`;
        }
    }

    /**
     * 显示上传进度
     */
    showUploadProgress() {
        // 创建或显示上传进度条
        let progressModal = document.getElementById('upload-progress-modal');
        if (!progressModal) {
            progressModal = this.createUploadProgressModal();
            document.body.appendChild(progressModal);
        }
        
        progressModal.classList.add('active');
    }

    /**
     * 更新上传进度
     */
    updateUploadProgress(progress, status) {
        const progressModal = document.getElementById('upload-progress-modal');
        if (!progressModal) return;

        const progressBar = progressModal.querySelector('.upload-progress-bar');
        const statusText = progressModal.querySelector('.upload-status-text');

        if (progressBar) progressBar.style.width = `${progress}%`;
        if (statusText) statusText.textContent = status;
    }

    /**
     * 隐藏上传进度
     */
    hideUploadProgress() {
        const progressModal = document.getElementById('upload-progress-modal');
        if (progressModal) {
            progressModal.classList.remove('active');
        }
    }

    /**
     * 工具方法
     */
    getFileIcon(fileType) {
        const iconMap = {
            'pdf': '📄',
            'ppt': '📊',
            'pptx': '📊',
            'doc': '📝',
            'docx': '📝',
            'xls': '📈',
            'xlsx': '📈'
        };
        return iconMap[fileType.toLowerCase()] || '📁';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substr(0, maxLength - 3) + '...';
    }

    showLoading(message = '加载中...') {
        // 实现加载提示
        console.log(message);
    }

    hideLoading() {
        // 隐藏加载提示
    }

    showError(message) {
        alert(`错误: ${message}`);
    }

    showSuccessMessage(message) {
        // 显示成功消息
        console.log(`成功: ${message}`);
    }

    showErrorMessage(message) {
        alert(`错误: ${message}`);
    }

    /**
     * 更新PPT统计信息
     */
    updatePPTStatistics(stats) {
        const totalPPTsEl = document.getElementById('totalPPTs');
        const totalSlidesEl = document.getElementById('totalSlides');
        const selectedCountEl = document.getElementById('selectedCount');

        if (totalPPTsEl) totalPPTsEl.textContent = stats.totalFiles || 0;
        if (totalSlidesEl) totalSlidesEl.textContent = stats.totalSlides || 0;
        if (selectedCountEl) selectedCountEl.textContent = stats.selectedCount || 0;

        // 更新文件大小统计
        const totalSizeEl = document.getElementById('totalSize');
        if (totalSizeEl) {
            totalSizeEl.textContent = this.formatFileSize(stats.totalSize || 0);
        }
    }

    /**
     * 切换批量操作按钮状态
     */
    toggleBatchActions(hasSelected, selectedCount) {
        const batchDeleteBtn = document.getElementById('batchDeletePPTs');
        const selectAllBtn = document.getElementById('selectAllPPTs');
        const deselectAllBtn = document.getElementById('deselectAllPPTs');

        if (batchDeleteBtn) {
            batchDeleteBtn.disabled = !hasSelected;
            batchDeleteBtn.textContent = hasSelected ? `删除选中 (${selectedCount})` : '批量删除';
        }

        if (selectAllBtn) selectAllBtn.style.display = hasSelected ? 'none' : 'inline-block';
        if (deselectAllBtn) deselectAllBtn.style.display = hasSelected ? 'inline-block' : 'none';
    }

    /**
     * 更新文件选择状态
     */
    updateFileSelection(pptId, isSelected) {
        const checkbox = document.querySelector(`input.ppt-checkbox[data-ppt-id="${pptId}"]`);
        if (checkbox) {
            checkbox.checked = isSelected;
        }

        const card = document.querySelector(`.ppt-card[data-ppt-id="${pptId}"]`);
        if (card) {
            card.classList.toggle('selected', isSelected);
        }
    }

    /**
     * 更新所有文件选择状态
     */
    updateAllFilesSelection(selectedIds) {
        const checkboxes = document.querySelectorAll('input.ppt-checkbox');
        checkboxes.forEach(checkbox => {
            const pptId = parseInt(checkbox.getAttribute('data-ppt-id'));
            const isSelected = selectedIds.includes(pptId);
            checkbox.checked = isSelected;
            
            const card = checkbox.closest('.ppt-card');
            if (card) {
                card.classList.toggle('selected', isSelected);
            }
        });
    }

    /**
     * 显示上传摘要
     */
    showUploadSummary(successCount, failCount) {
        const totalCount = successCount + failCount;
        let message = `上传完成！\n`;
        message += `成功: ${successCount}/${totalCount}\n`;
        if (failCount > 0) {
            message += `失败: ${failCount}/${totalCount}`;
        }
        
        if (failCount > 0) {
            alert(message);
        } else {
            // 可以显示更友好的成功提示
            console.log(message);
        }
    }

    /**
     * 更新上传状态
     */
    updateUploadStatus(status) {
        // 可以在页面上显示当前上传状态
        console.log(`上传状态: ${status}`);
    }

    /**
     * 创建上传进度模态框
     */
    createUploadProgressModal() {
        const modal = document.createElement('div');
        modal.id = 'upload-progress-modal';
        modal.className = 'upload-progress-modal';

        modal.innerHTML = `
            <div class="upload-progress-header">
                <h3>上传文件</h3>
            </div>
            <div class="upload-progress-body">
                <div class="upload-progress-bar-container">
                    <div class="upload-progress-bar" style="width: 0%"></div>
                </div>
                <div class="upload-status-text">准备上传...</div>
            </div>
        `;

        return modal;
    }

    /**
     * 在新窗口预览（由PPTHandler调用）
     */
    async previewInNewWindow(pptId) {
        // 这个方法会被PPTHandler调用
        if (window.pptHandler) {
            await window.pptHandler.previewInNewWindow(pptId);
        }
    }

    /**
     * 安全渲染PPT标签
     */
    renderPPTTags(tags) {
        // 处理各种可能的标签格式
        let tagArray = [];
        
        if (typeof tags === 'string') {
            try {
                // 尝试解析JSON字符串
                tagArray = JSON.parse(tags);
            } catch (e) {
                // 如果不是JSON，按逗号分割
                tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
            }
        } else if (Array.isArray(tags)) {
            tagArray = tags;
        } else if (tags) {
            // 其他情况转为字符串
            tagArray = [String(tags)];
        }

        // 确保是数组且有内容
        if (!Array.isArray(tagArray) || tagArray.length === 0) {
            return '';
        }

        return `
            <div class="ppt-tags">
                ${tagArray.map(tag => `<span class="ppt-tag">${this.escapeHtml(String(tag))}</span>`).join('')}
            </div>
        `;
    }
}