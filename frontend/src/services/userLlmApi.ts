/**
 * 用户自定义LLM配置API
 */
import api from './api';

export interface UserLLMConfig {
  id: number;
  provider_id: string;
  name: string;
  description?: string;
  icon: string;
  base_url?: string;
  model_name: string;
  is_active: boolean;
  is_verified: boolean;
  usage_count: number;
  last_used_at?: string;
  created_at?: string;
}

export interface CreateLLMConfigRequest {
  provider_id: string;
  name: string;
  description?: string;
  icon?: string;
  api_key: string;
  base_url?: string;
  model_name: string;
}

export interface UpdateLLMConfigRequest {
  name?: string;
  description?: string;
  icon?: string;
  api_key?: string;
  base_url?: string;
  model_name?: string;
  is_active?: boolean;
}

export interface VerifyLLMRequest {
  api_key: string;
  base_url?: string;
  model_name: string;
}

export interface VerifyLLMResponse {
  success: boolean;
  message: string;
}

export const userLlmApi = {
  /**
   * 获取用户的所有LLM配置
   */
  getUserLLMConfigs: async (): Promise<UserLLMConfig[]> => {
    const response = await api.get('/user/llm-configs');
    return response.data;
  },

  /**
   * 创建新的LLM配置
   */
  createLLMConfig: async (config: CreateLLMConfigRequest): Promise<UserLLMConfig> => {
    const response = await api.post('/user/llm-configs', config);
    return response.data;
  },

  /**
   * 更新LLM配置
   */
  updateLLMConfig: async (configId: number, config: UpdateLLMConfigRequest): Promise<UserLLMConfig> => {
    const response = await api.put(`/user/llm-configs/${configId}`, config);
    return response.data;
  },

  /**
   * 删除LLM配置
   */
  deleteLLMConfig: async (configId: number): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete(`/user/llm-configs/${configId}`);
    return response.data;
  },

  /**
   * 验证LLM配置是否可用
   */
  verifyLLMConfig: async (data: VerifyLLMRequest): Promise<VerifyLLMResponse> => {
    const response = await api.post('/user/llm-configs/verify', data);
    return response.data;
  },

  /**
   * 获取API密钥（用于编辑）
   */
  getApiKey: async (configId: number): Promise<{ api_key: string; masked_key: string; provider_id: string }> => {
    const response = await api.get(`/user/llm-configs/${configId}/api-key`);
    return response.data;
  }
};

export default userLlmApi;
