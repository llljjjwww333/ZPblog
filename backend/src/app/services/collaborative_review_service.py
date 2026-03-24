"""
多智能体协作评审系统
核心创新：模拟人类专家委员会的讨论和共识达成机制
"""
import json
import re
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass, field
from enum import Enum
import random


class DiscussionStatus(Enum):
    """讨论状态"""
    INDEPENDENT = "independent"  # 独立评审阶段
    DISCUSSING = "discussing"    # 讨论阶段
    CONSENSUS = "consensus"      # 达成共识
    DISSENT = "dissent"          # 存在分歧


@dataclass
class ReviewerOpinion:
    """评审者意见"""
    reviewer_name: str
    reviewer_role: str
    content: str
    confidence: float  # 置信度 0-100
    key_points: List[str] = field(default_factory=list)  # 关键观点
    concerns: List[str] = field(default_factory=list)    # 担忧/问题
    suggestions: List[str] = field(default_factory=list) # 建议


@dataclass
class DiscussionRound:
    """讨论轮次"""
    round_num: int
    opinions: List[ReviewerOpinion]
    disagreements: List[Dict] = field(default_factory=list)  # 分歧点
    consensus_items: List[str] = field(default_factory=list) # 共识项


@dataclass
class CollaborativeReviewResult:
    """协作评审结果"""
    final_report: str
    discussion_rounds: List[DiscussionRound]
    consensus_score: float  # 最终共识度
    dissenting_opinions: List[str]  # 保留的不同意见
    reviewer_weights: Dict[str, float]  # 各角色最终权重


class CollaborativeReviewService:
    """
    多智能体协作评审服务
    
    核心创新：
    1. 角色间讨论机制 - 不是简单汇总，而是相互质疑和回应
    2. 动态权重调整 - 根据历史表现和一致性调整角色权重
    3. 共识达成算法 - 自动判断何时达成共识，何时保留分歧
    """
    
    def __init__(self):
        # 角色历史准确率（用于动态调整权重）
        self.reviewer_history = {
            "fact_checker": {"accuracy": 0.85, "reviews_count": 0},
            "seo_expert": {"accuracy": 0.80, "reviews_count": 0},
            "stylist": {"accuracy": 0.75, "reviews_count": 0},
            "devil_advocate": {"accuracy": 0.70, "reviews_count": 0},
            "persona_reader": {"accuracy": 0.78, "reviews_count": 0},
        }
        
    def collaborative_review(
        self,
        title: str,
        content: str,
        selected