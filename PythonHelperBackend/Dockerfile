FROM python:3.12

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 5000

# 挂载数据卷
ENV DATABASE_PATH=/data/mistakes.db
ENV PPT_UPLOAD_FOLDER=/data/ppt_files
ENV FLASK_DEBUG=0
# 如果容器对外使用 HTTPS，保持 true；若直接暴露 HTTP，请改为 false
ENV SESSION_COOKIE_SECURE=true

RUN mkdir -p /data/ppt_files
CMD ["python", "run.py"]
