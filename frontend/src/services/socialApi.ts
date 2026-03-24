import api from './api';

export interface UserSimple {
  id: number;
  username: string;
  nickname?: string;
  avatar?: string;
}

export interface FriendRequest {
  id: number;
  user_id: number;
  friend_id: number;
  status: string;
  created_at: string;
  requester?: UserSimple;
}

export interface Friend {
  id: number;
  friend: UserSimple;
  status: string;
  created_at: string;
}

export interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  is_read: string;
  created_at: string;
  sender?: UserSimple;
  receiver?: UserSimple;
}

export interface Conversation {
  friend_id: number;
  friend_info?: UserSimple;
  last_message?: Message;
  unread_count: number;
}

export interface ChatHistory {
  messages: Message[];
  total: number;
}

export interface FriendUser extends UserSimple {
  // 继承自 UserSimple，根据需要可以添加其他字段
}

export const friendApi = {
  getFriends: async (skip: number = 0, limit: number = 100): Promise<Friend[]> => {
    const response = await api.get('/friends/', { params: { skip, limit } });
    // 后端返回的是包含详细信息的 Friend 对象列表
    return response.data;
  },

  getFriendRequests: async (skip: number = 0, limit: number = 100): Promise<FriendRequest[]> => {
    const response = await api.get('/friends/requests', { params: { skip, limit } });
    return response.data;
  },

  getSentRequests: async (skip: number = 0, limit: number = 100): Promise<FriendRequest[]> => {
    const response = await api.get('/friends/sent', { params: { skip, limit } });
    return response.data;
  },

  sendFriendRequest: async (friendId: number): Promise<{ message: string; friend_id: number }> => {
    const response = await api.post('/friends/add', { friend_id: friendId });
    return response.data;
  },

  acceptFriendRequest: async (requestId: number): Promise<{ message: string }> => {
    const response = await api.post(`/friends/${requestId}/accept`);
    return response.data;
  },

  rejectFriendRequest: async (requestId: number): Promise<{ message: string }> => {
    const response = await api.post(`/friends/${requestId}/reject`);
    return response.data;
  },

  deleteFriend: async (friendId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/friends/${friendId}`);
    return response.data;
  },

  getFriendStatus: async (targetUserId: number): Promise<{ status: string; request_id?: number }> => {
    const response = await api.get(`/friends/status/${targetUserId}`);
    return response.data;
  },

  searchUsers: async (username: string, skip: number = 0, limit: number = 20): Promise<UserSimple[]> => {
    const response = await api.get('/friends/search', { params: { username, skip, limit } });
    return response.data;
  }
};

export const messageApi = {
  sendMessage: async (receiverId: number, content: string): Promise<Message> => {
    const response = await api.post('/messages/send', { receiver_id: receiverId, content });
    return response.data;
  },

  getConversations: async (): Promise<Conversation[]> => {
    const response = await api.get('/messages/conversations');
    return response.data;
  },

  getChatHistory: async (friendId: number, skip: number = 0, limit: number = 50): Promise<ChatHistory> => {
    const response = await api.get(`/messages/${friendId}`, { params: { skip, limit } });
    return response.data;
  },

  getUnreadCount: async (): Promise<number> => {
    const response = await api.get('/messages/unread/count');
    return response.data;
  },

  markAsRead: async (messageId: number): Promise<{ message: string }> => {
    const response = await api.put(`/messages/${messageId}/read`);
    return response.data;
  }
};
