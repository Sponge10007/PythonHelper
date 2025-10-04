// js/mistake_manager/PPTHandler.js

import * as api from '../common/api.js';

export class PPTHandler {
    constructor(uiManager) {
        this.ui = uiManager;
        this.allPptFiles = [];
        this.filteredPptFiles = [];
        this.uploadProgress = new Map(); // 存储上传进度
        this.thumbnailCache = new Map(); // 缩略图缓存
        this.selectedFiles = new Set(); // 选中的文件
    }

    async init() {
        try {
            this.ui.showLoading('正在加载PPT文件...');
            this.allPptFiles = await api.fetchPPTFiles();
            this.filteredPptFiles = [...this.allPptFiles];
            
            // 异步加载缩略图，不阻塞界面渲染
            this.loadThumbnails().then(() => {
                // 缩略图加载完成后更新界面
                this.updateThumbnailsInUI();
            });
            
            this.render();
            this.ui.hideLoading();
        } catch (error) {
            console.error('初始化PPT管理器失败:', error);
            this.ui.showError(`加载失败: ${error.message}`);
        }
    }

    /**
     * 更新UI中的缩略图
     */
    updateThumbnailsInUI() {
        this.allPptFiles.forEach(file => {
            const thumbnail = this.getThumbnail(file.id);
            this.ui.updateThumbnail(file.id, thumbnail);
        });
    }

    render() {
        this.ui.renderPPTGrid(
            this.filteredPptFiles,
            (id) => this.previewPPT(id),
            (id) => this.downloadPPT(id),
            (id) => this.deletePPT(id),
            (id) => this.toggleSelectPPT(id)
        );
        this.updateStatistics();
        this.renderSelectedActions();
    }

    /**
     * 加载所有文件的缩略图
     */
    async loadThumbnails() {
        const loadPromises = this.allPptFiles.map(async (file) => {
            try {
                if (!this.thumbnailCache.has(file.id)) {
                    const thumbnail = await api.getPPTThumbnail(file.id, {
                        width: 200,
                        height: 150,
                        quality: 80
                    });
                    this.thumbnailCache.set(file.id, thumbnail);
                }
            } catch (error) {
                console.warn(`加载文件 ${file.id} 缩略图失败:`, error);
                // 设置默认缩略图
                this.thumbnailCache.set(file.id, this.getDefaultThumbnail(file.file_type));
            }
        });

        await Promise.all(loadPromises);
    }

    /**
     * 获取默认缩略图
     */
    getDefaultThumbnail(fileType) {
        const iconMap = {
            'pdf': '📄',
            'ppt': '📊',
            'pptx': '📊', 
            'doc': '📝',
            'docx': '📝'
        };
        
        const icon = iconMap[fileType.toLowerCase()] || '📁';
        
        // 创建SVG缩略图
        const svg = `
            <svg width="200" height="150" xmlns="http://www.w3.org/2000/svg">
                <rect width="200" height="150" fill="#f8f9fa" stroke="#dee2e6"/>
                <text x="100" y="85" font-family="Arial" font-size="48" text-anchor="middle" fill="#6c757d">${icon}</text>
            </svg>
        `;
        
        return `data:image/svg+xml;base64,${btoa(svg)}`;
    }

    // 上传功能已移动到 simple_upload.js 独立模块处理

    /**
     * 预览PPT文件 - 提供多种查看选项
     */
    async previewPPT(pptId) {
        try {
            const file = this.allPptFiles.find(f => f.id === pptId);
            if (!file) {
                throw new Error('文件不存在');
            }

            // 显示预览选项菜单
            this.showPreviewOptions(file);

        } catch (error) {
            console.error('预览失败:', error);
            alert(`预览失败: ${error.message}`);
        }
    }

    /**
     * 显示预览选项
     */
    showPreviewOptions(file) {
        // 构建文件URL
        const serverUrl = getBackendUrl();
        const fileUrl = `${serverUrl}/ppt/files/${file.id}/download`;
        const fileType = (file.file_type || '').toLowerCase();

        // 移除现有的选项窗口
        const existingModal = document.getElementById('previewOptionsModal');
        if (existingModal) {
            existingModal.remove();
        }

        // 创建预览选项窗口
        const modalHTML = `
            <div id="previewOptionsModal" class="ppt-viewer-modal active">
                <div class="viewer-backdrop" id="previewBackdrop"></div>
                <div class="viewer-content" style="max-width: 500px; margin: auto; padding: 20px;">
                    <div class="viewer-header">
                        <div class="viewer-info">
                            <h2 class="viewer-title">${file.original_name}</h2>
                            <div class="viewer-subtitle">选择预览方式</div>
                        </div>
                        <div class="viewer-controls">
                            <button class="btn-viewer-close" id="btnPreviewClose">×</button>
                        </div>
                    </div>
                    <div class="preview-options" style="padding: 20px;">
                        <button id="btnDownload" 
                                style="width: 100%; padding: 12px; margin: 8px 0; border: none; background: #007bff; color: white; border-radius: 4px; cursor: pointer;">
                            📄 直接下载文件
                        </button>
                        
                        ${fileType === 'pdf' ? `
                        <button id="btnPdfViewer" 
                                style="width: 100%; padding: 12px; margin: 8px 0; border: none; background: #dc3545; color: white; border-radius: 4px; cursor: pointer;">
                            📋 浏览器内置PDF查看器
                        </button>
                        <button id="btnGoogleDocsPdf" 
                                style="width: 100%; padding: 12px; margin: 8px 0; border: none; background: #28a745; color: white; border-radius: 4px; cursor: pointer;">
                            🌐 Google Docs 在线查看
                        </button>
                        ` : ''}
                        
                        ${(fileType === 'ppt' || fileType === 'pptx') ? `
                        <button id="btnOfficeOnline" 
                                style="width: 100%; padding: 12px; margin: 8px 0; border: none; background: #fd7e14; color: white; border-radius: 4px; cursor: pointer;">
                            📊 Office Online 查看器
                        </button>
                        <button id="btnGoogleDocsPpt" 
                                style="width: 100%; padding: 12px; margin: 8px 0; border: none; background: #28a745; color: white; border-radius: 4px; cursor: pointer;">
                            🌐 Google Docs 在线查看
                        </button>
                        ` : ''}

                        <div style="margin-top: 16px; padding: 12px; background: #f8f9fa; border-radius: 4px; font-size: 14px; color: #6c757d;">
                            💡 提示：如果在线查看器无法使用，请直接下载文件用本地软件打开
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 添加到页面
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // 绑定事件
        this.bindPreviewEvents(file, fileUrl, fileType);
    }

    /**
     * 绑定预览选项事件
     */
    bindPreviewEvents(file, fileUrl, fileType) {
        const closeModal = () => {
            const modal = document.getElementById('previewOptionsModal');
            if (modal) modal.remove();
        };

        // 关闭按钮和背景点击
        document.getElementById('btnPreviewClose')?.addEventListener('click', closeModal);
        document.getElementById('previewBackdrop')?.addEventListener('click', closeModal);

        // 下载按钮
        document.getElementById('btnDownload')?.addEventListener('click', () => {
            window.open(fileUrl, '_blank');
            closeModal();
        });

        // PDF特有按钮
        if (fileType === 'pdf') {
            document.getElementById('btnPdfViewer')?.addEventListener('click', () => {
                window.open(fileUrl, '_blank');
                closeModal();
            });
            
            document.getElementById('btnGoogleDocsPdf')?.addEventListener('click', () => {
                const googleUrl = `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}`;
                window.open(googleUrl, '_blank');
                closeModal();
            });
        }

        // PPT特有按钮
        if (fileType === 'ppt' || fileType === 'pptx') {
            document.getElementById('btnOfficeOnline')?.addEventListener('click', () => {
                const officeUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileUrl)}`;
                window.open(officeUrl, '_blank');
                closeModal();
            });
            
            document.getElementById('btnGoogleDocsPpt')?.addEventListener('click', () => {
                const googleUrl = `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}`;
                window.open(googleUrl, '_blank');
                closeModal();
            });
        }

        // ESC键关闭
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        });
    }

    /**
     * 格式化文件大小
     */
    formatFileSize(bytes) {
        if (!bytes) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * 在新窗口中预览
     */
    async previewInNewWindow(pptId) {
        try {
            await api.previewPPTFile(pptId, {
                newWindow: true,
                previewType: 'auto'
            });
        } catch (error) {
            console.error('新窗口预览失败:', error);
            alert(`预览失败: ${error.message}`);
        }
    }

    /**
     * 下载PPT文件
     */
    async downloadPPT(pptId) {
        try {
            const file = this.allPptFiles.find(f => f.id === pptId);
            await api.downloadPPTFile(pptId, file?.original_name);
        } catch (error) {
            console.error('下载失败:', error);
            alert(`下载失败: ${error.message}`);
        }
    }

    /**
     * 删除PPT文件
     */
    async deletePPT(pptId) {
        try {
            const file = this.allPptFiles.find(f => f.id === pptId);
            if (!file) return;

            if (!confirm(`确定要删除文件 "${file.original_name}" 吗？`)) {
                return;
            }

            await api.deletePPTFile(pptId);
            console.log('文件删除成功');
            
            // 从缓存中移除
            this.thumbnailCache.delete(pptId);
            this.selectedFiles.delete(pptId);
            
            // 刷新列表
            await this.init();

        } catch (error) {
            console.error('删除失败:', error);
            console.error(`删除失败: ${error.message}`);
        }
    }

    /**
     * 切换文件选择状态
     */
    toggleSelectPPT(pptId) {
        if (this.selectedFiles.has(pptId)) {
            this.selectedFiles.delete(pptId);
        } else {
            this.selectedFiles.add(pptId);
        }
        
        this.renderSelectedActions();
        this.ui.updateFileSelection(pptId, this.selectedFiles.has(pptId));
    }

    /**
     * 全选/取消全选
     */
    toggleSelectAll() {
        if (this.selectedFiles.size === this.filteredPptFiles.length) {
            // 取消全选
            this.selectedFiles.clear();
        } else {
            // 全选
            this.filteredPptFiles.forEach(file => {
                this.selectedFiles.add(file.id);
            });
        }
        
        this.renderSelectedActions();
        this.ui.updateAllFilesSelection(Array.from(this.selectedFiles));
    }

    /**
     * 切换PPT选择状态
     */
    toggleSelectPPT(pptId) {
        // 确保pptId是字符串类型
        pptId = String(pptId);
        
        if (this.selectedFiles.has(pptId)) {
            this.selectedFiles.delete(pptId);
        } else {
            this.selectedFiles.add(pptId);
        }
        
        // 更新复选框状态
        this.updateCheckboxes();
        this.renderSelectedActions();
    }

    /**
     * 更新所有复选框状态
     */
    updateCheckboxes() {
        const checkboxes = document.querySelectorAll('.ppt-checkbox');
        checkboxes.forEach(checkbox => {
            const pptId = String(checkbox.getAttribute('data-ppt-id'));
            const isSelected = this.selectedFiles.has(pptId);
            checkbox.checked = isSelected;
            
            // 更新PPT卡片的选中状态样式
            const pptCard = checkbox.closest('.ppt-card');
            if (pptCard) {
                if (isSelected) {
                    pptCard.classList.add('selected');
                } else {
                    pptCard.classList.remove('selected');
                }
            }
        });
    }

    /**
     * 进入编辑模式
     */
    enterEditMode() {
        this.selectedFiles.clear();
        document.querySelector('.ppt-grid').classList.add('edit-mode');
        this.updateCheckboxes();
        this.renderSelectedActions();
    }

    /**
     * 退出编辑模式
     */
    exitEditMode() {
        this.selectedFiles.clear();
        document.querySelector('.ppt-grid').classList.remove('edit-mode');
        this.updateCheckboxes();
        this.renderSelectedActions();
    }

    /**
     * 选择所有当前页的文件
     */
    selectAllFiles() {
        this.filteredPptFiles.forEach(file => {
            this.selectedFiles.add(String(file.id));
        });
        this.updateCheckboxes();
        this.renderSelectedActions();
    }

    /**
     * 取消选择所有文件
     */
    deselectAllFiles() {
        this.selectedFiles.clear();
        this.updateCheckboxes();
        this.renderSelectedActions();
    }

    /**
     * 批量删除选中的文件
     */
    async batchDeleteSelected() {
        if (this.selectedFiles.size === 0) {
            console.log('请先选择要删除的文件');
            return;
        }

        const selectedIds = Array.from(this.selectedFiles);
        const fileNames = selectedIds.map(id => {
            const file = this.allPptFiles.find(f => f.id === id);
            return file ? file.original_name : `文件${id}`;
        });

        if (!confirm(`确定要删除以下 ${selectedIds.length} 个文件吗？\n\n${fileNames.join('\n')}`)) {
            return;
        }

        try {
            this.ui.showLoading('正在删除文件...');
            
            const result = await api.batchDeletePPTFiles(selectedIds);
            
            this.ui.hideLoading();
            console.log(`成功删除 ${result.success || selectedIds.length} 个文件`);
            
            // 清空选择状态
            this.selectedFiles.clear();
            
            // 刷新列表
            await this.init();

        } catch (error) {
            console.error('批量删除失败:', error);
            this.ui.hideLoading();
            console.error(`批量删除失败: ${error.message}`);
        }
    }

    /**
     * 搜索文件
     */
    searchFiles(query) {
        if (!query.trim()) {
            this.filteredPptFiles = [...this.allPptFiles];
        } else {
            const lowerQuery = query.toLowerCase();
            this.filteredPptFiles = this.allPptFiles.filter(file => 
                file.original_name.toLowerCase().includes(lowerQuery) ||
                file.description?.toLowerCase().includes(lowerQuery) ||
                (file.tags && file.tags.some(tag => tag.toLowerCase().includes(lowerQuery)))
            );
        }
        
        this.render();
    }

    /**
     * 排序文件
     */
    sortFiles(sortBy) {
        const sortFunctions = {
            'name': (a, b) => a.original_name.localeCompare(b.original_name),
            'date': (a, b) => new Date(b.upload_date) - new Date(a.upload_date),
            'size': (a, b) => b.file_size - a.file_size,
            'type': (a, b) => a.file_type.localeCompare(b.file_type)
        };

        if (sortFunctions[sortBy]) {
            this.filteredPptFiles.sort(sortFunctions[sortBy]);
            this.render();
        }
    }

    /**
     * 更新统计信息
     */
    updateStatistics() {
        const stats = {
            totalFiles: this.allPptFiles.length,
            totalSize: this.allPptFiles.reduce((sum, file) => sum + (file.file_size || 0), 0),
            totalSlides: this.allPptFiles.reduce((sum, file) => sum + (file.slides_count || 0), 0),
            selectedCount: this.selectedFiles.size
        };

        this.ui.updatePPTStatistics(stats);
    }

    /**
     * 渲染选择操作按钮
     */
    renderSelectedActions() {
        const hasSelected = this.selectedFiles.size > 0;
        const batchDeleteBtn = document.getElementById('batchDeletePPTs');
        
        if (batchDeleteBtn) {
            batchDeleteBtn.disabled = !hasSelected;
            batchDeleteBtn.textContent = hasSelected 
                ? `批量删除 (${this.selectedFiles.size})`
                : '批量删除';
        }
    }

    /**
     * 获取缩略图
     */
    getThumbnail(pptId) {
        return this.thumbnailCache.get(pptId) || this.getDefaultThumbnail('unknown');
    }

    /**
     * 过滤文件类型
     */
    filterByType(fileType) {
        if (!fileType || fileType === 'all') {
            this.filteredPptFiles = [...this.allPptFiles];
        } else {
            this.filteredPptFiles = this.allPptFiles.filter(file => 
                file.file_type.toLowerCase() === fileType.toLowerCase()
            );
        }
        
        this.render();
    }

    /**
     * 清空所有文件
     */
    async clearAllFiles() {
        if (this.allPptFiles.length === 0) {
            console.log('没有文件可以清空');
            return;
        }

        if (!confirm(`确定要删除所有 ${this.allPptFiles.length} 个文件吗？此操作不可恢复！`)) {
            return;
        }

        try {
            const allIds = this.allPptFiles.map(file => file.id);
            await api.batchDeletePPTFiles(allIds);
            
            console.log('所有文件已清空');
            
            // 清空缓存和状态
            this.thumbnailCache.clear();
            this.selectedFiles.clear();
            
            // 刷新列表
            await this.init();

        } catch (error) {
            console.error('清空文件失败:', error);
            console.error(`清空失败: ${error.message}`);
        }
    }
}