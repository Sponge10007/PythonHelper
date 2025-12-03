// js/mistake_manager/PPTViewer.js
// 高级PPT查看器，支持左滑右滑、缩放等操作

import { BACKEND_URL } from '../common/config.js';

export class PPTViewer {
    constructor() {
        this.currentFile = null;
        this.currentSlide = 0;
        this.slides = [];
        this.totalSlides = 0;
        this.isLoading = false;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.zoomLevel = 1;
        this.minZoom = 0.5;
        this.maxZoom = 3;
        
        this.bindEvents();
    }

    /**
     * 显示PPT
     */
    async showPPT(file) {
        try {
            console.log('PPTViewer.showPPT called with file:', file);
            
            if (!file) {
                throw new Error('文件对象为空');
            }
            
            this.file = file;
            this.createViewerHTML();
            this.bindEvents();
            
            // 显示模态框
            const modal = document.getElementById('pptViewerModal');
            if (!modal) {
                throw new Error('找不到PPT查看器模态框');
            }
            modal.classList.add('active');
            
            // 加载PPT内容
            await this.loadPPTContent(file);
            
        } catch (error) {
            console.error('显示PPT失败:', error);
            alert(`预览失败: ${error.message}`);
        }
    }

    /**
     * 创建查看器HTML结构
     */
    createViewerHTML() {
        // 检查是否已经存在查看器
        let modal = document.getElementById('pptViewerModal');
        if (modal) {
            return; // 已存在，不需要重新创建
        }

        // 创建查看器HTML
        const viewerHTML = `
            <div id="pptViewerModal" class="ppt-viewer-modal">
                <div class="viewer-backdrop"></div>
                <div class="viewer-content">
                    <div class="viewer-header">
                        <div class="viewer-info">
                            <h2 class="viewer-title" id="viewerTitle"></h2>
                            <div class="viewer-subtitle" id="viewerSubtitle"></div>
                        </div>
                        <div class="viewer-controls">
                            <span class="page-indicator" id="pageIndicator">1 / 1</span>
                            <span class="zoom-indicator" id="zoomIndicator">100%</span>
                            <button class="btn-viewer-close" id="btnViewerClose">×</button>
                        </div>
                    </div>
                    <div class="viewer-body">
                        <div class="slide-container" id="slideContainer">
                            <div class="slide-image-container" id="slideImageContainer">
                                <!-- 幻灯片内容将在这里显示 -->
                            </div>
                        </div>
                        <button class="btn-slide-nav btn-prev-slide" id="btnPrevSlide">‹</button>
                        <button class="btn-slide-nav btn-next-slide" id="btnNextSlide">›</button>
                        <div class="viewer-toolbar">
                            <div class="toolbar-group">
                                <button id="btnZoomOut" title="缩小">-</button>
                                <button id="btnZoomReset" title="重置缩放">⌂</button>
                                <button id="btnZoomIn" title="放大">+</button>
                            </div>
                            <div class="toolbar-group">
                                <button id="btnFullscreen" title="全屏">⛶</button>
                            </div>
                        </div>
                    </div>
                    <div class="viewer-loading" id="viewerLoading">
                        <div class="loading-spinner"></div>
                        <div class="loading-text">加载中...</div>
                    </div>
                    <div class="viewer-error" id="viewerError">
                        <div class="error-icon">⚠</div>
                        <div class="error-text" id="errorText"></div>
                    </div>
                </div>
            </div>
        `;

        // 添加到页面
        document.body.insertAdjacentHTML('beforeend', viewerHTML);
    }

    /**
     * 加载PPT内容
     */
    async loadPPTContent(file) {
        this.showLoading(true);
        
        try {
            console.log('loadPPTContent called with file:', file);
            
            // 安全获取文件类型
            const fileType = (file.file_type || file.original_name?.split('.').pop() || 'unknown').toLowerCase();
            console.log('Detected file type:', fileType);
            
            const serverUrl = BACKEND_URL;
            console.log('Server URL:', serverUrl);
            
            if (fileType === 'pdf') {
                await this.loadPDFSlides(file);
            } else if (['ppt', 'pptx'].includes(fileType)) {
                await this.loadPPTSlides(file);
            } else {
                throw new Error(`不支持的文件格式: ${fileType}`);
            }
            
            // 更新UI
            this.updateViewerUI();
            this.showSlide(0);
            
        } catch (error) {
            console.error('加载PPT内容失败:', error);
            this.showError(`加载失败: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 加载PDF幻灯片
     */
    async loadPDFSlides(file) {
        const serverUrl = BACKEND_URL;
        
        // 尝试获取PDF的页面信息
        const response = await fetch(`${serverUrl}/ppt/files/${file.id}/info`);
        if (!response.ok) {
            throw new Error('无法获取文件信息');
        }
        
        const fileInfo = await response.json();
        this.totalSlides = fileInfo.pages || file.slides_count || 1;
        
        // 生成PDF页面URL
        this.slides = [];
        for (let i = 0; i < this.totalSlides; i++) {
            this.slides.push({
                type: 'pdf',
                url: `${serverUrl}/ppt/files/${file.id}/preview?page=${i + 1}&format=image`,
                pageNumber: i + 1
            });
        }
    }

    /**
     * 加载PPT幻灯片
     */
    async loadPPTSlides(file) {
        const serverUrl = BACKEND_URL;
        
        // 尝试获取PPT的幻灯片信息
        try {
            const response = await fetch(`${serverUrl}/ppt/files/${file.id}/slides`);
            if (response.ok) {
                const slidesInfo = await response.json();
                // 转换相对URL为完整URL
                this.slides = (slidesInfo.slides || []).map(slide => ({
                    ...slide,
                    type: 'image',
                    url: `${serverUrl}${slide.image_url}`,
                    thumbnail_url: `${serverUrl}${slide.thumbnail_url}`
                }));
                this.totalSlides = this.slides.length;
            } else {
                throw new Error('无法获取幻灯片信息');
            }
        } catch (error) {
            console.error('加载幻灯片失败:', error);
            // 回退方案：直接使用文件预览
            this.slides = [{
                type: 'ppt',
                url: `${serverUrl}/ppt/files/${file.id}/preview?type=direct`,
                pageNumber: 1
            }];
            this.totalSlides = 1;
        }
    }

    /**
     * 显示指定幻灯片
     */
    showSlide(slideIndex) {
        if (slideIndex < 0 || slideIndex >= this.totalSlides) {
            return;
        }
        
        this.currentSlide = slideIndex;
        const slide = this.slides[slideIndex];
        
        const slideContainer = document.querySelector('.slide-container');
        if (!slideContainer) return;
        
        // 更新幻灯片内容
        if (slide.type === 'image' || slide.type === 'pdf') {
            // 图片格式（包括SVG）
            slideContainer.innerHTML = `
                <div class="slide-image-container">
                    <img 
                        src="${slide.url}" 
                        alt="幻灯片 ${slideIndex + 1}"
                        class="slide-image"
                        style="transform: scale(${this.zoomLevel}); transform-origin: center center;"
                        onload="this.parentElement.classList.add('loaded')"
                        onerror="console.error('图片加载失败:', this.src); this.parentElement.innerHTML='<div class=\\"slide-error\\">图片加载失败<br>URL: ${slide.url}</div>'"
                    >
                </div>
            `;
        } else {
            // HTML/iframe格式
            slideContainer.innerHTML = `
                <iframe 
                    src="${slide.url}" 
                    class="slide-iframe"
                    style="transform: scale(${this.zoomLevel}); transform-origin: center center;"
                    title="幻灯片 ${slideIndex + 1}">
                </iframe>
            `;
        }
        
        // 更新导航状态
        this.updateNavigation();
        
        // 更新页码显示
        const pageIndicator = document.querySelector('.page-indicator');
        if (pageIndicator) {
            pageIndicator.textContent = `${slideIndex + 1} / ${this.totalSlides}`;
        }
    }

    /**
     * 上一张幻灯片
     */
    prevSlide() {
        if (this.currentSlide > 0) {
            this.showSlide(this.currentSlide - 1);
        }
    }

    /**
     * 下一张幻灯片
     */
    nextSlide() {
        if (this.currentSlide < this.totalSlides - 1) {
            this.showSlide(this.currentSlide + 1);
        }
    }

    /**
     * 缩放控制
     */
    zoomIn() {
        if (this.zoomLevel < this.maxZoom) {
            this.zoomLevel = Math.min(this.zoomLevel * 1.2, this.maxZoom);
            this.applyZoom();
        }
    }

    zoomOut() {
        if (this.zoomLevel > this.minZoom) {
            this.zoomLevel = Math.max(this.zoomLevel / 1.2, this.minZoom);
            this.applyZoom();
        }
    }

    resetZoom() {
        this.zoomLevel = 1;
        this.applyZoom();
    }

    applyZoom() {
        const slideImage = document.querySelector('.slide-image');
        const slideIframe = document.querySelector('.slide-iframe');
        
        if (slideImage) {
            slideImage.style.transform = `scale(${this.zoomLevel})`;
        }
        if (slideIframe) {
            slideIframe.style.transform = `scale(${this.zoomLevel})`;
        }
        
        // 更新缩放指示器
        const zoomIndicator = document.querySelector('.zoom-indicator');
        if (zoomIndicator) {
            zoomIndicator.textContent = `${Math.round(this.zoomLevel * 100)}%`;
        }
    }

    /**
     * 更新导航按钮状态
     */
    updateNavigation() {
        const prevBtn = document.querySelector('.btn-prev-slide');
        const nextBtn = document.querySelector('.btn-next-slide');
        
        if (prevBtn) {
            prevBtn.disabled = this.currentSlide === 0;
        }
        if (nextBtn) {
            nextBtn.disabled = this.currentSlide === this.totalSlides - 1;
        }
    }

    /**
     * 更新查看器UI
     */
    updateViewerUI() {
        const modalTitle = document.querySelector('.viewer-title');
        const modalSubtitle = document.querySelector('.viewer-subtitle');
        
        if (modalTitle && this.currentFile) {
            modalTitle.textContent = this.currentFile.original_name;
        }
        
        if (modalSubtitle && this.currentFile) {
            modalSubtitle.innerHTML = `
                <span>${this.currentFile.file_type.toUpperCase()}</span> • 
                <span>${this.formatFileSize(this.currentFile.file_size || 0)}</span> • 
                <span>${this.totalSlides}页</span>
            `;
        }
    }

    /**
     * 绑定事件处理器
     */
    bindEvents() {
        // 防止重复绑定事件
        if (this.eventsBinding) return;
        this.eventsBinding = true;

        // 键盘事件
        document.addEventListener('keydown', (e) => {
            if (!document.getElementById('pptViewerModal')?.classList.contains('active')) return;
            
            switch (e.key) {
                case 'ArrowLeft':
                case 'ArrowUp':
                    e.preventDefault();
                    this.prevSlide();
                    break;
                case 'ArrowRight':
                case 'ArrowDown':
                case ' ':
                    e.preventDefault();
                    this.nextSlide();
                    break;
                case 'Escape':
                    this.close();
                    break;
                case '+':
                case '=':
                    e.preventDefault();
                    this.zoomIn();
                    break;
                case '-':
                    e.preventDefault();
                    this.zoomOut();
                    break;
                case '0':
                    e.preventDefault();
                    this.resetZoom();
                    break;
            }
        });

        // 绑定按钮点击事件
        this.bindButtonEvents();
    }

    /**
     * 绑定按钮事件
     */
    bindButtonEvents() {
        // 等待DOM元素创建后再绑定
        setTimeout(() => {
            // 关闭按钮
            const btnClose = document.getElementById('btnViewerClose');
            if (btnClose) {
                btnClose.onclick = () => this.close();
            }

            // 导航按钮
            const btnPrev = document.getElementById('btnPrevSlide');
            if (btnPrev) {
                btnPrev.onclick = () => this.prevSlide();
            }

            const btnNext = document.getElementById('btnNextSlide');
            if (btnNext) {
                btnNext.onclick = () => this.nextSlide();
            }

            // 缩放按钮
            const btnZoomOut = document.getElementById('btnZoomOut');
            if (btnZoomOut) {
                btnZoomOut.onclick = () => this.zoomOut();
            }

            const btnZoomReset = document.getElementById('btnZoomReset');
            if (btnZoomReset) {
                btnZoomReset.onclick = () => this.resetZoom();
            }

            const btnZoomIn = document.getElementById('btnZoomIn');
            if (btnZoomIn) {
                btnZoomIn.onclick = () => this.zoomIn();
            }

            // 全屏按钮
            const btnFullscreen = document.getElementById('btnFullscreen');
            if (btnFullscreen) {
                btnFullscreen.onclick = () => this.toggleFullscreen();
            }

            // 触摸事件
            const slideContainer = document.getElementById('slideContainer');
            if (slideContainer) {
                slideContainer.addEventListener('touchstart', (e) => this.handleTouchStart(e));
                slideContainer.addEventListener('touchend', (e) => this.handleTouchEnd(e));
            }
        }, 100);
    }

    /**
     * 处理触摸事件
     */
    handleTouchStart(e) {
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
    }

    handleTouchEnd(e) {
        if (!this.touchStartX || !this.touchStartY) return;
        
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        
        const diffX = this.touchStartX - touchEndX;
        const diffY = this.touchStartY - touchEndY;
        
        // 只处理水平滑动
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
            if (diffX > 0) {
                // 向左滑动 - 下一张
                this.nextSlide();
            } else {
                // 向右滑动 - 上一张
                this.prevSlide();
            }
        }
        
        this.touchStartX = 0;
        this.touchStartY = 0;
    }

    /**
     * 创建查看器模态框
     */
    createViewerModal() {
        let modal = document.getElementById('ppt-viewer-modal');
        if (modal) {
            return; // 已存在
        }
        
        modal = document.createElement('div');
        modal.id = 'ppt-viewer-modal';
        modal.className = 'ppt-viewer-modal';
        
        modal.innerHTML = `
            <div class="viewer-backdrop"></div>
            <div class="viewer-content">
                <div class="viewer-header">
                    <div class="viewer-info">
                        <h3 class="viewer-title">PPT预览</h3>
                        <div class="viewer-subtitle"></div>
                    </div>
                    <div class="viewer-controls">
                        <span class="page-indicator">1 / 1</span>
                        <span class="zoom-indicator">100%</span>
                        <button class="btn-viewer-close" title="关闭">✕</button>
                    </div>
                </div>
                
                <div class="viewer-body">
                    <div class="slide-container"></div>
                    
                    <!-- 导航按钮 -->
                    <button class="btn-slide-nav btn-prev-slide" title="上一张">❮</button>
                    <button class="btn-slide-nav btn-next-slide" title="下一张">❯</button>
                    
                    <!-- 工具栏 -->
                    <div class="viewer-toolbar">
                        <div class="toolbar-group">
                            <button class="btn-zoom-out" title="缩小">−</button>
                            <button class="btn-zoom-reset" title="重置缩放">⌂</button>
                            <button class="btn-zoom-in" title="放大">+</button>
                        </div>
                        <div class="toolbar-group">
                            <button class="btn-fullscreen" title="全屏">⛶</button>
                            <button class="btn-download" title="下载">⬇</button>
                        </div>
                    </div>
                </div>
                
                <div class="viewer-loading">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">正在加载...</div>
                </div>
                
                <div class="viewer-error" style="display: none;">
                    <div class="error-icon">⚠</div>
                    <div class="error-text"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 绑定事件
        this.bindModalEvents(modal);
    }

    /**
     * 绑定模态框事件
     */
    bindModalEvents(modal) {
        // 关闭按钮
        modal.querySelector('.btn-viewer-close').addEventListener('click', () => this.close());
        modal.querySelector('.viewer-backdrop').addEventListener('click', () => this.close());
        
        // 导航按钮
        modal.querySelector('.btn-prev-slide').addEventListener('click', () => this.prevSlide());
        modal.querySelector('.btn-next-slide').addEventListener('click', () => this.nextSlide());
        
        // 缩放按钮
        modal.querySelector('.btn-zoom-in').addEventListener('click', () => this.zoomIn());
        modal.querySelector('.btn-zoom-out').addEventListener('click', () => this.zoomOut());
        modal.querySelector('.btn-zoom-reset').addEventListener('click', () => this.resetZoom());
        
        // 全屏按钮
        modal.querySelector('.btn-fullscreen').addEventListener('click', () => this.toggleFullscreen());
        
        // 下载按钮
        modal.querySelector('.btn-download').addEventListener('click', () => this.downloadFile());
        
        // 触摸事件
        const slideContainer = modal.querySelector('.slide-container');
        slideContainer.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        slideContainer.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        
        // 鼠标滚轮缩放
        slideContainer.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                if (e.deltaY < 0) {
                    this.zoomIn();
                } else {
                    this.zoomOut();
                }
            }
        });
    }

    /**
     * 切换全屏
     */
    toggleFullscreen() {
        const modal = document.getElementById('ppt-viewer-modal');
        if (modal.classList.contains('fullscreen')) {
            modal.classList.remove('fullscreen');
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        } else {
            modal.classList.add('fullscreen');
            if (modal.requestFullscreen) {
                modal.requestFullscreen();
            }
        }
    }

    /**
     * 下载文件
     */
    async downloadFile() {
        if (!this.currentFile) return;
        
        try {
            const serverUrl = BACKEND_URL;
            const downloadUrl = `${serverUrl}/ppt/files/${this.currentFile.id}/download`;
            
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = this.currentFile.original_name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (error) {
            console.error('下载失败:', error);
            alert('下载失败');
        }
    }

    /**
     * 显示/隐藏加载状态
     */
    showLoading(show) {
        const loadingEl = document.querySelector('.viewer-loading');
        if (loadingEl) {
            loadingEl.style.display = show ? 'flex' : 'none';
        }
    }

    /**
     * 显示错误信息
     */
    showError(message) {
        const errorEl = document.querySelector('.viewer-error');
        const errorText = document.querySelector('.error-text');
        
        if (errorEl && errorText) {
            errorText.textContent = message;
            errorEl.style.display = 'flex';
        }
    }

    /**
     * 关闭查看器
     */
    close() {
        const modal = document.getElementById('ppt-viewer-modal');
        if (modal) {
            modal.classList.remove('active', 'fullscreen');
            document.body.classList.remove('modal-open');
            
            // 重置状态
            this.currentFile = null;
            this.currentSlide = 0;
            this.slides = [];
            this.zoomLevel = 1;
        }
    }

    /**
     * 格式化文件大小
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// 创建全局实例
export const pptViewer = new PPTViewer();