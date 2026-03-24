"""
用户行为记录模型 - 用于推荐系统
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class UserBehavior(Base):
    """用户行为记录表"""
    __tablename__ = "user_behaviors"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    behavior_type = Column(String(20), nullable=False, index=True)  # view/like/comment/share/collect
    score = Column(Float, default=1.0)  # 行为权重
    created_at = Column(DateTime, server_default=func.now())
    
    # 关联关系
    user = relationship("User", back_populates="behaviors")
    post = relationship("Post", back_populates="behaviors")
    
    # 复合索引优化查询
    __table_args__ = (
        Index('idx_user_behavior', 'user_id', 'behavior_type'),
        Index('idx_post_behavior', 'post_id', 'behavior_type'),
        Index('idx_user_post_behavior', 'user_id', 'post_id', 'behavior_type', unique=True),
    )

class UserPreference(Base):
    """用户偏好表 - 记录用户对分类的偏好"""
    __tablename__ = "user_preferences"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False)
    preference_score = Column(Float, default=0.0)  # 偏好分数
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # 关联关系
    user = relationship("User", back_populates="preferences")
    category = relationship("Category", back_populates="user_preferences")
    
    # 复合唯一索引
    __table_args__ = (
        Index('idx_user_category_preference', 'user_id', 'category_id', unique=True),
    )

class PostSimilarity(Base):
    """文章相似度表 - 预计算文章之间的相似度"""
    __tablename__ = "post_similarities"
    
    id = Column(Integer, primary_key=True, index=True)
    post_id_1 = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    post_id_2 = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    similarity_score = Column(Float, default=0.0)  # 相似度分数 (0-1)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # 复合唯一索引
    __table_args__ = (
        Index('idx_post_pair', 'post_id_1', 'post_id_2', unique=True),
    )
