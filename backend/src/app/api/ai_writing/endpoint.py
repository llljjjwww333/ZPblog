"""
AI 写作辅助 API 端点
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, List
from app.api.auth.dependencies import get_current_user
from app.model.user import User
from app.services.ai_writing_service import AIWritingService

router = APIRouter(tags=["ai-writing"])


class PolishRequest(BaseModel):
    """润色请求"""
    text: str = Field(..., min_length=1, max_length=10000, description="需要润色的文本")
    style: str = Field("professional", description="润色风格: professional/fluent/concise/creative")


class PolishResponse(BaseModel):
    """润色响应"""
    success: bool
    original: str
    polished: Optional[str] = None
    style: str
    error: Optional[str] = None


class ContinueRequest(BaseModel):
    """续写请求"""
    text: str = Field(..., min_length=1, max_length=5000, description="已有文本")
    context: str = Field("", max_length=500, description="续写要求或提示")


class ContinueResponse(BaseModel):
    """续写响应"""
    success: bool
    continuation: Optional[str] = None
    context: str
    error: Optional[str] = None


class TitleRequest(BaseModel):
    """生成标题请求"""
    content: str = Field(..., min_length=1, max_length=5000, description="文章内容")
    count: int = Field(5, ge=1, le=10, description="生成标题数量")


class TitleResponse(BaseModel):
    """生成标题响应"""
    success: bool
    titles: List[str] = []
    count: int
    error: Optional[str] = None


class SummaryRequest(BaseModel):
    """生成摘要请求"""
    content: str = Field(..., min_length=1, max_length=10000, description="文章内容")
    max_length: int = Field(200, ge=50, le=500, description="摘要最大长度")


class SummaryResponse(BaseModel):
    """生成摘要响应"""
    success: bool
    summary: Optional[str] = None
    max_length: int
    error: Optional[str] = None


class ImproveRequest(BaseModel):
    """改进文章请求"""
    text: str = Field(..., min_length=1, max_length=10000, description="需要改进的文本")
    improvement_type: str = Field("grammar", description="改进类型: grammar/structure/vocabulary/readability")


class ImproveResponse(BaseModel):
    """改进文章响应"""
    success: bool
    original: str
    improved: Optional[str] = None
    improvement_type: str
    error: Optional[str] = None


@router.post("/polish", response_model=PolishResponse)
async def polish_text(
    request: PolishRequest,
    current_user: User = Depends(get_current_user)
):
    """
    AI 润色文章文本
    
    - **text**: 需要润色的文本内容
    - **style**: 润色风格
        - professional: 专业正式
        - fluent: 流畅易读
        - concise: 精简凝练
        - creative: 创意文学
    """
    try:
        service = AIWritingService()
        result = service.polish_text(request.text, request.style)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI 润色失败: {str(e)}"
        )


@router.post("/continue", response_model=ContinueResponse)
async def continue_writing(
    request: ContinueRequest,
    current_user: User = Depends(get_current_user)
):
    """
    AI 续写文章
    
    - **text**: 已有文本内容
    - **context**: 续写要求或提示（可选）
    """
    try:
        service = AIWritingService()
        result = service.continue_writing(request.text, request.context)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI 续写失败: {str(e)}"
        )


@router.post("/generate-titles", response_model=TitleResponse)
async def generate_titles(
    request: TitleRequest,
    current_user: User = Depends(get_current_user)
):
    """
    AI 生成文章标题建议
    
    - **content**: 文章内容
    - **count**: 生成标题数量（1-10）
    """
    try:
        service = AIWritingService()
        result = service.generate_title(request.content, request.count)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成标题失败: {str(e)}"
        )


@router.post("/generate-summary", response_model=SummaryResponse)
async def generate_summary(
    request: SummaryRequest,
    current_user: User = Depends(get_current_user)
):
    """
    AI 生成文章摘要
    
    - **content**: 文章内容
    - **max_length**: 摘要最大长度（50-500字）
    """
    try:
        service = AIWritingService()
        result = service.generate_summary(request.content, request.max_length)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成摘要失败: {str(e)}"
        )


@router.post("/improve", response_model=ImproveResponse)
async def improve_writing(
    request: ImproveRequest,
    current_user: User = Depends(get_current_user)
):
    """
    AI 针对性改进文章
    
    - **text**: 需要改进的文本
    - **improvement_type**: 改进类型
        - grammar: 修正语法错误
        - structure: 优化段落结构
        - vocabulary: 提升词汇质量
        - readability: 提高可读性
    """
    try:
        service = AIWritingService()
        result = service.improve_writing(request.text, request.improvement_type)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"改进文章失败: {str(e)}"
        )
