"""
数据库连接配置
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from app.config import settings

# 创建数据库引擎
engine = create_engine(
    settings.DATABASE_URL, #继承settings.py中的DATABASE_URL
    connect_args={}, # MySQL不需要特殊的连接参数
    pool_size=10,      # 连接池大小
    max_overflow=20,   # 最大溢出连接数
    pool_timeout=60,   # 连接超时时间（秒）
    pool_recycle=1800, # 连接回收时间（秒）
    echo=False         # 是否打印SQL语句
)

# 创建数据库会话类
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 核心
Base = declarative_base()#model被post引用post引用post引用post引用post引用post引用post引用post引用

# 依赖函数，用于在路由中获取数据库会话
def get_db():
    """
    获取数据库会话
    在FastAPI的Depends中使用
    """
    db = SessionLocal()# 创建数据库会话实例
    try:
        yield db
    finally:
        db.close()