// js/common/api.js

const BACKEND_URL = 'http://localhost:5000';
// const BACKEND_URL = "https://89a39c1476f74a949b6e7dddabaf7ba4--35427.ap-shanghai2.cloudstudio.club";
// const BACKEND_URL = "https://89a39c1476f74a949b6e7dddabaf7ba4--8000.ap-shanghai2.cloudstudio.club";

/**
 * 与AI后端进行对话 - 支持流式传输
 * @param {Array} messages - 完整对话消息数组
 * @param {string} apiKey - 用户的 API Key
 * @param {string} apiEndpoint - API 端点
 * @param {Function} onChunk - 接收流式数据的回调函数
 * @returns {Promise<void>}
 */
export async function fetchAiResponseStream(messages, apiKey, apiEndpoint, onChunk) {

    const response = await fetch(`${BACKEND_URL}/ai/chat/stream`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messages: messages,  // 发送完整对话历史
            apiKey: apiKey,
            apiEndpoint: apiEndpoint
        })
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `HTTP error! status: ${response.status}`);
    }

    console.log('response', response);
    // 处理Server-Sent Events
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            // console.log('chunk', chunk);
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        onChunk(data);

                        // 如果传输完成，退出循环
                        if (data.done) {
                            return;
                        }
                        
                    } catch (e) {
                        console.warn('解析流式数据失败:', e, line);
                    }
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}

/**
 * 与AI后端进行对话 - 支持持久记忆
 * @param {Array} messages - 完整对话消息数组
 * @param {string} apiKey - 用户的 API Key
 * @param {string} apiEndpoint - API 端点
 * @returns {Promise<Object>} - AI的响应数据
 */
export async function fetchAiResponse(messages, apiKey, apiEndpoint) {
    const response = await fetch(`${BACKEND_URL}/ai/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messages: messages,  // 发送完整对话历史
            apiKey: apiKey,
            apiEndpoint: apiEndpoint
        })
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
}

/**
 * 获取所有错题
 * @returns {Promise<Array>} - 错题列表
 */
export async function fetchMistakes() {
    const response = await fetch(`${BACKEND_URL}/mistakes`);
    if (!response.ok) {
        throw new Error('获取错题失败');
    }
    const data = await response.json();
    return data.mistakes || [];
}

/**
 * 保存新的错题到后端
 * @param {Object} mistake - 新的错题对象
 * @returns {Promise<void>}
 */
export async function saveMistake(mistake) {
    // 这个函数用于添加一个全新的错题记录
    const currentMistakes = await fetchMistakes();
    currentMistakes.unshift(mistake);

    const response = await fetch(`${BACKEND_URL}/mistakes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mistakes: currentMistakes })
    });

    if (!response.ok) {
        throw new Error('保存错题失败');
    }
}

/**
 * 更新一个已存在的错题
 * @param {number} mistakeId - 错题的ID
 * @param {Object} updatedMistake - 更新后的错题对象
 * @returns {Promise<Object>}
 */
export async function updateMistake(mistakeId, updatedMistake) {
    const response = await fetch(`${BACKEND_URL}/mistakes/${mistakeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMistake)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '更新错题失败');
    }
    // 后端应返回更新后的完整错题对象
    return response.json(); 
}

/**
 * 删除一个错题
 * @param {number} mistakeId - 错题的ID
 * @returns {Promise<Object>}
 */
export async function deleteMistake(mistakeId) {
    const response = await fetch(`${BACKEND_URL}/mistakes/${mistakeId}`, {
        method: 'DELETE'
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '删除错题失败');
    }
    
    return response.json();
}

// PPT 文件管理相关 API 函数

/**
 * 获取所有PPT文件列表（携带session）
 * @returns {Promise<Array>} - PPT文件列表
 */
export async function fetchPPTFiles() {
    try {
        const response = await fetch(`${BACKEND_URL}/ppt/files`, {
            credentials: 'include'  // 携带cookie/session
        });
        if (!response.ok) {
            throw new Error(`获取PPT文件列表失败: ${response.status}`);
        }
        const data = await response.json();
        return data.ppt_files || [];
    } catch (error) {
        console.error('获取PPT文件列表错误:', error);
        throw new Error(`获取PPT文件列表失败: ${error.message}`);
    }
}

/**
 * 上传PPT文件
 * @param {File} file - 要上传的文件对象
 * @param {string} description - 文件描述 (可选)
 * @param {Array<string>} tags - 文件标签 (可选)
 * @param {Function} onProgress - 上传进度回调函数 (可选)
 * @returns {Promise<Object>} - 上传结果
 */
export async function uploadPPTFile(file, description = '', tags = [], onProgress = null) {
    try {
        if (!file) {
            throw new Error('文件不能为空');
        }

        // 验证文件类型
        const allowedTypes = ['ppt', 'pptx', 'doc', 'docx', 'pdf'];
        const fileExtension = file.name.split('.').pop().toLowerCase();
        if (!allowedTypes.includes(fileExtension)) {
            throw new Error(`不支持的文件类型: ${fileExtension}`);
        }

        // 验证文件大小 (限制50MB)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
            throw new Error('文件大小不能超过50MB');
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('description', description);
        formData.append('tags', JSON.stringify(tags));

        // 创建XMLHttpRequest以支持上传进度
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            // 上传进度监听
            if (onProgress) {
                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        const percentComplete = Math.round((event.loaded / event.total) * 100);
                        onProgress(percentComplete, event.loaded, event.total);
                    }
                };
            }

            xhr.onload = () => {
                if (xhr.status === 200) {
                    try {
                        const result = JSON.parse(xhr.responseText);
                        resolve(result);
                    } catch (e) {
                        reject(new Error('响应数据解析失败'));
                    }
                } else {
                    try {
                        const error = JSON.parse(xhr.responseText);
                        reject(new Error(error.error || `上传失败: ${xhr.status}`));
                    } catch (e) {
                        reject(new Error(`上传失败: ${xhr.status}`));
                    }
                }
            };

            xhr.onerror = () => reject(new Error('网络错误，上传失败'));
            xhr.ontimeout = () => reject(new Error('上传超时'));

            xhr.timeout = 300000; // 5分钟超时
            xhr.open('POST', `${BACKEND_URL}/ppt/upload`);
            xhr.withCredentials = true;  // 携带cookie/session
            xhr.send(formData);
        });

    } catch (error) {
        console.error('上传PPT文件错误:', error);
        throw error;
    }
}

/**
 * 下载PPT文件
 * @param {number} pptId - PPT文件ID
 * @param {string} filename - 下载时的文件名 (可选)
 * @returns {Promise<void>} - 触发浏览器下载
 */
export async function downloadPPTFile(pptId, filename = null) {
    try {
        if (!pptId) {
            throw new Error('PPT文件ID不能为空');
        }

        const response = await fetch(`${BACKEND_URL}/ppt/files/${pptId}/download`, {
            credentials: 'include'  // 携带cookie/session
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `下载失败: ${response.status}`);
        }

        // 获取文件blob数据
        const blob = await response.blob();
        
        // 从响应头获取文件名
        const contentDisposition = response.headers.get('Content-Disposition');
        let downloadFilename = filename;
        if (!downloadFilename && contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch) {
                downloadFilename = filenameMatch[1].replace(/['"]/g, '');
            }
        }
        
        // 创建下载链接并触发下载
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = downloadFilename || `ppt_file_${pptId}`;
        document.body.appendChild(a);
        a.click();
        
        // 清理
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

    } catch (error) {
        console.error('下载PPT文件错误:', error);
        throw new Error(`下载失败: ${error.message}`);
    }
}

/**
 * 删除PPT文件
 * @param {number} pptId - PPT文件ID
 * @returns {Promise<void>}
 */
export async function deletePPTFile(pptId) {
    try {
        if (!pptId) {
            throw new Error('PPT文件ID不能为空');
        }

        const response = await fetch(`${BACKEND_URL}/ppt/files/${pptId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `删除失败: ${response.status}`);
        }

        return await response.json();

    } catch (error) {
        console.error('删除PPT文件错误:', error);
        throw new Error(`删除失败: ${error.message}`);
    }
}

/**
 * 批量删除PPT文件
 * @param {Array<number>} pptIds - PPT文件ID数组
 * @returns {Promise<Object>} - 删除结果统计
 */
export async function batchDeletePPTFiles(pptIds) {
    try {
        if (!pptIds || !Array.isArray(pptIds) || pptIds.length === 0) {
            throw new Error('PPT文件ID列表不能为空');
        }

        const response = await fetch(`${BACKEND_URL}/ppt/files/batch-delete`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',  // 携带cookie/session
            body: JSON.stringify({ ids: pptIds })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `批量删除失败: ${response.status}`);
        }

        return await response.json();

    } catch (error) {
        console.error('批量删除PPT文件错误:', error);
        throw new Error(`批量删除失败: ${error.message}`);
    }
}

/**
 * 获取PPT文件统计信息
 * @returns {Promise<Object>} - 统计数据
 */
export async function getPPTFileStats() {
    try {
        const response = await fetch(`${BACKEND_URL}/ppt/stats`);
        if (!response.ok) {
            throw new Error(`获取统计信息失败: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('获取PPT统计信息错误:', error);
        throw new Error(`获取统计信息失败: ${error.message}`);
    }
}

/**
 * 搜索PPT文件
 * @param {string} query - 搜索关键词
 * @param {Object} filters - 搜索过滤条件 (可选)
 * @returns {Promise<Array>} - 搜索结果
 */
export async function searchPPTFiles(query, filters = {}) {
    try {
        const params = new URLSearchParams();
        if (query) params.append('q', query);
        
        // 添加过滤条件
        Object.keys(filters).forEach(key => {
            if (filters[key] !== undefined && filters[key] !== null) {
                params.append(key, filters[key]);
            }
        });

        const response = await fetch(`${BACKEND_URL}/ppt/search?${params}`);
        if (!response.ok) {
            throw new Error(`搜索失败: ${response.status}`);
        }
        
        const data = await response.json();
        return data.results || [];
    } catch (error) {
        console.error('搜索PPT文件错误:', error);
        throw new Error(`搜索失败: ${error.message}`);
    }
}

// ================================
// PPT 文件预览相关 API 函数
// ================================

/**
 * 获取文件预览URL
 * @param {number} pptId - PPT文件ID
 * @param {string} previewType - 预览类型 ('pdf', 'thumbnail', 'slides')
 * @returns {Promise<string>} - 预览URL
 */
export async function getPPTPreviewUrl(pptId, previewType = 'pdf') {
    try {
        if (!pptId) {
            throw new Error('PPT文件ID不能为空');
        }

        const response = await fetch(`${BACKEND_URL}/ppt/files/${pptId}/preview?type=${previewType}`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `获取预览失败: ${response.status}`);
        }

        const data = await response.json();
        return data.preview_url;

    } catch (error) {
        console.error('获取PPT预览URL错误:', error);
        throw new Error(`获取预览失败: ${error.message}`);
    }
}

/**
 * 获取文件缩略图
 * @param {number} pptId - PPT文件ID
 * @param {Object} options - 缩略图选项
 * @returns {Promise<string>} - 缩略图Base64数据或URL
 */
export async function getPPTThumbnail(pptId, options = {}) {
    try {
        if (!pptId) {
            throw new Error('PPT文件ID不能为空');
        }

        const { width = 200, height = 150, quality = 80 } = options;
        const params = new URLSearchParams({ width, height, quality });

        const response = await fetch(`${BACKEND_URL}/ppt/files/${pptId}/thumbnail?${params}`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `获取缩略图失败: ${response.status}`);
        }

        // 检查返回的内容类型
        const contentType = response.headers.get('Content-Type');
        
        if (contentType && contentType.startsWith('image/')) {
            // 返回图片数据，转换为Base64
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
        } else {
            // 返回JSON格式的URL
            const data = await response.json();
            return data.thumbnail_url;
        }

    } catch (error) {
        console.error('获取PPT缩略图错误:', error);
        throw new Error(`获取缩略图失败: ${error.message}`);
    }
}

/**
 * 预览PPT文件 - 在新窗口中打开
 * @param {number} pptId - PPT文件ID
 * @param {Object} options - 预览选项
 */
export async function previewPPTFile(pptId, options = {}) {
    try {
        if (!pptId) {
            throw new Error('PPT文件ID不能为空');
        }

        const { 
            newWindow = true, 
            previewType = 'auto',
            windowName = '_blank'
        } = options;

        // 获取文件信息以确定预览方式
        const files = await fetchPPTFiles();
        const file = files.find(f => f.id === pptId);
        
        if (!file) {
            throw new Error('文件不存在');
        }

        let previewUrl;
        const fileExt = file.file_type.toLowerCase();

        // 根据文件类型确定预览策略
        switch (fileExt) {
            case 'pdf':
                // PDF文件直接使用浏览器预览
                previewUrl = `${BACKEND_URL}/ppt/files/${pptId}/preview?type=direct`;
                break;
                
            case 'ppt':
            case 'pptx':
                // PPT文件转换为PDF预览
                if (previewType === 'auto' || previewType === 'pdf') {
                    previewUrl = await getPPTPreviewUrl(pptId, 'pdf');
                } else if (previewType === 'slides') {
                    previewUrl = await getPPTPreviewUrl(pptId, 'slides');
                }
                break;
                
            case 'doc':
            case 'docx':
                // Word文件转换为PDF预览
                previewUrl = await getPPTPreviewUrl(pptId, 'pdf');
                break;
                
            default:
                throw new Error(`不支持预览此文件类型: ${fileExt}`);
        }

        if (newWindow) {
            // 在新窗口中打开预览
            const previewWindow = window.open(previewUrl, windowName, 
                'width=1200,height=800,scrollbars=yes,resizable=yes,menubar=no,toolbar=no'
            );
            
            if (!previewWindow) {
                throw new Error('无法打开预览窗口，可能被浏览器阻止弹窗');
            }
            
            return previewWindow;
        } else {
            // 返回预览URL供页面内嵌使用
            return previewUrl;
        }

    } catch (error) {
        console.error('预览PPT文件错误:', error);
        throw new Error(`预览失败: ${error.message}`);
    }
}

/**
 * 获取PPT文件的幻灯片列表（用于幻灯片浏览器）
 * @param {number} pptId - PPT文件ID
 * @returns {Promise<Array>} - 幻灯片信息数组
 */
export async function getPPTSlides(pptId) {
    try {
        if (!pptId) {
            throw new Error('PPT文件ID不能为空');
        }

        const response = await fetch(`${BACKEND_URL}/ppt/files/${pptId}/slides`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `获取幻灯片失败: ${response.status}`);
        }

        const data = await response.json();
        return data.slides || [];

    } catch (error) {
        console.error('获取PPT幻灯片错误:', error);
        throw new Error(`获取幻灯片失败: ${error.message}`);
    }
}

/**
 * 创建嵌入式预览组件
 * @param {number} pptId - PPT文件ID
 * @param {HTMLElement} container - 容器元素
 * @param {Object} options - 预览选项
 */
export async function createEmbeddedPreview(pptId, container, options = {}) {
    try {
        if (!pptId || !container) {
            throw new Error('PPT文件ID和容器元素不能为空');
        }

        const {
            width = '100%',
            height = '600px',
            showToolbar = true,
            showSlideNavigation = true
        } = options;

        // 获取文件信息
        const files = await fetchPPTFiles();
        const file = files.find(f => f.id === pptId);
        
        if (!file) {
            throw new Error('文件不存在');
        }

        const fileExt = file.file_type.toLowerCase();
        
        // 清空容器
        container.innerHTML = '';
        container.style.position = 'relative';
        container.style.width = width;
        container.style.height = height;

        if (fileExt === 'pdf') {
            // PDF文件使用iframe预览
            const iframe = document.createElement('iframe');
            iframe.src = `${BACKEND_URL}/ppt/files/${pptId}/preview?type=direct`;
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            container.appendChild(iframe);
            
        } else if (['ppt', 'pptx'].includes(fileExt)) {
            // PPT文件创建幻灯片浏览器
            await createSlideViewer(pptId, container, { showToolbar, showSlideNavigation });
            
        } else {
            // 其他文件类型显示缩略图
            const thumbnail = await getPPTThumbnail(pptId);
            const img = document.createElement('img');
            img.src = thumbnail;
            img.style.maxWidth = '100%';
            img.style.maxHeight = '100%';
            img.style.objectFit = 'contain';
            container.appendChild(img);
        }

    } catch (error) {
        console.error('创建嵌入式预览错误:', error);
        // 显示错误信息
        container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; 
                        background: #f5f5f5; color: #666; font-family: Arial, sans-serif;">
                <div style="text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📄</div>
                    <div>预览失败: ${error.message}</div>
                </div>
            </div>
        `;
        throw error;
    }
}

/**
 * 创建幻灯片浏览器组件
 * @param {number} pptId - PPT文件ID  
 * @param {HTMLElement} container - 容器元素
 * @param {Object} options - 选项
 */
async function createSlideViewer(pptId, container, options = {}) {
    const { showToolbar = true, showSlideNavigation = true } = options;
    
    try {
        const slides = await getPPTSlides(pptId);
        
        if (!slides || slides.length === 0) {
            throw new Error('没有找到幻灯片');
        }

        let currentSlide = 0;

        // 创建界面结构
        container.innerHTML = `
            <div class="slide-viewer" style="height: 100%; display: flex; flex-direction: column;">
                ${showToolbar ? `
                <div class="slide-toolbar" style="padding: 10px; background: #f8f9fa; border-bottom: 1px solid #dee2e6; display: flex; justify-content: space-between; align-items: center;">
                    <div class="slide-info">幻灯片 <span id="current-slide">1</span> / <span id="total-slides">${slides.length}</span></div>
                    <div class="slide-controls">
                        <button id="prev-slide" style="margin-right: 8px; padding: 4px 8px;">上一张</button>
                        <button id="next-slide" style="padding: 4px 8px;">下一张</button>
                    </div>
                </div>
                ` : ''}
                <div class="slide-content" style="flex: 1; display: flex; align-items: center; justify-content: center; background: #fff;">
                    <img id="slide-image" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
                </div>
                ${showSlideNavigation ? `
                <div class="slide-thumbnails" style="height: 80px; padding: 10px; background: #f8f9fa; border-top: 1px solid #dee2e6; overflow-x: auto; display: flex; gap: 8px;">
                    ${slides.map((slide, index) => `
                        <img class="thumbnail" data-slide="${index}" 
                             src="${slide.thumbnail_url}" 
                             style="height: 60px; cursor: pointer; border: 2px solid transparent; object-fit: cover;"
                             onclick="showSlide(${index})" />
                    `).join('')}
                </div>
                ` : ''}
            </div>
        `;

        // 显示幻灯片函数
        const showSlide = (index) => {
            if (index < 0 || index >= slides.length) return;
            
            currentSlide = index;
            const slideImage = container.querySelector('#slide-image');
            const currentSlideSpan = container.querySelector('#current-slide');
            
            if (slideImage) slideImage.src = slides[index].image_url;
            if (currentSlideSpan) currentSlideSpan.textContent = index + 1;
            
            // 更新缩略图选中状态
            container.querySelectorAll('.thumbnail').forEach((thumb, i) => {
                thumb.style.border = i === index ? '2px solid #007bff' : '2px solid transparent';
            });
        };

        // 绑定事件
        if (showToolbar) {
            const prevBtn = container.querySelector('#prev-slide');
            const nextBtn = container.querySelector('#next-slide');
            
            if (prevBtn) prevBtn.onclick = () => showSlide(currentSlide - 1);
            if (nextBtn) nextBtn.onclick = () => showSlide(currentSlide + 1);
        }

        if (showSlideNavigation) {
            container.querySelectorAll('.thumbnail').forEach((thumb, index) => {
                thumb.onclick = () => showSlide(index);
            });
        }

        // 键盘导航
        const handleKeyPress = (e) => {
            if (e.key === 'ArrowLeft') showSlide(currentSlide - 1);
            if (e.key === 'ArrowRight') showSlide(currentSlide + 1);
        };
        
        container.addEventListener('keydown', handleKeyPress);
        container.tabIndex = 0; // 使容器可以接收键盘事件

        // 显示第一张幻灯片
        showSlide(0);

        // 将showSlide函数暴露到全局，供onclick使用
        window.showSlide = showSlide;

    } catch (error) {
        console.error('创建幻灯片浏览器错误:', error);
        throw error;
    }
}