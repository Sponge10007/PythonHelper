# Python 课程 AI 教学助手

**Python 课程 AI 教学助手** 是一款面向 Python 学习者的 Chrome 浏览器插件，提供 AI 智能问答、错题管理、本地题库检索、课堂 PPT/PDF 资料管理和 PTA 题目集分析等功能。

项目分为两部分：

```text
PythonHelperFrontEnd   Chrome 插件（Manifest V3）
PythonHelperBackend    Flask + SQLite 后端服务
```

---

## ✨ 主要功能

- **AI 智能问答**：支持划词提问、多会话管理、Markdown 和 LaTeX 公式渲染；回答会经过“去答案化”审查，以引导思路为主。
- **沉浸式侧边栏**：在当前网页侧边栏中完成提问、检索、错题收藏等操作，不打断学习流程。
- **错题管理**：
  - 从 AI 对话中勾选消息，一键保存为错题；
  - 支持搜索、标签筛选、排序、分页、编辑、批量删除；
  - 可对错题对话调用 AI 生成题目、Markdown 解析，并自动从已有标签中选择合适标签。
- **PPT / 文档管理**：
  - 支持上传 `ppt / pptx / doc / docx / pdf`；
  - 支持文件列表、搜索、下载、删除、批量删除和在线预览。
- **本地题库检索**：内置 Python 题库，支持关键词搜索和题型统计。
- **PTA 题目集分析**：粘贴 PTA 题目集链接后，插件抓取题目数据并生成 AI 分析报告。

---

## 🛠️ 环境要求

| 环境 | 要求 |
|---|---|
| Python | 3.9 或更高版本 |
| 浏览器 | Chrome 或基于 Chromium 的浏览器 |
| 邮箱服务 | 阿里云 DirectMail SMTP 或其他兼容 SMTP（用于注册验证码、密码重置） |
| AI 服务 | DeepSeek、OpenAI 或其他 OpenAI 兼容接口 |

---

## 🚀 安装与运行

### 1. 启动后端

```bash
cd PythonHelperBackend

# 创建虚拟环境（推荐）
python -m venv .venv
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 从模板创建本地配置文件
cp .env.example .env
```

编辑 `PythonHelperBackend/.env`，至少配置：

```dotenv
SECRET_KEY=请使用随机字符串
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
AI_API_KEY=your_ai_api_key
AI_API_ENDPOINT=https://api.deepseek.com/v1/chat/completions
AI_ALLOWED_HOSTS=api.deepseek.com,api.openai.com
SESSION_COOKIE_SECURE=false
```

启动服务：

```bash
python run.py
```

默认地址为 `http://localhost:5000`，可访问：

```bash
curl http://localhost:5000/health
```

看到 `"status": "healthy"` 即表示启动成功。

> 后端启动脚本会自动读取同目录下的 `.env`。完整的后端配置说明见 [`PythonHelperBackend/README.md`](PythonHelperBackend/README.md)。

### 2. 加载 Chrome 插件

1. 打开 Chrome，进入 `chrome://extensions/`。
2. 开启右上角“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择 `PythonHelperFrontEnd` 目录。
5. 工具栏出现插件图标即加载成功。

### 3. 配置插件后端地址

插件默认连接：

```text
http://localhost:5000
```

如果后端部署在其他服务器，请在插件页面的开发者工具 Console 中执行：

```js
localStorage.setItem('pythonHelperBackendUrl', 'https://your-server.example.com');
```

然后重新打开插件侧边栏。

---

## 🚀 使用指南

### 1. 登录

- 首次使用必须先登录。
- 本项目仅允许 `@zju.edu.cn` 邮箱注册。
- 注册时点击“发送验证码”，到邮箱获取验证码后完成注册，再登录。
- 如果邮箱服务未配置，注册验证码将无法发送。

### 2. AI 对话

- 点击浏览器工具栏中的插件图标打开侧边栏。
- 在网页中选中文本后，侧边栏输入框会自动填充。
- 也可以直接输入问题，按 `Enter` 或点击发送按钮。
- 在插件“设置”中填写自己的 AI API Key；如果后端 `.env` 已配置 `AI_API_KEY`，则后端会优先使用服务端 Key。

### 3. 错题管理

1. 在对话页面点击右上角“保存错题记录”进入选择模式。
2. 勾选要保存的对话消息。
3. 点击“保存选中消息为错题”。
4. 点击侧边栏“错题集”图标可快速预览。
5. 点击侧边栏“跳转网页”图标可打开独立错题管理页面，进行搜索、筛选、编辑、批量删除和 AI 解析。

### 4. PPT / 文档管理

- 打开独立管理页面后，切换到“课堂管理”。
- 点击上传区域选择 `ppt / pptx / doc / docx / pdf` 文件上传。
- 上传时后端会校验文件扩展名和文件头，拒绝伪装文件。
- 文件列表支持搜索、排序、下载、预览、单个删除和批量删除。

### 5. PTA 题目分析

1. 点击侧边栏“套题报告”图标。
2. 粘贴 `https://pintia.cn/problem-sets/...` 格式的题目集链接。
3. 点击“开始分析”。
4. 等待插件抓取题目并生成 HTML 分析报告。

> PTA 抓取依赖 Chrome `debugger` 权限，加载插件或运行时浏览器可能显示敏感权限提示，属当前实现方式所需。

### 6. 设置

- 点击侧边栏“设置”图标。
- 可填写插件侧使用的 AI API Key。
- 若后端已配置 `AI_API_KEY`，插件中的 Key 仅作为备用。

---

## ⚙️ 技术栈

| 模块 | 技术 |
|---|---|
| 前端 | HTML、CSS、原生 JavaScript ES Modules、Chrome Extension Manifest V3 |
| 后端 | Flask、SQLite |
| 核心依赖 | Flask、Flask-CORS、Requests、Werkzeug、Markdown、python-dotenv |

---

## 🔐 生产部署注意

1. 后端必须使用 HTTPS，并设置：

   ```dotenv
   SESSION_COOKIE_SECURE=true
   ```

2. 必须设置真实的 `SECRET_KEY`、`SMTP_USER`、`SMTP_PASS`、`AI_API_KEY`。
3. 不要把 `.env`、`*.db` 提交到 Git。
4. 可通过 `python run_production.py` 或 Docker 启动：

   ```bash
   cd PythonHelperBackend
   docker build -t python-helper-backend .
   docker run -d \
     -p 5000:5000 \
     -e SECRET_KEY=... \
     -e SMTP_USER=... \
     -e SMTP_PASS=... \
     -e AI_API_KEY=... \
     -v /data/pythonhelper:/data \
     python-helper-backend
   ```

5. 部署后需要在插件中通过 `localStorage.setItem('pythonHelperBackendUrl', 'https://your-server')` 指向线上后端。
