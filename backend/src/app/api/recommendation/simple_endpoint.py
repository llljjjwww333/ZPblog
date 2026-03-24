"""
推荐系统 API 端点 - 简化版本，避免 OAuth2 认证问题
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
import json

from app.database import get_db
from app.services.recommendation_service import RecommendationService
from app.services.ai_recommendation_service import AIRecommendationService
from app.services.feedback_service import FeedbackService
from app.services.reader_review_service import ReaderReviewService, ReaderRole
from app.services.ai_rewrite_service import get_rewrite_service
from app.services.multi_agent_review_service import get_multi_agent_service
from app.model.post import Post
from app.api.recommendation.dependencies import (
    get_current_user_optional,
    get_current_user_required
)
from app.core.rate_limit import RateLimitConfig
from app.model.user_llm_config import UserLLMConfig
from app.core.encryption import get_encryption

# 配置logger
logger = logging.getLogger(__name__)

router = APIRouter(tags=["recommendation"])


class RecommendedPostItem(BaseModel):
    id: int
    title: str
    excerpt: Optional[str] = None
    cover_image: Optional[str] = None
    status: str = "published"
    created_at: datetime
    view_count: int = 0
    author_id: Optional[int] = None
    author_nickname: Optional[str] = None


class RecommendedPostResponse(BaseModel):
    id: int
    title: str
    excerpt: Optional[str] = None
    cover_image: Optional[str] = None
    created_at: datetime
    view_count: int
    author_nickname: Optional[str] = None
    reason: str


class FeedbackRequest(BaseModel):
    post_id: int
    feedback_type: str  # 'interested', 'not_interested', 'skip'


class FeedbackResponse(BaseModel):
    success: bool
    message: str


class AIRecommendationResponse(BaseModel):
    posts: List[RecommendedPostResponse]
    reason: str


@router.get(
    "/recommendations",
    dependencies=[Depends(RateLimitConfig.RECOMMENDATION)]
)
async def get_recommendations(
    request: Request,
    limit: int = Query(10, ge=1, le=50, description="返回数量"),
    context: str = Query("", description="上下文信息"),
    algorithm: str = Query("ai", description="推荐算法: ai, popular, collaborative, content, hybrid"),
    model: str = Query("deepseek", description="使用的AI模型: deepseek, qwen, openai 等"),
    db: Session = Depends(get_db),
    user_id: Optional[int] = Depends(get_current_user_optional)
):
    """
    获取个性化推荐文章
    
    - **limit**: 返回文章数量（1-50）
    - **context**: 额外的上下文信息，如当前浏览的分类
    - **algorithm**: 推荐算法 (ai, popular, collaborative, content, hybrid)
    - **model**: 使用的AI模型 (deepseek, qwen, openai 等)
    """
    try:
        logger.info(f"获取推荐: algorithm={algorithm}, user_id={user_id}, model={model}")

        # 根据算法类型选择推荐服务
        if algorithm == 'ai':
            # AI智能推荐（传递user_id以支持用户自定义模型）
            ai_service = AIRecommendationService(db, provider_id=model, user_id=user_id)
            posts, reason = ai_service.get_ai_recommendations(user_id, limit, context, model=model)
            ai_reason = reason
        elif algorithm == 'popular':
            # 热门文章 - 按浏览量排序
            rec_service = RecommendationService(db)
            posts = rec_service.get_popular_posts(limit=limit, days=30)
            ai_reason = "基于文章热度推荐"
        elif algorithm == 'collaborative':
            # 协同过滤推荐
            rec_service = RecommendationService(db)
            if user_id:
                posts = rec_service.get_collaborative_recommendations(user_id, limit=limit)
            else:
                # 未登录用户返回热门文章
                posts = rec_service.get_popular_posts(limit=limit, days=30)
            ai_reason = "基于相似用户偏好推荐"
        elif algorithm == 'content':
            # 基于内容的推荐
            rec_service = RecommendationService(db)
            if user_id:
                posts = rec_service.get_content_based_recommendations(user_id, limit=limit)
            else:
                # 未登录用户返回热门文章
                posts = rec_service.get_popular_posts(limit=limit, days=30)
            ai_reason = "基于您的阅读历史推荐"
        elif algorithm == 'hybrid':
            # 混合推荐
            rec_service = RecommendationService(db)
            posts = rec_service.get_hybrid_recommendations(user_id, limit=limit)
            ai_reason = "综合多种算法推荐"
        else:
            # 默认使用AI推荐
            ai_service = AIRecommendationService(db, provider_id=model)
            posts, reason = ai_service.get_ai_recommendations(user_id, limit, context, model=model)
            ai_reason = reason

        # 转换为响应格式
        result = []
        for post in posts:
            author_nickname = None
            if post.author:
                author_nickname = post.author.nickname or post.author.username

            result.append({
                "id": post.id,
                "title": post.title,
                "excerpt": post.excerpt,
                "cover_image": post.cover_image,
                "created_at": post.created_at,
                "view_count": post.view_count,
                "author_nickname": author_nickname
            })

        logger.info(f"推荐完成: 返回{len(result)}篇文章")
        return {
            "items": result,
            "total": len(result),
            "ai_reason": ai_reason
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取推荐失败: {str(e)}"
        )


@router.post("/recommendations/feedback")
async def submit_feedback(
    request: Request,
    feedback: FeedbackRequest,
    db: Session = Depends(get_db)
):
    """
    提交推荐反馈
    
    - **post_id**: 文章ID
    - **feedback_type**: 反馈类型 (interested/not_interested/skip)
    """
    try:
        # 从 token 中获取用户信息
        user_id = None
        auth_header = request.headers.get('authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            try:
                payload = verify_token(token)
                user_id = payload.get('user_id')
            except:
                pass
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="请先登录"
            )
        
        # 提交反馈
        feedback_service = FeedbackService(db)
        feedback_service.record_feedback(
            user_id=user_id,
            post_id=feedback.post_id,
            feedback_type=feedback.feedback_type
        )
        
        return {
            "success": True,
            "message": "反馈已记录"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"提交反馈失败: {str(e)}"
        )


# ========== 反馈闭环 API ==========

@router.post("/feedback/show")
async def record_show(
    request: Request,
    post_id: int = Query(..., description="文章ID"),
    algorithm: str = Query("ai", description="推荐算法"),
    reason: Optional[str] = Query(None, description="推荐理由"),
    db: Session = Depends(get_db)
):
    """
    记录推荐结果展示（用于后续判断跳过）
    """
    try:
        # 从 token 中获取用户信息
        user_id = None
        auth_header = request.headers.get('authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            try:
                payload = verify_token(token)
                user_id = payload.get('user_id')
            except:
                pass
        
        # 可选：记录展示日志
        print(f"[反馈] 用户 {user_id} 看到推荐文章 {post_id}, 算法: {algorithm}")
        
        return {"success": True, "message": "展示已记录"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"记录展示失败: {str(e)}"
        )


@router.post("/feedback/click/{post_id}")
async def record_click(
    request: Request,
    post_id: int,
    algorithm: str = Query("ai", description="推荐算法"),
    db: Session = Depends(get_db)
):
    """
    记录用户点击推荐文章（正反馈）
    """
    try:
        # 从 token 中获取用户信息
        user_id = None
        auth_header = request.headers.get('authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            try:
                payload = verify_token(token)
                user_id = payload.get('user_id')
            except Exception as e:
                logger.warning(f"Token验证失败: {e}")
                # Token验证失败，静默处理
                return {"success": False, "message": "Token验证失败，点击未记录"}
        
        if not user_id:
            # 未登录用户，静默处理，不返回401
            logger.info(f"未登录用户点击文章{post_id}，不记录反馈")
            return {"success": False, "message": "未登录，点击未记录"}
        
        # 记录点击反馈
        feedback_service = FeedbackService(db)
        feedback_service.record_feedback(
            user_id=user_id,
            post_id=post_id,
            feedback_type='interested'
        )
        
        return {"success": True, "message": "点击已记录"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"记录点击失败: {str(e)}"
        )


@router.post("/feedback/skip/{post_id}")
async def record_skip(
    request: Request,
    post_id: int,
    algorithm: str = Query("ai", description="推荐算法"),
    db: Session = Depends(get_db)
):
    """
    记录用户跳过推荐文章（负反馈）
    """
    try:
        # 从 token 中获取用户信息
        user_id = None
        auth_header = request.headers.get('authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            try:
                payload = verify_token(token)
                user_id = payload.get('user_id')
            except Exception as e:
                logger.warning(f"Token验证失败: {e}")
                # Token验证失败，静默处理，不记录反馈
                return {"success": False, "message": "Token验证失败，跳过反馈未记录"}
        
        if not user_id:
            # 未登录用户，静默处理，不返回401
            logger.info(f"未登录用户跳过文章{post_id}，不记录反馈")
            return {"success": False, "message": "未登录，跳过反馈未记录"}
        
        # 记录跳过反馈
        feedback_service = FeedbackService(db)
        feedback_service.record_feedback(
            user_id=user_id,
            post_id=post_id,
            feedback_type='skip'
        )
        
        return {"success": True, "message": "跳过已记录"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"记录跳过失败: {str(e)}"
        )


@router.get("/feedback/negative-preferences")
async def get_negative_preferences(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    获取用户的负向偏好（用于调试）
    """
    try:
        # 从 token 中获取用户信息
        user_id = None
        auth_header = request.headers.get('authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            try:
                payload = verify_token(token)
                user_id = payload.get('user_id')
            except:
                pass
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="请先登录"
            )
        
        feedback_service = FeedbackService(db)
        negative_preferences = feedback_service.get_negative_preferences(user_id)
        
        return {
            "negative_preferences": negative_preferences,
            "statistics": {
                "total_clicks": 0,
                "total_skips": 0,
                "click_rate": 0.0
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取负向偏好失败: {str(e)}"
        )


@router.get("/reader-review/roles")
async def get_reader_review_roles(
    request: Request,
    lang: str = Query("zh", description="语言: zh 或 en")
):
    """
    获取所有可用的读者评审角色
    """
    try:
        service = ReaderReviewService()
        roles = service.get_roles_info(lang)
        return {"roles": roles}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取角色列表失败: {str(e)}"
        )


@router.post("/reader-review")
async def review_article(
    request: Request,
    title: str = Query(..., description="文章标题"),
    content: str = Query(..., description="文章内容"),
    role: str = Query(..., description="评审角色"),
    persona: Optional[str] = Query(None, description="读者画像子角色"),
    custom_persona_name: Optional[str] = Query(None, description="自定义读者名称"),
    custom_persona_desc: Optional[str] = Query(None, description="自定义读者描述"),
):
    """
    评审文章

    - **title**: 文章标题
    - **content**: 文章内容
    - **role**: 评审角色 (fact_checker/persona_reader/seo_expert/stylist/devil_advocate)
    - **persona**: 读者画像子角色 (beginner/expert/manager)，仅对 persona_reader 有效
    - **custom_persona_name**: 自定义读者名称（如：产品经理）
    - **custom_persona_desc**: 自定义读者描述（背景和需求）
    """
    try:
        service = ReaderReviewService()
        result = service.review_article(title, content, role, persona, custom_persona_name, custom_persona_desc)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"文章评审失败: {str(e)}"
        )


@router.post("/reader-review/batch")
async def batch_review_article(
    request: Request,
    title: str = Query(..., description="文章标题"),
    content: str = Query(..., description="文章内容"),
    roles: List[str] = Query(..., description="评审角色列表，逗号分隔"),
):
    """
    批量评审文章

    - **title**: 文章标题
    - **content**: 文章内容
    - **roles**: 评审角色列表，如: fact_checker,seo_expert,stylist
    """
    try:
        service = ReaderReviewService()
        results = service.batch_review(title, content, roles)
        return {"results": results}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量评审失败: {str(e)}"
        )


class RewriteRequest(BaseModel):
    title: str
    content: str
    review_results: List[dict]
    round_num: int = 1
    max_rounds: int = 3
    focus_areas: Optional[List[str]] = None

@router.post("/ai-rewrite")
async def ai_rewrite_article(
    request: RewriteRequest,
):
    """
    AI 根据评审结果修改文章

    - **title**: 文章标题
    - **content**: 文章内容
    - **review_results**: 评审结果列表
    - **round_num**: 当前修改轮次（1-5）
    - **max_rounds**: 总修改轮次（1-5）
    - **focus_areas**: 重点优化方向列表，如: ["logic", "style", "seo"]
    """
    try:
        # 调用 AI 修改服务
        service = get_rewrite_service()
        new_title, new_content, explanation = service.rewrite_article(
            title=request.title,
            content=request.content,
            review_results=request.review_results,
            round_num=request.round_num,
            max_rounds=request.max_rounds,
            focus_areas=request.focus_areas
        )
        
        return {
            "success": True,
            "original_title": request.title,
            "original_content": request.content,
            "new_title": new_title,
            "new_content": new_content,
            "explanation": explanation,
            "round_num": request.round_num,
            "max_rounds": request.max_rounds
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI 修改失败: {str(e)}"
        )


class MultiAgentReviewRequest(BaseModel):
    title: str
    content: str
    roles: Optional[List[dict]] = None  # 改为可选，后端会自动生成
    custom_audience: Optional[dict] = None
    selected_llms: Optional[List[str]] = None  # 用户选择的大模型列表




@router.get("/available-llms")
async def get_available_llms(
    db: Session = Depends(get_db),
    user_id: Optional[int] = Depends(get_current_user_optional)
):
    """
    获取所有可用的大模型列表（用于推荐系统）
    
    包含系统预设模型和用户自定义模型
    """
    try:
        from app.core.llm_config import get_llm_config
        llm_config = get_llm_config()
        llms = []

        # 1. 添加系统预设模型（从配置中加载的）
        for provider_id, config in llm_config.get_enabled_providers().items():
            # 根据provider_id确定logo文件名（使用SVG图标）
            if 'deepseek' in provider_id.lower():
                logo_url = '/deepseek-color.svg'
            elif 'qwen' in provider_id.lower():
                logo_url = '/qwen-color.svg'
            elif 'openai' in provider_id.lower():
                logo_url = '/openai.svg'
            else:
                logo_url = None

            llms.append({
                'id': provider_id,
                'name': config.name,
                'description': config.description or f'{config.name} 大模型',
                'logo_url': logo_url,  # 只返回logo_url，不返回icon emoji
                'model': config.model,
                'type': 'system',  # 系统预设模型
                'is_user_config': False
            })
        
        # 1.5 始终显示OpenAI/GPT选项（即使用户没有配置系统级的API key）
        # 因为用户可以使用自己的API key
        if not any(m['id'] == 'openai' for m in llms):
            llms.append({
                'id': 'openai',
                'name': 'OpenAI GPT',
                'description': 'OpenAI GPT 模型（需配置API密钥）',
                'logo_url': '/openai.svg',
                'model': 'gpt-3.5-turbo',
                'type': 'system',
                'is_user_config': False
            })

        # 2. 添加用户自定义模型（如果已登录）
        if user_id:
            user_configs = db.query(UserLLMConfig).filter(
                UserLLMConfig.user_id == user_id,
                UserLLMConfig.is_active == True
            ).all()
            
            for config in user_configs:
                # 根据provider_id确定对应的SVG图标
                if config.provider_id == 'gemini':
                    logo_url = '/gemini-color.svg'
                elif config.provider_id == 'gpt':
                    logo_url = '/openai.svg'
                elif config.provider_id == 'claude':
                    logo_url = '/claude-color.svg'
                else:
                    logo_url = None
                
                llms.append({
                    'id': f"user_{config.provider_id}",  # 添加前缀区分用户模型
                    'name': config.name,
                    'description': config.description or f'{config.name} (自定义)',
                    'logo_url': logo_url,  # 使用SVG图标
                    'model': config.model_name,
                    'type': 'user',  # 用户自定义模型
                    'is_user_config': True,
                    'config_id': config.id,
                    'is_verified': config.is_verified
                })

        return {'llms': llms}

    except Exception as e:
        logger.error(f"获取可用LLM列表失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取可用LLM列表失败: {str(e)}"
        )


@router.get("/multi-agent/available-llms")
async def get_multi_agent_available_llms(
    db: Session = Depends(get_db),
    user_id: Optional[int] = Depends(get_current_user_optional)
):
    """
    获取多智能体评审可用的LLM列表
    
    前两个固定：DeepSeek 和 千问（系统模型）
    其余可由用户自定义添加
    """
    try:
        # 使用多智能体评审服务获取可用模型
        service = get_multi_agent_service()
        
        # 获取可用LLM列表（包含系统模型和用户自定义模型）
        llms = service.get_available_llms(user_id=user_id, db_session=db)
        
        return {
            'llms': llms,
            'system_models': ['deepseek', 'qwen'],  # 固定的前两个系统模型
            'note': '前两个模型(DeepSeek、千问)为系统固定模型，其余为用户自定义模型'
        }

    except Exception as e:
        logger.error(f"获取多智能体可用LLM列表失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取可用LLM列表失败: {str(e)}"
        )


@router.post("/multi-agent-review")
async def multi_agent_review(
    request: MultiAgentReviewRequest,
    db: Session = Depends(get_db),
    user_id: Optional[int] = Depends(get_current_user_optional)
):
    """
    多智能体协作评审（流式输出，逐步生成）- 支持两个及以上的AI

    - **title**: 文章标题
    - **content**: 文章内容
    - **selected_llms**: 选择的大模型列表（至少2个）
    - **custom_audience**: 自定义目标读者（可选）
    
    返回：Server-Sent Events 流，每个事件包含一条消息
    """
    from fastapi.responses import StreamingResponse
    import asyncio
    
    async def generate_stream():
        """生成流式响应"""
        try:
            service = get_multi_agent_service()
            
            # 加载用户自定义模型（如果用户已登录）
            if user_id:
                service.load_user_models(user_id, db)
            
            # 获取用户选择的LLM
            selected_llms = request.selected_llms or ['deepseek', 'qwen']
            available_llms = list(service.llm_clients.keys())
            selected_llms = [llm for llm in selected_llms if llm in available_llms]
            
            if len(selected_llms) < 2:
                yield f"data: {json.dumps({'error': '请至少选择两个可用的LLM'}, ensure_ascii=False)}\n\n"
                return
            
            # 获取所有选中LLM的配置信息
            llm_configs = []
            for llm_id in selected_llms:
                # 确定logo URL
                if 'deepseek' in llm_id.lower():
                    logo_url = '/deepseek-color.svg'
                elif 'qwen' in llm_id.lower():
                    logo_url = '/qwen-color.svg'
                elif llm_id.startswith('user_'):
                    # 用户自定义模型
                    original_id = llm_id[5:]  # 去掉 'user_' 前缀
                    if original_id == 'gemini':
                        logo_url = '/gemini-color.svg'
                    elif original_id == 'gpt':
                        logo_url = '/openai.svg'
                    elif original_id == 'claude':
                        logo_url = '/claude-color.svg'
                    else:
                        logo_url = None
                else:
                    logo_url = None
                
                # 获取显示名称
                client = service.llm_clients.get(llm_id)
                if client:
                    llm_configs.append({
                        'id': llm_id,
                        'name': client.name,
                        'client': client,
                        'logo_url': logo_url
                    })
            
            # 发送开始事件
            yield f"data: {json.dumps({'type': 'start', 'message': f'开始多智能体评审，参与AI: {len(llm_configs)}个'}, ensure_ascii=False)}\n\n"
            await asyncio.sleep(0.1)
            
            # 第一阶段：所有AI给出初始评审
            yield f"data: {json.dumps({'type': 'phase', 'phase': 'initial', 'message': '初始评审阶段...'}, ensure_ascii=False)}\n\n"
            await asyncio.sleep(0.1)
            
            initial_reviews = []
            for i, llm in enumerate(llm_configs):
                llm_name = llm['name']
                yield f"data: {json.dumps({'type': 'thinking', 'message': f'{llm_name} 正在给出初始评审...'}, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.1)
                
                review = service._generate_review(
                    request.title, request.content, llm['id'],
                    llm['client'], request.custom_audience
                )
                
                msg = {
                    'agent_name': llm_name,
                    'agent_icon': '🤖',
                    'logo_url': llm['logo_url'],
                    'content': review,
                    'message_type': 'review',
                    'target_agent': None,
                    'confidence': 0.85,
                    'phase': 'initial'
                }
                yield f"data: {json.dumps({'type': 'message', 'message': msg}, ensure_ascii=False)}\n\n"
                initial_reviews.append({'llm': llm, 'review': review, 'msg': msg})
                await asyncio.sleep(0.5)
            
            # 第二阶段：多AI讨论阶段
            yield f"data: {json.dumps({'type': 'phase', 'phase': 'discussion', 'message': '开始多AI讨论阶段...'}, ensure_ascii=False)}\n\n"
            await asyncio.sleep(0.1)
            
            discussion_history = [
                f"{r['llm']['name']}: {r['review'][:500]}..." for r in initial_reviews
            ]
            
            # 多轮讨论，每轮每个AI都参与
            max_rounds = 2
            for round_num in range(max_rounds):
                round_num_display = round_num + 1
                yield f"data: {json.dumps({'type': 'phase', 'phase': 'discussion', 'message': f'第{round_num_display}轮讨论...'}, ensure_ascii=False)}\n\n"
                
                for i, llm in enumerate(llm_configs):
                    llm_name = llm['name']
                    yield f"data: {json.dumps({'type': 'thinking', 'message': f'{llm_name} 正在思考回应...'}, ensure_ascii=False)}\n\n"
                    await asyncio.sleep(0.1)
                    
                    # 获取上一个发言者的内容
                    prev_content = discussion_history[-1] if discussion_history else ""
                    
                    response = service._generate_discussion_response(
                        llm['id'], llm['client'],
                        prev_content, discussion_history, round_num, request.custom_audience
                    )
                    
                    # 确定target_agent（下一个发言者，如果是最后一个则指向第一个）
                    next_index = (i + 1) % len(llm_configs)
                    target_agent = llm_configs[next_index]['name']
                    
                    msg_response = {
                        'agent_name': llm_name,
                        'agent_icon': '🤖',
                        'logo_url': llm['logo_url'],
                        'content': response,
                        'message_type': 'response',
                        'target_agent': target_agent,
                        'confidence': 0.8,
                        'phase': 'discussion',
                        'round': round_num_display
                    }
                    yield f"data: {json.dumps({'type': 'message', 'message': msg_response}, ensure_ascii=False)}\n\n"
                    discussion_history.append(f"{llm_name}: {response}")
                    await asyncio.sleep(0.3)
            
            # 第三阶段：共识报告
            yield f"data: {json.dumps({'type': 'phase', 'phase': 'consensus', 'message': '正在生成共识报告...'}, ensure_ascii=False)}\n\n"
            await asyncio.sleep(0.1)
            
            # 使用第一个LLM生成共识报告
            all_messages = [r['msg'] for r in initial_reviews]
            
            consensus = service._generate_consensus(
                request.title, request.content, all_messages,
                llm_configs[0]['client'], request.custom_audience
            )
            
            msg_consensus = {
                'agent_name': '评审委员会',
                'agent_icon': '⚖️',
                'content': consensus,
                'message_type': 'consensus',
                'target_agent': None,
                'confidence': 0.9,
                'phase': 'consensus'
            }
            yield f"data: {json.dumps({'type': 'message', 'message': msg_consensus}, ensure_ascii=False)}\n\n"
            
            # 发送完成事件
            yield f"data: {json.dumps({'type': 'complete', 'message': '评审完成'}, ensure_ascii=False)}\n\n"
            
        except Exception as e:
            print(f"[ERROR] 流式评审失败: {e}")
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)}, ensure_ascii=False)}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
