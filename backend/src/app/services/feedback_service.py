"""
用户反馈服务 - 实现 RLHF 反馈闭环
记录用户对推荐结果的点击/跳过行为，构建负样本用于 Prompt 修正
"""
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_
from typing import List, Dict, Optional
from datetime import datetime, timedelta

from app.model.user_feedback import UserRecommendationFeedback, UserNegativePreference
from app.model.post import Post
from app.model.category import Category


class FeedbackService:
    """用户反馈服务类"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def record_recommendation_show(self, user_id: int, post_id: int, 
                                   algorithm: str, reason: str = None) -> bool:
        """
        记录推荐展示（用于后续判断跳过）
        
        Args:
            user_id: 用户ID
            post_id: 文章ID
            algorithm: 推荐算法类型
            reason: AI推荐理由
        
        Returns:
            是否记录成功
        """
        try:
            # 获取文章信息
            post = self.db.query(Post).filter(Post.id == post_id).first()
            category_name = post.category.name if post and post.category else None
            
            # 检查是否已存在记录
            existing = self.db.query(UserRecommendationFeedback).filter(
                and_(
                    UserRecommendationFeedback.user_id == user_id,
                    UserRecommendationFeedback.post_id == post_id,
                    UserRecommendationFeedback.recommendation_algorithm == algorithm
                )
            ).first()
            
            if existing:
                return True  # 已存在则不重复记录
            
            # 创建新的反馈记录
            feedback = UserRecommendationFeedback(
                user_id=user_id,
                post_id=post_id,
                recommendation_algorithm=algorithm,
                recommendation_reason=reason,
                is_clicked=False,
                is_skipped=False,
                post_category=category_name,
                post_title=post.title if post else None
            )
            
            self.db.add(feedback)
            self.db.commit()
            return True
            
        except Exception as e:
            print(f"记录推荐展示失败: {e}")
            self.db.rollback()
            return False
    
    def record_click(self, user_id: int, post_id: int, algorithm: str) -> bool:
        """
        记录用户点击推荐文章（正反馈）
        
        Args:
            user_id: 用户ID
            post_id: 文章ID
            algorithm: 推荐算法类型
        
        Returns:
            是否记录成功
        """
        try:
            # 查找或创建反馈记录
            feedback = self.db.query(UserRecommendationFeedback).filter(
                and_(
                    UserRecommendationFeedback.user_id == user_id,
                    UserRecommendationFeedback.post_id == post_id,
                    UserRecommendationFeedback.recommendation_algorithm == algorithm
                )
            ).first()
            
            if feedback:
                feedback.is_clicked = True
                feedback.is_skipped = False
            else:
                # 如果没有展示记录，直接创建点击记录
                post = self.db.query(Post).filter(Post.id == post_id).first()
                feedback = UserRecommendationFeedback(
                    user_id=user_id,
                    post_id=post_id,
                    recommendation_algorithm=algorithm,
                    is_clicked=True,
                    is_skipped=False,
                    post_category=post.category.name if post and post.category else None,
                    post_title=post.title if post else None
                )
                self.db.add(feedback)
            
            self.db.commit()
            return True
            
        except Exception as e:
            print(f"记录点击失败: {e}")
            self.db.rollback()
            return False
    
    def record_skip(self, user_id: int, post_id: int, algorithm: str) -> bool:
        """
        记录用户跳过推荐文章（负反馈）
        同时更新负向偏好表
        
        Args:
            user_id: 用户ID
            post_id: 文章ID
            algorithm: 推荐算法类型
        
        Returns:
            是否记录成功
        """
        try:
            # 查找展示记录并标记为跳过
            feedback = self.db.query(UserRecommendationFeedback).filter(
                and_(
                    UserRecommendationFeedback.user_id == user_id,
                    UserRecommendationFeedback.post_id == post_id,
                    UserRecommendationFeedback.recommendation_algorithm == algorithm,
                    UserRecommendationFeedback.is_clicked == False
                )
            ).first()
            
            if feedback:
                feedback.is_skipped = True
                
                # 更新负向偏好
                self._update_negative_preference(user_id, post_id, feedback.post_category)
            
            self.db.commit()
            return True
            
        except Exception as e:
            print(f"记录跳过失败: {e}")
            self.db.rollback()
            return False
    
    def _update_negative_preference(self, user_id: int, post_id: int, category_name: str = None):
        """更新用户负向偏好"""
        try:
            # 1. 更新分类负向偏好
            if category_name:
                category = self.db.query(Category).filter(Category.name == category_name).first()
                if category:
                    negative_pref = self.db.query(UserNegativePreference).filter(
                        and_(
                            UserNegativePreference.user_id == user_id,
                            UserNegativePreference.category_id == category.id
                        )
                    ).first()
                    
                    if negative_pref:
                        negative_pref.skip_count += 1
                        negative_pref.negative_score += 2  # 每次跳过加2分
                    else:
                        negative_pref = UserNegativePreference(
                            user_id=user_id,
                            category_id=category.id,
                            negative_score=2,
                            skip_count=1
                        )
                        self.db.add(negative_pref)
            
            # 2. 提取文章关键词并更新关键词负向偏好（简化版：从标题提取）
            post = self.db.query(Post).filter(Post.id == post_id).first()
            if post and post.title:
                # 提取标题关键词（这里简化处理，实际可用 NLP 分词）
                keywords = self._extract_keywords(post.title)
                for keyword in keywords:
                    if len(keyword) >= 2:  # 至少2个字符
                        negative_pref = self.db.query(UserNegativePreference).filter(
                            and_(
                                UserNegativePreference.user_id == user_id,
                                UserNegativePreference.keyword == keyword
                            )
                        ).first()
                        
                        if negative_pref:
                            negative_pref.skip_count += 1
                            negative_pref.negative_score += 1
                        else:
                            negative_pref = UserNegativePreference(
                                user_id=user_id,
                                keyword=keyword,
                                negative_score=1,
                                skip_count=1
                            )
                            self.db.add(negative_pref)
            
        except Exception as e:
            print(f"更新负向偏好失败: {e}")
    
    def _extract_keywords(self, title: str) -> List[str]:
        """从标题提取关键词（简化版）"""
        # 这里可以使用 jieba 等分词工具，简化处理直接按空格和标点分割
        import re
        # 去除标点，按空格分割
        words = re.findall(r'[\u4e00-\u9fa5]{2,}|[a-zA-Z]+', title)
        return words[:3]  # 最多取3个关键词
    
    def get_negative_preferences(self, user_id: int, limit: int = 5) -> Dict:
        """
        获取用户负向偏好（用于 Prompt 修正）
        
        Returns:
            {
                "categories": [("技术", 5), ("生活", 3)],  # 跳过的分类及次数
                "keywords": [("Python", 3), ("教程", 2)]   # 跳过的关键词
            }
        """
        try:
            # 获取负向分类偏好
            category_prefs = self.db.query(
                Category.name,
                UserNegativePreference.skip_count
            ).join(
                UserNegativePreference,
                UserNegativePreference.category_id == Category.id
            ).filter(
                UserNegativePreference.user_id == user_id
            ).order_by(
                desc(UserNegativePreference.negative_score)
            ).limit(limit).all()
            
            # 获取负向关键词偏好
            keyword_prefs = self.db.query(
                UserNegativePreference.keyword,
                UserNegativePreference.skip_count
            ).filter(
                and_(
                    UserNegativePreference.user_id == user_id,
                    UserNegativePreference.keyword != None
                )
            ).order_by(
                desc(UserNegativePreference.negative_score)
            ).limit(limit).all()
            
            return {
                "categories": [(c[0], c[1]) for c in category_prefs],
                "keywords": [(k[0], k[1]) for k in keyword_prefs]
            }
            
        except Exception as e:
            print(f"获取负向偏好失败: {e}")
            return {"categories": [], "keywords": []}
    
    def get_recent_skipped_posts(self, user_id: int, limit: int = 5) -> List[Dict]:
        """
        获取用户最近跳过的文章（用于 Prompt 中的负样本示例）
        
        Returns:
            [{"title": "...", "category": "...", "reason": "..."}]
        """
        try:
            skipped = self.db.query(UserRecommendationFeedback).filter(
                and_(
                    UserRecommendationFeedback.user_id == user_id,
                    UserRecommendationFeedback.is_skipped == True
                )
            ).order_by(
                desc(UserRecommendationFeedback.created_at)
            ).limit(limit).all()
            
            return [
                {
                    "title": s.post_title or "未知文章",
                    "category": s.post_category or "未分类",
                    "reason": s.recommendation_reason or ""
                }
                for s in skipped
            ]
            
        except Exception as e:
            print(f"获取跳过记录失败: {e}")
            return []
    
    def get_feedback_statistics(self, user_id: int) -> Dict:
        """获取用户反馈统计"""
        try:
            stats = self.db.query(
                func.sum(UserRecommendationFeedback.is_clicked).label('total_clicks'),
                func.sum(UserRecommendationFeedback.is_skipped).label('total_skips')
            ).filter(
                UserRecommendationFeedback.user_id == user_id
            ).first()
            
            return {
                "total_clicks": stats.total_clicks or 0,
                "total_skips": stats.total_skips or 0,
                "click_rate": stats.total_clicks / (stats.total_clicks + stats.total_skips) 
                              if (stats.total_clicks + stats.total_skips) > 0 else 0
            }
            
        except Exception as e:
            print(f"获取反馈统计失败: {e}")
            return {"total_clicks": 0, "total_skips": 0, "click_rate": 0}
