# PythonHelper 项目部署指南

## 🚀 快速部署

### 1. 准备服务器
确保你的服务器满足以下要求：
- Ubuntu 18.04+ 或 CentOS 7+
- 至少 2GB RAM
- 至少 10GB 可用磁盘空间
- 可以通过SSH访问

### 2. 一键部署
```bash
# 设置服务器IP和域名
export SERVER_IP=1.2.3.4
export DOMAIN=yourdomain.com  # 可选，不设置将使用IP

# 执行部署脚本
chmod +x deploy.sh
./deploy.sh
```

### 3. 手动部署步骤

如果自动部署脚本有问题，可以按照以下步骤手动部署：

#### 3.1 上传文件到服务器
```bash
# 本地打包
tar czf pythonhelper.tar.gz PythonHelperBackend/ PythonHelperFrontEnd/

# 上传到服务器
scp pythonhelper.tar.gz root@your-server:/root/

# 服务器上解压
ssh root@your-server
cd /root
tar xzf pythonhelper.tar.gz
mkdir -p /var/www/pythonhelper
cp -r PythonHelperBackend/* /var/www/pythonhelper/
mkdir -p /var/www/pythonhelper/static
cp -r PythonHelperFrontEnd/* /var/www/pythonhelper/static/
```

#### 3.2 安装依赖
```bash
# 更新系统
apt update && apt install -y python3 python3-pip python3-venv nginx supervisor sqlite3

# 创建虚拟环境
cd /var/www/pythonhelper
python3 -m venv venv
source venv/bin/activate
pip install flask flask-cors

# 设置权限
chown -R www-data:www-data /var/www/pythonhelper
chmod -R 755 /var/www/pythonhelper
chmod -R 777 /var/www/pythonhelper/ppt_files
```

#### 3.3 配置Nginx
创建 `/etc/nginx/sites-available/pythonhelper`：
```nginx
server {
    listen 80;
    server_name yourdomain.com;  # 改为你的域名或IP
    client_max_body_size 100M;

    # 静态文件
    location /static/ {
        alias /var/www/pythonhelper/static/;
        expires 1d;
    }

    # Chrome扩展文件
    location /extension/ {
        alias /var/www/pythonhelper/static/;
        add_header Access-Control-Allow-Origin "*";
    }

    # API代理
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
    }
}
```

启用站点：
```bash
ln -sf /etc/nginx/sites-available/pythonhelper /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

#### 3.4 配置Supervisor
创建 `/etc/supervisor/conf.d/pythonhelper.conf`：
```ini
[program:pythonhelper]
directory=/var/www/pythonhelper
command=/var/www/pythonhelper/venv/bin/python run_production.py
user=www-data
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/www/pythonhelper/logs/app.log
environment=FLASK_ENV=production,SERVER_DOMAIN=yourdomain.com,PPT_UPLOAD_FOLDER=/var/www/pythonhelper/ppt_files
```

启动服务：
```bash
supervisorctl reread
supervisorctl update
supervisorctl start pythonhelper
```

## 🔧 部署后配置

### 修复文件路径问题
如果数据库中有Windows路径，需要修复：
```bash
cd /var/www/pythonhelper
sqlite3 mistakes.db "UPDATE ppt_files SET file_path = REPLACE(file_path, 'c:\\Users\\Yang Xingtao\\Desktop\\PythonHelper\\PythonHelperBackend\\ppt_files\\', '/var/www/pythonhelper/ppt_files/');"
```

### Chrome 扩展配置
部署后，需要更新Chrome扩展的配置：

1. 打开扩展目录中的 `js/common/api.js`
2. 确认 `getBackendUrl()` 函数能正确识别生产环境
3. 或者手动设置服务器地址：
```javascript
const BACKEND_URL = 'http://yourdomain.com';  // 改为你的服务器地址
```

## 📋 预览功能说明

### 当前实现
- **PDF文件**：直接在浏览器中预览
- **PPT文件**：尝试使用Google Docs Viewer（需要公网访问）
- **其他文件**：提供下载链接

### Google Docs Viewer 限制
Google Docs Viewer 有以下限制：
1. 只能预览公网可访问的文件
2. 文件大小限制（通常25MB以内）
3. 支持的格式有限

### 推荐的预览解决方案

#### 方案1: 使用 Office Online
```javascript
// 在UIManager.js中修改PPT预览逻辑
const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`;
```

#### 方案2: 转换为图片预览
在后端添加PPT转图片功能：
```python
# 安装依赖
pip install python-pptx Pillow

# 在后端添加转换接口
@ppt_bp.route('/files/<int:ppt_id>/images', methods=['GET'])
def get_ppt_images(ppt_id):
    # 将PPT转换为图片并返回
    pass
```

#### 方案3: 使用 PDF.js
将PPT转换为PDF后使用PDF.js预览：
```python
# 安装LibreOffice
apt install -y libreoffice

# 转换命令
libreoffice --headless --convert-to pdf --outdir /tmp/ file.pptx
```

## 🔍 故障排查

### 常见问题

#### 1. 服务无法启动
```bash
# 查看日志
tail -f /var/www/pythonhelper/logs/app.log
supervisorctl status pythonhelper
```

#### 2. 静态文件404
```bash
# 检查文件权限
ls -la /var/www/pythonhelper/static/
# 检查Nginx配置
nginx -t
```

#### 3. 数据库权限错误
```bash
# 修复权限
chown www-data:www-data /var/www/pythonhelper/mistakes.db
chmod 664 /var/www/pythonhelper/mistakes.db
```

#### 4. PPT预览失败
- 确保文件路径正确
- 检查文件权限
- 验证API接口返回

### 有用的命令
```bash
# 重启服务
supervisorctl restart pythonhelper

# 查看Nginx状态
systemctl status nginx

# 查看实时日志
tail -f /var/www/pythonhelper/logs/app.log

# 测试API
curl http://your-domain/health

# 查看进程
ps aux | grep python
```

## 📝 后续优化建议

1. **HTTPS配置**：使用 Let's Encrypt 配置SSL证书
2. **性能优化**：使用Gunicorn替代Flask开发服务器
3. **监控告警**：配置日志监控和邮件告警
4. **备份方案**：定期备份数据库和文件
5. **CDN加速**：静态文件使用CDN加速访问

## 📞 支持

如果遇到部署问题：
1. 检查服务器系统要求
2. 查看错误日志
3. 确认网络连接和防火墙设置
4. 验证域名DNS解析