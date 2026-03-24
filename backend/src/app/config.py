from pydantic_settings import BaseSettings
from typing import Optional, List
import os
from pathlib import Path
from dotenv import load_dotenv

# 加载 .env 文件
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)
    print(f"[CONFIG] 已加载 .env 文件: {env_path}")
else:
    print(f"[CONFIG] 未找到 .env 文件: {env_path}")

class Settings(BaseSettings):
   
   # 应用配置
    app_name: str = "ZPblog"
    DEBUG: bool = False  # 生产环境默认为 False
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "http://127.0.0.1:3001"]
   
   # 数据库配置 - 从环境变量读取，提供默认值仅用于开发
    DATABASE_URL: str = "sqlite:///./blog.db"  # 默认使用 SQLite，生产环境应使用 MySQL

   # JWT 配置 - 生产环境必须从环境变量设置
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # 上传文件配置
    UPLOAD_DIR: str = "app/static/uploads"
    MAX_UPLOAD_SIZE: int = 5 * 1024 * 1024  # 5MB
    
    # AI 推荐配置 - 从环境变量读取
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "local")  # openai / azure / local
    AI_API_KEY: str = os.getenv("AI_API_KEY", "")  # DeepSeek/OpenAI API Key
    AI_API_BASE: str = os.getenv("AI_API_BASE", "https://api.deepseek.com/v1")
    AI_MODEL: str = os.getenv("AI_MODEL", "deepseek-chat")

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "allow"  # 允许额外的环境变量


settings = Settings()  # 核心类 setting，被 database.py 引用