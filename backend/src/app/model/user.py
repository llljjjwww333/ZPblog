"""
用户数据模型
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    """用户模型"""
    
    __tablename__ = "users"
    
    # 主键
    id = Column(Integer, primary_key=True, index=True)
    
    # 用户基本信息
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    nickname = Column(String(100))  # 昵称
    avatar = Column(String(255), nullable=True)  # 用户头像URL
    bio = Column(String(500), nullable=True)  # 个人简介
    background_image = Column(String(255), nullable=True)  # 个人背景图URL
    
    # 社交链接
    github_url = Column(String(255), nullable=True)
    gitee_url = Column(String(255), nullable=True)
    
    # 认证信息
    hashed_password = Column(String(255), nullable=False)
    
    # 状态和权限
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    can_post = Column(Boolean, default=True)  # 是否允许发文章
    role = Column(String(20), default="author")  # admin/author/guest
    
    # 时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    def __repr__(self):
        return f"<User {self.id}: {self.username}>"
    
    # 关联关系
    behaviors = relationship("UserBehavior", back_populates="user", cascade="all, delete-orphan")
    preferences = relationship("UserPreference", back_populates="user", cascade="all, delete-orphan")
    recommendation_feedbacks = relationship("UserRecommendationFeedback", back_populates="user", cascade="all, delete-orphan")
    negative_preferences = relationship("UserNegativePreference", back_populates="user", cascade="all, delete-orphan")