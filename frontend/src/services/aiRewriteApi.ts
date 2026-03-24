/**
 * AI 文章修改 API 服务
 */
import axios from 'axios';

// 创建专门的 API 实例用于 AI 修改（需要更长的超时时间）
const aiApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 300000, // AI 修改需要更长时间：300秒（5分钟）
  headers: {
    'Content-Type': 'application/json',
  }
});

// 复制主 API 的拦截器配置
aiApi.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

aiApi.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

export interface ReviewResult {
  reviewer_name: string;
  content: string;
  icon?: string;
}

export interface RewriteRequest {
  title: string;
  content: string;
  review_results: ReviewResult[];
  round_num: number;
  max_rounds: number;
  focus_areas?: string[];
}

export interface RewriteResponse {
  success: boolean;
  original_title: string;
  original_content: string;
  new_title: string;
  new_content: string;
  explanation: string;
  round_num: number;
  max_rounds: number;
}

/**
 * AI 修改文章
 */
export const aiRewriteArticle = async (params: RewriteRequest): Promise<RewriteResponse> => {
  const response = await aiApi.post('/ai-rewrite', {
    title: params.title,
    content: params.content,
    review_results: params.review_results,
    round_num: params.round_num,
    max_rounds: params.max_rounds,
    focus_areas: params.focus_areas,
  });
  return response.data;
};

/**
 * 重点优化方向选项
 */
export const FOCUS_AREA_OPTIONS = [
  { value: 'logic', label: '逻辑结构', description: '优化文章逻辑和结构' },
  { value: 'style', label: '写作风格', description: '改进语言表达和文风' },
  { value: 'seo', label: 'SEO优化', description: '提升搜索引擎友好度' },
  { value: 'readability', label: '可读性', description: '让读者更容易理解' },
  { value: 'facts', label: '事实准确性', description: '核实和修正事实错误' },
];

/**
 * 默认修改轮次配置
 */
export const DEFAULT_REWRITE_CONFIG = {
  max_rounds: 3,
  focus_areas: ['logic', 'style', 'readability'],
};
