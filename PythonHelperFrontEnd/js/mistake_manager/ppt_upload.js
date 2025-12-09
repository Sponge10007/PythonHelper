// js/mistake_manager/ppt_upload_simple.js - 简化的PPT上传功能

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
        fileInput.addEventListener('change', (event) => {
            this.handleFileSelection(event);
        });
    }

    async handleFileSelection(event) {
        const files = Array.from(event.target.files);
        
        if (files.length === 0) {
            console.log('没有选择文件');
            return;
        }

        console.log(`选择了 ${files.length} 个文件`);

        if (this.isUploading) {
            console.log('正在上传中，请稍候...');
            return;
        }

        console.log(`开始上传 ${files.length} 个文件`);
        this.isUploading = true;

        let successCount = 0;
        let failCount = 0;

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                console.log(`上传文件 ${i + 1}/${files.length}: ${file.name} (${file.size} bytes)`);
                
                try {
                    const result = await api.uploadPPTFile(file);
                    console.log(`文件 ${file.name} 上传完成，结果:`, result);
                    successCount++;
                } catch (error) {
                    console.error(`上传 ${file.name} 失败:`, error);
                    failCount++;
                }
            }

            console.log(`上传完成：成功 ${successCount} 个，失败 ${failCount} 个`);
            
            // 如果有成功上传的文件，刷新页面显示
            if (successCount > 0) {
                console.log('有文件上传成功，开始刷新PPT文件列表');
                await this.refreshPPTList();
            }

        } catch (error) {
            console.error('上传过程出错:', error);
        } finally {
            this.isUploading = false;
            // 清空文件输入框，允许重新选择相同文件
            event.target.value = '';
            console.log('上传流程结束');
        }
    }

    /**
     * 简单直接的刷新方法
     */
    async refreshPPTList() {
        console.log('开始刷新PPT文件列表...');
        
        // 等待一下确保后端处理完成
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // 方法1: 直接调用全局pptHandler的init方法
        if (window.pptHandler && typeof window.pptHandler.init === 'function') {
            console.log('通过全局pptHandler刷新');
            try {
                await window.pptHandler.init();
                console.log('PPT列表刷新成功');
                return;
            } catch (error) {
                console.error('pptHandler.init()失败:', error);
            }
        }

        // 方法2: 发送自定义事件通知刷新
        console.log('发送刷新事件');
        const event = new CustomEvent('refreshPPTList');
        document.dispatchEvent(event);
    }
}

// 创建全局实例
const uploadManager = new PPTUploadManager();
uploadManager.init();

export { PPTUploadManager };