# Python 教学助手后端服务

Flask + SQLite 后端，为 Python 课程 AI 教学助手 Chrome 插件提供 AI 聊天、题库检索、错题管理、PPT 管理、标签和用户认证接口。

---

## 快速启动

```bash
cd PythonHelperBackend

python -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt

# 从模板创建配置文件并填写
cp .env.example .env

python run.py
```

`run.py` 会自动读取同目录下的 `.env`。默认监听 `0.0.0.0:5000`。

检查服务：

```bash
curl http://localhost:5000/health
```

---

## 配置文件

复制模板：

```bash
cp .env.example .env
```

### 基础配置

| 变量 | 默认值 | 说明 |
|---|---|---|
| `FLASK_ENV` | `development` | 运行环境标识 |
| `FLASK_DEBUG` | `0` | 是否开启 Flask Debug，生产必须为 `0` |
| `HOST` | `0.0.0.0` | `run.py` 监听地址 |
| `PORT` | `5000` | `run.py` 监听端口 |
| `SECRET_KEY` | 未设置时随机生成 | Flask 会话签名密钥；生产环境必须固定设置为随机值 |
| `DATABASE_PATH` | `mistakes.db` | SQLite 数据库文件路径 |
| `PPT_UPLOAD_FOLDER` | `./ppt_files` | 课件上传目录 |
| `MAX_CONTENT_LENGTH` | `104857600` | 上传大小限制，单位字节，默认 100MB |

### 会话 Cookie

| 变量 | 默认值 | 说明 |
|---|---|---|
| `SESSION_COOKIE_SECURE` | 本地 `false`，生产配置 `true` | 是否只通过 HTTPS 发送 Cookie |
| `SESSION_COOKIE_SAMESITE` | 根据 Secure 自动设置 | HTTPS 时为 `None`，HTTP 时为 `Lax` |

> 生产环境必须使用 HTTPS，并设置 `SESSION_COOKIE_SECURE=true`，否则 Chrome 扩展跨域请求无法可靠携带登录 Cookie。

### 邮件配置

注册验证码和密码重置邮件依赖 SMTP。

| 变量 | 默认值 | 说明 |
|---|---|---|
| `SMTP_HOST` | `smtpdm.aliyun.com` | SMTP 服务器 |
| `SMTP_PORT` | `465` | 使用 SSL 的 SMTP 端口 |
| `SMTP_USER` | 空 | SMTP 用户名 |
| `SMTP_PASS` | 空 | SMTP 密码 |
| `SMTP_FROM_NAME` | `Python Helper` | 发件人显示名称 |

### AI 配置

| 变量 | 默认值 | 说明 |
|---|---|---|
| `AI_API_KEY` | 空 | 服务端统一 AI Key；设置后优先使用，插件中填写的 Key 作为备用 |
| `AI_API_ENDPOINT` | `https://api.deepseek.com/v1/chat/completions` | AI API 完整地址 |
| `AI_ALLOWED_HOSTS` | `api.deepseek.com,api.openai.com` | 允许访问的 AI 域名白名单，逗号分隔 |

安全限制：

- AI endpoint 只允许 HTTPS。
- 只允许访问 `AI_ALLOWED_HOSTS` 中的域名。
- 服务端配置了 `AI_API_KEY` 时，后端会强制使用 `AI_API_ENDPOINT`，不会把服务端 Key 发送到用户指定的第三方地址。

### CORS 配置

| 变量 | 默认值 | 说明 |
|---|---|---|
| `CORS_ALLOWED_ORIGINS` | 空 | 逗号分隔的允许来源；为空时默认允许 localhost、127.0.0.1 和浏览器扩展来源 |

---

## 生产部署

### 方式一：`run_production.py`

```bash
cd PythonHelperBackend
cp .env.example .env
# 编辑 .env，填写生产配置

python run_production.py
```

`run_production.py` 会：

1. 自动加载 `.env`；
2. 根据 `FLASK_ENV` 选择 `DevelopmentConfig` 或 `ProductionConfig`；
3. 启动前初始化数据库；
4. 以 `DEBUG=False` 运行。

### 方式二：Docker

```bash
cd PythonHelperBackend

docker build -t python-helper-backend .

docker run -d \
  -p 5000:5000 \
  -e SECRET_KEY=请填写随机值 \
  -e SMTP_USER=请填写 \
  -e SMTP_PASS=请填写 \
  -e AI_API_KEY=请填写 \
  -e SESSION_COOKIE_SECURE=true \
  -v /data/pythonhelper:/data \
  python-helper-backend
```

`.dockerignore` 已排除 `.env`、`*.db`、`ppt_files/` 等敏感或本地文件。

---

## 主要接口

### 公开接口

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/health` | 健康检查 |
| `POST` | `/search` | 搜索本地题库 |
| `GET` | `/questions` | 获取全部题目 |
| `GET` | `/questions/stats` | 题目统计 |
| `POST` | `/auth/login` | 登录 |
| `POST` | `/auth/register` | 注册 |
| `POST` | `/auth/send-verification` | 发送邮箱验证码 |
| `POST` | `/auth/forgot-password` | 发送密码重置验证码 |
| `POST` | `/auth/reset-password` | 重置密码 |
| `POST` | `/auth/logout` | 登出 |
| `POST` | `/auth/resend-verification` | 重新发送验证码 |
| `GET` | `/auth/check-auth` | 检查当前登录状态 |

### 需登录接口

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/ai/chat` | AI 对话 |
| `POST` | `/ai/chat/stream` | AI 流式对话 |
| `GET/POST` | `/mistakes` | 错题列表 / 保存错题 |
| `PUT/DELETE` | `/mistakes/<id>` | 更新 / 删除错题 |
| `POST` | `/mistakes/<id>/analyze` | AI 分析错题 |
| `GET` | `/ppt/files` | 获取当前用户的 PPT 列表 |
| `POST` | `/ppt/upload` | 上传 PPT / 文档 |
| `GET` | `/ppt/files/<id>/info` | 获取单个 PPT 信息 |
| `DELETE` | `/ppt/files/<id>` | 删除单个 PPT |
| `GET` | `/ppt/files/<id>/download` | 下载 PPT |
| `GET` | `/ppt/files/<id>/preview` | 预览 PPT |
| `GET` | `/ppt/files/<id>/thumbnail` | PPT 缩略图 |
| `GET` | `/ppt/files/<id>/slides` | 幻灯片列表 |
| `GET` | `/ppt/search` | 搜索当前用户的 PPT |
| `GET` | `/ppt/stats` | 当前用户的 PPT 统计 |
| `GET/POST` | `/api/tags` | 标签列表 / 新增 |
| `PUT/DELETE` | `/api/tags/<id>` | 更新 / 删除标签 |
| `GET/PUT` | `/api/mistakes/<id>/tags` | 错题标签读取 / 设置 |
| `POST` | `/pta/analyze` | PTA 题目分析 |

---

## 认证说明

- 注册仅允许 `@zju.edu.cn` 邮箱。
- 注册前必须先调用 `/auth/send-verification` 获取验证码。
- 验证码有效期 10 分钟，同一邮箱 60 秒内只能发送一次。
- 登录接口会检查邮箱是否已验证。
- 前端扩展请求需要携带 Cookie，即 `credentials: 'include'`。

---

## 文件上传说明

允许扩展名：

```text
ppt, pptx, doc, docx, pdf
```

后端除扩展名校验外，还会校验文件头：

| 扩展名 | 允许的文件头 |
|---|---|
| `pdf` | `%PDF` |
| `pptx / docx` | `PK` |
| `ppt / doc` | OLE2 复合文档头 |

---

## 数据库说明

- 默认使用 `mistakes.db`。
- 启动时会自动创建缺失的表，并为旧数据库补充新增字段。
- SQLite 外键已开启。
- 数据库连接按请求复用，请求结束自动关闭。

---

## 常见问题

### 1. 注册时收不到验证码

检查 `.env` 中 `SMTP_USER`、`SMTP_PASS` 是否正确，并确认服务器可以访问 `SMTP_HOST:SMTP_PORT`。

### 2. AI 对话返回“未配置AI API密钥”

- 插件设置中填写 AI API Key；或
- 后端 `.env` 中配置 `AI_API_KEY`。

### 3. 登录成功但后续接口返回 401

- 确认前端请求携带 `credentials: 'include'`。
- 生产环境必须使用 HTTPS，并设置 `SESSION_COOKIE_SECURE=true`。

### 4. 插件连不上后端

- 确认后端已启动：`curl http://localhost:5000/health`。
- 如果后端不在本机，请在插件页面 Console 中执行：

```js
localStorage.setItem('pythonHelperBackendUrl', 'https://your-server.example.com');
```

然后重新打开侧边栏。
