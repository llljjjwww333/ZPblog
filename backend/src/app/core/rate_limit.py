"""
API限流配置
简单的内存限流实现
"""
import time
from typing import Dict, Tuple, Optional
from fastapi import HTTPException, status, Request
from functools import wraps
import logging

logger = logging.getLogger(__name__)

# 内存存储: {key: (count, reset_time)}
_rate_limit_storage: Dict[str, Tuple[int, float]] = {}


class RateLimiter:
    """简单的内存限流器"""
    
    def __init__(self, times: int = 10, seconds: int = 60):
        """
        初始化限流器
        
        Args:
            times: 允许的最大请求次数
            seconds: 时间窗口（秒）
        """
        self.times = times
        self.seconds = seconds
    
    def _get_key(self, request: Request, identifier: str = None) -> str:
        """生成限流key"""
        # 优先使用用户ID，否则使用IP地址
        client_id = identifier or request.client.host
        return f"{client_id}:{request.url.path}"
    
    def is_allowed(self, request: Request, identifier: str = None) -> Tuple[bool, int, int]:
        """
        检查是否允许请求
        
        Returns:
            (是否允许, 剩余次数, 重置时间)
        """
        key = self._get_key(request, identifier)
        now = time.time()
        
        # 清理过期的记录
        if key in _rate_limit_storage:
            count, reset_time = _rate_limit_storage[key]
            if now > reset_time:
                # 重置计数器
                _rate_limit_storage[key] = (1, now + self.seconds)
                return True, self.times - 1, int(self.seconds)
            else:
                # 检查是否超过限制
                if count >= self.times:
                    remaining = int(reset_time - now)
                    return False, 0, remaining
                else:
                    _rate_limit_storage[key] = (count + 1, reset_time)
                    return True, self.times - count - 1, int(reset_time - now)
        else:
            # 首次请求
            _rate_limit_storage[key] = (1, now + self.seconds)
            return True, self.times - 1, int(self.seconds)
    
    async def __call__(self, request: Request):
        """FastAPI依赖调用"""
        allowed, remaining, reset_time = self.is_allowed(request)
        
        if not allowed:
            logger.warning(f"限流触发: {request.client.host} 访问 {request.url.path}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"请求过于频繁，请在 {reset_time} 秒后重试",
                headers={"Retry-After": str(reset_time)}
            )
        
        # 设置响应头
        request.state.rate_limit_remaining = remaining
        request.state.rate_limit_reset = reset_time


# 预定义的限流配置
class RateLimitConfig:
    """限流配置"""
    
    # AI推荐接口：每小时30次（成本较高）
    AI_RECOMMENDATION = RateLimiter(times=30, seconds=3600)
    
    # 普通推荐接口：每分钟10次
    RECOMMENDATION = RateLimiter(times=10, seconds=60)
    
    # 反馈接口：每分钟20次
    FEEDBACK = RateLimiter(times=20, seconds=60)
    
    # 模型列表接口：每分钟60次
    AVAILABLE_LLMS = RateLimiter(times=60, seconds=60)
    
    # AI改写接口：每小时10次（成本很高）
    AI_REWRITE = RateLimiter(times=10, seconds=3600)
    
    # 多智能体评审：每小时5次（成本最高）
    MULTI_AGENT_REVIEW = RateLimiter(times=5, seconds=3600)


def rate_limit(times: int = 10, seconds: int = 60):
    """
    限流装饰器工厂
    
    用法:
        @router.get("/endpoint", dependencies=[Depends(rate_limit(5, 60))])
        async def endpoint():
            pass
    """
    return RateLimiter(times=times, seconds=seconds)
