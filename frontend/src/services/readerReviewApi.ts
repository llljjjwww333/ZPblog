import axios from 'axios';
import api from './api';

// 创建专门的 API 实例，用于长时间运行的 AI 请求
const aiApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 300000, // AI 请求需要更长的超时时间：300秒（5分钟）
  headers: {
    'Content-Type': 'application/json',
  }
});

// 复制主 API 的拦截器配置
aiApi.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('access_token');
    console.log('[aiApi] 发送请求:', config.url, '有token:', !!token);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

aiApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    console.error('[aiApi] 响应错误:', {
      url: error.config?.url,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    
    // 处理307重定向
    if (error.response?.status === 307 && error.response.headers.location) {
      console.log('[aiApi] 处理307重定向到:', error.response.headers.location);
      
      let redirectUrl = error.response.headers.location;
      if (redirectUrl.startsWith('/api/')) {
        redirectUrl = redirectUrl.replace(/^\/api/, '');
      }
      
      const newConfig = {
        ...error.config,
        url: redirectUrl,
        headers: { 
          ...error.config.headers,
          Authorization: error.config.headers.Authorization || ''
        },
        maxRedirects: 0
      };
      
      try {
        const redirectedResponse = await aiApi(newConfig);
        return redirectedResponse;
      } catch (redirectError) {
        throw redirectError;
      }
    }
    
    return Promise.reject(error);
  }
);

export interface ReaderRole {
  id: string;
  name: string;
  icon: string;
  description: string;
  has_personas: boolean;
  personas?: {
    id: string;
    name: string;
    description: string;
  }[];
}

export interface ReviewResult {
  success: boolean;
  role: string;
  persona?: string;
  role_name: string;
  icon: string;
  raw_review: string;
  parsed_review: {
    summary: string;
    issues: string[];
    suggestions: string[];
  };
  error?: string;
}

export const readerReviewApi = {
  // 获取所有读者角色（使用普通 API）
  getRoles: async (lang: string = 'zh'): Promise<{ roles: ReaderRole[] }> => {
    const response = await api.get('/reader-review/roles', { params: { lang } });
    return response.data;
  },

  // 单角色评审（使用 AI API，超时更长）
  reviewArticle: async (
    title: string,
    content: string,
    role: string,
    persona?: string,
    customPersonaName?: string,
    customPersonaDesc?: string
  ): Promise<ReviewResult> => {
    console.log('[readerReviewApi] 开始评审请求:', { title, role, persona });
    try {
      const response = await aiApi.post('/reader-review', null, {
        params: { 
          title, 
          content, 
          role, 
          persona,
          custom_persona_name: customPersonaName,
          custom_persona_desc: customPersonaDesc
        }
      });
      console.log('[readerReviewApi] 评审请求成功:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[readerReviewApi] 评审请求失败:', error);
      console.error('[readerReviewApi] 错误详情:', error.response?.data || error.message);
      throw error;
    }
  },

  // 批量评审（使用 AI API，超时更长）
  batchReview: async (
    title: string,
    content: string,
    roles: string[]
  ): Promise<{ results: ReviewResult[] }> => {
    const response = await aiApi.post('/reader-review/batch', null, {
      params: { title, content, roles: roles.join(',') }
    });
    return response.data;
  }
};
