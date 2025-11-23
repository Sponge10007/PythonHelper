// js/mistake_manager/PPTHandler.js

import * as api from '../common/api.js';
import { getBackendUrl } from './backend_config.js';

export class PPTHandler {
    constructor(uiManager) {
        this.ui = uiManager;
        this.allPptFiles = [];
        this.filteredPptFiles = [];
        this.uploadProgress = new Map(); // 存储上传进度
        this.thumbnailCache = new Map(); // 缩略图缓存
        this.selectedFiles = new Set(); // 选中的文件
        
        // 状态管理
        this.currentSort = 'date';
        this.currentSearch = '';
        this.currentTypeFilter = 'all';
        
        // 监听简单的刷新事件
        document.addEventListener('refreshPPTList', () => {
            console.log('PPTHandler收到刷新事件');
            this.init();
        });
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
            (id, isSelected) => this.togglePPTSelection(id, isSelected)
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
            <div id="previewOptionsModal" class="preview-modal-overlay">
                <div class="preview-modal-container">
                    <div class="preview-modal-header">
                        <h3 class="preview-modal-title">选择预览方式</h3>
                        <button class="preview-modal-close" id="btnPreviewClose">×</button>
                    </div>
                    <div class="preview-modal-content">
                        <button class="preview-option-btn" id="btnDownload">
                            <img src="../../icons/download.png" alt="下载" class="preview-icon">
                            <span class="preview-text">直接下载文件</span>
                        </button>
                        
                        ${fileType === 'pdf' ? `
                        <button class="preview-option-btn" id="btnPdfViewer">
                            <img src="../icons/preview.png" alt="预览" class="preview-icon">
                            <span class="preview-text">浏览器内置PDF查看器</span>
                        </button>
                        <button class="preview-option-btn" id="btnGoogleDocsPdf">
                            <img src="../icons/google-docs-preview.png" alt="Google" class="preview-icon">
                            <span class="preview-text">Google Docs 在线查看</span>
                        </button>
                        ` : ''}
                        
                        ${(fileType === 'ppt' || fileType === 'pptx') ? `
                        <button class="preview-option-btn" id="btnOfficeOnline">
                            <img src="../icons/office-online-preview.png" alt="Office" class="preview-icon">
                            <span class="preview-text">Office Online 查看器</span>
                        </button>
                        <button class="preview-option-btn" id="btnGoogleDocsPpt">
                            <img src="../icons/google-docs-preview.png" alt="Google" class="preview-icon">
                            <span class="preview-text">Google Docs 在线查看</span>
                        </button>
                        ` : ''}

                        <div class="preview-tip">
                            <span>提示：如果在线查看器无法使用，请直接下载文件用本地软件打开</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <style>
                .preview-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.6);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 10000;
                    backdrop-filter: blur(4px);
                }
                
                .preview-modal-container {
                    background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
                    border-radius: 12px;
                    box-shadow: 0 15px 30px rgba(0, 0, 0, 0.12);
                    width: 420px;
                    max-width: 90vw;
                    max-height: 85vh;
                    overflow: hidden;
                    animation: modalSlideIn 0.3s ease-out;
                }
                
                @keyframes modalSlideIn {
                    from {
                        opacity: 0;
                        transform: scale(0.9) translateY(-15px);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
                
                @keyframes modalSlideOut {
                    from {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                    to {
                        opacity: 0;
                        transform: scale(0.9) translateY(-15px);
                    }
                }
                
                .preview-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 18px 22px 15px;
                    background: white;
                    color: black;
                    position: relative;
                }
                
                .preview-modal-header::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 1px;
                    background: rgba(255, 255, 255, 0.2);
                }
                
                .preview-modal-title {
                    margin: 0;
                    font-size: 18px;
                    font-weight: 600;
                    letter-spacing: 0.3px;
                }
                
                .preview-modal-close {
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    color: white;
                    font-size: 20px;
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                }
                
                .preview-modal-close:hover {
                    background: rgba(255, 255, 255, 0.3);
                    transform: scale(1.1);
                }
                
                .preview-modal-content {
                    padding: 18px 22px 20px;
                }
                
                .preview-option-btn {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    padding: 12px 16px;
                    margin: 6px 0;
                    border: 1px solid #e9ecef;
                    background: #ffffff;
                    color: #333;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    text-align: left;
                    position: relative;
                    overflow: hidden;
                }
                
                .preview-option-btn::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(122, 55, 151, 0.08), transparent);
                    transition: left 0.4s;
                }
                
                .preview-option-btn:hover {
                    border-color: #7A3797;
                    background: #f8f9ff;
                    transform: translateY(-1px);
                    box-shadow: 0 6px 20px rgba(122, 55, 151, 0.12);
                }
                
                .preview-option-btn:hover::before {
                    left: 100%;
                }
                
                .preview-option-btn:active {
                    transform: translateY(0);
                    box-shadow: 0 3px 12px rgba(122, 55, 151, 0.15);
                }
                
                .preview-icon {
                    width: 20px;
                    height: 20px;
                    margin-right: 12px;
                    flex-shrink: 0;
                    filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.1));
                }
                
                .preview-text {
                    font-size: 15px;
                    font-weight: 500;
                    color: #333;
                    flex: 1;
                }
                
                .preview-tip {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    padding: 12px 16px;
                    margin: 12px 0 0;
                    border: 1px solid #e9ecef;
                    background: #7a3898;
                    color: #ffffffff;
                    border-radius: 8px;
                    font-size: 13px;
                    text-align: center;
                    line-height: 1.4;
                }
                
                .tip-icon {
                    width: 16px;
                    height: 16px;
                    margin-right: 8px;
                    flex-shrink: 0;
                    margin-top: 1px;
                }
                
                /* 响应式设计 */
                @media (max-width: 768px) {
                    .preview-modal-container {
                        width: 95vw;
                        margin: 8px;
                        border-radius: 10px;
                    }
                    
                    .preview-modal-header {
                        padding: 16px 18px 12px;
                    }
                    
                    .preview-modal-title {
                        font-size: 16px;
                    }
                    
                    .preview-modal-content {
                        padding: 16px 18px 18px;
                    }
                    
                    .preview-option-btn {
                        padding: 10px 14px;
                        margin: 5px 0;
                    }
                    
                    .preview-text {
                        font-size: 14px;
                    }
                    
                    .preview-icon {
                        width: 18px;
                        height: 18px;
                        margin-right: 10px;
                    }
                }
            </style>
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
            if (modal) {
                modal.style.animation = 'modalSlideOut 0.2s ease-in';
                setTimeout(() => modal.remove(), 200);
            }
        };

        // 关闭按钮和背景点击
        document.getElementById('btnPreviewClose')?.addEventListener('click', closeModal);
        document.querySelector('.preview-modal-overlay')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('preview-modal-overlay')) {
                closeModal();
            }
        });

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
     * 切换文件选择状态 - 已废弃，使用 togglePPTSelection
     */
    // toggleSelectPPT(pptId) { ... }

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
     * 切换PPT选择状态 - 已废弃，使用 togglePPTSelection
     */
    // toggleSelectPPT(pptId) { ... }

    /**
     * 更新复选框状态
     */
    updateCheckboxes() {
        // 更新复选框
        this.filteredPptFiles.forEach(file => {
            const checkbox = document.querySelector(`input[data-ppt-id="${file.id}"]`);
            if (checkbox) {
                const isSelected = this.selectedFiles.has(String(file.id));
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
            }
        });

        // 通知编辑管理器更新按钮状态
        if (window.editManager) {
            window.editManager.updateSelectedItems(Array.from(this.selectedFiles));
        }
    }

    /**
     * 切换单个PPT的选中状态
     */
    togglePPTSelection(pptId, isSelected) {
        const idStr = String(pptId);
        console.log(`切换PPT ${pptId} 选中状态:`, isSelected);
        
        if (isSelected) {
            this.selectedFiles.add(idStr);
        } else {
            this.selectedFiles.delete(idStr);
        }
        
        // 更新卡片视觉效果
        const pptCard = document.querySelector(`[data-ppt-id="${pptId}"]`);
        if (pptCard) {
            if (isSelected) {
                pptCard.classList.add('selected');
            } else {
                pptCard.classList.remove('selected');
            }
        }
        
        this.updateCheckboxes();
        this.renderSelectedActions();
        console.log(`PPT ${pptId} ${isSelected ? '已选中' : '取消选中'}，当前选中数量: ${this.selectedFiles.size}`);
    }

    /**
     * 根据ID数组批量删除PPT文件
     */
    async batchDeleteByIds(selectedIds) {
        try {
            this.ui.showLoading('正在删除文件...');
            
            const result = await api.batchDeletePPTFiles(selectedIds);
            
            this.ui.hideLoading();
            console.log(`成功删除 ${result.success || selectedIds.length} 个文件`);
            
            // 刷新列表
            await this.init();
            
        } catch (error) {
            console.error('批量删除失败:', error);
            this.ui.hideLoading();
            throw error;
        }
    }

    /**
     * 初始化编辑管理器相关的回调
     */
    initEditCallbacks(editManager) {
        editManager.registerCallbacks('ppt', {
            selectAll: () => this.selectAllFiles(),
            deselectAll: () => this.deselectAllFiles(),
            batchDelete: () => this.batchDeleteSelected(),
            render: () => this.renderPPTFiles()
        });
    }

    /**
     * 检查是否处于编辑模式
     */
    isInEditMode(editManager) {
        const state = editManager.getState();
        return state.isEditMode && state.currentType === 'ppt';
    }

    /**
     * 选择所有当前页的文件
     */
    selectAllFiles() {
        console.log('当前页PPT文件:', this.filteredPptFiles);
        
        this.filteredPptFiles.forEach(file => {
            this.selectedFiles.add(String(file.id));
            
            // 更新视觉效果
            const checkbox = document.querySelector(`input[data-ppt-id="${file.id}"]`);
            if (checkbox) {
                checkbox.checked = true;
            }
            
            const pptCard = document.querySelector(`[data-ppt-id="${file.id}"]`);
            if (pptCard) {
                pptCard.classList.add('selected');
            }
        });
        
        this.updateCheckboxes();
        this.renderSelectedActions();
        console.log(`已选择 ${this.selectedFiles.size} 个PPT文件`);
    }

    /**
     * 取消选择所有文件
     */
    deselectAllFiles() {
        console.log('取消全选PPT，当前选中:', this.selectedFiles);
        
        // 先更新视觉效果
        this.selectedFiles.forEach(fileId => {
            const checkbox = document.querySelector(`input[data-ppt-id="${fileId}"]`);
            if (checkbox) {
                checkbox.checked = false;
            }
            
            const pptCard = document.querySelector(`[data-ppt-id="${fileId}"]`);
            if (pptCard) {
                pptCard.classList.remove('selected');
            }
        });
        
        this.selectedFiles.clear();
        this.updateCheckboxes();
        this.renderSelectedActions();
        console.log('已取消选择所有PPT文件');
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
        this.currentSearch = query;
        this.refreshList();
    }

    /**
     * 排序文件
     */
    sortFiles(sortBy) {
        this.currentSort = sortBy;
        this.refreshList();
    }

    /**
     * 过滤文件类型
     */
    filterByType(fileType) {
        this.currentTypeFilter = fileType;
        this.refreshList();
    }

    /**
     * 刷新列表（应用所有筛选和排序）
     */
    refreshList() {
        let result = [...this.allPptFiles];

        // 1. 搜索
        if (this.currentSearch.trim()) {
            const lowerQuery = this.currentSearch.toLowerCase();
            result = result.filter(file => {
                // 搜索文件名
                if (file.original_name.toLowerCase().includes(lowerQuery)) {
                    return true;
                }
                // 搜索描述
                if (file.description?.toLowerCase().includes(lowerQuery)) {
                    return true;
                }
                // 搜索标签
                if (file.tags && Array.isArray(file.tags)) {
                    return file.tags.some(tag => tag.toLowerCase().includes(lowerQuery));
                }
                return false;
            });
        }

        // 2. 类型过滤
        if (this.currentTypeFilter && this.currentTypeFilter !== 'all') {
            result = result.filter(file => 
                file.file_type.toLowerCase() === this.currentTypeFilter.toLowerCase()
            );
        }

        // 3. 排序
        const sortFunctions = {
            'name': (a, b) => a.original_name.localeCompare(b.original_name),
            'date': (a, b) => new Date(b.upload_date) - new Date(a.upload_date),
            'size': (a, b) => b.file_size - a.file_size,
            'type': (a, b) => a.file_type.localeCompare(b.file_type)
        };

        if (sortFunctions[this.currentSort]) {
            result.sort(sortFunctions[this.currentSort]);
        }
        
        this.filteredPptFiles = result;
        this.render();
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

    // filterByType 方法已整合到 refreshList 中，这里删除旧的实现
    
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