import axios from 'axios';
import { User } from '../types';

// 创建axios实例
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api', // 使用环境变量，默认为 /api
  timeout: 30000, // 增加超时时间到30秒
  headers: {
    'Content-Type': 'application/json',
  }
});

// 请求拦截器 - 添加JWT令牌
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('access_token');
    
    console.log('发送API请求:', {
      url: config.url,
      method: config.method,
      hasToken: !!token,
      token: token ? '存在' : '不存在'
    });
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('已添加Authorization头:', config.headers.Authorization);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理307重定向和错误
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    // 添加详细的错误日志，方便调试
    console.error('API请求错误:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      headers: error.config?.headers
    });
    
    // 处理307重定向，避免循环重定向
    if (error.response?.status === 307 && error.response.headers.location) {
      console.log('处理307重定向，从', error.config?.url, '到', error.response.headers.location);
      
      // 提取重定向URL
      let redirectUrl = error.response.headers.location;
      
      // 确保重定向URL是相对路径或完整URL
      if (redirectUrl.startsWith('/api/')) {
        // 如果重定向URL已经包含/api/，则去掉/api/部分，因为我们的baseURL已经包含/api
        redirectUrl = redirectUrl.replace(/^\/api/, '');
      } else if (!redirectUrl.startsWith('http://') && !redirectUrl.startsWith('https://')) {
        // 如果是相对路径，直接使用
        redirectUrl = redirectUrl;
      }
      
      console.log('处理后的重定向URL:', redirectUrl);
      
      // 检查是否为循环重定向，忽略尾随斜杠差异
      const normalizeUrl = (url: string) => url.replace(/\/$/, ''); // 移除尾随斜杠
      if (normalizeUrl(redirectUrl) === normalizeUrl(error.config?.url || '')) {
        console.error('循环重定向，终止请求');
        throw new Error('循环重定向');
      }
      
      // 创建新的请求配置，确保完全复制原始配置
      const newConfig = {
        ...error.config,
        url: redirectUrl,
        // 确保完整复制所有请求头，特别是Authorization头
        headers: { 
          ...error.config.headers,
          // 明确设置Authorization头，确保不丢失
          Authorization: error.config.headers.Authorization || ''
        },
        // 禁用重定向跟随，避免无限循环
        maxRedirects: 0
      };
      
      console.log('重定向请求:', newConfig.url, newConfig.method);
      console.log('重定向请求头:', newConfig.headers);
      
      try {
        // 手动重发请求，使用同一个axios实例，确保请求拦截器和baseURL被正确应用
        const redirectedResponse = await api(newConfig);
        console.log('重定向请求成功，状态:', redirectedResponse.status);
        return redirectedResponse;
      } catch (redirectError) {
        console.error('重定向请求失败:', redirectError);
        // 如果重发请求失败，抛出新的错误
        throw redirectError;
      }
    }
    
    if (error.response?.status === 404) {
      console.error('API请求404错误:', {
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        fullUrl: (error.config?.baseURL || '') + (error.config?.url || '')
      });
      // 检查是否是由于baseURL配置错误导致的
      // 很多时候404是因为请求到了 http://8.154.28.91/api/login 而不是 http://8.154.28.91:8000/api/login
      // 或者是因为反向代理配置问题
    }

    if (error.response?.status === 401) {
      // 401 Unauthorized - token过期或无效
      console.error('未授权访问: Token可能已过期');
      
      // 清除本地过期的token
      sessionStorage.removeItem('access_token');
      sessionStorage.removeItem('user');
      
      // 可以选择刷新页面或重定向到登录页，这里我们简单地清除token
      // 让组件检测到没有token时显示登录界面或提示
      
      // 如果不是登录接口本身的401，则重定向到登录页
      if (!error.config.url.includes('/login')) {
         // 可选：window.location.href = '/login'; 
         // 但根据用户之前的要求"即使未授权也不跳转到主界面"，我们可能只清除token
         // 不过为了用户体验，通常应该让用户重新登录
         // 这里我们仅清除token，让上层逻辑处理
      }
    }
    return Promise.reject(error);
  }
);

// 认证相关API
export const authApi = {
  // 登录
  login: async (username: string, password: string) => {
    const response = await api.post('/login', {
      username,
      password,
    });
    return response.data;
  },
  
  // 注册
  register: async (username: string, email: string, password: string, nickname?: string) => {
    const requestBody: any = {
      username,
      email,
      password,
    };
    
    // 只有当nickname有值时才发送该字段
    if (nickname && nickname.trim() !== '') {
      requestBody.nickname = nickname;
    }
    
    const response = await api.post('/auth/register', requestBody);
    return response.data;
  },
  
  // 获取当前用户信息
  getCurrentUser: async () => {
    const response = await api.get('/me');
    return response.data;
  },
  
  // 获取用户统计数据
  getUserStats: async () => {
    const response = await api.get('/me/stats');
    return response.data;
  },

  // 更新当前用户信息
  updateCurrentUser: async (data: { nickname?: string; password?: string; avatar?: string; bio?: string; background_image?: string }) => {
    const response = await api.put<User>('/me', data);
    return response.data;
  },
  
  // 获取指定用户信息
  getUserInfo: async (userId: number) => {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },
  
  // 上传图片
  uploadImage: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post<{ url: string; filename: string }>('/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

export default api;
