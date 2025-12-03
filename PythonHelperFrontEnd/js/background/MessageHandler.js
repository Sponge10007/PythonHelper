// js/background/MessageHandler.js
import { BACKEND_URL } from '../common/config.js';

export class MessageHandler {
    constructor(dataManager) {
        this.dataManager = dataManager;
    }

    listen() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('收到消息:', message.type);
            switch (message.type) {
                case 'TEXT_SELECTED':
                    chrome.runtime.sendMessage({ type: 'TEXT_SELECTED', text: message.text })
                        .catch(e => console.log("无法将选中文本发送到侧边栏，可能侧边栏未打开。"));
                    break;
                case 'SETTINGS_UPDATED':
                    this.dataManager.updateSettings(message.settings);
                    break;
                case 'QUESTION_MODE_CHANGED':
                    this.dataManager.updateQuestionMode(message.mode);
                    break;
                case 'FETCH_PTA_DATA':
                    this.fetchPtaData(message.url, this.dataManager.settings)
                        .then(result => sendResponse({ status: 'success', data: result }))
                        .catch(error => sendResponse({ status: 'error', error: error.message }));
                    return true; // 表示我们将异步响应
            }
            return true;
        });
    }

    async fetchPtaData(url, settings) {
        let tabId;
        let debuggerAttached = false;

        try {
            console.log('正在创建临时标签页...');
            const tab = await chrome.tabs.create({ url, active: false });
            tabId = tab.id;

            console.log(`正在附加调试器到 Tab ID: ${tabId}...`);
            await this.attachDebugger(tabId);
            debuggerAttached = true;

            await chrome.debugger.sendCommand({ tabId }, "Network.enable");
            console.log('网络监控已启用，开始捕获API响应...');

            const capturedRawData = await this.captureRawResponses(tabId);
            if (capturedRawData.problems.length === 0) {
                throw new Error("分析超时：未能捕获到任何题目API请求。");
            }

            console.log("数据捕获完成，正在发送到后端进行AI分析...");
            
            const response = await fetch(`${BACKEND_URL()}/pta/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    rawData: capturedRawData,
                    apiKey: settings.aiApiKey,
                    apiEndpoint: 'https://api.deepseek.com/v1/chat/completions'
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`后端分析失败: ${errorData.error || response.statusText}`);
            }

            const reportHtml = await response.text();
            console.log("成功从后端接收到HTML分析报告。");
            return reportHtml;

        } catch (error) {
            console.error("PTA数据抓取或分析过程中发生错误:", error);
            throw error;
        } finally {
            if (debuggerAttached) {
                await chrome.debugger.detach({ tabId });
            }
            if (tabId) {
                await chrome.tabs.remove(tabId);
            }
        }
    }

    attachDebugger(tabId) {
        return new Promise((resolve, reject) => {
            chrome.debugger.attach({ tabId }, "1.3", () => {
                if (chrome.runtime.lastError) {
                    reject(new Error(`无法附加调试器: ${chrome.runtime.lastError.message}`));
                } else {
                    resolve();
                }
            });
        });
    }

    captureRawResponses(tabId) {
        return new Promise((resolve) => {
            const requestMap = new Map();
            const capturedRawData = { problems: [], answers: [], submissions: [] };
            let requestCount = 0;

            const onDebuggerEvent = async (source, method, params) => {
                if (source.tabId !== tabId) return;

                if (method === "Network.requestWillBeSent") {
                    const { requestId, request } = params;
                    const url = request.url;
                    if (url.includes("/exam-problems") || url.includes("/standard-answers") || url.includes("/last-submissions")) {
                        requestMap.set(requestId, url);
                    }
                }

                if (method === "Network.loadingFinished") {
                    const { requestId } = params;
                    if (requestMap.has(requestId)) {
                        const url = requestMap.get(requestId);
                        try {
                            const response = await chrome.debugger.sendCommand(
                                { tabId }, "Network.getResponseBody", { requestId }
                            );
                            
                            const rawBody = response.body;
                            if (!rawBody || rawBody.trim() === "") {
                                console.warn(`响应体为空，已跳过: ${url}`);
                                return;
                            }

                            requestCount++;
                            console.log(`✅ (${requestCount}) 成功捕获响应体: ${url.substring(0, 80)}...`);

                            if (url.includes("/exam-problems")) {
                                capturedRawData.problems.push(rawBody);
                            } else if (url.includes("/standard-answers")) {
                                capturedRawData.answers.push(rawBody);
                            } else if (url.includes("/last-submissions")) {
                                capturedRawData.submissions.push(rawBody);
                            }

                        } catch (e) {
                            console.warn(`获取响应体失败: ${url}`, e.message);
                        }
                    }
                }
            };

            chrome.debugger.onEvent.addListener(onDebuggerEvent);

            setTimeout(() => {
                chrome.debugger.onEvent.removeListener(onDebuggerEvent);
                console.log(`捕获结束，共捕获 ${requestCount} 个相关API响应。`);
                resolve(capturedRawData);
            }, 15000);
        });
    }
}