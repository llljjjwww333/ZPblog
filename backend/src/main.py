from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.staticfiles import StaticFiles

# 导入数据库配置
from app.database import engine, Base

# 导入所有模型，确保它们被注册到 Base.metadata
from app.model.user import User
from app.model.post import Post
from app.model.category import Category
from app.model.comment import Comment
from app.model.notification import Notification
from app.model.friend import Friend
from app.model.message import Message

# 导入路由（使用相对导入）
from app.api.post.endpoint import router as post_router
from app.api.category.endpoint import router as category_router
from app.api.auth.endpoint import router as auth_router
from app.api.comment.endpoint import router as comment_router
from app.api.endpoints.notifications import router as notification_router
from app.api.endpoints.friends import router as friend_router
from app.api.endpoints.messages import router as message_router
from app.api.upload.endpoint import router as upload_router
from app.api.misc.sitemap import router as sitemap_router # 导入sitemap路由
from app.api.misc.pdf_parser import router as pdf_router # 导入PDF解析路由
from app.api.recommendation.simple_endpoint import router as recommendation_router # 导入推荐路由
from app.api.ai_writing.endpoint import router as ai_writing_router # 导入AI写作路由
from app.api.user_llm import router as user_llm_router # 导入用户LLM配置路由
from app.api.admin import router as admin_router # 导入admin路由

from app.config import settings

# 创建实例
app = FastAPI(
    title="我的个人博客平台",
    description="简单版本",
    debug=settings.DEBUG,
    redirect_slashes=False  # 禁用自动重定向，避免 307 导致认证信息丢失
)


# 配置静态文件目录
import os
app.mount("/static", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static")), name="static")

# WebSocket连接管理
from app.core.socket import manager

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 配置OAuth2认证
@app.get("/openapi.json", include_in_schema=False)
async def get_openapi_json():
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    
    # 添加securitySchemes配置
    openapi_schema["components"]["securitySchemes"] = {
        "OAuth2PasswordBearer": {
            "type": "oauth2",
            "flows": {
                "password": {
                    "tokenUrl": "/api/auth/login/form",
                    "scopes": {}
                }
            }
        }
    }
    
    # 为需要认证的端点添加security要求
    for path_name, path in openapi_schema["paths"].items():
        for method in path.values():
            if "tags" in method and ("posts" in method["tags"] or "auth" in method["tags"]):
                # 排除推荐端点（不需要强制认证）
                if "/recommended" not in path_name:
                    method.setdefault("security", []).append({"OAuth2PasswordBearer": []})
    
    return openapi_schema

# 注册路由
app.include_router(post_router, prefix="/api", tags=["posts"])
app.include_router(category_router, prefix="/api", tags=["categories"])
app.include_router(auth_router, prefix="/api", tags=["auth"])
app.include_router(comment_router, prefix="/api")
app.include_router(notification_router, prefix="/api/notifications", tags=["notifications"])
app.include_router(friend_router, prefix="/api", tags=["friends"])
app.include_router(message_router, prefix="/api", tags=["messages"])
app.include_router(upload_router, prefix="/api")
app.include_router(sitemap_router)
app.include_router(pdf_router, prefix="/api")
app.include_router(recommendation_router, prefix="/api")
app.include_router(ai_writing_router, prefix="/api")
app.include_router(user_llm_router, prefix="/api")
app.include_router(admin_router, prefix="/api")

# 路由测试
@app.get("/")
async def root_check():
    return {"message": "欢迎来到个人博客平台"}

@app.get("/health/")
async def health_check():
    return {"status": "正常运行中"}

# 创建数据库表
print("创建数据库表...")
Base.metadata.create_all(bind=engine)
print("数据库表创建完成！")

# WebSocket端点
from fastapi import WebSocket, WebSocketDisconnect, Depends
from app.api.auth.dependencies import get_current_active_user_ws
from app.model.user import User

@app.websocket("/ws/chat/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: int,
    current_user: User = Depends(get_current_active_user_ws)
):
    # 验证用户身份
    if current_user.id != user_id:
        await websocket.close(code=1008, reason="身份验证失败")
        return
    
    # 接受连接
    await manager.connect(websocket, user_id)
    
    try:
        while True:
            # 接收消息（可选，用于心跳检测）
            try:
                data = await websocket.receive_text()
                if data == "ping":
                    await websocket.send_json({"type": "pong"})
            except WebSocketDisconnect:
                # 断开连接
                manager.disconnect(user_id)
                break
            except Exception as e:
                # 忽略接收消息时的异常
                print(f"WebSocket接收消息失败: {e}")
                # 继续循环，保持连接
                continue
    except Exception as e:
        # 忽略其他异常，确保连接不会意外关闭
        print(f"WebSocket错误: {e}")
        manager.disconnect(user_id)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )




