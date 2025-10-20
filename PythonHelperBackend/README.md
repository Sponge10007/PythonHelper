# Python教学助手后端服务

这是Python教学助手Chrome插件的后端服务，提供AI聊天和题库检索功能。

## 功能特性

- 🤖 AI聊天接口：与大模型API交互，提供智能回答
- 📚 题库检索：搜索本地题库数据库
- 🔍 健康检查：服务状态监控
- 🌐 跨域支持：支持Chrome插件的前端调用

## 安装和运行

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

方式一：使用启动脚本（推荐）
```bash
python start_server.py
```

方式二：直接运行
```bash
python app.py
```

### 3. 访问服务

服务启动后，可以通过以下地址访问：
- 健康检查：http://localhost:8000/health
- API文档：http://localhost:8000/

## API接口

### 健康检查
```
GET /health
```

### AI聊天
```
POST /ai/chat
Content-Type: application/json

{
    "message": "用户问题",
    "apiKey": "AI API密钥",
    "apiEndpoint": "API端点"
}
```

### 搜索题库
```
POST /search
Content-Type: application/json

{
    "query": "搜索关键词"
}
```

### 获取所有题目
```
GET /questions
```

### 获取题目统计信息
```
GET /questions/stats
```

返回题目类型、分类、难度等统计信息。

## 配置说明

### 环境变量
- `FLASK_ENV`: 运行环境（development/production）
- `FLASK_DEBUG`: 调试模式（True/False）

### AI API配置
在Chrome插件的设置中配置：
- API密钥：你的AI服务API密钥
- API端点：AI服务的API地址（默认：https://api.deepseek.com/v1/chat/completions）

#### 支持的AI服务
1. **DeepSeek API**（推荐）
   - 端点：https://api.deepseek.com/v1/chat/completions
   - 模型：deepseek-chat
   - 获取API密钥：https://platform.deepseek.com/

2. **OpenAI API**
   - 端点：https://api.openai.com/v1/chat/completions
   - 模型：gpt-3.5-turbo
   - 获取API密钥：https://platform.openai.com/

3. **其他兼容OpenAI API的服务**
   - 使用相同的API格式
   - 修改端点和模型名称即可

## 文件结构

```
PythonHelperBackend/
├── app.py              # 主应用文件
├── start_server.py     # 启动脚本
├── requirements.txt    # Python依赖
└── README.md          # 说明文档
```

## 开发说明

### 添加新的API接口
1. 在`app.py`中添加新的路由函数
2. 在`PythonHelperBackend`类中添加相应的业务逻辑
3. 更新前端代码调用新接口

### 修改题库数据
题库数据优先从`database.json`文件加载，如果不存在则回退到`../PythonHelperFrontEnd/data/questions.json`文件。

#### 数据库结构
新的`database.json`文件包含以下字段：
- `question_type`: 题目类型（单选题、判断题等）
- `question_number`: 题号
- `question`: 题目内容
- `options`: 选项（单选题）
- `answer`: 答案

#### 支持的题目类型
- **单选题**: 包含选项和答案
- **判断题**: 答案为True/False
- **其他类型**: 可扩展支持

修改题库数据后重启服务即可生效。

## 故障排除

### 常见问题

1. **端口被占用**
   - 修改`app.py`中的端口号
   - 或者停止占用端口的其他服务

2. **依赖安装失败**
   - 确保Python版本 >= 3.7
   - 使用虚拟环境：`python -m venv venv && source venv/bin/activate`

3. **跨域问题**
   - 确保CORS配置正确
   - 检查Chrome插件的host_permissions设置

### 日志查看
服务运行时会输出详细的日志信息，包括：
- 服务启动状态
- API调用记录
- 错误信息

## 许可证

本项目采用MIT许可证。 