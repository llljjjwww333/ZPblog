// 用户相关类型
export interface User {
  id: number;
  username: string;
  email: string;
  nickname?: string;
  role: string;
  is_active: boolean;
  created_at: string;
  avatar?: string;
  bio?: string;
  github_url?: string;
  gitee_url?: string;
}

export interface UserInfo {
  id: number;
  username: string;
  nickname?: string;
}

export interface UserCreate {
  username: string;
  email: string;
  password: string;
  nickname?: string;
}

export interface UserLogin {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// 文章相关类型
export interface Post {
  id: number;
  title: string;
  content_markdown: string;
  content_html: string;
  excerpt: string;
  slug: string;
  status: 'draft' | 'published' | 'private';
  author_id: number;
  category_id: number;
  author: User;
  category?: Category;
  created_at: string;
  updated_at?: string;
  published_at?: string;
  view_count: number;
}

export interface PostCreate {
  title: string;
  content_markdown: string;
  excerpt?: string;
  slug?: string;
  status: 'draft' | 'published' | 'private';
  category_id: number;
}

export interface PostUpdate {
  title?: string;
  content_markdown?: string;
  excerpt?: string;
  slug?: string;
  status?: 'draft' | 'published' | 'private';
  category_id?: number;
}

export interface PostListItem {
  id: number;
  title: string;
  excerpt: string;
  slug: string;
  status: string;
  created_at: string;
  view_count: number;
}

export interface PostListResponse {
  total: number;
  page: number;
  size: number;
  items: PostListItem[];
}

// 分类相关类型
export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  order: number;
  is_active: boolean;
  created_at: string;
}