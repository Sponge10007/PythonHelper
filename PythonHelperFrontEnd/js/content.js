// 内容脚本 - 运行在网页上下文中
class ContentScript {
    constructor() {
        this.selectedText = '';
        this.lastSelectionTime = 0;
        this.debounceDelay = 300; // 防抖延迟
        this.isExtensionAvailable = false; // 检查扩展是否可用
        
        this.init();
    }

    init() {
        // 检查扩展是否可用
        this.checkExtensionAvailability();
        
        // 监听文本选中事件
        document.addEventListener('mouseup', (e) => this.handleTextSelection(e));
        document.addEventListener('keyup', (e) => this.handleTextSelection(e));
        
        // 监听来自background script的消息
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                if (message.type === 'GET_SELECTED_TEXT') {
                    sendResponse({ text: this.selectedText });
                }
            });

            // 通知background script内容脚本已加载
            try {
                chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_LOADED' }).catch(error => {
                    console.log('发送内容脚本加载消息失败:', error);
                });
            } catch (error) {
                console.log('发送内容脚本加载消息异常:', error);
            }
        }
    }

    handleTextSelection(event) {
        // 防抖处理
        const now = Date.now();
        if (now - this.lastSelectionTime < this.debounceDelay) {
            return;
        }
        this.lastSelectionTime = now;

        // 获取选中的文本
        const selection = window.getSelection();
        const text = selection.toString().trim();

        // 如果选中的文本发生变化，发送消息
        if (text !== this.selectedText) {
            this.selectedText = text;
            
            // 只有在扩展可用时才发送消息
            if (this.isExtensionAvailable) {
                // 发送选中的文本到background script
                try {
                    chrome.runtime.sendMessage({
                        type: 'TEXT_SELECTED',
                        text: text,
                        url: window.location.href,
                        title: document.title
                    }).catch(error => {
                        console.log('发送选中文本消息失败:', error);
                    });
                } catch (error) {
                    console.log('发送选中文本消息异常:', error);
                }
            } else {
                console.log('扩展不可用，无法发送选中文本消息');
            }
        }
    }
    
    checkExtensionAvailability() {
        // 检查Chrome扩展API是否可用
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
            this.isExtensionAvailable = true;
            console.log('Chrome扩展API可用');
        } else {
            this.isExtensionAvailable = false;
            console.log('Chrome扩展API不可用，可能是非扩展环境');
        }
    }

    // 高亮选中的文本（可选功能）
    highlightSelection() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const span = document.createElement('span');
            span.style.backgroundColor = 'yellow';
            span.style.opacity = '0.3';
            
            try {
                range.surroundContents(span);
            } catch (e) {
                console.log('无法高亮选中的文本');
            }
        }
    }

    // 清除高亮
    clearHighlights() {
        const highlights = document.querySelectorAll('span[style*="background-color: yellow"]');
        highlights.forEach(highlight => {
            const parent = highlight.parentNode;
            parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
            parent.normalize();
        });
    }
}

// 初始化内容脚本
new ContentScript(); 