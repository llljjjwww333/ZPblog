import api from './api';

export interface PolishRequest {
  text: string;
  style?: 'professional' | 'fluent' | 'concise' | 'creative';
}

export interface PolishResponse {
  success: boolean;
  original: string;
  polished: string;
  style: string;
  error?: string;
}

export interface ContinueRequest {
  text: string;
  context?: string;
}

export interface ContinueResponse {
  success: boolean;
  continuation: string;
  context: string;
  error?: string;
}

export interface TitleRequest {
  content: string;
  count?: number;
}

export interface TitleResponse {
  success: boolean;
  titles: string[];
  count: number;
  error?: string;
}

export interface SummaryRequest {
  content: string;
  max_length?: number;
}

export interface SummaryResponse {
  success: boolean;
  summary: string;
  max_length: number;
  error?: string;
}

export interface ImproveRequest {
  text: string;
  improvement_type?: 'grammar' | 'structure' | 'vocabulary' | 'readability';
}

export interface ImproveResponse {
  success: boolean;
  original: string;
  improved: string;
  improvement_type: string;
  error?: string;
}

export const aiWritingApi = {
  // AI 润色文本
  polishText: (data: PolishRequest) => {
    return api.post<PolishResponse>('/polish', data);
  },

  // AI 续写文章
  continueWriting: (data: ContinueRequest) => {
    return api.post<ContinueResponse>('/continue', data);
  },

  // AI 生成标题建议
  generateTitles: (data: TitleRequest) => {
    return api.post<TitleResponse>('/generate-titles', data);
  },

  // AI 生成摘要
  generateSummary: (data: SummaryRequest) => {
    return api.post<SummaryResponse>('/generate-summary', data);
  },

  // AI 针对性改进
  improveWriting: (data: ImproveRequest) => {
    return api.post<ImproveResponse>('/improve', data);
  },
};
