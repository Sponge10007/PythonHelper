// js/mistake_manager/UIManager.js

import { getBackendUrl } from './backend_config.js';

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
        
        // 标签筛选相关元素
        this.courseFilter = document.getElementById('courseFilter');
        this.knowledgeFilter = document.getElementById('knowledgeFilter');
        this.difficultyFilter = document.getElementById('difficultyFilter');
        this.clearFiltersBtn = document.getElementById('clearFilters');
        this.applyFiltersBtn = document.getElementById('applyFilters');
        
        // 当前选中的筛选标签
        this.selectedFilters = {
            course: new Set(),
            knowledge: new Set(),
            difficulty: new Set()
        };
    }

    /**
     * 获取服务器URL - 支持开发和生产环境
     */
    getServerUrl() {
        // Chrome扩展环境检测
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
            // 扩展环境：使用动态检测的后端地址
            return getBackendUrl();
        }
        
        // 检查是否设置了全局服务器地址
        if (typeof window !== 'undefined' && window.SERVER_URL) {
            return window.SERVER_URL;
        }
        
        // 检查是否是生产环境
        const isProduction = window.location.protocol === 'https:' || 
                           (window.location.hostname !== 'localhost' && 
                            window.location.hostname !== '127.0.0.1');
        
        if (isProduction) {
            // 生产环境：使用当前域名
            return `${window.location.protocol}//${window.location.hostname}`;
        } else {
            // 开发环境：使用localhost
            return getBackendUrl();
        }
    }

    renderMistakeList(mistakes, onEdit, onDelete) {
        this.mistakeList.innerHTML = '';
        if (mistakes.length === 0) {
            this.mistakeList.innerHTML = `<div class="no-mistakes">暂无错题记录</div>`;
            return;
        }
        mistakes.forEach(mistake => {
            const mistakeElement = this.createMistakeElement(mistake);
            mistakeElement.querySelector('.edit-mistake-btn').addEventListener('click', () => onEdit(mistake.id));
            mistakeElement.querySelector('.delete-mistake-btn').addEventListener('click', () => onDelete(mistake.id));
            
            // 添加折叠功能的事件绑定
            const toggleButton = mistakeElement.querySelector('.analysis-toggle');
            if (toggleButton) {
                toggleButton.addEventListener('click', (e) => {
                    this.toggleAnalysis(e.target);
                });
            }
            
            this.mistakeList.appendChild(mistakeElement);
        });
        
        // 由EditManager处理勾选框事件
        if (window.editManager && window.editManager.bindCheckboxEvents) {
            setTimeout(() => window.editManager.bindCheckboxEvents('mistake'), 0);
        }
    }

    createMistakeElement(mistake) {
        const div = document.createElement('div');
        div.className = 'mistake-item';
        div.id = `mistake-${mistake.id}`; // 添加ID以便选择
        
        // 处理标签显示 - 只使用新的标签数组格式
        const tagsToShow = [];
        
        if (mistake.tags && Array.isArray(mistake.tags)) {
            mistake.tags.forEach(tag => {
                if (typeof tag === 'string' && tag.trim()) {
                    // 根据标签名称判断类别
                    const tagName = tag.trim();
                    if (this.isCourseTag(tagName)) {
                        tagsToShow.push({ text: `课程: ${tagName}`, class: 'tag-lesson' });
                    } else if (this.isKnowledgeTag(tagName)) {
                        tagsToShow.push({ text: `知识点: ${tagName}`, class: 'tag-category' });
                    } else if (this.isDifficultyTag(tagName)) {
                        tagsToShow.push({ text: `难度: ${tagName}`, class: 'tag-difficulty' });
                    } else {
                        // 默认作为知识点标签显示
                        tagsToShow.push({ text: `知识点: ${tagName}`, class: 'tag-category' });
                    }
                }
            });
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

        // 生成唯一的ID用于折叠功能
        const collapseId = `analysis-${mistake.id}`;

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
            ${tagsHtml}
            <div class="analysis-collapse">
                <button class="analysis-toggle" data-target="${collapseId}" data-expanded="false">
                    <span class="analysis-toggle-text">展开解析</span>
                    <span class="analysis-toggle-icon">▼</span>
                </button>
            </div>
            <div class="analysis-content" id="${collapseId}" style="display: none;">
                <div class="mistake-conversation">${messagesHtml}</div>
            </div>
            <div class="mistake-actions">
                <button class="edit-mistake-btn btn-secondary" data-mistake-id="${mistake.id}">编辑</button>
                <button class="delete-mistake-btn btn-danger" data-mistake-id="${mistake.id}">删除</button>
            </div>
        `;
        return div;
    }

    /**
     * 切换解析内容的展开/收起状态
     * @param {HTMLElement} button - 点击的按钮元素
     */
    toggleAnalysis(button) {
        const targetId = button.getAttribute('data-target');
        const content = document.getElementById(targetId);
        const isExpanded = button.getAttribute('data-expanded') === 'true';
        
        if (!content) {
            console.error('找不到目标内容元素:', targetId);
            return;
        }
        
        if (isExpanded) {
            // 收起内容
            content.style.display = 'none';
            button.setAttribute('data-expanded', 'false');
            button.querySelector('.analysis-toggle-text').textContent = '展开解析';
            button.querySelector('.analysis-toggle-icon').textContent = '▼';
        } else {
            // 展开内容
            content.style.display = 'block';
            button.setAttribute('data-expanded', 'true');
            button.querySelector('.analysis-toggle-text').textContent = '收起解析';
            button.querySelector('.analysis-toggle-icon').textContent = '▲';
        }
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

    fillEditModal(mistake) {
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
            const response = await fetch('http://localhost:8000/api/tags/categories');
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

    renderPPTGrid(pptFiles, onPreview, onDownload, onDelete) {
        this.pptGrid.innerHTML = '';
        if (pptFiles.length === 0) {
            
            return;
        }

        pptFiles.forEach(ppt => {
            const pptCard = this.createPPTCardElement(ppt);
            
            // 绑定事件
            const previewBtn = pptCard.querySelector('.btn-preview');
            const downloadBtn = pptCard.querySelector('.btn-download');
            const deleteBtn = pptCard.querySelector('.btn-delete');

            if (previewBtn) previewBtn.addEventListener('click', () => onPreview(ppt.id));
            if (downloadBtn) downloadBtn.addEventListener('click', () => onDownload(ppt.id));
            if (deleteBtn) deleteBtn.addEventListener('click', () => onDelete(ppt.id));

            this.pptGrid.appendChild(pptCard);
        });
        
        // 由EditManager处理勾选框事件
        if (window.editManager && window.editManager.bindCheckboxEvents) {
            setTimeout(() => window.editManager.bindCheckboxEvents('ppt'), 0);
        }
    }
    
    createPPTCardElement(ppt) {
        const pptCard = document.createElement('div');
        pptCard.className = 'ppt-card';
        pptCard.setAttribute('data-ppt-id', ppt.id);
        
        // 格式化文件大小
        const fileSize = this.formatFileSize(ppt.file_size || 0);
        
        // 格式化上传时间
        const uploadDate = new Date(ppt.upload_date).toLocaleDateString();

        pptCard.innerHTML = `
            <div class="ppt-card-header">
                <input type="checkbox" class="ppt-checkbox" data-ppt-id="${ppt.id}">
            </div>
            
            <div class="ppt-card-content">
                <div class="ppt-title" title="${ppt.original_name}">${this.truncateText(ppt.original_name, 40)}</div>
                
                <div class="ppt-tags">
                    <span class="ppt-tag ppt-type">${ppt.file_type.toUpperCase()}</span>
                    <span class="ppt-tag ppt-size">${fileSize}</span>
                    <span class="ppt-tag ppt-pages">${ppt.slides_count || 0}页</span>
                    <span class="ppt-tag ppt-date">${uploadDate}</span>
                </div>
                
                ${ppt.description ? `<div class="ppt-description">${this.escapeHtml(ppt.description)}</div>` : ''}
                ${this.renderPPTTags(ppt.tags)}
            </div>
            
            <div class="ppt-actions">
                <button class="ppt-card-btn btn-preview" title="查看">
                    <img src="../../icons/preview.png" alt="查看" class="btn-icon"> 查看
                </button>
                <button class="ppt-card-btn btn-download" title="下载">
                    <img src="../../icons/download.png" alt="下载" class="btn-icon"> 下载
                </button>
                <button class="ppt-card-btn btn-delete" title="删除">
                    <img src="../../icons/delete.png" alt="删除" class="btn-icon"> 删除
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
            // 使用动态服务器地址，支持生产环境部署
            const serverUrl = await Promise.resolve(this.getServerUrl());
            const previewUrl = `${serverUrl}/ppt/files/${file.id}/preview?type=direct`;
            
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
                // PPT预览 - 提供多种预览选项
                previewContainer.innerHTML = `
                    <div class="ppt-preview-wrapper">
                        <div class="preview-options">
                            <h4>PPT文件预览选项</h4>
                            <div class="preview-buttons">
                                <button class="btn-primary" onclick="window.open('${previewUrl}', '_blank')">
                                    📱 在新窗口中预览
                                </button>
                                <button class="btn-secondary" onclick="this.tryOfficeViewer('${previewUrl}')">
                                    🌐 使用Office Online预览
                                </button>
                                <button class="btn-secondary" onclick="this.closest('.preview-modal').querySelector('.btn-close-preview').click(); 
                                         document.querySelector('[data-ppt-id=&quot;${file.id}&quot;] .btn-download').click();">
                                    💾 直接下载
                                </button>
                            </div>
                        </div>
                        
                        <div class="preview-note">
                            <p><strong>预览说明：</strong></p>
                            <ul>
                                <li>新窗口预览：在浏览器新标签页中打开文件</li>
                                <li>Office Online：需要文件可公网访问（仅限生产环境）</li>
                                <li>下载查看：下载到本地使用Office软件查看</li>
                            </ul>
                        </div>
                        
                        <div id="office-viewer-container" style="display: none;">
                            <iframe id="office-viewer-frame" style="width: 100%; height: 600px; border: none;" title="Office预览"></iframe>
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

    // 上传进度功能已移除

    // 上传进度更新功能已移除

    // 上传进度隐藏功能已移除

    /**
     * 工具方法
     */
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
        console.error('错误:', message);
        this.showTempMessage(message, 'error');
    }

    showSuccess(message) {
        console.log('成功:', message);
        this.showTempMessage(message, 'success');
    }

    showWarning(message) {
        console.warn('警告:', message);
        this.showTempMessage(message, 'warning');
    }

    showSuccessMessage(message) {
        // 显示成功消息
        console.log(`成功: ${message}`);
        // 添加临时的成功提示
        this.showTempMessage(message, 'success');
    }

    showErrorMessage(message) {
        console.error('错误:', message);
        this.showTempMessage(message, 'error');
    }

    /**
     * 显示临时消息
     */
    showTempMessage(message, type = 'info') {
        // 移除已存在的临时消息
        const existingMessages = document.querySelectorAll('.temp-message');
        existingMessages.forEach(msg => msg.remove());

        const messageDiv = document.createElement('div');
        messageDiv.className = `temp-message temp-message-${type}`;
        messageDiv.textContent = message;
        
        // 根据类型设置不同的颜色
        const colors = {
            success: { bg: '#28a745', border: '#1e7e34' },
            error: { bg: '#dc3545', border: '#bd2130' },
            warning: { bg: '#ffc107', border: '#d39e00', text: '#212529' },
            info: { bg: '#007bff', border: '#0056b3' }
        };
        
        const color = colors[type] || colors.info;
        
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${color.bg};
            color: ${color.text || 'white'};
            border: 2px solid ${color.border};
            border-radius: 6px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-size: 14px;
            font-weight: 500;
            max-width: 400px;
            animation: slideInRight 0.3s ease-out;
        `;
        
        // 添加动画样式
        if (!document.getElementById('temp-message-styles')) {
            const style = document.createElement('style');
            style.id = 'temp-message-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOutRight {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(messageDiv);
        
        // 3秒后移除消息
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => {
                    if (messageDiv.parentNode) {
                        messageDiv.parentNode.removeChild(messageDiv);
                    }
                }, 300);
            }
        }, 3000);
    }

    // 上传状态更新功能已移除

    // 上传总结功能已移除

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

    // 上传摘要功能已移除

    /**
     * 更新上传状态
     */
    updateUploadStatus(status) {
        // 可以在页面上显示当前上传状态
        console.log(`上传状态: ${status}`);
    }

    // 上传进度模态框功能已移除

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
      * 尝试使用Office Online预览
    */
    tryOfficeViewer(previewUrl) {
        const container = document.getElementById('office-viewer-container');
        const frame = document.getElementById('office-viewer-frame');
        
        if (container && frame) {
            // 使用Office Online Viewer
            const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`;
            frame.src = officeViewerUrl;
            container.style.display = 'block';
            
            // 隐藏预览选项
            const options = container.parentElement.querySelector('.preview-options');
            if (options) options.style.display = 'none';
            
            // 添加返回按钮
            if (!container.querySelector('.back-button')) {
                const backBtn = document.createElement('button');
                backBtn.className = 'btn-secondary back-button';
                backBtn.innerHTML = '← 返回选择预览方式';
                backBtn.onclick = () => {
                    container.style.display = 'none';
                    if (options) options.style.display = 'block';
                };
                container.insertBefore(backBtn, frame);
            }
        }
    }

    /**

    /**
     * 判断标签是否为课程标签
     */
    isCourseTag(tagName) {
        // 尝试从全局标签分类中获取
        if (window.tagCategories && window.tagCategories.course) {
            return window.tagCategories.course.has(tagName);
        }
        
        // 备用：使用硬编码的课程标签
        const courseTags = ['数据类型及表达式', '复合数据类型', '面向对象', '函数', '流程控制', '文件概述', '异常处理'];
        return courseTags.includes(tagName);
    }

    /**
     * 判断标签是否为知识点标签
     */
    isKnowledgeTag(tagName) {
        // 尝试从全局标签分类中获取
        if (window.tagCategories && window.tagCategories.knowledge) {
            return window.tagCategories.knowledge.has(tagName);
        }
        
        // 备用：使用硬编码的知识点标签
        const knowledgeTags = ['变量', '循环', '条件语句', '列表', '字典', '字符串', '文件操作', '类', '继承'];
        return knowledgeTags.includes(tagName);
    }

    /**
     * 判断标签是否为难度标签
     */
    isDifficultyTag(tagName) {
        // 尝试从全局标签分类中获取
        if (window.tagCategories && window.tagCategories.difficulty) {
            return window.tagCategories.difficulty.has(tagName);
        }
        
        // 备用：使用硬编码的难度标签
        const difficultyTags = ['简单', '中等', '困难'];
        return difficultyTags.includes(tagName);
    }

    /**
     * 初始化标签筛选器
     */
    initTagFilters() {
        this.loadFilterTags();
        this.bindFilterEvents();
    }

    /**
     * 加载筛选标签
     */
    loadFilterTags() {
        // 加载课程标签
        this.loadFilterCategory('course', this.courseFilter, 'course-tag');
        // 加载知识点标签
        this.loadFilterCategory('knowledge', this.knowledgeFilter, 'knowledge-tag');
        // 加载难度标签
        this.loadFilterCategory('difficulty', this.difficultyFilter, 'difficulty-tag');
    }

    /**
     * 加载特定类别的筛选标签
     */
    loadFilterCategory(category, container, cssClass) {
        if (!container) return;
        
        container.innerHTML = '';
        
        // 从全局标签分类中获取标签
        if (window.tagCategories && window.tagCategories[category]) {
            window.tagCategories[category].forEach(tagName => {
                const tagElement = document.createElement('div');
                tagElement.className = `filter-tag-item ${cssClass}`;
                tagElement.textContent = tagName;
                tagElement.dataset.tagName = tagName;
                tagElement.dataset.category = category;
                
                container.appendChild(tagElement);
            });
        }
    }

    /**
     * 绑定筛选事件
     */
    bindFilterEvents() {
        // 绑定标签点击事件
        [this.courseFilter, this.knowledgeFilter, this.difficultyFilter].forEach(container => {
            if (container) {
                container.addEventListener('click', (e) => {
                    if (e.target.classList.contains('filter-tag-item')) {
                        this.toggleFilterTag(e.target);
                    }
                });
            }
        });

        // 绑定清除筛选按钮
        if (this.clearFiltersBtn) {
            this.clearFiltersBtn.addEventListener('click', () => {
                this.clearAllFilters();
            });
        }

        // 绑定应用筛选按钮
        if (this.applyFiltersBtn) {
            this.applyFiltersBtn.addEventListener('click', () => {
                this.applyFilters();
            });
        }
    }

    /**
     * 切换筛选标签选中状态
     */
    toggleFilterTag(tagElement) {
        const tagName = tagElement.dataset.tagName;
        const category = tagElement.dataset.category;
        
        if (tagElement.classList.contains('selected')) {
            // 取消选中
            tagElement.classList.remove('selected');
            this.selectedFilters[category].delete(tagName);
        } else {
            // 选中
            tagElement.classList.add('selected');
            this.selectedFilters[category].add(tagName);
        }
    }

    /**
     * 清除所有筛选
     */
    clearAllFilters() {
        // 清除选中状态
        this.selectedFilters.course.clear();
        this.selectedFilters.knowledge.clear();
        this.selectedFilters.difficulty.clear();
        
        // 清除UI选中状态
        document.querySelectorAll('.filter-tag-item.selected').forEach(item => {
            item.classList.remove('selected');
        });
        
        // 触发筛选更新
        this.applyFilters();
    }

    /**
     * 应用筛选
     */
    applyFilters() {
        // 触发自定义事件，通知MistakeHandler更新筛选
        const filterEvent = new CustomEvent('tagFilterChanged', {
            detail: {
                filters: {
                    course: Array.from(this.selectedFilters.course),
                    knowledge: Array.from(this.selectedFilters.knowledge),
                    difficulty: Array.from(this.selectedFilters.difficulty)
                }
            }
        });
        document.dispatchEvent(filterEvent);
    }

    /**
     * 获取当前筛选条件
     */
    getCurrentFilters() {
        return {
            course: Array.from(this.selectedFilters.course),
            knowledge: Array.from(this.selectedFilters.knowledge),
            difficulty: Array.from(this.selectedFilters.difficulty)
        };
    }

    /**
     * 尝试使用Office Online预览
     */

    /**
     * 安全渲染PPT标签（只显示自定义标签，避免与基本信息重复）
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

        // 过滤掉基本信息标签（文件类型、大小等），只保留自定义标签
        const excludeBasicInfo = ['pdf', 'ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx'];
        tagArray = tagArray.filter(tag => {
            const tagStr = String(tag).toLowerCase();
            return !excludeBasicInfo.some(basicTag => tagStr.includes(basicTag)) &&
                   !tagStr.match(/^\d+(\.\d+)?\s*(b|kb|mb|gb)$/i) && // 过滤文件大小格式
                   !tagStr.match(/^\d+页$/); // 过滤页数格式
        });

        // 确保是数组且有内容
        if (!Array.isArray(tagArray) || tagArray.length === 0) {
            return '';
        }

        return `
            <div class="ppt-custom-tags">
                ${tagArray.map(tag => `<span class="ppt-tag">${this.escapeHtml(String(tag))}</span>`).join('')}
            </div>
        `;
    }

    /**
     * 这些方法已被 EditManager 替代，保留空方法以避免兼容性问题
     */
    enterMistakeEditMode() {
        console.log('UIManager: enterMistakeEditMode 已被 EditManager 替代');
    }

    /**
     * 这些方法已被 EditManager 替代，保留空方法以避免兼容性问题
     */
    exitMistakeEditMode() {
        console.log('UIManager: exitMistakeEditMode 已被 EditManager 替代');
    }
}