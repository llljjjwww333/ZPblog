import api from './api';

export interface Category {
  id: number;
  name: string;
  description: string | null;
  image?: string | null;
  parent_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryCreate {
  name: string;
  description?: string;
  image?: string;
  parent_id?: number;
}

export interface CategoryUpdate {
  name?: string;
  description?: string;
  image?: string;
  parent_id?: number;
}

export interface CategoryTree extends Category {
  children: CategoryTree[];
}

export const categoryApi = {
  async getList(params: {
    include_posts?: boolean;
  } = {}): Promise<Category[]> {
    const response = await api.get('/categories/', { params });
    return response.data;
  },

  async getTree(): Promise<CategoryTree[]> {
    const response = await api.get('/categories/tree');
    return response.data;
  },

  async getById(id: number): Promise<Category> {
    const response = await api.get(`/categories/${id}/`);
    return response.data;
  },

  async create(data: CategoryCreate): Promise<Category> {
    const response = await api.post('/categories/', data);
    return response.data;
  },

  async update(id: number, data: CategoryUpdate): Promise<Category> {
    const response = await api.put(`/categories/${id}/`, data);
    return response.data;
  },

  async delete(id: number, move_posts_to?: number): Promise<void> {
    await api.delete(`/categories/${id}/`, { params: { move_posts_to } });
  },
};