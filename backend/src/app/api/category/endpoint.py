"""
分类相关的API端点
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.model.category import Category
from app.schemas.category import (
    CategoryCreate, CategoryUpdate, CategoryResponse, 
    CategoryTree, CategorySimple
)

# 创建路由器
router = APIRouter(prefix="/categories", tags=["categories"])

# ========== 创建分类 ==========
@router.post("/", 
             response_model=CategoryResponse, 
             status_code=status.HTTP_201_CREATED,
             summary="创建新分类",
             description="创建一个新的文章分类")
async def create_category(
    category_data: CategoryCreate,
    db: Session = Depends(get_db)
):
    """
    创建新分类
    
    - **name**: 分类名称（必需）
    - **parent_id**: 父分类ID（可选，创建子分类）
    """
    
    # 检查父分类是否存在
    if category_data.parent_id:
        parent = db.query(Category).filter(Category.id == category_data.parent_id).first()
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"父分类 ID {category_data.parent_id} 不存在"
            )
    
    # 创建分类对象
    db_category = Category(**category_data.model_dump())
    
    # 保存到数据库
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    
    return db_category

# ========== 获取所有分类（平铺列表） ==========
@router.get("/", 
            response_model=List[CategoryResponse],
            summary="获取所有分类",
            description="获取所有分类的平铺列表")
async def get_categories(
    include_posts: bool = Query(False, description="是否包含文章数量统计"),
    db: Session = Depends(get_db)
):
    """
    获取所有分类（平铺列表）
    
    - **include_posts**: 是否更新文章数量统计（默认false）
    """
    
    # 如果需要更新文章数量统计
    if include_posts:
        # 更新每个分类的文章数量
        categories = db.query(Category).all()
        for category in categories:
            # 这里需要计算该分类下的文章数量
            # 稍后实现
            pass
    
    # 按创建时间排序
    categories = db.query(Category).order_by(
        Category.created_at.asc()
    ).all()
    
    return categories

# ========== 获取分类树 ==========
@router.get("/tree", 
            response_model=List[CategoryTree],
            summary="获取分类树",
            description="获取分类的树形结构")
async def get_category_tree(db: Session = Depends(get_db)):
    """
    获取分类的树形结构
    
    返回层级嵌套的分类结构
    """
    
    # 获取所有分类
    all_categories = db.query(Category).order_by(
        Category.created_at.asc()
    ).all()
    
    # 构建树形结构
    def build_tree(parent_id=None):
        """递归构建分类树"""
        result = []
        for category in all_categories:
            if category.parent_id == parent_id:
                # 创建分类节点
                category_dict = CategoryResponse.model_validate(category).model_dump()
                # 递归获取子分类
                children = build_tree(category.id)
                # 构建树节点
                tree_node = CategoryTree(**category_dict, children=children)
                result.append(tree_node)
        return result
    
    return build_tree()

# ========== 获取单分类 ==========
@router.get("/{category_id}/", 
            response_model=CategoryResponse,
            summary="获取单分类",
            description="根据ID获取单个分类的详细信息")
async def get_category(
    category_id: int,
    db: Session = Depends(get_db)
):
    """
    获取单个分类
    
    - **category_id**: 分类ID
    """
    
    category = db.query(Category).filter(Category.id == category_id).first()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"分类 ID {category_id} 不存在"
        )
    
    return category



# ========== 更新分类 ==========
@router.put("/{category_id}/", 
            response_model=CategoryResponse,
            summary="更新分类",
            description="更新分类的名称、描述等信息")
async def update_category(
    category_id: int,
    category_data: CategoryUpdate,
    db: Session = Depends(get_db)
):
    """
    更新分类
    
    - **category_id**: 要更新的分类ID
    """
    
    # 获取分类
    category = db.query(Category).filter(Category.id == category_id).first()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"分类 ID {category_id} 不存在"
        )
    
    # 检查父分类是否存在且不能是自身
    if category_data.parent_id:
        if category_data.parent_id == category_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="分类不能将自身设置为父分类"
            )
        
        parent = db.query(Category).filter(Category.id == category_data.parent_id).first()
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"父分类 ID {category_data.parent_id} 不存在"
            )
    
    # 更新字段
    update_data = category_data.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(category, field, value)
    
    # 保存更改
    db.commit()
    db.refresh(category)
    
    return category

# ========== 删除分类 ==========
@router.delete("/{category_id}/", 
               status_code=status.HTTP_204_NO_CONTENT,
               summary="删除分类",
               description="根据ID删除分类")
async def delete_category(
    category_id: int,
    move_posts_to: Optional[int] = Query(None, description="将文章移动到其他分类的ID"),
    db: Session = Depends(get_db)
):
    """
    删除分类
    
    - **category_id**: 要删除的分类ID
    - **move_posts_to**: 可选，将文章移动到另一个分类
    """
    
    # 获取分类
    category = db.query(Category).filter(Category.id == category_id).first()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"分类 ID {category_id} 不存在"
        )
    
    # 检查是否有子分类
    child_count = db.query(Category).filter(Category.parent_id == category_id).count()
    if child_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无法删除有子分类的分类，请先删除或移动子分类"
        )
    
    # 检查是否有文章
    from app.model.post import Post
    post_count = db.query(Post).filter(Post.category_id == category_id).count()
    
    if post_count > 0:
        if not move_posts_to:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"分类下有 {post_count} 篇文章，请指定move_posts_to参数将文章移动到其他分类"
            )
        
        # 检查目标分类是否存在
        target_category = db.query(Category).filter(Category.id == move_posts_to).first()
        if not target_category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"目标分类 ID {move_posts_to} 不存在"
            )
        
        # 移动文章到新分类
        db.query(Post).filter(Post.category_id == category_id).update(
            {Post.category_id: move_posts_to}
        )
    
    # 删除分类
    db.delete(category)
    db.commit()
    
    return None