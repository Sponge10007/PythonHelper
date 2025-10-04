// js/mistake_manager/ppt_upload.js - PPT上传功能

import * as api from '../common/api.js';

class PPTUploadManager {
    constructor() {
        this.isUploading = false;
    }

    init() {
        // 确保DOM加载完成后再绑定事件
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.bindEvents());
        } else {
            this.bindEvents();
        }
    }

    bindEvents() {
        const fileInput = document.getElementById('pptFileInput');
        if (!fileInput) {
            console.error('找不到文件输入框 pptFileInput');
            return;
        }

        console.log('PPT上传模块已加载，绑定文件选择事件');

        // 清除可能存在的旧事件监听器
        fileInput.removeEventListener('change', this.handleFileSelection);
        
        // 绑定文件选择事件
        fileInput.addEventListener('change', (e) => {
            this.handleFileSelection(e);
        });

        // 确保文件输入框可见且可点击
        fileInput.style.pointerEvents = 'auto';
        
        console.log('文件选择事件已绑定');
    }

    async handleFileSelection(event) {
        const files = event.target.files;
        console.log('文件选择事件触发，选择的文件:', files);
        
        if (!files || files.length === 0) {
            console.log('没有选择文件');
            return;
        }

        if (this.isUploading) {
            console.log('正在上传中，请稍候...');
            return;
        }

        console.log(`开始上传 ${files.length} 个文件`);
        this.isUploading = true;

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                console.log(`上传文件 ${i + 1}/${files.length}: ${file.name} (${file.size} bytes)`);
                
                const result = await api.uploadPPTFile(file);
                console.log(`文件 ${file.name} 上传完成，结果:`, result);
            }

            console.log('所有文件上传完成');
            
            // 刷新页面显示
            if (window.pageManager && window.pageManager.pptHandler) {
                console.log('刷新PPT文件列表');
                await window.pageManager.pptHandler.init();
            }

        } catch (error) {
            console.error('上传失败:', error);
        } finally {
            this.isUploading = false;
            // 清空文件输入框，允许重新选择相同文件
            event.target.value = '';
            console.log('上传流程结束');
        }
    }
}

// 创建全局实例
const uploadManager = new PPTUploadManager();
uploadManager.init();

export { PPTUploadManager };
