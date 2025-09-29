// js/sidebar/SidebarManager.js
// 注意：UIManager, ChatManager, SettingsManager 将通过全局window对象访问

// 获取后端URL函数
function getBackendUrl() {
    // 在Chrome扩展中检测环境
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        return 'http://localhost:5000';
    }
    // 备用检测
    const isLocalDev = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname === '';
    return isLocalDev ? 'http://localhost:5000' : 'http://47.98.249.0:8888';
}

class SidebarManager {
    constructor() {
        this.ui = new window.UIManager();
        this.chatManager = new window.ChatManager(this.ui);
        // 新增：实例化 SettingsManager
        this.settingsManager = new window.SettingsManager(this.ui);
        
        // 验证码发送状态跟踪
        this.verificationSent = false;
        
        this.bindEvents();
        this.init();
    }

    async init() {
        await this.chatManager.init();
        await this.settingsManager.init();
        await this.checkLoginStatus();
    }    bindEvents() {
        console.log('正在绑定事件...'); // 调试信息
        
        // --- 聊天相关事件 ---
        this.ui.welcomeScreen.querySelector('#startFirstChat').addEventListener('click', () => this.chatManager.createNewChat());
        this.ui.sendMessageBtn.addEventListener('click', (e) => { e.preventDefault(); this.chatManager.sendMessage(this.ui.chatInput.value.trim()); });
        this.ui.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.chatManager.sendMessage(this.ui.chatInput.value.trim());
            }
        });
        this.ui.chatInput.addEventListener('input', () => this.ui.adjustTextareaHeight());
        document.getElementById('clearChatBtn').addEventListener('click', () => this.chatManager.clearCurrentChat());

        // --- 错题事件绑定 ---
        document.getElementById('enterMistakeModeBtn').addEventListener('click', () => this.chatManager.toggleMistakeSelectionMode());
        document.getElementById('saveSelectionBtn').addEventListener('click', () => this.chatManager.saveSelectionToMistakes());
        this.ui.chatMessages.addEventListener('change', (e) => {
            if (e.target.classList.contains('message-selector')) {
                const messageElement = e.target.closest('.message');
                const messageId = messageElement.dataset.messageId;
                this.chatManager.handleMessageSelection(messageId, e.target.checked);
            }
        });

        // --- 图标与视图切换事件 ---
        document.getElementById('toggleChatListBtn').addEventListener('click', () => this.ui.toggleChatList());
        document.getElementById('newChatBtn').addEventListener('click', () => this.chatManager.createNewChat());
        document.getElementById('mistakesBtn').addEventListener('click', () => this.chatManager.showMistakeCollection());
        
        // --- 设置事件绑定 ---
        document.getElementById('settingsBtn').addEventListener('click', () => this.ui.showView(this.ui.settingsInterface));
        this.ui.settingsInterface.querySelector('#saveSettings').addEventListener('click', () => this.handleSaveSettings());

        // --- PTA题目分析事件绑定 ---
        document.getElementById('ptaBtn').addEventListener('click', () => this.ui.showView(this.ui.ptaAnalysisInterface));
        document.getElementById('startPtaAnalysisBtn').addEventListener('click', () => this.handlePtaAnalysis());
        
        // --- 登录按钮事件绑定 ---
        const loginBtn = document.getElementById('loginBtn');
        const loginFromSidebar = document.getElementById('loginFromSidebar');
        
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                this.handleLogin();
            });
        }
        
        if (loginFromSidebar) {
            loginFromSidebar.addEventListener('click', () => {
                this.handleLogin();
            });
        }
        
        // --- 返回按钮事件 ---
        this.bindBackButtons();
        
        // --- 登录界面事件绑定 ---
        this.bindAuthEvents();
        
        // 打开错题管理器页面的按钮 - 使用事件委托
        document.addEventListener('click', (e) => {
            console.log('点击事件:', e.target.id, e.target.className, e.target); // 调试所有点击
            
            if (e.target && (e.target.id === 'openMistakeManagerBtn' || e.target.closest('#openMistakeManagerBtn'))) {
                console.log('🎯 点击了错题管理器按钮!'); // 调试信息
                e.preventDefault();
                e.stopPropagation();
                
                // 设置iframe的src为正确的扩展URL
                const iframe = document.getElementById('mistakeManagerFrame');
                if (iframe) {
                    iframe.src = chrome.runtime.getURL('html/mistake_manager.html');
                    console.log('📄 设置iframe src:', iframe.src);
                } else {
                    console.log('❌ 未找到iframe!');
                }
                
                // 显示错题管理器视图
                if (this.ui && this.ui.mistakeManagerView) {
                    this.ui.showView(this.ui.mistakeManagerView);
                    console.log('✅ 已调用showView');
                } else {
                    console.log('❌ UI或视图不存在!', this.ui, this.ui?.mistakeManagerView);
                }
            }
        });
    }

    // 新增：处理PTA分析请求
    handlePtaAnalysis() {
        const urlInput = document.getElementById('ptaUrlInput');
        const url = urlInput.value.trim();

        if (!url.startsWith('https://pintia.cn/problem-sets/')) {
            alert('请输入一个有效的拼题A题目集网址！');
            return;
        }

        const analysisBtn = document.getElementById('startPtaAnalysisBtn');
        analysisBtn.textContent = '分析中...';
        analysisBtn.disabled = true;

        console.log('正在请求后台脚本进行PTA分析...');
        chrome.runtime.sendMessage({ type: 'FETCH_PTA_DATA', url: url }, (response) => {
            analysisBtn.textContent = '开始分析';
            analysisBtn.disabled = false;
            
            if (response && response.status === 'success') {
                console.log('成功接收到HTML报告，正在打开新标签页...');
                // response.data 现在是HTML字符串
                const reportHtml = response.data;
                const blob = new Blob([reportHtml], { type: 'text/html' });
                const reportUrl = URL.createObjectURL(blob);
                chrome.tabs.create({ url: reportUrl });
                
                // 成功后可以返回主界面
                this.showMainView();
            } else {
                alert(`分析失败: ${response ? response.error : '未知错误'}`);
            }
        });
    }

    // 新增：处理保存设置的逻辑
    async handleSaveSettings() {
        const newSettings = await this.settingsManager.saveSettings();
        if (newSettings) {
            // 通知 ChatManager 更新其内部的 settings
            this.chatManager.updateSettings(newSettings);
            // 通知 background script
            chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED', settings: newSettings });
        }
    }
    
    // 辅助方法，用于确定返回的主视图
    showMainView() {
        if (this.chatManager.chats.length > 0) {
            this.chatManager.showChat(this.chatManager.currentChatId || this.chatManager.chats[0].id);
        } else {
            this.ui.showView(this.ui.welcomeScreen);
        }
    }

    // 辅助方法，用于绑定所有返回按钮
    bindBackButtons() {
        const backToMain = () => {
           this.showMainView();
        };
        document.getElementById('backToMain').addEventListener('click', backToMain);
        document.getElementById('backToMainFromSettings').addEventListener('click', backToMain);
        document.getElementById('backToMainFromPta').addEventListener('click', backToMain);
        document.getElementById('backToMainFromLogin').addEventListener('click', backToMain);
        document.getElementById('backToMainFromManager').addEventListener('click', backToMain);
    }

    // 检查登录状态
    async checkLoginStatus() {
        try {
            const result = await chrome.storage.local.get(['isLoggedIn', 'userEmail']);
            this.updateUIBasedOnLoginStatus(result.isLoggedIn, result.userEmail);
        } catch (error) {
            console.error('检查登录状态失败:', error);
            this.updateUIBasedOnLoginStatus(false, null);
        }
    }

    // 根据登录状态更新UI
    updateUIBasedOnLoginStatus(isLoggedIn, userEmail) {
        const loginPrompt = document.getElementById('loginPrompt');
        const startFirstChat = document.getElementById('startFirstChat');
        const loginBtn = document.getElementById('loginBtn');
        
        // 需要登录后才能使用的按钮
        const requireLoginButtons = [
            'mistakesBtn', 'settingsBtn', 'ptaBtn',
            'toggleChatListBtn'
        ];
        
        // 错题管理器按钮不需要登录即可使用
        const mistakeManagerBtn = document.getElementById('openMistakeManagerBtn');
        if (mistakeManagerBtn) {
            mistakeManagerBtn.disabled = false;
            mistakeManagerBtn.style.opacity = '1';
            mistakeManagerBtn.style.pointerEvents = 'auto';
        }
        
        if (isLoggedIn && userEmail) {
            // 用户已登录 - 启用所有功能
            if (loginPrompt) loginPrompt.style.display = 'none';
            if (startFirstChat) {
                startFirstChat.disabled = false;
                startFirstChat.textContent = '开始对话';
                startFirstChat.style.opacity = '1';
            }
            
            // 启用所有功能按钮
            requireLoginButtons.forEach(btnId => {
                const btn = document.getElementById(btnId);
                if (btn) {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    btn.style.pointerEvents = 'auto';
                }
            });
            
            // 更新登录按钮显示
            if (loginBtn) {
                loginBtn.innerHTML = '<span class="material-symbols-outlined">account_circle</span>';
                loginBtn.title = `已登录: ${userEmail}`;
                loginBtn.style.background = 'rgba(76, 175, 80, 0.3)';
            }
        } else {
            // 用户未登录 - 显示登录提示
            if (loginPrompt) loginPrompt.style.display = 'block';
            if (startFirstChat) {
                startFirstChat.disabled = true;
                startFirstChat.textContent = '请先登录';
                startFirstChat.style.opacity = '0.5';
            }
            
            // 禁用功能按钮
            requireLoginButtons.forEach(btnId => {
                const btn = document.getElementById(btnId);
                if (btn) {
                    btn.disabled = true;
                    btn.style.opacity = '0.5';
                    btn.style.pointerEvents = 'none';
                }
            });
            
            // 重置登录按钮显示
            if (loginBtn) {
                loginBtn.innerHTML = '<span class="material-symbols-outlined">login</span>';
                loginBtn.title = '用户登录';
                loginBtn.style.background = '';
            }
        }
    }

    // 处理登录按钮点击
    handleLogin() {
        this.ui.showView(this.ui.loginInterface);
    }

    // 处理登出
    async handleLogout() {
        try {
            await chrome.storage.local.remove(['isLoggedIn', 'userEmail', 'userToken']);
            this.updateUIBasedOnLoginStatus(false, null);
            this.showMainView();
        } catch (error) {
            console.error('登出失败:', error);
        }
    }

    // 绑定认证相关事件
    bindAuthEvents() {
        // 使用安全的元素获取和事件绑定
        const bindSafeEvent = (elementId, eventType, handler) => {
            const element = document.getElementById(elementId);
            if (element) {
                element.addEventListener(eventType, handler);
                console.log(`✅ 成功绑定事件: ${elementId} -> ${eventType}`);
            } else {
                console.warn(`⚠️ 未找到元素: ${elementId}`);
            }
        };

        // 登录提交
        bindSafeEvent('loginSubmitBtn', 'click', () => this.handleLoginSubmit());
        
        // 注册提交
        bindSafeEvent('registerSubmitBtn', 'click', () => this.handleRegisterSubmit());
        
        // 忘记密码
        bindSafeEvent('forgotPasswordBtn', 'click', () => this.handleForgotPassword());
        
        // 表单切换
        bindSafeEvent('showRegisterForm', 'click', () => this.showAuthForm('register'));
        bindSafeEvent('showLoginForm', 'click', () => this.showAuthForm('login'));
        
        // 回车键提交
        bindSafeEvent('loginPassword', 'keypress', (e) => {
            if (e.key === 'Enter') this.handleLoginSubmit();
        });
        bindSafeEvent('registerPassword', 'keypress', (e) => {
            if (e.key === 'Enter') this.handleRegisterSubmit();
        });
    }

    // 显示认证表单
    showAuthForm(type) {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        
        if (loginForm && registerForm) {
            if (type === 'register') {
                loginForm.style.display = 'none';
                registerForm.style.display = 'block';
                console.log('🔄 显示注册表单');
            } else {
                loginForm.style.display = 'block';
                registerForm.style.display = 'none';
                console.log('🔄 显示登录表单');
            }
        } else {
            console.warn('⚠️ 未找到认证表单元素:', { loginForm, registerForm });
        }
    }

    // 显示认证消息
    showAuthMessage(message, type = 'info') {
        const messageEl = document.getElementById('authMessage');
        if (!messageEl) return;
        
        messageEl.className = `auth-message ${type}`;
        messageEl.textContent = message;
        messageEl.classList.remove('hidden');
        
        // 3秒后自动隐藏成功消息
        if (type === 'success') {
            setTimeout(() => {
                messageEl.classList.add('hidden');
            }, 3000);
        }
    }

    // 验证邮箱格式
    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showAuthMessage('请输入有效的邮箱地址', 'error');
            return false;
        }
        return true;
    }

    // 处理登录提交
    async handleLoginSubmit() {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        
        if (!this.validateEmail(email)) return;
        if (!password) {
            this.showAuthMessage('请输入密码', 'error');
            return;
        }
        
        const btn = document.getElementById('loginSubmitBtn');
        const originalText = btn.textContent;
        btn.textContent = '登录中...';
        btn.disabled = true;
        
        try {
            const response = await fetch(`${getBackendUrl()}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            const result = await response.json();
            
            if (result.success) {
                await chrome.storage.local.set({
                    isLoggedIn: true,
                    userEmail: email,
                    userToken: result.token || 'temp'
                });
                
                this.showAuthMessage('登录成功！', 'success');
                setTimeout(() => {
                    this.showMainView();
                    this.checkLoginStatus();
                }, 1500);
            } else {
                this.showAuthMessage(result.message || '登录失败', 'error');
            }
        } catch (error) {
            console.error('登录错误:', error);
            this.showAuthMessage('网络错误，请稍后重试', 'error');
        }
        
        btn.textContent = originalText;
        btn.disabled = false;
    }

    // 处理注册提交
    async handleRegisterSubmit() {
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value.trim();
        
        if (!this.validateEmail(email)) return;
        if (!password || password.length < 6) {
            this.showAuthMessage('密码至少需要6位字符', 'error');
            return;
        }
        
        const btn = document.getElementById('registerSubmitBtn');
        const originalText = btn.textContent;
        btn.textContent = '注册中...';
        btn.disabled = true;
        
        try {
            const response = await fetch(`${getBackendUrl()}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showAuthMessage('注册成功！请检查邮箱验证邮件', 'success');
                this.verificationSent = true;
                setTimeout(() => {
                    this.showAuthForm('login');
                    document.getElementById('loginEmail').value = email;
                }, 2000);
            } else {
                this.showAuthMessage(result.message || '注册失败', 'error');
            }
        } catch (error) {
            console.error('注册错误:', error);
            this.showAuthMessage('网络错误，请稍后重试', 'error');
        }
        
        btn.textContent = originalText;
        btn.disabled = false;
    }

    // 处理忘记密码
    async handleForgotPassword() {
        const email = document.getElementById('loginEmail').value.trim();
        
        if (!this.validateEmail(email)) return;
        
        try {
            const response = await fetch(`${getBackendUrl()}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showAuthMessage('密码重置邮件已发送', 'success');
            } else {
                this.showAuthMessage(result.message || '发送失败', 'error');
            }
        } catch (error) {
            console.error('密码重置错误:', error);
            this.showAuthMessage('网络错误，请稍后重试', 'error');
        }
    }
}

// 将SidebarManager暴露到全局window对象
window.SidebarManager = SidebarManager;

document.addEventListener('DOMContentLoaded', () => {
    new window.SidebarManager();
});