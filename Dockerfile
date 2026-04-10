# 后端Dockerfile
FROM python:3.9-slim

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \n    gcc \n    libpq-dev \n    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY backend/requirements.txt .
COPY backend/src/requirements.txt ./backend-requirements.txt

# 安装Python依赖
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir -r backend-requirements.txt

# 复制后端代码
COPY backend/src/ /app/backend/src/

# 复制前端构建文件（可选）
# 如果前端采用 Render 静态站点部署，则此复制步骤不是必需的。
#COPY frontend/dist/ /app/frontend/dist/

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["uvicorn", "backend.src.main:app", "--host", "0.0.0.0", "--port", "8000"]
