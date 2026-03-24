from sqlalchemy import Column, Integer, String, DateTime, ForeignKey,Boolean, Text
from app.database import Base
from sqlalchemy.sql import func
from sqlalchemy import ForeignKey#外键
from sqlalchemy.orm import relationship

class Post(Base):
   
    __tablename__ = "posts"# 表名: posts

    id = Column(Integer, primary_key=True, index=True)# 主键: id
   
    title = Column(String(255), nullable=False)# 标题: title
    excerpt = Column(String(255), nullable=True)# 摘要: excerpt
    content_markdown = Column(Text, nullable=False)# 内容: content
    content_html = Column(Text)# 内容: content_html
    cover_image = Column(String(255), nullable=True)# 封面图片: cover_image
    category_id = Column(Integer, ForeignKey("categories.id"), default=1)  # 关联category表
    status = Column(String(20), default="draft")  # 文章状态：草稿、已发布等
    created_at = Column(DateTime(timezone=True), server_default=func.now())# 创建时间: created_at
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())# 更新时间: updated_at
    published_at = Column(DateTime(timezone=True))  # 发布时间
    post_count = Column(Integer, default=0)# 文章数量: post_count
    view_count = Column(Integer, default=0)# 点击量: view_count

     # 外键（先简单处理，后面再加用户）
    author_id = Column(Integer, ForeignKey("users.id"), default=1)  # 默认为第一个用户
    
    
    # 与User模型的关系
    author = relationship("User", backref="posts")  # 与User模型的关系


    # 与Category模型中的posts关系对应
    category = relationship("Category", back_populates="posts")

    def __repr__(self):  #python魔法方法，可以直接看对象信息
        return f"<Post(id={self.id}, title={self.title}, status={self.status}, created_at={self.created_at}, updated_at={self.updated_at}, post_count={self.post_count}, view_count={self.view_count}, author_id={self.author_id})>"
    
    # 关联关系 - 推荐系统
    behaviors = relationship("UserBehavior", back_populates="post", cascade="all, delete-orphan")
    recommendation_feedbacks = relationship("UserRecommendationFeedback", back_populates="post", cascade="all, delete-orphan")