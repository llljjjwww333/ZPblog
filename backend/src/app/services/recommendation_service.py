"""
推荐系统服务 - 实现多种推荐算法
"""
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc, and_, or_, case, text
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
import random
import math

from app.model.post import Post
from app.model.user import User
from app.model.category import Category
from app.model.comment import Comment
from app.model.user_behavior import UserBehavior, UserPreference, PostSimilarity


class RecommendationService:
    """推荐服务类"""
    
    # 行为权重配置
    BEHAVIOR_WEIGHTS = {
        'view': 1.0,      # 浏览
        'like': 3.0,      # 点赞
        'comment': 5.0,   # 评论
        'collect': 4.0,   # 收藏
        'share': 6.0,     # 分享
    }
    
    def __init__(self, db: Session):
        self.db = db
    
    def record_behavior(self, user_id: int, post_id: int, behavior_type: str) -> bool:
        """
        记录用户行为
        
        Args:
            user_id: 用户ID
            post_id: 文章ID
            behavior_type: 行为类型 (view/like/comment/share/collect)
        
        Returns:
            是否记录成功
        """
        try:
            # 检查是否已存在相同行为
            existing = self.db.query(UserBehavior).filter(
                and_(
                    UserBehavior.user_id == user_id,
                    UserBehavior.post_id == post_id,
                    UserBehavior.behavior_type == behavior_type
                )
            ).first()
            
            if existing:
                # 更新行为时间
                existing.created_at = datetime.now()
            else:
                # 创建新行为记录
                behavior = UserBehavior(
                    user_id=user_id,
                    post_id=post_id,
                    behavior_type=behavior_type,
                    score=self.BEHAVIOR_WEIGHTS.get(behavior_type, 1.0)
                )
                self.db.add(behavior)
            
            # 更新用户偏好
            self._update_user_preference(user_id, post_id, behavior_type)
            
            self.db.commit()
            return True
        except Exception as e:
            print(f"记录用户行为失败: {e}")
            self.db.rollback()
            return False
    
    def _update_user_preference(self, user_id: int, post_id: int, behavior_type: str):
        """更新用户对分类的偏好"""
        # 获取文章分类
        post = self.db.query(Post).filter(Post.id == post_id).first()
        if not post or not post.category_id:
            return
        
        category_id = post.category_id
        weight = self.BEHAVIOR_WEIGHTS.get(behavior_type, 1.0)
        
        # 查找或创建偏好记录
        preference = self.db.query(UserPreference).filter(
            and_(
                UserPreference.user_id == user_id,
                UserPreference.category_id == category_id
            )
        ).first()
        
        if preference:
            preference.preference_score += weight
        else:
            preference = UserPreference(
                user_id=user_id,
                category_id=category_id,
                preference_score=weight
            )
            self.db.add(preference)
    
    def get_popular_posts(self, limit: int = 10, days: int = 30) -> List[Post]:
        """
        获取热门文章（基于阅读量和时间衰减）
        
        Args:
            limit: 返回数量
            days: 考虑的天数范围
        
        Returns:
            热门文章列表
        """
        # 计算时间范围
        start_date = datetime.now() - timedelta(days=days)
        
        # 热门度评分 = 阅读量 * 时间衰减因子 + 行为加权分数
        # 使用通用的日期差计算方式
        try:
            posts = self.db.query(
                Post,
                (
                    Post.view_count * func.exp(-(func.julianday(func.now()) - func.julianday(Post.created_at)) / 7) +
                    func.coalesce(
                        self.db.query(func.sum(UserBehavior.score))
                        .filter(UserBehavior.post_id == Post.id)
                        .filter(UserBehavior.created_at >= start_date)
                        .scalar_subquery(),
                        0
                    )
                ).label('hot_score')
            ).filter(
                Post.status == 'published'
            ).order_by(desc('hot_score')).limit(limit).all()
        except:
            # 如果上面的方式失败，使用简单的按阅读量排序
            posts = self.db.query(
                Post,
                Post.view_count.label('hot_score')
            ).filter(
                Post.status == 'published'
            ).order_by(desc(Post.view_count)).limit(limit).all()
        
        return [post for post, _ in posts]
    
    def get_collaborative_recommendations(self, user_id: int, limit: int = 10) -> List[Post]:
        """
        基于协同过滤的推荐
        
        找到与目标用户兴趣相似的其他用户，推荐他们喜欢的文章
        
        Args:
            user_id: 用户ID
            limit: 返回数量
        
        Returns:
            推荐文章列表
        """
        # 获取当前用户有行为的分类
        user_categories = self.db.query(UserPreference.category_id).filter(
            UserPreference.user_id == user_id
        ).all()
        
        if not user_categories:
            # 如果没有偏好记录，返回热门文章
            return self.get_popular_posts(limit)
        
        category_ids = [c[0] for c in user_categories]
        
        # 找到有相似偏好的其他用户
        similar_users = self.db.query(UserPreference.user_id).filter(
            and_(
                UserPreference.category_id.in_(category_ids),
                UserPreference.user_id != user_id
            )
        ).group_by(UserPreference.user_id).having(
            func.count(UserPreference.category_id) >= len(category_ids) * 0.3
        ).all()
        
        if not similar_users:
            return self.get_popular_posts(limit)
        
        similar_user_ids = [u[0] for u in similar_users]
        
        # 获取这些用户喜欢但当前用户未看过的文章
        recommended_posts = self.db.query(Post).join(
            UserBehavior,
            UserBehavior.post_id == Post.id
        ).filter(
            and_(
                Post.status == 'published',
                UserBehavior.user_id.in_(similar_user_ids),
                ~Post.id.in_(
                    self.db.query(UserBehavior.post_id).filter(
                        UserBehavior.user_id == user_id
                    )
                )
            )
        ).group_by(Post.id).order_by(
            desc(func.sum(UserBehavior.score))
        ).limit(limit).all()
        
        return recommended_posts
    
    def get_content_based_recommendations(self, user_id: int, limit: int = 10) -> List[Post]:
        """
        基于内容的推荐
        
        根据用户历史行为，推荐相似分类的文章
        
        Args:
            user_id: 用户ID
            limit: 返回数量
        
        Returns:
            推荐文章列表
        """
        # 获取用户偏好分类
        preferences = self.db.query(UserPreference).filter(
            UserPreference.user_id == user_id
        ).order_by(desc(UserPreference.preference_score)).limit(5).all()
        
        if not preferences:
            return self.get_popular_posts(limit)
        
        category_ids = [p.category_id for p in preferences]
        
        # 获取用户已阅读的文章ID
        read_post_ids = [
            b[0] for b in self.db.query(UserBehavior.post_id).filter(
                UserBehavior.user_id == user_id
            ).all()
        ]
        
        # 推荐偏好分类中的文章（排除已阅读的）
        query = self.db.query(Post).filter(
            and_(
                Post.status == 'published',
                Post.category_id.in_(category_ids)
            )
        )
        
        if read_post_ids:
            query = query.filter(~Post.id.in_(read_post_ids))
        
        # 按分类偏好分数和文章热度排序
        posts = query.order_by(
            desc(Post.view_count),
            desc(Post.created_at)
        ).limit(limit).all()
        
        return posts
    
    def get_hybrid_recommendations(
        self, 
        user_id: Optional[int] = None, 
        limit: int = 10,
        weights: Dict[str, float] = None
    ) -> List[Post]:
        """
        混合推荐算法
        
        综合多种推荐策略，加权混合结果
        
        Args:
            user_id: 用户ID（未登录则为None）
            limit: 返回数量
            weights: 各算法权重配置
        
        Returns:
            推荐文章列表
        """
        if weights is None:
            weights = {
                'popular': 0.3,
                'collaborative': 0.3,
                'content': 0.4
            }
        
        # 未登录用户只返回热门文章
        if user_id is None:
            return self.get_popular_posts(limit)
        
        # 获取各算法推荐结果
        popular_posts = self.get_popular_posts(limit * 2)
        collaborative_posts = self.get_collaborative_recommendations(user_id, limit * 2)
        content_posts = self.get_content_based_recommendations(user_id, limit * 2)
        
        # 加权打分
        post_scores: Dict[int, Tuple[Post, float]] = {}
        
        # 热门算法打分
        for i, post in enumerate(popular_posts):
            score = weights['popular'] * (1.0 - i / len(popular_posts)) if popular_posts else 0
            if post.id in post_scores:
                post_scores[post.id] = (post_scores[post.id][0], post_scores[post.id][1] + score)
            else:
                post_scores[post.id] = (post, score)
        
        # 协同过滤打分
        for i, post in enumerate(collaborative_posts):
            score = weights['collaborative'] * (1.0 - i / len(collaborative_posts)) if collaborative_posts else 0
            if post.id in post_scores:
                post_scores[post.id] = (post_scores[post.id][0], post_scores[post.id][1] + score)
            else:
                post_scores[post.id] = (post, score)
        
        # 内容推荐打分
        for i, post in enumerate(content_posts):
            score = weights['content'] * (1.0 - i / len(content_posts)) if content_posts else 0
            if post.id in post_scores:
                post_scores[post.id] = (post_scores[post.id][0], post_scores[post.id][1] + score)
            else:
                post_scores[post.id] = (post, score)
        
        # 按分数排序并返回
        sorted_posts = sorted(post_scores.values(), key=lambda x: x[1], reverse=True)
        return [post for post, _ in sorted_posts[:limit]]
    
    def get_related_posts(self, post_id: int, limit: int = 5) -> List[Post]:
        """
        获取相关文章（基于内容相似度）
        
        Args:
            post_id: 当前文章ID
            limit: 返回数量
        
        Returns:
            相关文章列表
        """
        # 获取当前文章
        current_post = self.db.query(Post).filter(Post.id == post_id).first()
        if not current_post:
            return []
        
        # 优先返回同分类的文章
        related_posts = self.db.query(Post).filter(
            and_(
                Post.status == 'published',
                Post.category_id == current_post.category_id,
                Post.id != post_id
            )
        ).order_by(desc(Post.view_count)).limit(limit).all()
        
        # 如果同分类文章不足，补充其他热门文章
        if len(related_posts) < limit:
            existing_ids = [p.id for p in related_posts] + [post_id]
            additional_posts = self.db.query(Post).filter(
                and_(
                    Post.status == 'published',
                    ~Post.id.in_(existing_ids)
                )
            ).order_by(desc(Post.view_count)).limit(limit - len(related_posts)).all()
            related_posts.extend(additional_posts)
        
        return related_posts
    
    def get_personalized_feed(
        self, 
        user_id: int, 
        page: int = 1, 
        size: int = 10
    ) -> Tuple[List[Post], int]:
        """
        获取个性化推荐流（分页）
        
        Args:
            user_id: 用户ID
            page: 页码
            size: 每页数量
        
        Returns:
            (文章列表, 总数量)
        """
        # 获取推荐文章
        recommended = self.get_hybrid_recommendations(user_id, limit=size * 3)
        
        # 分页
        start = (page - 1) * size
        end = start + size
        paginated_posts = recommended[start:end]
        
        return paginated_posts, len(recommended)
    
    def calculate_post_similarity(self, post_id_1: int, post_id_2: int) -> float:
        """
        计算两篇文章的相似度
        
        基于：
        1. 是否同分类
        2. 共同阅读用户数量
        3. 标题相似度（简单实现）
        
        Args:
            post_id_1: 文章1 ID
            post_id_2: 文章2 ID
        
        Returns:
            相似度分数 (0-1)
        """
        post1 = self.db.query(Post).filter(Post.id == post_id_1).first()
        post2 = self.db.query(Post).filter(Post.id == post_id_2).first()
        
        if not post1 or not post2:
            return 0.0
        
        score = 0.0
        
        # 同分类加分
        if post1.category_id == post2.category_id and post1.category_id:
            score += 0.3
        
        # 共同阅读用户
        users1 = set(
            b[0] for b in self.db.query(UserBehavior.user_id).filter(
                UserBehavior.post_id == post_id_1
            ).all()
        )
        users2 = set(
            b[0] for b in self.db.query(UserBehavior.user_id).filter(
                UserBehavior.post_id == post_id_2
            ).all()
        )
        
        if users1 and users2:
            common_users = users1 & users2
            union_users = users1 | users2
            jaccard_similarity = len(common_users) / len(union_users) if union_users else 0
            score += jaccard_similarity * 0.7
        
        return min(score, 1.0)
