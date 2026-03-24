"""
用户自定义LLM配置API
"""
from fastapi import APIRouter

router = APIRouter(tags=["user-llm"])

from .endpoints import *
