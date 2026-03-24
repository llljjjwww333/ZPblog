import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { messageApi, friendApi, Message } from '../services/socialApi';

interface ChatPartner {
  id: number;
  username: string;
  nickname?: string;
  avatar?: string;
}

const Chat: React.FC = () => {
  const { t, language } = useLanguage();
  // 从URL hash中获取friendId
  const getFriendIdFromUrl = () => {
    const hash = window.location.hash;
    if (hash.startsWith('#/chat/')) {
      return hash.split('/')[2];
    }
    return '';
  };
  const [friendId, setFriendId] = useState(getFriendIdFromUrl());
  const [partner, setPartner] = useState<ChatPartner | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  };

  // 监听URL变化
  useEffect(() => {
    const handleUrlChange = () => {
      const newFriendId = getFriendIdFromUrl();
      if (newFriendId !== friendId) {
        setFriendId(newFriendId);
      }
    };

    // 监听popstate事件（浏览器前进/后退）和hashchange事件
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, [friendId]);

  // 加载聊天历史
  useEffect(() => {
    if (friendId) {
      const friendIdNum = parseInt(friendId);
      // 先检查好友关系状态
      checkFriendStatus(friendIdNum).then((canLoad) => {
        // 只有当好友关系正常时才加载聊天历史
        if (canLoad) {
          loadChatHistory(friendIdNum);
        } else {
          setLoading(false);
        }
      });
    } else {
      setLoading(false);
    }
  }, [friendId]);

  // 检查好友关系状态
  const checkFriendStatus = async (id: number) => {
    try {
      const status = await friendApi.getFriendStatus(id);
      console.log('好友关系状态:', status);
      // 检查是否被对方删除
      if (status.status === 'deleted_by_other') {
        alert('对方已删除好友关系，无法发送消息');
        // 跳转到好友列表页面
        window.location.hash = '#/friends';
        return false;
      }
      // 检查是否是非好友关系
      if (status.status === 'none') {
        alert('需要先添加对方为好友才能发送消息');
        // 跳转到好友列表页面
        window.location.hash = '#/friends';
        return false;
      }
      return true;
    } catch (err) {
      console.error('检查好友关系状态失败:', err);
      return true;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // WebSocket消息监听（使用全局WebSocket连接）
  useEffect(() => {
    const handleWebSocketMessage = (event: CustomEvent) => {
      try {
        const data = event.detail;
        if (data.type === 'new_message') {
          const newMessage = data.message;
          // 检查消息是否与当前聊天相关
          if (newMessage.sender_id === parseInt(friendId) || newMessage.receiver_id === parseInt(friendId)) {
            setMessages(prev => [...prev, newMessage]);
          }
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
  }, [friendId]);

  const loadChatHistory = async (id: number) => {
    try {
      setLoading(true);
      const data = await messageApi.getChatHistory(id);
      setMessages(data.messages.reverse());
      // 获取好友信息
      if (data.messages.length > 0) {
        const lastMessage = data.messages[data.messages.length - 1];
        const partnerInfo = lastMessage.sender_id === id ? lastMessage.sender : lastMessage.receiver;
        if (partnerInfo) {
          setPartner({
            id: partnerInfo.id,
            username: partnerInfo.username,
            nickname: partnerInfo.nickname,
            avatar: partnerInfo.avatar
          });
        }
      }
    } catch (err: any) {
      console.error('加载聊天记录失败:', err);
      // 检查是否是403错误
      if (err.response?.status === 403) {
        // 检查错误详情
        if (err.response?.data?.detail === '对方已删除好友关系，无法查看聊天记录') {
          alert('对方已删除好友关系，无法查看聊天记录');
          // 跳转到好友列表页面
          window.location.hash = '#/friends';
        } else {
          alert('需要先添加对方为好友才能查看聊天记录');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !friendId || sending) return;
    
    try {
      setSending(true);
      const sentMessage = await messageApi.sendMessage(parseInt(friendId), newMessage);
      setMessages(prev => [...prev, sentMessage]);
      setNewMessage('');
      
      // 保持输入框焦点，不需要手动focus，因为我们不再禁用input
    } catch (err: any) {
      console.error('发送消息失败:', err);
      // 检查是否是403错误
      if (err.response?.status === 403) {
        // 检查错误详情
        if (err.response?.data?.detail === '对方已删除好友关系，无法发送消息') {
          alert('对方已删除好友关系，无法发送消息');
        } else {
          alert('需要先添加对方为好友才能发送消息');
        }
      } else {
        alert(t('chat.send_failed'));
      }
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      };
      return date.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', options);
    } catch {
      return dateStr;
    }
  };

  const isOwnMessage = (msg: Message) => {
    const userStr = sessionStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      return msg.sender_id === user.id;
    }
    return false;
  };

  if (loading) {
    return (
      <div className="chat-page loading">
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  // 检查是否需要显示时间（间隔超过5分钟）
  const shouldShowTime = (currentMsg: Message, prevMsg: Message | null) => {
    if (!prevMsg) return true;
    const currentTime = new Date(currentMsg.created_at).getTime();
    const prevTime = new Date(prevMsg.created_at).getTime();
    return (currentTime - prevTime) > 5 * 60 * 1000; // 5分钟
  };

  return (
    <div className="chat-page">
      <div className="chat-header">
        <button className="back-btn" onClick={() => {
          window.location.hash = '#/friends';
        }}>
          ←
        </button>
        <div className="chat-partner">
          <div className="partner-avatar">
            {partner?.avatar ? (
              <img src={partner.avatar} alt={partner.username} />
            ) : (
              <span>{partner?.username.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="partner-info">
            <span className="partner-name">{partner?.nickname || partner?.username}</span>
            <span className="partner-username">@{partner?.username}</span>
          </div>
        </div>
      </div>

      <div className="chat-messages" ref={chatMessagesRef}>
        {messages.length === 0 ? (
          <div className="no-messages">
            <p>{t('chat.no_messages')}</p>
            <p>{t('chat.start_conversation')}</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const showTime = shouldShowTime(msg, index > 0 ? messages[index - 1] : null);
            return (
              <React.Fragment key={msg.id}>
                {showTime && (
                  <div className="time-separator">
                    <span>{formatTime(msg.created_at)}</span>
                  </div>
                )}
                <div 
                  className={`message ${isOwnMessage(msg) ? 'own' : 'other'}`}
                >
                  <div className="message-content">
                    <p className="message-text">{msg.content}</p>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} style={{ float: 'left', clear: 'both' }} />
      </div>

      <div className="chat-input">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={t('chat.placeholder')}
          onKeyPress={(e) => e.key === 'Enter' && !sending && handleSend()}
          // 移除disabled属性，防止发送后失去焦点
        />
        <button onClick={handleSend} disabled={sending || !newMessage.trim()}>
          {sending ? t('chat.sending') : t('chat.send')}
        </button>
      </div>

      <style>{`
        .chat-page {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 60px);
          max-width: 100%;
          margin: 0;
          background: white; /* 改回纯白背景 */
        }

        .chat-page.loading {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .chat-header {
          display: flex;
          align-items: center;
          padding: 15px 20px;
          background: white; /* 头部也改回白色 */
          border-bottom: 1px solid #f0f0f0; /* 极细的分隔线 */
        }

        .back-btn {
          width: 40px;
          height: 40px;
          border: none;
          background: none;
          font-size: 1.5rem;
          cursor: pointer;
          margin-right: 10px;
          border-radius: 50%;
          transition: background 0.2s;
        }

        .back-btn:hover {
          background: var(--bg-secondary);
        }

        .chat-partner {
          display: flex;
          align-items: center;
        }

        .partner-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--primary);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 12px;
          overflow: hidden;
        }

        .partner-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .partner-info {
          display: flex;
          flex-direction: column;
        }

        .partner-name {
          font-weight: 500;
          color: var(--text-main);
        }

        .partner-username {
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .no-messages {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          text-align: center;
        }

        .time-separator {
          display: flex;
          justify-content: center;
          margin: 20px 0 10px;
        }

        .time-separator span {
          background: rgba(0, 0, 0, 0.05);
          color: #999;
          font-size: 0.75rem;
          padding: 4px 12px;
          border-radius: 4px;
        }

        .message {
          display: flex;
          flex-direction: column;
          max-width: 70%;
          margin-bottom: 8px;
          /* 移除外层容器可能存在的背景或边框 */
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }

        .message.own {
          align-self: flex-end;
        }

        .message.other {
          align-self: flex-start;
        }

        .message-content {
          padding: 10px 14px;
          border-radius: 12px;
          position: relative;
          word-break: break-word;
          box-shadow: none !important;
          border: none !important; /* 彻底移除所有边框 */
        }

        .message.own .message-content {
          background: #333;
          color: white;
          border-bottom-right-radius: 4px;
        }

        .message.other .message-content {
          background: white;
          color: #000;
          border-bottom-left-radius: 4px;
          border: 1px solid #f0f0f0 !important; /* 加回极细的边框以区分白色背景 */
        }

        .message-text {
          margin: 0;
          word-break: break-word;
        }

        .chat-input {
          display: flex;
          padding: 15px 20px;
          background: white;
          border-top: 1px solid #e0e0e0; /* 加回顶部边框 */
          gap: 10px;
        }

        .chat-input input {
          flex: 1;
          padding: 10px 14px;
          border: 1px solid #e0e0e0; /* 给输入框加一个细边框 */
          background: white;
          border-radius: 4px;
          font-size: 1rem;
          outline: none;
        }

        .chat-input input:focus {
          background: white;
        }

        .chat-input button {
          padding: 12px 24px;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 24px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .chat-input button:hover:not(:disabled) {
          background: var(--primary-dark);
        }

        .chat-input button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default Chat;
