FROM python:3.12

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 5000

# 挂载数据卷
ENV DATABASE_PATH=/data/mistakes.db
ENV PPT_UPLOAD_FOLDER=/data/ppt_files

RUN mkdir -p /data/ppt_files
CMD ["python", "run.py"]
