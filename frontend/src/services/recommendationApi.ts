import api from './api';

export interface RecommendedPostsParams {
  algorithm?: 'ai' | 'popular' | 'collaborative' | 'content' | 'hybrid';
  limit?: number;
  context?: string;
  model?: string;  // AI模型选择: deepseek, qwen, openai 等
}

export interface RecommendedPostsRequest {
  algorithm: 'ai' | 'popular' | 'collaborative' | 'content' | 'hybrid';
  limit?: number;
  context?: string;
  model?: string;
}

export interface LLMModel {
  id: string;
  name: string;
  description: string;
  icon: string;
  logo_url?: string;
  model: string;
  type?: 'system' | 'user';  // 模型类型：系统预设或用户自定义
  is_user_config?: boolean;  // 是否是用户自定义模型
  config_id?: number;  // 用户配置ID
  is_verified?: boolean;  // 是否已验证
}

export interface FeedParams {
  page?: number;
  size?: number;
}

export interface RecommendedPost {
  id: number;
  title: string;
  excerpt: string;
  cover_image: string;
  status: string;
  created_at: string;
  view_count: number;
  author_id?: number;
  author_nickname?: string;
  author_username?: string;
  category_id?: number;
  category_name?: string;
}

export interface RecommendedPostsResponse {
  items: RecommendedPost[];
  total: number;
  ai_reason?: string;
}

export interface NegativePreferences {
  categories: [string, number][];
  keywords: [string, number][];
}

export interface FeedbackStatistics {
  total_clicks: number;
  total_skips: number;
  click_rate: number;
}

export const recommendationApi = {
  // 获取推荐文章
  getRecommendedPosts: async (params: RecommendedPostsParams = {}): Promise<RecommendedPostsResponse> => {
    const response = await api.get('/recommendations', { params });
    return response.data;
  },

  // 获取可用的AI模型列表
  getAvailableLLMs: async (): Promise<LLMModel[]> => {
    const response = await api.get('/available-llms');
    return response.data.llms || [];
  },

  // 获取个性化推荐流
  getPersonalizedFeed: async (params: FeedParams = {}) => {
    const response = await api.get('/posts/feed', { params });
    return response.data;
  },

  // 获取相关文章
  getRelatedPosts: async (postId: number, limit: number = 5) => {
    const response = await api.get(`/posts/${postId}/related`, { params: { limit } });
    return response.data;
  },

  // 获取热门文章
  getPopularPosts: async (limit: number = 10, days: number = 30) => {
    const response = await api.get('/recommended/popular', { params: { limit, days } });
    return response.data;
  },

  // 记录用户行为
  recordBehavior: async (postId: number, behaviorType: 'view' | 'like' | 'comment' | 'share' | 'collect') => {
    const response = await api.post(`/behavior/${postId}/${behaviorType}`);
    return response.data;
  },

  // ========== 反馈闭环 API ==========

  /**
   * 记录推荐结果展示（用于后续判断跳过）
   * @param postId 文章ID
   * @param algorithm 推荐算法类型
   * @param reason 推荐理由（AI推荐时）
   */
  recordRecommendationShow: async (postId: number, algorithm: string = 'ai', reason?: string) => {
    const response = await api.post('/feedback/show', null, {
      params: { post_id: postId, algorithm, reason }
    });
    return response.data;
  },

  /**
   * 记录用户点击推荐文章（正反馈）
   * @param postId 文章ID
   * @param algorithm 推荐算法类型
   */
  recordRecommendationClick: async (postId: number, algorithm: string = 'ai') => {
    const response = await api.post(`/feedback/click/${postId}`, null, {
      params: { algorithm }
    });
    return response.data;
  },

  /**
   * 记录用户跳过推荐文章（负反馈）
   * 会更新用户的负向偏好，用于后续推荐优化
   * @param postId 文章ID
   * @param algorithm 推荐算法类型
   */
  recordRecommendationSkip: async (postId: number, algorithm: string = 'ai') => {
    const response = await api.post(`/feedback/skip/${postId}`, null, {
      params: { algorithm }
    });
    return response.data;
  },

  /**
   * 获取用户的负向偏好（用于调试）
   * @returns 负向偏好和统计信息
   */
  getNegativePreferences: async (): Promise<{
    negative_preferences: NegativePreferences;
    statistics: FeedbackStatistics;
  }> => {
    const response = await api.get('/feedback/negative-preferences');
    return response.data;
  },
};
