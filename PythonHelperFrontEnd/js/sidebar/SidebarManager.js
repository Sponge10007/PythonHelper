// js/sidebar/SidebarManager.js

import { UIManager } from './UIManager.js';
import { ChatManager } from './ChatManager.js';
// 导入 SettingsManager 来处理设置逻辑
import { SettingsManager } from './SettingsManager.js';

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
        this.ui = new UIManager();
        this.chatManager = new ChatManager(this.ui);
        // 新增：实例化 SettingsManager
        this.settingsManager = new SettingsManager(this.ui);
        
        // 验证码发送状态跟踪
        this.verificationSent = false;
        
        this.bindEvents();
        this.init();
    }

    async init() {
        await this.chatManager.init();
        await this.settingsManager.init();
        this.setupMessageListener();
    }

    setupMessageListener() {
        // 监听来自background script的消息
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('Sidebar收到消息:', message.type);
            switch (message.type) {
                case 'TEXT_SELECTED':
                    // 处理选中文本，填充到输入框
                    if (this.ui.chatInput) {
                        this.ui.chatInput.value = message.text;
                        this.ui.adjustTextareaHeight();
                    }
                    break;
                default:
                    console.log('未处理的消息类型:', message.type);
            }
            return true;
        });
    }
    
    bindEvents() {
        await this.checkLoginStatus();
    }    bindEvents() {
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
        
        // --- 记忆管理事件绑定 ---
        document.getElementById('memoryManageBtn').addEventListener('click', () => {
            if (this.chatManager.currentChatId) {
                const stats = this.chatManager.getChatStatistics(this.chatManager.currentChatId);
                if (stats) {
                    this.ui.showMemoryManageDialog(stats, (keepRecent) => {
                        this.chatManager.clearChatHistory(this.chatManager.currentChatId, keepRecent);
                        this.ui.showMemoryStatusMessage(
                            keepRecent === 0 ? '已清空全部对话历史' : `已清理历史，保留最近${keepRecent}条消息`,
                            'success'
                        );
                    });
                }
            }
        });

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
        
        // 打开错题管理器页面的按钮
        const openMistakeManagerBtn = document.getElementById('openMistakeManagerBtn');
        if(openMistakeManagerBtn) {
            openMistakeManagerBtn.addEventListener('click', () => {
                try {
                    // 尝试使用扩展内部页面
                    const mistakeManagerUrl = chrome.runtime.getURL('html/mistake_manager.html');
                    chrome.tabs.create({ url: mistakeManagerUrl });
                } catch (error) {
                    console.error('无法打开错题管理器:', error);
                    // 备用方案：显示错误提示
                    this.showAuthMessage('无法打开错题管理器，请检查扩展权限', 'error');
                }
            });
        }
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
        document.getElementById('backToMainFromProfile').addEventListener('click', backToMain);
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
            'openMistakeManagerBtn', 'toggleChatListBtn'
        ];
        
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
                loginBtn.style.color = '#28a745';
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
    async handleLogin() {
        try {
            const result = await chrome.storage.local.get(['isLoggedIn', 'userEmail']);
            if (result.isLoggedIn && result.userEmail) {
                // 已登录 - 显示用户信息页面
                this.showUserProfile(result.userEmail);
            } else {
                // 未登录 - 显示登录界面
                this.ui.showView(this.ui.loginInterface);
            }
        } catch (error) {
            console.error('检查登录状态失败:', error);
            this.ui.showView(this.ui.loginInterface);
        }
    }

    // 显示用户信息页面
    showUserProfile(userEmail) {
        // 更新用户邮箱显示
        const displayEmailElement = document.getElementById('displayUserEmail');
        if (displayEmailElement) {
            displayEmailElement.textContent = userEmail;
        }
        
        // 显示用户信息界面
        this.ui.showView(this.ui.userProfileInterface);
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
        // 登录提交
        document.getElementById('loginSubmitBtn').addEventListener('click', () => this.handleLoginSubmit());
        
        // 注册提交
        document.getElementById('registerSubmitBtn').addEventListener('click', () => this.handleRegisterSubmit());
        
        // 忘记密码提交
        document.getElementById('resetPasswordSubmitBtn').addEventListener('click', () => this.handleResetPasswordSubmit());
        
        // 发送验证码按钮
        document.getElementById('sendVerificationBtn').addEventListener('click', () => this.handleSendVerificationCode());
        document.getElementById('sendResetCodeBtn').addEventListener('click', () => this.handleSendResetCode());
        
        // 忘记密码链接
        document.getElementById('forgotPasswordLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.showAuthForm('forgot');
        });
        
        // 返回登录链接
        document.getElementById('backToLoginLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.showAuthForm('login');
        });
        
        // 表单切换（登录/注册标签）
        document.getElementById('loginTab').addEventListener('click', () => this.showAuthForm('login'));
        document.getElementById('registerTab').addEventListener('click', () => this.showAuthForm('register'));
        
        // 登出按钮
        document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());
        
        // 回车键提交
        document.getElementById('loginPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLoginSubmit();
        });
        document.getElementById('confirmPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleRegisterSubmit();
        });
        document.getElementById('confirmNewPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleResetPasswordSubmit();
        });
    }

    // 显示认证表单
    showAuthForm(type) {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const forgotPasswordForm = document.getElementById('forgotPasswordForm');
        const loginTab = document.getElementById('loginTab');
        const registerTab = document.getElementById('registerTab');
        
        // 隐藏所有表单
        loginForm.classList.add('hidden');
        registerForm.classList.add('hidden');
        forgotPasswordForm.classList.add('hidden');
        
        // 重置所有标签状态
        loginTab.classList.remove('active');
        registerTab.classList.remove('active');
        
        // 清除之前的错误消息
        this.hideAuthMessage();
        
        if (type === 'register') {
            registerForm.classList.remove('hidden');
            registerTab.classList.add('active');
        } else if (type === 'forgot') {
            forgotPasswordForm.classList.remove('hidden');
            // 忘记密码表单不需要标签激活
        } else {
            // 默认显示登录表单
            loginForm.classList.remove('hidden');
            loginTab.classList.add('active');
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
        const verificationCode = document.getElementById('verificationCode').value.trim();
        const password = document.getElementById('registerPassword').value.trim();
        const confirmPassword = document.getElementById('confirmPassword').value.trim();
        
        if (!this.validateEmail(email)) return;
        if (!verificationCode) {
            this.showAuthMessage('请输入验证码', 'error');
            return;
        }
        if (!password || password.length < 6) {
            this.showAuthMessage('密码至少需要6位字符', 'error');
            return;
        }
        if (password !== confirmPassword) {
            this.showAuthMessage('两次输入的密码不一致', 'error');
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
                body: JSON.stringify({ 
                    email, 
                    password,
                    verification_code: verificationCode
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showAuthMessage('注册成功！', 'success');
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

    // 发送注册验证码
    async handleSendVerificationCode() {
        const email = document.getElementById('registerEmail').value.trim();
        
        if (!this.validateEmail(email)) return;
        
        const btn = document.getElementById('sendVerificationBtn');
        const originalText = btn.textContent;
        btn.textContent = '发送中...';
        btn.disabled = true;
        
        try {
            const response = await fetch(`${getBackendUrl()}/auth/send-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, type: 'register' })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showAuthMessage('验证码已发送到您的邮箱', 'success');
                this.startVerificationCountdown(btn, 60);
            } else {
                this.showAuthMessage(result.message || '发送失败', 'error');
                btn.textContent = originalText;
                btn.disabled = false;
            }
        } catch (error) {
            console.error('发送验证码错误:', error);
            this.showAuthMessage('网络错误，请稍后重试', 'error');
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }

    // 发送重置密码验证码
    async handleSendResetCode() {
        const email = document.getElementById('resetEmail').value.trim();
        
        if (!this.validateEmail(email)) return;
        
        const btn = document.getElementById('sendResetCodeBtn');
        const originalText = btn.textContent;
        btn.textContent = '发送中...';
        btn.disabled = true;
        
        try {
            const response = await fetch(`${getBackendUrl()}/auth/send-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, type: 'reset' })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showAuthMessage('验证码已发送到您的邮箱', 'success');
                this.startVerificationCountdown(btn, 60);
            } else {
                this.showAuthMessage(result.message || '发送失败', 'error');
                btn.textContent = originalText;
                btn.disabled = false;
            }
        } catch (error) {
            console.error('发送验证码错误:', error);
            this.showAuthMessage('网络错误，请稍后重试', 'error');
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }

    // 处理重置密码提交
    async handleResetPasswordSubmit() {
        const email = document.getElementById('resetEmail').value.trim();
        const verificationCode = document.getElementById('resetVerificationCode').value.trim();
        const newPassword = document.getElementById('newPassword').value.trim();
        const confirmNewPassword = document.getElementById('confirmNewPassword').value.trim();
        
        if (!this.validateEmail(email)) return;
        if (!verificationCode) {
            this.showAuthMessage('请输入验证码', 'error');
            return;
        }
        if (!newPassword || newPassword.length < 6) {
            this.showAuthMessage('新密码至少需要6位字符', 'error');
            return;
        }
        if (newPassword !== confirmNewPassword) {
            this.showAuthMessage('两次输入的密码不一致', 'error');
            return;
        }
        
        const btn = document.getElementById('resetPasswordSubmitBtn');
        const originalText = btn.textContent;
        btn.textContent = '重置中...';
        btn.disabled = true;
        
        try {
            const response = await fetch(`${getBackendUrl()}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email, 
                    verification_code: verificationCode,
                    new_password: newPassword 
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showAuthMessage('密码重置成功！请使用新密码登录', 'success');
                setTimeout(() => {
                    this.showAuthForm('login');
                    // 自动填入邮箱
                    document.getElementById('loginEmail').value = email;
                }, 2000);
            } else {
                this.showAuthMessage(result.message || '重置失败', 'error');
            }
        } catch (error) {
            console.error('重置密码错误:', error);
            this.showAuthMessage('网络错误，请稍后重试', 'error');
        }
        
        btn.textContent = originalText;
        btn.disabled = false;
    }

    // 验证码倒计时
    startVerificationCountdown(button, seconds) {
        let remaining = seconds;
        const originalText = button.textContent;
        
        const countdown = setInterval(() => {
            button.textContent = `${remaining}秒后重发`;
            remaining--;
            
            if (remaining < 0) {
                clearInterval(countdown);
                button.textContent = originalText;
                button.disabled = false;
            }
        }, 1000);
    }

    // 隐藏认证消息
    hideAuthMessage() {
        const messageEl = document.getElementById('authMessage');
        if (messageEl) {
            messageEl.classList.add('hidden');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SidebarManager();
});