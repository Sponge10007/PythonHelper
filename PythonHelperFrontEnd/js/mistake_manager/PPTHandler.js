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

    /**
     * 上传文件
     */
    async uploadFiles(files) {
        if (!files || files.length === 0) return;

        this.ui.showUploadProgress();
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                this.ui.updateUploadStatus(`正在上传 ${file.name} (${i + 1}/${files.length})`);
                
                const result = await api.uploadPPTFile(
                    file,
                    '', // description
                    [], // tags
                    (progress, loaded, total) => {
                        this.uploadProgress.set(file.name, progress);
                        this.ui.updateUploadProgress(progress, `${file.name}: ${progress}%`);
                    }
                );
                
                successCount++;
                this.ui.showSuccessMessage(`${file.name} 上传成功`);
                
            } catch (error) {
                failCount++;
                console.error(`上传 ${file.name} 失败:`, error);
                this.ui.showErrorMessage(`${file.name} 上传失败: ${error.message}`);
            }
        }

        this.ui.hideUploadProgress();
        this.ui.showUploadSummary(successCount, failCount);
        
        // 刷新文件列表
        if (successCount > 0) {
            await this.init();
        }
    }

    /**
     * 预览PPT文件
     */
    async previewPPT(pptId) {
        try {
            const file = this.allPptFiles.find(f => f.id === pptId);
            if (!file) {
                throw new Error('文件不存在');
            }

            // 直接显示预览模态框，UIManager会处理内容加载
            this.ui.showPreviewModal(file);

        } catch (error) {
            console.error('预览失败:', error);
            alert(`预览失败: ${error.message}`);
        }
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
            this.ui.showSuccessMessage('文件删除成功');
            
            // 从缓存中移除
            this.thumbnailCache.delete(pptId);
            this.selectedFiles.delete(pptId);
            
            // 刷新列表
            await this.init();

        } catch (error) {
            console.error('删除失败:', error);
            this.ui.showErrorMessage(`删除失败: ${error.message}`);
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
     * 批量删除选中的文件
     */
    async batchDeleteSelected() {
        if (this.selectedFiles.size === 0) {
            alert('请先选择要删除的文件');
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
            this.ui.showSuccessMessage(`成功删除 ${result.success || selectedIds.length} 个文件`);
            
            // 清空选择状态
            this.selectedFiles.clear();
            
            // 刷新列表
            await this.init();

        } catch (error) {
            console.error('批量删除失败:', error);
            this.ui.hideLoading();
            this.ui.showErrorMessage(`批量删除失败: ${error.message}`);
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
        this.ui.toggleBatchActions(hasSelected, this.selectedFiles.size);
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
            alert('没有文件可以清空');
            return;
        }

        if (!confirm(`确定要删除所有 ${this.allPptFiles.length} 个文件吗？此操作不可恢复！`)) {
            return;
        }

        try {
            const allIds = this.allPptFiles.map(file => file.id);
            await api.batchDeletePPTFiles(allIds);
            
            this.ui.showSuccessMessage('所有文件已清空');
            
            // 清空缓存和状态
            this.thumbnailCache.clear();
            this.selectedFiles.clear();
            
            // 刷新列表
            await this.init();

        } catch (error) {
            console.error('清空文件失败:', error);
            this.ui.showErrorMessage(`清空失败: ${error.message}`);
        }
    }
}