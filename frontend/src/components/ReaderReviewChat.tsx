import { useState, useEffect, useRef, useCallback } from 'react';
import { readerReviewApi, ReaderRole } from '../services/readerReviewApi';
// import { useLanguage } from '../contexts/LanguageContext';
import AIRewritePanel from './AIRewritePanel';
import { ReviewResult as RewriteReviewResult } from '../services/aiRewriteApi';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reviewerName?: string;
  reviewerIcon?: string;
  isLoading?: boolean;
  isCustomPersona?: boolean;  // 标记是否是自定义读者
  parsedReview?: {
    summary: string;
    issues: string[];
    suggestions: string[];
  };
}

interface ReaderReviewChatProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  selectedRoles: ReaderRole[];
  onApplyRewrite?: (newTitle: string, newContent: string) => void;
}

export function ReaderReviewChat({ isOpen, onClose, title, content, selectedRoles, onApplyRewrite }: ReaderReviewChatProps) {
  // const { t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [showRewritePanel, setShowRewritePanel] = useState(false);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 开始评审
  useEffect(() => {
    if (isOpen && selectedRoles.length > 0) {
      startReview();
    }
  }, [isOpen]);

  // 拖动相关事件
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest('.chat-header')) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 添加全局鼠标事件监听器
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const startReview = async () => {
    setIsReviewing(true);
    setMessages([]);

    // 添加用户消息
    const userMessage: Message = {
      id: 'user-1',
      role: 'user',
      content: `请评审我的文章：《${title}》`
    };
    setMessages([userMessage]);

    // 调试日志
    console.log('[DEBUG] selectedRoles:', selectedRoles);
    selectedRoles.forEach(role => {
      if (role.has_personas) {
        console.log('[DEBUG] role.personas:', role.personas);
      }
    });

    // 并行调用所有角色的评审
    const reviewPromises: Promise<void>[] = [];
    
    for (const role of selectedRoles) {
      if (role.has_personas && role.personas) {
        // 读者画像角色需要评审所有子角色
        for (const persona of role.personas) {
          console.log('[DEBUG] 评审 persona:', persona.name, persona.description);
          reviewPromises.push(reviewWithRole(role, persona.id, persona.name, persona.description));
        }
      } else {
        reviewPromises.push(reviewWithRole(role));
      }
    }
    
    // 等待所有评审完成
    await Promise.all(reviewPromises);

    setIsReviewing(false);
  };

  const reviewWithRole = async (role: ReaderRole, personaId?: string, personaName?: string, personaDesc?: string) => {
    // 添加加载消息
    const loadingId = `loading-${role.id}-${personaId || ''}-${Date.now()}`;
    const loadingMessage: Message = {
      id: loadingId,
      role: 'assistant',
      content: '',
      reviewerName: personaName ? `${role.name} - ${personaName}` : role.name,
      reviewerIcon: role.icon,
      isLoading: true
    };
    setMessages(prev => [...prev, loadingMessage]);

    try {
      // 检查是否是自定义读者（以 custom_ 开头）
      const isCustomPersona = personaId?.startsWith('custom_');
      
      const result = await readerReviewApi.reviewArticle(
        title,
        content,
        role.id,
        personaId,
        isCustomPersona ? personaName : undefined,
        isCustomPersona ? personaDesc : undefined
      );

      // 替换加载消息为实际结果
      setMessages(prev => prev.map(msg => 
        msg.id === loadingId
          ? {
              id: loadingId.replace('loading', 'result'),
              role: 'assistant',
              content: result.raw_review,
              reviewerName: result.role_name,
              reviewerIcon: result.icon,
              isLoading: false,
              isCustomPersona: isCustomPersona,  // 标记是否是自定义读者
              parsedReview: isCustomPersona ? undefined : result.parsed_review  // 自定义读者不解析结构化数据
            }
          : msg
      ));
    } catch (error: any) {
      // 替换为错误消息
      console.error('[ReaderReviewChat] 评审失败:', error);
      console.error('[ReaderReviewChat] 错误详情:', error.response?.data || error.message);
      setMessages(prev => prev.map(msg => 
        msg.id === loadingId
          ? {
              id: loadingId.replace('loading', 'error'),
              role: 'assistant',
              content: `评审失败: ${error.response?.data?.detail || error.message || '请稍后重试'}`,
              reviewerName: personaName ? `${role.name} - ${personaName}` : role.name,
              reviewerIcon: role.icon,
              isLoading: false
            }
          : msg
      ));
    }
  };

  const renderMessage = (message: Message) => {
    if (message.role === 'user') {
      return (
        <div key={message.id} className="message user-message">
          <div className="message-content">
            {message.content}
          </div>
        </div>
      );
    }

    return (
      <div key={message.id} className="message assistant-message">
        <div className="message-avatar">
          {message.reviewerIcon}
        </div>
        <div className="message-body">
          <div className="message-header">
            <span className="reviewer-name">{message.reviewerName}</span>
          </div>
          <div className="message-content">
            {message.isLoading ? (
              <div className="loading-indicator">
                <span className="loading-dot"></span>
                <span className="loading-dot"></span>
                <span className="loading-dot"></span>
                <span className="loading-text">正在评审...</span>
              </div>
            ) : message.isCustomPersona ? (
              // 自定义读者：直接显示原始内容，不格式化
              <div className="custom-persona-content">{message.content}</div>
            ) : message.parsedReview ? (
              <div className="review-result">
                {/* 摘要 */}
                {message.parsedReview.summary && (
                  <div className="result-block summary-block">
                    <div className="block-title">📋 评审摘要</div>
                    <div className="block-content">{message.parsedReview.summary}</div>
                  </div>
                )}

                {/* 问题列表 */}
                {message.parsedReview.issues.length > 0 && (
                  <div className="result-block issues-block">
                    <div className="block-title">⚠️ 发现问题</div>
                    <ul className="block-list">
                      {message.parsedReview.issues.map((issue, i) => (
                        <li key={i} className="issue-item">{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 建议 */}
                {message.parsedReview.suggestions.length > 0 && (
                  <div className="result-block suggestions-block">
                    <div className="block-title">💡 改进建议</div>
                    <ul className="block-list">
                      {message.parsedReview.suggestions.map((suggestion, i) => (
                        <li key={i} className="suggestion-item">{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 完整评审 */}
                <div className="result-block full-review-block">
                  <div className="block-title">📝 详细评审</div>
                  <div className="full-review-content">{message.content}</div>
                </div>
              </div>
            ) : (
              <div className="error-content">{message.content}</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // 获取评审结果（排除用户消息和加载消息）
  const getReviewResults = (): RewriteReviewResult[] => {
    return messages
      .filter(msg => msg.role === 'assistant' && !msg.isLoading && msg.reviewerName)
      .map(msg => ({
        reviewer_name: msg.reviewerName || '',
        content: msg.content,
        icon: msg.reviewerIcon
      }));
  };

  // 处理应用修改
  const handleApplyRewrite = (newTitle: string, newContent: string) => {
    // 调用父组件的回调
    if (onApplyRewrite) {
      onApplyRewrite(newTitle, newContent);
    }
    // 触发全局事件（兼容旧代码）
    const event = new CustomEvent('ai-rewrite-applied', {
      detail: { title: newTitle, content: newContent }
    });
    window.dispatchEvent(event);
    setShowRewritePanel(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="reader-review-chat-overlay">
      <div 
        className="reader-review-chat"
        ref={chatRef}
        style={{
          top: `${position.y}px`,
          left: `${position.x}px`,
          cursor: isDragging ? 'grabbing' : 'move'
        }}
        onMouseDown={handleMouseDown}
      >
        {/* 头部 - 根据模式显示不同标题 */}
        <div className="chat-header">
          <div className="chat-title">
            {showRewritePanel ? (
              <>
                <span className="chat-icon">✨</span>
                <span>AI 文章修改</span>
              </>
            ) : (
              <>
                <span className="chat-icon">📚</span>
                <span>AI 读者评审</span>
              </>
            )}
          </div>
          <button className="chat-close" onClick={onClose}>×</button>
        </div>

        {/* 消息区域 - 根据模式显示不同内容 */}
        <div className="chat-messages">
          {showRewritePanel ? (
            <AIRewritePanel
              title={title}
              content={content}
              reviewResults={getReviewResults()}
              onApply={handleApplyRewrite}
              onCancel={() => setShowRewritePanel(false)}
            />
          ) : (
            <>
              {messages.length === 0 ? (
                <div className="chat-empty">
                  <div className="empty-icon">📝</div>
                  <div className="empty-text">准备开始评审...</div>
                </div>
              ) : (
                messages.map(renderMessage)
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* 底部状态栏 */}
        <div className="chat-footer">
          {isReviewing ? (
            <div className="review-status">
              <span className="status-icon">⏳</span>
              <span>评审进行中...</span>
            </div>
          ) : showRewritePanel ? (
            <div className="review-footer-actions">
              <div className="review-status">
                <span className="status-icon">✨</span>
                <span>AI 修改模式</span>
              </div>
              <button
                className="rewrite-button secondary"
                onClick={() => setShowRewritePanel(false)}
              >
                ← 返回评审结果
              </button>
            </div>
          ) : (
            <div className="review-footer-actions">
              <div className="review-status completed">
                <span className="status-icon">✓</span>
                <span>评审完成</span>
              </div>
              {messages.length > 1 && (
                <button
                  className="rewrite-button"
                  onClick={() => setShowRewritePanel(true)}
                >
                  ✨ AI 一键修改
                </button>
              )}
            </div>
          )}
        </div>

        <style>{`
          .reader-review-chat-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: block;
            z-index: 1000;
          }

          .reader-review-chat {
            position: fixed;
            top: 100px;
            left: 100px;
            width: 90%;
            max-width: 800px;
            height: 80vh;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            animation: slideUp 0.3s ease;
            cursor: move;
            z-index: 1001;
          }

          @keyframes slideUp {
            from { 
              opacity: 0;
              transform: translateY(30px);
            }
            to { 
              opacity: 1;
              transform: translateY(0);
            }
          }

          /* 头部 */
          .chat-header {
            background: linear-gradient(135deg, #444444 0%, #222222 100%);
            color: white;
            padding: 16px 20px;
            cursor: move;
            user-select: none;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .chat-title {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 1.1rem;
            font-weight: 600;
          }

          .chat-icon {
            font-size: 1.3rem;
          }

          .chat-close {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            font-size: 1.5rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
          }

          .chat-close:hover {
            background: rgba(255, 255, 255, 0.3);
          }

          /* 消息区域 */
          .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            background: #f8f9fa;
          }

          .chat-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: #999;
          }

          .empty-icon {
            font-size: 3rem;
            margin-bottom: 10px;
          }

          .empty-text {
            font-size: 1rem;
          }

          /* 消息样式 */
          .message {
            margin-bottom: 20px;
            animation: messageSlideIn 0.3s ease;
          }

          @keyframes messageSlideIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .user-message {
            display: flex;
            justify-content: flex-end;
          }

          .user-message .message-content {
            background: #333333;
            color: white;
            padding: 12px 16px;
            border-radius: 18px 18px 4px 18px;
            max-width: 70%;
            font-size: 0.95rem;
          }

          .assistant-message {
            display: flex;
            gap: 12px;
          }

          .message-avatar {
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #444444 0%, #222222 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2rem;
            flex-shrink: 0;
          }

          .message-body {
            flex: 1;
            max-width: calc(100% - 60px);
          }

          .message-header {
            margin-bottom: 6px;
          }

          .reviewer-name {
            font-weight: 600;
            color: #333;
            font-size: 0.9rem;
          }

          .message-content {
            background: white;
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          }

          /* 加载动画 */
          .loading-indicator {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 0;
          }

          .loading-dot {
            width: 8px;
            height: 8px;
            background: #333333;
            border-radius: 50%;
            animation: bounce 1.4s infinite ease-in-out both;
          }

          .loading-dot:nth-child(1) { animation-delay: -0.32s; }
          .loading-dot:nth-child(2) { animation-delay: -0.16s; }

          @keyframes bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1); }
          }

          .loading-text {
            color: #666;
            font-size: 0.9rem;
            margin-left: 8px;
          }

          /* 评审结果 */
          .review-result {
            space-y: 16px;
          }

          .result-block {
            margin-bottom: 16px;
            padding: 12px;
            border-radius: 8px;
            border-left: 4px solid;
          }

          .result-block:last-child {
            margin-bottom: 0;
          }

          .summary-block {
            background: #e3f2fd;
            border-left-color: #2196f3;
          }

          .issues-block {
            background: #ffebee;
            border-left-color: #f44336;
          }

          .suggestions-block {
            background: #e8f5e9;
            border-left-color: #4caf50;
          }

          .full-review-block {
            background: #f5f5f5;
            border-left-color: #9e9e9e;
          }

          .block-title {
            font-weight: 600;
            margin-bottom: 8px;
            color: #333;
            font-size: 0.9rem;
          }

          .block-content {
            color: #555;
            font-size: 0.9rem;
            line-height: 1.5;
          }

          .block-list {
            margin: 0;
            padding-left: 20px;
          }

          .block-list li {
            margin-bottom: 6px;
            color: #555;
            font-size: 0.9rem;
            line-height: 1.5;
          }

          .issue-item {
            color: #c62828;
          }

          .suggestion-item {
            color: #2e7d32;
          }

          .full-review-content {
            white-space: pre-wrap;
            color: #555;
            font-size: 0.85rem;
            line-height: 1.6;
            max-height: 200px;
            overflow-y: auto;
          }

          .error-content {
            color: #c62828;
            font-size: 0.9rem;
          }

          /* 自定义读者内容 - 直接显示原始文本 */
          .custom-persona-content {
            white-space: pre-wrap;
            color: #333;
            font-size: 0.95rem;
            line-height: 1.7;
            padding: 8px 0;
          }

          /* 底部 */
          .chat-footer {
            background: white;
            border-top: 1px solid #e1e4e8;
            padding: 12px 20px;
          }

          .review-status {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #666;
            font-size: 0.9rem;
          }

          .review-status.completed {
            color: #4caf50;
          }

          .status-icon {
            font-size: 1rem;
          }

          /* 底部操作栏 */
          .review-footer-actions {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .rewrite-button {
            background: linear-gradient(135deg, #444444 0%, #222222 100%);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9rem;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          }

          .rewrite-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          }

          .rewrite-button.secondary {
            background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
            box-shadow: 0 2px 8px rgba(108, 117, 125, 0.3);
          }

          .rewrite-button.secondary:hover {
            box-shadow: 0 4px 12px rgba(108, 117, 125, 0.4);
          }

          /* 滚动条样式 */
          .chat-messages::-webkit-scrollbar {
            width: 8px;
          }

          .chat-messages::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 4px;
          }

          .chat-messages::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 4px;
          }

          .chat-messages::-webkit-scrollbar-thumb:hover {
            background: #a1a1a1;
          }
        `}</style>
      </div>
    </div>
  );
}
