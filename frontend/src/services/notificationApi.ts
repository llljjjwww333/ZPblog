import api from './api';

export interface Notification {
  id: number;
  recipient_id: number;
  sender_id: number;
  post_id?: number;
  comment_id?: number;
  friend_request_id?: number;
  content?: string; // 新增
  type?: string; // 新增
  is_read: boolean;
  created_at: string;
  sender?: {
    id: number;
    username: string;
    nickname?: string;
    avatar_url?: string;
  };
  post?: {
    id: number;
    title: string;
  };
  friend_request?: {
    id: number;
    status: string;
  };
}

export const notificationApi = {
  getNotifications: async (skip = 0, limit = 20) => {
    const response = await api.get<Notification[]>('/notifications/', {
      params: { skip, limit }
    });
    return response.data;
  },

  getUnreadCount: async () => {
    const response = await api.get<number>('/notifications/unread-count');
    return response.data;
  },

  markAsRead: async (id: number) => {
    const response = await api.put<Notification>(`/notifications/${id}/read`);
    return response.data;
  },

  markAllAsRead: async () => {
    const response = await api.put<boolean>('/notifications/read-all');
    return response.data;
  },

  deleteAll: async () => {
    const response = await api.delete<boolean>('/notifications/delete-all');
    return response.data;
  }
};
