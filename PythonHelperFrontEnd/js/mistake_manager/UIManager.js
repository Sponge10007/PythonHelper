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
        this.editCategory.value = mistake.category || '其他';
        this.editDifficulty.value = mistake.difficulty || '中等';
        const lessonTag = mistake.tags ? mistake.tags.find(tag => isLessonTag(tag)) : '';
        this.editLesson.value = lessonTag || '';
    }

    getEditModalData() {
        const lesson = this.editLesson.value;
        return {
            title: this.editTitle.value.trim(),
            category: this.editCategory.value,
            difficulty: this.editDifficulty.value,
            tags: lesson ? [lesson] : [],
        };
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

    renderPPTGrid(pptFiles, onPreview, onDownload) {
        this.pptGrid.innerHTML = '';
        if (pptFiles.length === 0) {
            this.pptGrid.innerHTML = '<div>暂无PPT文件</div>';
            return;
        }
        pptFiles.forEach(ppt => {
            const pptCard = this.createPPTCardElement(ppt);
            pptCard.querySelector('.btn-preview').addEventListener('click', () => onPreview(ppt.id));
            pptCard.querySelector('.btn-download').addEventListener('click', () => onDownload(ppt.id));
            this.pptGrid.appendChild(pptCard);
        });
    }
    
    createPPTCardElement(ppt) {
        const pptCard = document.createElement('div');
        pptCard.className = 'ppt-card';
        // ... (此处省略PPT卡片的具体innerHTML，因为它与问题无关，保持原样即可)
        return pptCard;
    }
}