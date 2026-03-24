import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { friendApi, UserSimple } from '../services/socialApi';

interface Friend {
  id: number;
  friend: UserSimple;
  status: string;
  created_at: string;
}

interface FriendRequest {
  id: number;
  user_id: number;
  friend_id: number;
  status: string;
  created_at: string;
  requester?: UserSimple;
}

const Friends: React.FC = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search'>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [searchResults, setSearchResults] = useState<UserSimple[]>([]);
  const [searchUsername, setSearchUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadFriends();
    loadRequests();
  }, []);

  // 监听WebSocket消息
  useEffect(() => {
    const handleWebSocketMessage = (event: any) => {
      const data = event.detail;
      if (data.type === 'new_friend_request') {
        // 收到新的好友请求，重新加载请求列表
        console.log('收到新的好友请求，刷新列表');
        loadRequests();
        // 显示提示消息
        setMessage('收到新的好友请求！');
        setTimeout(() => setMessage(''), 3000);
      }
    };

    window.addEventListener('websocketMessage', handleWebSocketMessage);
    return () => {
      window.removeEventListener('websocketMessage', handleWebSocketMessage);
    };
  }, []);

  const loadFriends = async () => {
    try {
      setLoading(true);
      const data = await friendApi.getFriends();
      console.log('原始好友列表:', data);
      // 过滤掉已被对方删除的好友
      const filteredFriends = [];
      for (const friend of data) {
        try {
          const status = await friendApi.getFriendStatus(friend.friend.id);
          console.log('好友状态:', friend.friend.id, status);
          if (status.status !== 'deleted_by_other') {
            filteredFriends.push(friend);
          }
        } catch (err) {
          console.error('检查好友状态失败:', err);
          filteredFriends.push(friend);
        }
      }
      console.log('过滤后的好友列表:', filteredFriends);
      setFriends(filteredFriends);
    } catch (err) {
      console.error('加载好友列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadRequests = async () => {
    try {
      const data = await friendApi.getFriendRequests();
      setRequests(data);
    } catch (err) {
      console.error('加载好友请求失败:', err);
    }
  };

  const handleSearch = async () => {
    if (!searchUsername.trim()) return;
    
    try {
      setLoading(true);
      const results = await friendApi.searchUsers(searchUsername);
      setSearchResults(results);
    } catch (err) {
      console.error('搜索用户失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const [addingFriends, setAddingFriends] = useState<Set<number>>(new Set());

  const handleAddFriend = async (userId: number) => {
    // 防止重复点击
    if (addingFriends.has(userId)) return;
    
    try {
      setAddingFriends(prev => new Set(prev).add(userId));
      await friendApi.sendFriendRequest(userId);
      setMessage('好友请求已发送！');
      setTimeout(() => setMessage(''), 3000);
      // 从搜索结果中移除已发送请求的用户
      setSearchResults(prev => prev.filter(u => u.id !== userId));
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || '发送好友请求失败';
      setMessage(errorMessage);
      setTimeout(() => setMessage(''), 3000);
      // 如果是已经存在的请求，也从搜索结果中移除
      if (errorMessage.includes('已经存在')) {
        setSearchResults(prev => prev.filter(u => u.id !== userId));
      }
    } finally {
      setAddingFriends(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const handleAcceptRequest = async (requestId: number) => {
    try {
      await friendApi.acceptFriendRequest(requestId);
      setMessage('已接受好友请求！');
      setTimeout(() => setMessage(''), 3000);
      loadFriends();
      loadRequests();
    } catch (err) {
      setMessage('接受请求失败');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleRejectRequest = async (requestId: number) => {
    try {
      await friendApi.rejectFriendRequest(requestId);
      setMessage('已拒绝好友请求');
      setTimeout(() => setMessage(''), 3000);
      loadRequests();
    } catch (err) {
      setMessage('拒绝请求失败');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleDeleteFriend = async (friendId: number) => {
    if (!window.confirm('确定要删除这个好友吗？')) return;
    
    try {
      await friendApi.deleteFriend(friendId);
      setMessage('已删除好友');
      setTimeout(() => setMessage(''), 3000);
      loadFriends();
    } catch (err) {
      setMessage('删除好友失败');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div className="friends-page">
      <h2>{t('friends.title')}</h2>
      
      {message && <div className="message">{message}</div>}
      
      <div className="tabs">
        <button 
          className={activeTab === 'friends' ? 'active' : ''} 
          onClick={() => setActiveTab('friends')}
        >
          {t('friends.my_friends')}
        </button>
        <button 
          className={activeTab === 'requests' ? 'active' : ''} 
          onClick={() => setActiveTab('requests')}
        >
          {t('friends.requests')} ({requests.length})
        </button>
        <button 
          className={activeTab === 'search' ? 'active' : ''} 
          onClick={() => setActiveTab('search')}
        >
          {t('friends.find_friends')}
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'friends' && (
          <div className="friends-list">
            {loading ? (
              <p>{t('common.loading')}</p>
            ) : friends.length === 0 ? (
              <p>{t('friends.no_friends')}</p>
            ) : (
              <ul>
                {friends.map(friend => (
                  <li key={friend.id} className="friend-item">
                    <div className="friend-avatar">
                      {friend.friend.avatar ? (
                        <img src={friend.friend.avatar} alt={friend.friend.username} />
                      ) : (
                        <span>{friend.friend.username.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="friend-info">
                      <span className="friend-name">
                        {friend.friend.nickname || friend.friend.username}
                      </span>
                      <span className="friend-username">@{friend.friend.username}</span>
                    </div>
                    <div className="friend-actions">
                      <button 
                        className="btn-chat"
                        onClick={() => {
                          // 添加点击动画效果
                          window.location.hash = `#/chat/${friend.friend.id}`;
                        }}
                      >
                        💬
                      </button>
                      <button 
                        className="btn-delete"
                        onClick={() => handleDeleteFriend(friend.friend.id)}
                      >
                        🗑️
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="requests-list">
            {loading ? (
              <p>{t('common.loading')}</p>
            ) : requests.length === 0 ? (
              <p>{t('friends.no_requests')}</p>
            ) : (
              <ul>
                {requests.map(request => (
                  <li key={request.id} className="request-item">
                    <div className="request-avatar">
                      {request.requester?.avatar ? (
                        <img src={request.requester.avatar} alt={request.requester.username} />
                      ) : (
                        <span>{request.requester?.username.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="request-info">
                      <span className="request-name">
                        {request.requester?.nickname || request.requester?.username}
                      </span>
                      <span className="request-username">@{request.requester?.username}</span>
                    </div>
                    <div className="request-actions">
                      <button 
                        className="btn-accept"
                        onClick={() => handleAcceptRequest(request.id)}
                      >
                        ✓
                      </button>
                      <button 
                        className="btn-reject"
                        onClick={() => handleRejectRequest(request.id)}
                      >
                        ✗
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'search' && (
          <div className="search-section">
            <div className="search-form">
              <input
                type="text"
                value={searchUsername}
                onChange={(e) => setSearchUsername(e.target.value)}
                placeholder={t('friends.search_placeholder')}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button onClick={handleSearch}>{t('search.button')}</button>
            </div>

            <div className="search-results">
              {loading ? (
                <p>{t('common.loading')}</p>
              ) : searchResults.length === 0 ? (
                <p>{t('friends.no_results')}</p>
              ) : (
                <ul>
                  {searchResults.map(user => (
                    <li key={user.id} className="search-result-item">
                      <div className="user-avatar">
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.username} />
                        ) : (
                          <span>{user.username.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="user-info">
                        <span className="user-name">{user.nickname || user.username}</span>
                        <span className="user-username">@{user.username}</span>
                      </div>
                      <button 
                        className="btn-add"
                        onClick={() => handleAddFriend(user.id)}
                        disabled={addingFriends.has(user.id)}
                        style={{
                          opacity: addingFriends.has(user.id) ? 0.7 : 1,
                          cursor: addingFriends.has(user.id) ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {addingFriends.has(user.id) ? '发送中...' : `+ ${t('friends.add_friend')}`}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .friends-page {
          padding: 20px;
          width: 100%;
          height: 100%;
          overflow-y: hidden;
          display: flex;
          flex-direction: column;
        }

        .friends-page h2 {
          margin-bottom: 15px;
          color: var(--text-main);
          font-size: 1.2rem;
          flex-shrink: 0;
        }

        .message {
          background-color: var(--primary-light);
          color: white;
          padding: 10px 15px;
          border-radius: 4px;
          margin-bottom: 15px;
          font-size: 0.9rem;
          flex-shrink: 0;
        }

        .tabs {
          display: flex;
          gap: 5px;
          margin-bottom: 15px;
          flex-wrap: wrap;
          flex-shrink: 0;
        }

        .tabs button {
          padding: 8px 12px;
          border: 1px solid var(--border-color);
          background: white;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s;
          font-size: 0.9rem;
          flex: 1;
          min-width: 80px;
        }

        .tabs button.active {
          background: var(--primary);
          color: white;
          border-color: var(--primary);
        }

        .tab-content {
          background: white;
          border-radius: 8px;
          padding: 15px;
          box-shadow: var(--shadow-sm);
          width: 100%;
          min-width: unset;
          flex: 1;
          overflow-y: auto;
          max-height: calc(100% - 120px);
        }

        .friend-item, .request-item, .search-result-item {
          display: flex;
          align-items: center;
          padding: 12px;
          border-bottom: 1px solid var(--border-light);
        }

        .friend-item:last-child, .request-item:last-child, .search-result-item:last-child {
          border-bottom: none;
        }

        .friend-avatar, .request-avatar, .user-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--primary);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 10px;
          overflow: hidden;
          flex-shrink: 0;
        }

        .friend-avatar img, .request-avatar img, .user-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .friend-info, .request-info, .user-info {
          flex: 1;
          min-width: 0;
        }

        .friend-name, .request-name, .user-name {
          display: block;
          font-weight: 500;
          color: var(--text-main);
          font-size: 0.95rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .friend-username, .request-username, .user-username {
          display: block;
          font-size: 0.8rem;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .friend-actions, .request-actions {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }

        .btn-chat, .btn-delete, .btn-accept, .btn-reject {
          width: 32px;
          height: 32px;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9rem;
          transition: all 0.2s;
        }

        .btn-chat {
          background: var(--primary-light);
          color: white;
        }

        .btn-delete, .btn-reject {
          background: #fee2e2;
          color: #dc2626;
        }

        .btn-accept {
          background: #dcfce7;
          color: #16a34a;
        }

        .btn-add {
          width: auto;
          padding: 6px 12px;
          border-radius: 4px;
          background: var(--primary);
          color: white;
          font-size: 0.85rem;
        }

        .search-form {
          display: flex;
          gap: 8px;
          margin-bottom: 15px;
          flex-shrink: 0;
        }

        .search-form input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          font-size: 0.9rem;
        }

        .search-form button {
          padding: 8px 12px;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
        }
      `}</style>
    </div>
  );
};

export default Friends;
