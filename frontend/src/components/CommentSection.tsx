import React, { useState, useEffect } from 'react';
import { commentApi, Comment, CommentCreate } from '../services/commentApi';
import { recommendationApi } from '../services/recommendationApi';
import { useLanguage } from '../contexts/LanguageContext';

interface CommentSectionProps {
  postId: number;
  isLoggedIn: boolean;
  currentUserId?: number;
}

export const CommentSection: React.FC<CommentSectionProps> = ({ postId, isLoggedIn }) => {
  const { t } = useLanguage();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [postId]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const data = await commentApi.getPostComments(postId);
      setComments(data);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      setSubmitting(true);
      const newComment: CommentCreate = {
        content: content,
        is_anonymous: isAnonymous
      };
      await commentApi.createComment(postId, newComment);
      
      // 记录评论行为
      await recommendationApi.recordBehavior(postId, 'comment')
        .catch(err => console.log('记录评论行为失败:', err));
      
      setContent('');
      setIsAnonymous(false);
      await fetchComments(); // Refresh list
    } catch (error) {
      console.error('Failed to create comment:', error);
      alert(t('comment.error.create'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (commentId: number) => {
    if (!isLoggedIn) {
        alert(t('comment.error.login'));
        return;
    }
    try {
      await commentApi.likeComment(commentId);
      // Optimistically update or refresh
      await fetchComments();
    } catch (error) {
      console.error('Failed to like comment:', error);
    }
  };

  return (
    <div className="comment-section">
      <h3>{t('comment.title', { count: comments.length })}</h3>

      {isLoggedIn ? (
        <form onSubmit={handleSubmit} className="comment-form">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('comment.placeholder')}
            rows={3}
            className="comment-input"
            required
          />
          <div className="comment-actions">
            <label className="anonymous-checkbox">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
              />
              {t('comment.anonymous')}
            </label>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? t('comment.submitting') : t('comment.submit')}
            </button>
          </div>
        </form>
      ) : (
        <div className="login-hint">
          {t('comment.login_hint')}
        </div>
      )}

      <div className="comments-list">
        {loading ? (
          <div>{t('comment.loading')}</div>
        ) : comments.length === 0 ? (
          <div className="no-comments">{t('comment.empty')}</div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="comment-item">
              <div className="comment-header">
                <div className="comment-author">
                  {comment.is_anonymous ? (
                    <div className="avatar-placeholder anonymous">?</div>
                  ) : (
                    comment.author?.avatar ? (
                      <img src={comment.author.avatar} alt="avatar" className="avatar-img" />
                    ) : (
                      <div className="avatar-placeholder">{(comment.author?.nickname || comment.author?.username || '?').charAt(0).toUpperCase()}</div>
                    )
                  )}
                  <span className="author-name">
                    {comment.is_anonymous ? t('comment.anonymous_user') : comment.author?.nickname || comment.author?.username || t('comment.unknown_user')}
                  </span>
                </div>
                <span className="comment-time">
                  {new Date(comment.created_at).toLocaleString()}
                </span>
              </div>
              <div className="comment-content">
                {comment.content}
              </div>
              <div className="comment-footer">
                <button 
                  className={`like-btn ${isLoggedIn ? '' : 'disabled'}`}
                  onClick={() => handleLike(comment.id)}
                  disabled={!isLoggedIn}
                >
                  👍 {comment.likes}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        .comment-section {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #eee;
        }
        .comment-form {
          margin-bottom: 30px;
          background: #f9f9f9;
          padding: 20px;
          border-radius: 8px;
        }
        .comment-input {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          resize: vertical;
          margin-bottom: 10px;
          font-family: inherit;
        }
        .comment-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .anonymous-checkbox {
          display: flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          user-select: none;
        }
        .login-hint {
          padding: 20px;
          text-align: center;
          background: #f9f9f9;
          border-radius: 8px;
          color: #666;
          margin-bottom: 30px;
        }
        .comment-item {
          padding: 15px 0;
          border-bottom: 1px solid #f0f0f0;
        }
        .comment-item:last-child {
          border-bottom: none;
        }
        .comment-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .comment-author {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .avatar-placeholder {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #ddd;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          color: #555;
        }
        .avatar-placeholder.anonymous {
          background: #333;
          color: #fff;
        }
        .avatar-img {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          object-fit: cover;
        }
        .author-name {
          font-weight: 500;
        }
        .comment-time {
          font-size: 0.85em;
          color: #999;
        }
        .comment-content {
          margin-bottom: 10px;
          line-height: 1.5;
          white-space: pre-wrap;
        }
        .like-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: #666;
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          border-radius: 4px;
          transition: background 0.2s;
        }
        .like-btn:hover:not(.disabled) {
          background: #f0f0f0;
          color: var(--primary);
        }
        .like-btn.disabled {
          cursor: default;
          opacity: 0.6;
        }
        .no-comments {
          text-align: center;
          color: #999;
          padding: 30px 0;
        }
      `}</style>
    </div>
  );
};
