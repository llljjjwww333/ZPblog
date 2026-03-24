import api from './api';

export interface Author {
  id: number;
  username: string;
  nickname?: string;
  avatar?: string;
}

export interface Post {
  id: number;
  title: string;
  content_markdown: string;
  content_html: string;
  excerpt: string;
  cover_image: string | null;
  status: 'draft' | 'published' | 'private';
  view_count: number;
  category_id: number | null;
  created_at: string;
  updated_at: string;
  author_id: number;
  author?: Author; // 新增作者信息
}

export interface PostListItem {
  id: number;
  title: string;
  excerpt: string;
  cover_image: string | null;
  status: 'draft' | 'published' | 'private';
  view_count: number;
  category_id: number | null;
  created_at: string;
  updated_at: string;
  author_id: number;
  author?: Author; // 新增作者信息
}

export interface PostListResponse {
  total: number;
  page: number;
  size: number;
  items: PostListItem[];
}

export interface PostCreate {
  title: string;
  content_markdown: string;
  excerpt?: string;
  cover_image?: string;
  category_id?: number;
  status?: 'draft' | 'published' | 'private';
}

export interface PostUpdate {
  title?: string;
  content_markdown?: string;
  excerpt?: string;
  cover_image?: string;
  category_id?: number;
  status?: 'draft' | 'published' | 'private';
}

export const postApi = {
  async getList(params: {
    page?: number;
    size?: number;
    status?: string;
    category_id?: number;
    search?: string;
  } = {}): Promise<PostListResponse> {
    // 使用带斜杠的路径，避免307重定向
    const response = await api.get('/posts/', { params });
    return response.data;
  },

  // 获取公开文章列表（无需登录）
  async getPublicList(params: {
    page?: number;
    size?: number;
    category_id?: number;
    search?: string;
  } = {}): Promise<PostListResponse> {
    const response = await api.get('/posts/public/', { params });
    return response.data;
  },

  // 获取公开文章详情（无需登录）
  async getPublicById(id: number, incrementView?: boolean): Promise<Post> {
    const params = incrementView !== undefined ? { increment_view: incrementView } : {};
    const response = await api.get(`/posts/public/${id}/`, { params });
    return response.data;
  },

  async getById(id: number, incrementView?: boolean): Promise<Post> {
    const params = incrementView !== undefined ? { increment_view: incrementView } : {};
    const response = await api.get(`/posts/${id}/`, { params });
    return response.data;
  },

  async create(data: PostCreate): Promise<Post> {
    const response = await api.post('/posts/', data);
    return response.data;
  },

  async update(id: number, data: PostUpdate): Promise<Post> {
    const response = await api.put(`/posts/${id}/`, data);
    return response.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/posts/${id}/`);
  },
};