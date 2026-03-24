import { useState, useEffect, useRef } from 'react';
import { postApi, Post } from '../services/postApi';
import { recommendationApi } from '../services/recommendationApi';
import { useLoading } from '../contexts/LoadingContext';
import { useLanguage } from '../contexts/LanguageContext';
import { CommentSection } from '../components/CommentSection';

interface ArticleDetailProps {
  articleId: number;
  onBack?: () => void; // 改为可选，组件内部使用浏览器返回
  isLoggedIn: boolean;
  currentUserId?: number;
}

export function ArticleDetail({ articleId, onBack, isLoggedIn, currentUserId }: ArticleDetailProps) {
  const { t } = useLanguage();
  const [article, setArticle] = useState<Post | null>(null);
  const [error, setError] = useState('');
  const { setLoading } = useLoading();
  const fetchedArticleId = useRef<number | null>(null);

  const handleBack = () => {
    onBack?.() || window.history.back();
  };

  useEffect(() => {
    fetchArticle();
  }, [articleId]);

  // 记录浏览行为
  useEffect(() => {
    if (isLoggedIn && articleId) {
      // 延迟3秒记录，确保用户真的在阅读
      const timer = setTimeout(() => {
        recommendationApi.recordBehavior(articleId, 'view')
          .catch(err => console.log('记录浏览行为失败:', err));
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [articleId, isLoggedIn]);

  const fetchArticle = async () => {
    try {
      console.log('正在获取文章详情, ID:', articleId);
      setLoading(true, t('common.loading'));
      
      // 每次进入文章详情都增加阅读量
      // 使用useRef防止Strict Mode下重复请求导致重复计数
      // 当组件卸载重挂载（如从首页重新进入）时，ref会重置，从而正确增加计数
      const shouldIncrement = fetchedArticleId.current !== articleId;
      if (shouldIncrement) {
        fetchedArticleId.current = articleId;
      }

      // 使用公开接口获取文章详情
      const data = await postApi.getPublicById(articleId, shouldIncrement);
      console.log('获取到文章详情:', data);
      setArticle(data);
    } catch (err) {
      console.error('获取文章失败:', err);
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="article-detail-page">
        <div className="error-message">{error}</div>
        <button className="btn-secondary" onClick={handleBack}>{t('detail.back')}</button>
      </div>
    );
  }

  if (!article) {
    return null;
  }

  return (
    <div className="magazine-layout">

      
      {/* 页面操作区域 */}
      <div className="page-header">
        <button className="btn-secondary" onClick={handleBack}>
          ← {t('detail.back')}
        </button>
      </div>

      {/* 主要内容区域 */}
      <div className="magazine-content">
        {/* 左侧主要文章内容 */}
        <div className="magazine-main">
          <article className="article-content-container">
            <header className="article-header">
              <h1 className="article-title">{article.title}</h1>
              <div className="article-meta">
                <span className="meta-item">{t('public.author')}: {article.author?.nickname || article.author?.username || '未知'}</span>
                <span className="meta-item">{t('detail.published_at')} {new Date(article.created_at).toLocaleDateString()}</span>
                <span className="meta-item">{t('detail.views')} {article.view_count}</span>
                {article.category_id && <span className="meta-item">{t('detail.category_id')}: {article.category_id}</span>}
              </div>
            </header>

            {article.cover_image && (
              <div className="article-cover">
                <img src={article.cover_image} alt={article.title} />
              </div>
            )}

            {article.excerpt && (
              <div className="article-excerpt">
                <strong>{t('detail.excerpt')}</strong>{article.excerpt}
              </div>
            )}

            <div 
              className="article-body markdown-body"
              dangerouslySetInnerHTML={{ __html: article.content_html || t('detail.no_content') }}
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.tagName === 'A') {
                  const link = target as HTMLAnchorElement;
                  const href = link.getAttribute('href');
                  if (href && !href.startsWith('#')) {
                    e.preventDefault();
                    // 确保链接有协议前缀
                    let url = href;
                    if (!url.startsWith('http://') && !url.startsWith('https://')) {
                      url = 'https://' + url;
                    }
                    window.open(url, '_blank', 'noopener,noreferrer');
                  }
                }
              }}
            />

            <CommentSection 
              postId={article.id} 
              isLoggedIn={isLoggedIn} 
              currentUserId={currentUserId} 
            />
          </article>
        </div>
      </div>

      <style>{`
        .magazine-layout {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }
        
        .magazine-header {
          text-align: center;
          margin-bottom: 30px;
        }
        
        .magazine-title {
          font-size: 3rem;
          font-weight: 900;
          letter-spacing: -1px;
          margin: 0;
          color: #000;
        }
        
        .magazine-subtitle {
          font-size: 0.9rem;
          color: #666;
          margin: 5px 0 20px;
        }
        
        .magazine-divider {
          border: 1px solid #000;
          width: 100%;
          margin: 20px 0;
        }
        
        .page-header {
          margin-bottom: 30px;
          padding-bottom: 15px;
          border-bottom: 1px solid #eee;
        }
        
        .btn-secondary {
          background-color: #6c757d;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.2s;
        }
        
        .btn-secondary:hover {
          background-color: #5a6268;
        }
        
        .magazine-content {
          display: flex;
          gap: 40px;
        }
        
        .magazine-main {
          flex: 1;
        }
        
        .article-content-container {
          background: white;
          padding: 40px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .article-header {
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 1px solid #eee;
        }
        
        .article-title {
          font-size: 2.5em;
          color: #333;
          margin-bottom: 15px;
          line-height: 1.2;
        }
        
        .article-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
          color: #888;
          font-size: 0.9em;
        }
        
        .meta-item {
          margin-right: 10px;
        }
        
        .article-cover img {
          max-width: 100%;
          border-radius: 4px;
          margin-bottom: 30px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        
        .article-excerpt {
          background: #f9f9f9;
          padding: 20px;
          border-left: 4px solid #007bff;
          margin-bottom: 30px;
          color: #555;
          font-size: 1.1em;
          line-height: 1.6;
        }
        
        .article-body {
          line-height: 1.8;
          color: #333;
          font-size: 1.1em;
        }
        
        .article-body h2 {
          margin-top: 2em;
          margin-bottom: 1em;
          font-size: 1.8em;
          font-weight: 700;
        }
        
        .article-body h3 {
          margin-top: 1.5em;
          margin-bottom: 0.8em;
          font-size: 1.4em;
          font-weight: 600;
        }
        
        .article-body p {
          margin-bottom: 1.5em;
        }
        
        .article-body img {
          max-width: 100%;
          margin: 20px 0;
          border-radius: 4px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .article-body pre {
          background: #f5f5f5;
          padding: 15px;
          border-radius: 4px;
          overflow-x: auto;
          margin: 20px 0;
        }
        
        .article-body code {
          background: #f5f5f5;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 0.9em;
        }
        
        .sidebar-title {
          font-size: 1.2rem;
          font-weight: 700;
          margin: 0 0 15px;
        }
        
        .sidebar-divider {
          border: 1px solid #000;
          width: 100%;
          margin: 10px 0 20px;
        }
        
        .news-item {
          margin-bottom: 25px;
          padding-bottom: 20px;
          border-bottom: 1px solid #eee;
        }
        
        .news-item:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }
        
        .news-category {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #c71d23;
          margin: 0 0 8px;
        }
        
        .news-content {
          display: flex;
          align-items: flex-start;
          gap: 15px;
        }
        
        .news-title {
          font-size: 0.9rem;
          font-weight: 500;
          margin: 0;
          line-height: 1.4;
          flex: 1;
        }
        
        .news-image {
          flex-shrink: 0;
          border-radius: 4px;
          overflow: hidden;
        }
        
        @media (max-width: 992px) {
          .magazine-content {
            flex-direction: column;
          }
          
          .magazine-sidebar {
            margin-top: 40px;
          }
        }
        
        @media (max-width: 768px) {
          .magazine-layout {
            padding: 15px;
          }
          
          .magazine-title {
            font-size: 2rem;
          }
          
          .article-content-container {
            padding: 20px;
          }
          
          .article-title {
            font-size: 1.8em;
          }
        }
      `}</style>
    </div>
  );
}
