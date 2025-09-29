#!/bin/bash
# deploy.sh - PythonHelper项目部署脚本

set -e  # 遇到错误立即停止

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置变量
SERVER_USER="${SERVER_USER:-root}"
SERVER_IP="${SERVER_IP:-your-server-ip}"
PROJECT_NAME="PythonHelper"
DEPLOY_DIR="/var/www/pythonhelper"
SERVICE_NAME="pythonhelper"

echo_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

echo_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查必要的环境变量
check_env() {
    echo_info "检查环境变量..."
    
    if [[ -z "$SERVER_IP" || "$SERVER_IP" == "your-server-ip" ]]; then
        echo_error "请设置 SERVER_IP 环境变量"
        echo "使用方法: SERVER_IP=1.2.3.4 ./deploy.sh"
        exit 1
    fi
    
    if [[ -z "$DOMAIN" ]]; then
        echo_warn "未设置 DOMAIN 环境变量，将使用IP地址"
        export DOMAIN=$SERVER_IP
    fi
}

# 本地构建和准备
prepare_local() {
    echo_info "准备本地文件..."
    
    # 创建部署目录
    mkdir -p ./deploy_package
    
    # 复制后端文件
    cp -r PythonHelperBackend/* ./deploy_package/
    
    # 复制前端文件到静态目录
    mkdir -p ./deploy_package/static
    cp -r PythonHelperFrontEnd/* ./deploy_package/static/
    
    # 创建必要的目录
    mkdir -p ./deploy_package/logs
    mkdir -p ./deploy_package/ppt_files
    
    # 复制现有的PPT文件
    if [[ -d "PythonHelperBackend/ppt_files" ]]; then
        cp -r PythonHelperBackend/ppt_files/* ./deploy_package/ppt_files/ 2>/dev/null || echo_warn "没有现有的PPT文件需要复制"
    fi
    
    echo_info "本地文件准备完成"
}

# 上传文件到服务器
upload_files() {
    echo_info "上传文件到服务器 $SERVER_IP..."
    
    # 创建服务器目录
    ssh -i ~/.ssh/MyKey.pem $SERVER_USER@$SERVER_IP "mkdir -p $DEPLOY_DIR"
    
    # 上传项目文件
    rsync -avz --progress -e "ssh -i ~/.ssh/MyKey.pem" ./deploy_package/ $SERVER_USER@$SERVER_IP:$DEPLOY_DIR/

    echo_info "文件上传完成"
}

# 服务器环境设置
setup_server() {
    echo_info "设置服务器环境..."

    ssh -i ~/.ssh/MyKey.pem $SERVER_USER@$SERVER_IP << EOF
set -e

echo "更新系统包..."
apt-get update

echo "安装Python和必要组件..."
apt-get install -y python3 python3-pip python3-venv nginx supervisor sqlite3

echo "创建虚拟环境..."
cd $DEPLOY_DIR
python3 -m venv venv
source venv/bin/activate

echo "安装Python依赖..."
pip install flask flask-cors

echo "设置文件权限..."
chown -R www-data:www-data $DEPLOY_DIR
chmod -R 755 $DEPLOY_DIR
chmod -R 777 $DEPLOY_DIR/ppt_files
chmod -R 777 $DEPLOY_DIR/logs

echo "服务器环境设置完成"
EOF
}

# 配置Nginx
configure_nginx() {
    echo_info "配置Nginx..."

    ssh -i ~/.ssh/MyKey.pem $SERVER_USER@$SERVER_IP << EOF
cat > /etc/nginx/sites-available/$PROJECT_NAME << 'NGINX_CONF'
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 100M;

    # 静态文件服务
    location /static/ {
        alias $DEPLOY_DIR/static/;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }

    # Chrome扩展文件
    location /extension/ {
        alias $DEPLOY_DIR/static/;
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
        add_header Access-Control-Allow-Headers "Content-Type";
    }

    # API代理到Flask
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # CORS设置
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
        
        if (\$request_method = 'OPTIONS') {
            return 204;
        }
    }
}
NGINX_CONF

# 启用站点
ln -sf /etc/nginx/sites-available/$PROJECT_NAME /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 测试并重启Nginx
nginx -t
systemctl restart nginx
systemctl enable nginx

echo "Nginx配置完成"
EOF
}

# 配置Supervisor
configure_supervisor() {
    echo_info "配置Supervisor..."
    
    ssh -i ~/.ssh/MyKey.pem $SERVER_USER@$SERVER_IP << EOF
cat > /etc/supervisor/conf.d/$SERVICE_NAME.conf << 'SUPERVISOR_CONF'
[program:$SERVICE_NAME]
directory=$DEPLOY_DIR
command=$DEPLOY_DIR/venv/bin/python run.py
user=www-data
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=$DEPLOY_DIR/logs/app.log
environment=FLASK_ENV=production,SERVER_DOMAIN=$DOMAIN,PPT_UPLOAD_FOLDER=$DEPLOY_DIR/ppt_files
SUPERVISOR_CONF

# 重启Supervisor
supervisorctl reread
supervisorctl update
supervisorctl start $SERVICE_NAME

echo "Supervisor配置完成"
EOF
}

# 更新数据库路径（修复Windows路径问题）
fix_database_paths() {
    echo_info "修复数据库中的文件路径..."
    
    ssh -i ~/.ssh/MyKey.pem $SERVER_USER@$SERVER_IP << EOF
cd $DEPLOY_DIR

# 备份数据库
cp mistakes.db mistakes.db.backup

# 修复PPT文件路径
sqlite3 mistakes.db << 'SQL'
UPDATE ppt_files 
SET file_path = REPLACE(
    file_path, 
    'c:\\Users\\Yang Xingtao\\Desktop\\PythonHelper\\PythonHelperBackend\\ppt_files\\', 
    '$DEPLOY_DIR/ppt_files/'
);

UPDATE ppt_files 
SET file_path = REPLACE(
    file_path, 
    '\\', 
    '/'
);

-- 显示更新结果
SELECT id, original_name, file_path FROM ppt_files LIMIT 5;
SQL

echo "数据库路径修复完成"
EOF
}

# 测试部署
test_deployment() {
    echo_info "测试部署..."
    
    echo "等待服务启动..."
    sleep 5
    
    # 测试API
    if curl -f "http://$SERVER_IP/health" > /dev/null 2>&1; then
        echo_info "✅ API服务正常"
    else
        echo_error "❌ API服务异常"
    fi
    
    # 测试静态文件
    if curl -f "http://$SERVER_IP/static/manifest.json" > /dev/null 2>&1; then
        echo_info "✅ 静态文件服务正常"
    else
        echo_warn "⚠️  静态文件服务可能有问题"
    fi
    
    echo_info "部署测试完成"
}

# 清理本地临时文件
cleanup() {
    echo_info "清理临时文件..."
    rm -rf ./deploy_package
}

# 主函数
main() {
    echo_info "开始部署 $PROJECT_NAME 到服务器 $SERVER_IP"
    
    check_env
    prepare_local
    upload_files
    setup_server
    configure_nginx
    configure_supervisor
    fix_database_paths
    test_deployment
    cleanup
    
    echo_info "🎉 部署完成！"
    echo_info "访问地址: http://$DOMAIN"
    echo_info "管理命令:"
    echo "  - 查看日志: ssh $SERVER_USER@$SERVER_IP 'tail -f $DEPLOY_DIR/logs/app.log'"
    echo "  - 重启服务: ssh $SERVER_USER@$SERVER_IP 'supervisorctl restart $SERVICE_NAME'"
    echo "  - 查看状态: ssh $SERVER_USER@$SERVER_IP 'supervisorctl status $SERVICE_NAME'"
}

# 显示帮助信息
show_help() {
    cat << EOF
PythonHelper项目部署脚本

使用方法:
    SERVER_IP=1.2.3.4 DOMAIN=yourdomain.com ./deploy.sh

环境变量:
    SERVER_IP    - 服务器IP地址 (必须)
    DOMAIN       - 服务器域名 (可选，默认使用IP)
    SERVER_USER  - SSH用户名 (可选，默认root)

示例:
    SERVER_IP=1.2.3.4 ./deploy.sh
    SERVER_IP=1.2.3.4 DOMAIN=pythonhelper.com SERVER_USER=ubuntu ./deploy.sh

EOF
}

# 参数处理
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac