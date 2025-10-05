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
        // 检查登录状态
        await this.checkLoginStatus();
        
        // 初始化发送按钮状态
        if (this.ui.sendMessageBtn) {
            this.ui.sendMessageBtn.classList.add('ready');
        }
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
    
    async bindEvents() {
        // 首先检查登录状态
        await this.checkLoginStatus();
        
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
        // document.getElementById('clearChatBtn').addEventListener('click', () => this.chatManager.clearCurrentChat());
        
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
        
        // --- 报告按钮事件绑定 ---
        const reportBtn = document.getElementById('ReportBtn');
        if (reportBtn) {
            reportBtn.addEventListener('click', () => {
                // 这里可以添加报告功能的逻辑
                console.log('套题报告功能待实现');
            });
        }
        
        // --- 设置事件绑定 ---
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.ui.showView(this.ui.settingsInterface));
        }
        const saveSettingsBtn = this.ui.settingsInterface.querySelector('#saveSettings');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => this.handleSaveSettings());
        }

        // --- PTA题目分析事件绑定 ---
        const ptaBtn = document.getElementById('ptaBtn');
        if (ptaBtn) {
            ptaBtn.addEventListener('click', () => this.ui.showView(this.ui.ptaAnalysisInterface));
        }
        const startPtaAnalysisBtn = document.getElementById('startPtaAnalysisBtn');
        if (startPtaAnalysisBtn) {
            startPtaAnalysisBtn.addEventListener('click', () => this.handlePtaAnalysis());
        }
        
        // --- 登录按钮事件绑定 ---
        const loginBtn = document.getElementById('loginBtn');
        const userBtn = document.getElementById('userBtn');
        
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                this.handleLogin();
            });
        }
        
        if (userBtn) {
            userBtn.addEventListener('click', () => {
                this.handleLogin();
            });
        }
        
        // --- 跳转网页按钮事件绑定 ---
        const jumpwebpageBtn = document.getElementById('jumpwebpageBtn');
        if (jumpwebpageBtn) {
            jumpwebpageBtn.addEventListener('click', () => {
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

    // 检查登录状态, 如果没登录, 自动跳转到登录页面
    async checkLoginStatus() {
        console.log('=== 开始检查登录状态 ===');
        try {
            const result = await chrome.storage.local.get(['isLoggedIn', 'userEmail', 'userToken']);
            console.log('从存储获取的数据:', result);
            
            const isLoggedIn = result.isLoggedIn === true;
            const userEmail = result.userEmail || null;
            
            console.log('解析的登录状态:', { isLoggedIn, userEmail });
            
            this.updateUIBasedOnLoginStatus(isLoggedIn, userEmail);
            
            // 新增：如果用户未登录，自动跳转到登录页面
            if (!isLoggedIn) {
                console.log('用户未登录，自动跳转到登录页面');
                setTimeout(() => {
                    console.log(this.ui.loginInterface)
                    this.ui.showView(this.ui.loginInterface);
                }, 500); // 延迟500ms以确保UI初始化完成
            }
        } catch (error) {
            console.error('检查登录状态失败:', error);
            this.updateUIBasedOnLoginStatus(false, null);
            // 出错时也跳转到登录页面
            setTimeout(() => {
                this.ui.showView(this.ui.loginInterface);
            }, 500);
        }
        console.log('=== 登录状态检查完成 ===');
    }

    // 根据登录状态更新UI
    updateUIBasedOnLoginStatus(isLoggedIn, userEmail) {
        console.log('=== 开始更新UI状态 ===');
        console.log('更新UI状态:', { isLoggedIn, userEmail });
        
        // 获取所有相关元素
        const startFirstChat = document.getElementById('startFirstChat');
        const userBtn = document.getElementById('userBtn'); // 正确的按钮ID
        const displayEmailElement = document.getElementById('displayUserEmail');
        
        // 需要登录后才能使用的按钮
        const requireLoginButtons = [
            'mistakesBtn', 'settingsBtn', 'ptaBtn', 
            'openMistakeManagerBtn', 'toggleChatListBtn',
            'ReportBtn', 'newChatBtn', 'memoryManageBtn',
            'enterMistakeModeBtn', 'saveSelectionBtn', 'jumpwebpageBtn'
        ];
        
        // 聊天相关按钮（单独处理）
        const chatButtons = ['sendMessageBtn'];
        const allButtons = [...requireLoginButtons, ...chatButtons];
        
        if (isLoggedIn && userEmail) {
            console.log('用户已登录，启用所有功能');
            
            // 启用开始对话按钮
            if (startFirstChat) {
                startFirstChat.disabled = false;
                startFirstChat.textContent = '开始对话';
                startFirstChat.style.opacity = '1';
                startFirstChat.style.pointerEvents = 'auto';
                console.log('启用开始对话按钮');
            }
            
            // 启用所有功能按钮
            allButtons.forEach(btnId => {
                const btn = document.getElementById(btnId);
                if (btn) {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    btn.style.pointerEvents = 'auto';
                    btn.style.filter = 'none'; // 清除可能的灰度滤镜
                    console.log(`启用按钮: ${btnId}`);
                } else {
                    console.warn(`找不到按钮: ${btnId}`);
                }
            });
            
            // 更新登录按钮显示
            if (userBtn) {
                userBtn.innerHTML = '<span class="material-symbols-outlined">account_circle</span>';
                userBtn.title = `已登录: ${userEmail}`;
                userBtn.style.background = 'rgba(122, 55, 151, 0.2)';
                userBtn.style.color = '#7A3797';
                console.log('更新登录按钮为已登录状态');
            }
            
            // 更新用户邮箱显示
            if (displayEmailElement) {
                displayEmailElement.textContent = userEmail;
                console.log(`更新用户邮箱显示: ${userEmail}`);
            }
            
        } else {
            console.log('用户未登录，直接跳转到登录页面');
            
            // 未登录时直接显示登录界面
            this.ui.showView(this.ui.loginInterface);
        }
        
        console.log('=== UI状态更新完成 ===');
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
        console.log('=== 显示用户资料界面 ===');
        console.log('用户邮箱:', userEmail);
        
        // 更新用户邮箱显示
        const displayEmailElement = document.getElementById('displayUserEmail');
        if (displayEmailElement) {
            displayEmailElement.textContent = userEmail;
            console.log(`已更新用户邮箱显示: ${userEmail}`);
        } else {
            console.warn('找不到用户邮箱显示元素');
        }
        
        // 确保UI状态是最新的
        this.updateUIBasedOnLoginStatus(true, userEmail);
        
        // 显示用户信息界面
        this.ui.showView(this.ui.userProfileInterface);
        console.log('已显示用户资料界面');
    }

    // 处理登出
    async handleLogout() {
        console.log('=== 开始登出操作 ===');
        try {
            // 清除所有登录相关的存储数据
            await chrome.storage.local.remove(['isLoggedIn', 'userEmail', 'userToken']);
            console.log('已清除所有登录相关数据');
            
            // 立即更新UI状态为未登录
            this.updateUIBasedOnLoginStatus(false, null);
            
            // 显示登出成功消息
            this.showAuthMessage('已成功登出', 'success');
            
            // 等待一下然后跳转到登录界面
            setTimeout(() => {
                this.ui.showView(this.ui.loginInterface);
                console.log('已跳转到登录界面');
            }, 1000);
            
        } catch (error) {
            console.error('登出失败:', error);
            // 即使登出失败，也要强制更新UI状态
            this.updateUIBasedOnLoginStatus(false, null);
            this.ui.showView(this.ui.loginInterface);
        }
        console.log('=== 登出操作完成 ===');
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
        
        // 重置所有验证码发送按钮状态
        this.resetVerificationButtons();
        
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
                // 立即保存登录状态
                await chrome.storage.local.set({
                    isLoggedIn: true,
                    userEmail: email,
                    userToken: result.token || 'temp'
                });
                console.log('登录成功，已保存登录状态:', { email });
                
                this.showAuthMessage('登录成功！', 'success');
                
                // 立即更新UI状态
                this.updateUIBasedOnLoginStatus(true, email);
                
                // 登录成功后跳转到主聊天界面
                setTimeout(() => {
                    this.ui.showView(this.ui.chatInterface);
                }, 1500);
            } else {
                this.showAuthMessage(result.message || '登录失败', 'error');
            }
        } catch (error) {
            console.error('登录错误:', error);
            if (error.name === 'TypeError' || error.message.includes('fetch')) {
                this.showAuthMessage('网络连接失败，请检查网络后重试', 'error');
            } else if (error.message && error.message.includes('HTTP 500')) {
                this.showAuthMessage('服务器内部错误，请联系管理员', 'error');
            } else {
                this.showAuthMessage('网络错误，请稍后重试', 'error');
            }
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
            if (error.name === 'TypeError' || error.message.includes('fetch')) {
                this.showAuthMessage('网络连接失败，请检查网络后重试', 'error');
            } else if (error.message && error.message.includes('HTTP 500')) {
                this.showAuthMessage('服务器内部错误，请联系管理员', 'error');
            } else {
                this.showAuthMessage('网络错误，请稍后重试', 'error');
            }
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
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.showAuthMessage('验证码已发送到您的邮箱', 'success');
                this.startVerificationCountdown(btn, 60);
            } else {
                this.showAuthMessage(result.message || '发送失败，请检查邮箱地址', 'error');
                btn.textContent = originalText;
                btn.disabled = false;
            }
        } catch (error) {
            console.error('发送验证码错误:', error);
            if (error.name === 'TypeError' || error.message.includes('fetch')) {
                this.showAuthMessage('网络连接失败，请检查网络后重试', 'error');
            } else if (error.message.includes('HTTP 500')) {
                this.showAuthMessage('服务器内部错误，数据库配置问题，请联系管理员', 'error');
            } else if (error.message.includes('HTTP 404')) {
                this.showAuthMessage('服务不可用，请检查服务器状态', 'error');
            } else if (error.message.includes('HTTP')) {
                this.showAuthMessage(`服务器错误：${error.message}`, 'error');
            } else {
                this.showAuthMessage('发送失败，请稍后重试', 'error');
            }
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
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.showAuthMessage('验证码已发送到您的邮箱', 'success');
                this.startVerificationCountdown(btn, 60);
            } else {
                this.showAuthMessage(result.message || '发送失败，请检查邮箱地址', 'error');
                btn.textContent = originalText;
                btn.disabled = false;
            }
        } catch (error) {
            console.error('发送验证码错误:', error);
            if (error.name === 'TypeError' || error.message.includes('fetch')) {
                this.showAuthMessage('网络连接失败，请检查网络后重试', 'error');
            } else if (error.message.includes('HTTP 500')) {
                this.showAuthMessage('服务器内部错误，数据库配置问题，请联系管理员', 'error');
            } else if (error.message.includes('HTTP 404')) {
                this.showAuthMessage('服务不可用，请检查服务器状态', 'error');
            } else if (error.message.includes('HTTP')) {
                this.showAuthMessage(`服务器错误：${error.message}`, 'error');
            } else {
                this.showAuthMessage('发送失败，请稍后重试', 'error');
            }
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
            if (error.name === 'TypeError' || error.message.includes('fetch')) {
                this.showAuthMessage('网络连接失败，请检查网络后重试', 'error');
            } else if (error.message && error.message.includes('HTTP 500')) {
                this.showAuthMessage('服务器内部错误，请联系管理员', 'error');
            } else {
                this.showAuthMessage('网络错误，请稍后重试', 'error');
            }
        }
        
        btn.textContent = originalText;
        btn.disabled = false;
    }

    // 验证码倒计时
    startVerificationCountdown(button, seconds) {
        // 清除可能存在的之前的倒计时
        if (button.countdownInterval) {
            clearInterval(button.countdownInterval);
        }
        
        let remaining = seconds;
        const originalText = button.dataset.originalText || button.textContent;
        
        // 保存原始文本
        if (!button.dataset.originalText) {
            button.dataset.originalText = originalText;
        }
        
        // 立即禁用按钮并显示倒计时
        button.disabled = true;
        button.textContent = `${remaining}秒后重发`;
        
        button.countdownInterval = setInterval(() => {
            remaining--;
            
            if (remaining > 0) {
                button.textContent = `${remaining}秒后重发`;
            } else {
                // 倒计时结束，恢复按钮
                clearInterval(button.countdownInterval);
                button.countdownInterval = null;
                button.textContent = originalText;
                button.disabled = false;
                console.log('验证码发送倒计时结束，按钮已恢复');
            }
        }, 1000);
        
        console.log(`开始${seconds}秒验证码发送倒计时`);
    }

    // 重置验证码发送按钮状态
    resetVerificationButtons() {
        const buttons = [
            { id: 'sendVerificationBtn', text: '发送验证码' },
            { id: 'sendResetCodeBtn', text: '发送验证码' }
        ];
        
        buttons.forEach(({ id, text }) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.textContent = text;
                btn.disabled = false;
                // 清除可能存在的倒计时
                if (btn.countdownInterval) {
                    clearInterval(btn.countdownInterval);
                    btn.countdownInterval = null;
                }
            }
        });
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