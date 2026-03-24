import { useState, useEffect, useRef } from 'react';
import { notificationApi, Notification } from '../services/notificationApi';
import { useLanguage } from '../contexts/LanguageContext';

interface NotificationCenterProps {
  onNavigateToArticle: (articleId: number) => void;
}

// 扩展Notification类型以支持聊天消息通知
interface ChatMessageNotification {
  id: string; // 临时ID
  type: 'chat_message';
  sender_id: number;
  sender_name: string;
  content: string;
  created_at: string;
}

// 扩展Notification类型以支持好友请求通知
interface FriendRequestNotification {
  id: string; // 临时ID
  type: 'friend_request';
  requester_id: number;
  requester_name: string;
  created_at: string;
}

type ExtendedNotification = Notification | ChatMessageNotification | FriendRequestNotification;

export function NotificationCenter({ onNavigateToArticle }: NotificationCenterProps) {
  const { t } = useLanguage();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPopup, setShowPopup] = useState(false);
  const [notifications, setNotifications] = useState<ExtendedNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  // 定时轮询未读消息数量
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const count = await notificationApi.getUnreadCount();
        setUnreadCount(count);
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // 每30秒轮询一次

    return () => clearInterval(interval);
  }, []);

  // 监听WebSocket消息，接收实时通知
  useEffect(() => {
    const handleWebSocketMessage = (event: CustomEvent) => {
      try {
        const data = event.detail;
        console.log('收到WebSocket消息:', data.type);
        
        if (data.type === 'new_notification') {
          console.log('收到实时通知:', data.notification);
          // 更新未读计数
          setUnreadCount(prev => prev + 1);
          // 更新通知列表，无论弹出框是否打开
          setNotifications(prev => [data.notification, ...prev]);
        } else if (data.type === 'new_message') {
          console.log('收到实时聊天消息:', data.message);
          // 创建聊天消息通知
          const chatNotification: ChatMessageNotification = {
            id: `chat_${Date.now()}_${data.message.id}`,
            type: 'chat_message',
            sender_id: data.message.sender_id,
            sender_name: data.message.sender?.nickname || data.message.sender?.username || '未知用户',
            content: data.message.content,
            created_at: data.message.created_at
          };
          // 更新未读计数
          setUnreadCount(prev => prev + 1);
          // 更新通知列表，无论弹出框是否打开
          setNotifications(prev => [chatNotification, ...prev]);
        } else if (data.type === 'new_friend_request') {
          console.log('收到好友请求通知:', data.request);
          // 创建好友请求通知
          const friendRequestNotification: FriendRequestNotification = {
            id: `friend_request_${Date.now()}_${data.request.id}`,
            type: 'friend_request',
            requester_id: data.request.user_id,
            requester_name: data.request.requester?.nickname || data.request.requester?.username || '未知用户',
            created_at: data.request.created_at
          };
          // 更新未读计数
          setUnreadCount(prev => prev + 1);
          // 更新通知列表，无论弹出框是否打开
          setNotifications(prev => [friendRequestNotification, ...prev]);
        }
      } catch (error) {
        console.error('WebSocket消息解析失败:', error);
      }
    };

    // 监听自定义事件
    window.addEventListener('websocketMessage', handleWebSocketMessage as any);

    return () => {
      window.removeEventListener('websocketMessage', handleWebSocketMessage as any);
    };
  }, []); // 移除showPopup依赖，确保始终处理WebSocket消息

  // 点击外部关闭弹窗
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setShowPopup(false);
      }
    };

    if (showPopup) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPopup]);

  const handleTogglePopup = async () => {
    if (!showPopup) {
      setLoading(true);
      try {
        const data = await notificationApi.getNotifications();
        setNotifications(data);
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      } finally {
        setLoading(false);
      }
    }
    setShowPopup(!showPopup);
  };

  const handleNotificationClick = async (notification: ExtendedNotification) => {
    // 处理聊天消息通知
    if ('type' in notification && notification.type === 'chat_message') {
      console.log('点击聊天消息通知:', notification);
      // 跳转到聊天页面
      setShowPopup(false);
      window.location.hash = `#/chat/${notification.sender_id}`;
      // 从通知列表中移除
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
      setUnreadCount(prev => Math.max(0, prev - 1));
      return;
    } else if ('type' in notification && notification.type === 'friend_request') {
      console.log('点击好友请求通知:', notification);
      // 跳转到好友页面
      setShowPopup(false);
      window.location.hash = '#/friends';
      // 从通知列表中移除
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
      setUnreadCount(prev => Math.max(0, prev - 1));
      return;
    }
    
    // 处理普通通知
    const regularNotification = notification as Notification;
    // 标记为已读
    if (!regularNotification.is_read) {
      try {
        await notificationApi.markAsRead(regularNotification.id);
        setUnreadCount(prev => Math.max(0, prev - 1));
        setNotifications(prev => prev.map(n => 
          n.id === regularNotification.id ? { ...n, is_read: true } : n
        ));
      } catch (error) {
        console.error('Failed to mark as read:', error);
      }
    }
    
    // 跳转到文章详情页
    if ('post_id' in regularNotification && regularNotification.post_id) {
      setShowPopup(false);
      onNavigateToArticle(regularNotification.post_id);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      // 处理普通通知
      setNotifications(prev => prev.map(n => 
        'is_read' in n ? { ...n, is_read: true } : n
      ));
      // 移除聊天消息通知
      setNotifications(prev => prev.filter(n => !('type' in n) || n.type !== 'chat_message'));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm(t('notification.confirm_delete_all') || '确定要删除所有通知吗？')) {
      return;
    }
    try {
      await notificationApi.deleteAll();
      setUnreadCount(0);
      setNotifications([]);
    } catch (error) {
      console.error('Failed to delete all notifications:', error);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }} ref={popupRef}>
      <button 
        onClick={handleTogglePopup}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          padding: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#333' // 改为深灰色以适应浅色背景
        }}
        title={t('notification.title') || '通知'}
      >
        {/* 简洁线条风格的铃铛 SVG 图标 */}
        <svg 
          width="24" 
          height="24" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            backgroundColor: '#ff4d4f',
            color: 'white',
            borderRadius: '50%',
            fontSize: '10px',
            minWidth: '8px',
            height: '8px',
            padding: 0,
            border: 'none'
          }}>
          </span>
        )}
      </button>

      {showPopup && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: '0',
          width: '320px',
          maxHeight: '400px',
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #f0f0f0',
          marginTop: '8px'
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px'
          }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, flex: 1 }}>{t('notification.title') || '消息通知'}</h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {unreadCount > 0 && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkAllRead();
                  }}
                  style={{
                    background: '#fff',
                    border: '1px solid #d9d9d9',
                    borderRadius: '4px',
                    color: '#666',
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: '4px 8px',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                    lineHeight: 1
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.color = 'var(--primary)';
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.background = '#fafafa';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.color = '#666';
                    e.currentTarget.style.borderColor = '#d9d9d9';
                    e.currentTarget.style.background = '#fff';
                  }}
                  title={t('notification.mark_all_read') || '一键已读'}
                >
                  {t('notification.mark_all_read') || '一键已读'}
                </button>
              )}
              {notifications.length > 0 && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteAll();
                  }}
                  style={{
                    background: '#fff',
                    border: '1px solid #d9d9d9',
                    borderRadius: '4px',
                    color: '#666',
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: '4px 8px',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                    lineHeight: 1
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.color = '#ff4d4f';
                    e.currentTarget.style.borderColor = '#ff4d4f';
                    e.currentTarget.style.background = '#fff1f0';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.color = '#666';
                    e.currentTarget.style.borderColor = '#d9d9d9';
                    e.currentTarget.style.background = '#fff';
                  }}
                  title={t('notification.delete_all') || '一键删除'}
                >
                  {t('notification.delete_all') || '一键删除'}
                </button>
              )}
            </div>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                {t('common.loading') || '加载中...'}
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '30px 20px', textAlign: 'center', color: '#999' }}>
                {t('notification.empty') || '暂无新消息'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {notifications.map(notification => (
                  <div 
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #f0f0f0',
                      cursor: 'pointer',
                      backgroundColor: 'type' in notification ? (notification.type === 'friend_request' ? '#f6ffed' : (notification.type === 'chat_message' ? '#e6f7ff' : 'white')) : ('is_read' in notification && !notification.is_read ? '#f6ffed' : 'white'),
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fafafa'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'type' in notification ? (notification.type === 'friend_request' ? '#f6ffed' : (notification.type === 'chat_message' ? '#e6f7ff' : 'white')) : ('is_read' in notification && !notification.is_read ? '#f6ffed' : 'white')}
                  >
                    {(() => {
                      if ('type' in notification && notification.type === 'friend_request') {
                        const friendReq = notification as FriendRequestNotification;
                        return (
                          <div>
                            <div style={{ fontSize: '14px', marginBottom: '4px', lineHeight: '1.4' }}>
                              <span style={{ fontWeight: 600, color: '#52c41a' }}>
                                {friendReq.requester_name}
                              </span>
                              <span style={{ color: '#666', margin: '0 4px' }}>
                                发送了好友请求
                              </span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#999' }}>
                              {new Date(friendReq.created_at).toLocaleString()}
                            </div>
                          </div>
                        );
                      } else if ('type' in notification && notification.type === 'chat_message') {
                        const chatMsg = notification as ChatMessageNotification;
                        return (
                          <div>
                            <div style={{ fontSize: '14px', marginBottom: '4px', lineHeight: '1.4' }}>
                              <span style={{ fontWeight: 600, color: '#1890ff' }}>
                                {chatMsg.sender_name}
                              </span>
                              <span style={{ color: '#666', margin: '0 4px' }}>
                                发送了一条消息
                              </span>
                            </div>
                            <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px', lineHeight: '1.3' }}>
                              <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {chatMsg.content}
                              </span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#999' }}>
                              {new Date(chatMsg.created_at).toLocaleString()}
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div>
                            <div style={{ fontSize: '14px', marginBottom: '4px', lineHeight: '1.4' }}>
                              <span style={{ fontWeight: 600 }}>
                                {'sender' in notification && (notification.sender?.nickname || notification.sender?.username) || (t('comment.anonymous_user') || '匿名用户')}
                              </span>
                              <span style={{ color: '#666', margin: '0 4px' }}>
                                {t('notification.commented') || '评论了你的文章'}
                              </span>
                              <span style={{ color: 'var(--primary)' }}>
                                {'post' in notification && notification.post?.title || t('notification.unknown_post')}
                              </span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#999' }}>
                              {new Date(notification.created_at).toLocaleString()}
                            </div>
                          </div>
                        );
                      }
                    })()}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
