"""
用户反馈模型 - 用于 RLHF 反馈闭环
记录用户对 AI 推荐结果的点击/跳过行为
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Index, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class UserRecommendationFeedback(Base):
    """用户对推荐结果的反馈表"""
    __tablename__ = "user_recommendation_feedback"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # 推荐上下文
    recommendation_algorithm = Column(String(20), nullable=False)  # ai/hybrid/popular 等
    recommendation_reason = Column(Text, nullable=True)  # AI 推荐理由
    
    # 用户反馈
    is_clicked = Column(Boolean, default=False)  # 是否点击
    is_skipped = Column(Boolean, default=False)  # 是否跳过（展示但未点击）
    
    # 负样本信息（用于 Prompt 修正）
    post_category = Column(String(50), nullable=True)  # 文章分类
    post_title = Column(String(200), nullable=True)   # 文章标题（记录时快照）
    
    # 时间戳
    created_at = Column(DateTime, server_default=func.now())
    
    # 关联关系
    user = relationship("User", back_populates="recommendation_feedbacks")
    post = relationship("Post", back_populates="recommendation_feedbacks")
    
    # 复合索引
    __table_args__ = (
        Index('idx_user_recommendation', 'user_id', 'post_id', 'recommendation_algorithm'),
        Index('idx_user_feedback_time', 'user_id', 'created_at'),
    )


class UserNegativePreference(Base):
    """用户负向偏好表 - 记录用户不喜欢的内容类型"""
    __tablename__ = "user_negative_preferences"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # 负向偏好维度
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=True)
    keyword = Column(String(50), nullable=True)  # 关键词（从标题/摘要提取）
    
    # 负向强度（跳过次数越多，强度越高）
    negative_score = Column(Integer, default=1)  # 负向分数
    skip_count = Column(Integer, default=1)      # 跳过次数
    
    # 最近更新时间
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # 关联关系
    user = relationship("User", back_populates="negative_preferences")
    category = relationship("Category", back_populates="user_negative_preferences")
    
    # 复合唯一索引
    __table_args__ = (
        Index('idx_user_negative_category', 'user_id', 'category_id', unique=True),
        Index('idx_user_negative_keyword', 'user_id', 'keyword'),
    )
