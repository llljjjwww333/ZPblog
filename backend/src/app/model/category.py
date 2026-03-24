from sqlalchemy import Column, Integer, String, DateTime, ForeignKey,Boolean
from app.database import Base
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship


class Category(Base):
    __tablename__ = "categories"
   
    #主键
    id = Column(Integer, primary_key=True, index=True)
    

    #基本信息
    name = Column(String(50), unique=True, index=True)
    description = Column(String(255))
    image = Column(String(255), nullable=True) # 分类封面图

    #树形结构
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    


    #统计信息
    post_count = Column(Integer, default=0)#文章数量

    #时间戳
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    #自引用
    parent = relationship("Category", remote_side=[id], backref="children")

    #文章关系
    posts = relationship("Post", back_populates="category")#一对多
    
    #用户偏好关系
    user_preferences = relationship("UserPreference", back_populates="category")
    
    #用户负向偏好关系
    user_negative_preferences = relationship("UserNegativePreference", back_populates="category")

    def __repr__(self):  #python魔法方法，可以直接看对象信息
        return f"<Category {self.name}>"

