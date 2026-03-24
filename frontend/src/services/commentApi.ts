import api from './api';

export interface UserSimple {
  id: number;
  username: string;
  email?: string;
  nickname?: string;
  avatar?: string;
}

export interface Comment {
  id: number;
  content: string;
  is_anonymous: boolean;
  post_id: number;
  author_id: number;
  created_at: string;
  likes: number;
  author?: UserSimple;
}

export interface CommentCreate {
  content: string;
  is_anonymous: boolean;
}

export const commentApi = {
  getPostComments: async (postId: number) => {
    const response = await api.get<Comment[]>(`/comments/post/${postId}`);
    return response.data;
  },
  
  createComment: async (postId: number, data: CommentCreate) => {
    const response = await api.post<Comment>(`/comments/post/${postId}`, data);
    return response.data;
  },
  
  likeComment: async (commentId: number) => {
    const response = await api.post<Comment>(`/comments/${commentId}/like`);
    return response.data;
  }
};
