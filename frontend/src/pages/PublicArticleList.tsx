import { useState, useEffect } from 'react';
import { postApi, PostListItem } from '../services/postApi';
import { useLoading } from '../contexts/LoadingContext';
import { useLanguage } from '../contexts/LanguageContext';
import './PublicArticleList.css';

interface PublicArticleListProps {
  onViewArticle?: (id: number) => void;
  // 为了兼容 App.tsx 中的调用，增加别名
  onNavigateToDetail?: (id: number) => void;
  enableHoverEffect?: boolean;
  viewMode?: 'list' | 'grid';
}

export function PublicArticleList({ onViewArticle, onNavigateToDetail, enableHoverEffect = true, viewMode = 'list' }: PublicArticleListProps) {
  const handleViewArticle = (id: number) => {
    if (onViewArticle) onViewArticle(id);
    if (onNavigateToDetail) onNavigateToDetail(id);
  };
  
  const { t } = useLanguage();
  const [articles, setArticles] = useState<PostListItem[]>([]);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    size: 10,
    total: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  // 使用全局加载上下文
  const { setLoading } = useLoading();

  const fetchArticles = async () => {
    try {
      setLoading(true, t('common.loading'));
      const response = await postApi.getPublicList({
        page: pagination.page,
        size: pagination.size,
        search: searchQuery || undefined,
      });
      setArticles(response.items);
      setPagination(prev => ({
        ...prev,
        total: response.total,
      }));
      setError('');
    } catch (err) {
      console.error('获取文章列表失败:', err);
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, [pagination.page, pagination.size]); 

  // 监听回车键进行搜索
  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 })); // 搜索时重置到第一页
    // fetchArticles 会因为 pagination.page 的变化而被调用
    // 但是如果是第一页，我们需要手动调用 fetchArticles
    if (pagination.page === 1) {
      fetchArticles();
    }
  };

  const totalPages = Math.ceil(pagination.total / pagination.size);

  const getCardStyle = (index: number) => {
    // 如果禁用了悬停效果，直接返回基础样式
    if (!enableHoverEffect) {
      return {
        cursor: 'pointer',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '8px',
        marginBottom: '0px', // 使用 gap 控制间距
        border: 'none', 
        position: 'relative',
        zIndex: 1,
        opacity: 1,
        boxShadow: 'var(--shadow-sm)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        overflow: 'hidden', // 确保内容不会溢出圆角
      } as React.CSSProperties;
    }

    // const isHovered = hoveredIndex === index;
    const isAnyHovered = hoveredIndex !== null;
    const N = articles.length;
    const C = 20; // 压缩系数

    let style: React.CSSProperties = {
        cursor: 'pointer',
        transition: 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.4s ease',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '8px',
        marginBottom: '20px',
        border: '1px solid transparent', 
        transformOrigin: 'center center',
        position: 'relative',
        zIndex: 1,
        opacity: 1,
        overflow: 'hidden', // 确保内容不会溢出圆角
      };

    if (isAnyHovered) {
      const k = hoveredIndex!;
      
      if (index < k) {
        // 上方元素
        const translateY = -1 * index * C;
        style = {
          ...style,
          transform: `translateY(${translateY}px)`,
          zIndex: 1,
          boxShadow: 'var(--shadow-sm)',
        };
      } else if (index > k) {
        // 下方元素
        const translateY = (N - 1 - index) * C;
        style = {
          ...style,
          transform: `translateY(${translateY}px)`,
          zIndex: 1,
          boxShadow: 'var(--shadow-sm)',
        };
      } else {
        // 选中元素
        const translateY = ( (N - 1 - k) * C - k * C ) / 2;
        
        style = {
          ...style,
          transform: `scale(1.05) scaleY(1.3) translateY(${translateY}px) translateZ(20px)`,
          boxShadow: 'var(--shadow-lg)',
          zIndex: 100, 
          backgroundColor: 'var(--bg-card)', 
        };
      }
    } else {
      // 默认状态
      style = {
        ...style,
        transform: 'scale(1) translateZ(0)',
        boxShadow: 'var(--shadow-sm)',
      };
    }
    
    return style;
  };

  const getContentStyle = (index: number) => {
    const baseStyle: React.CSSProperties = {
      height: '100%',
      width: '100%',
      padding: '24px',
      boxSizing: 'border-box',
    };

    if (!enableHoverEffect) {
      return baseStyle;
    }

    const isHovered = hoveredIndex === index;
    
    return {
      ...baseStyle,
      transform: isHovered ? 'scale(0.952, 0.769)' : 'scale(1)',
      transformOrigin: 'center center',
      transition: 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)',
    } as React.CSSProperties;
  };

  return (
    <div className="article-list-page public-list" style={{ overflow: 'visible' }}>
      <div className="page-header" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: viewMode === 'grid' ? '20px 40px' : '0', 
        background: viewMode === 'grid' ? '#fff' : 'transparent', 
        borderBottom: viewMode === 'grid' ? '1px solid #f0f0f0' : 'none', 
        position: viewMode === 'grid' ? 'sticky' : 'static', 
        top: 0, 
        zIndex: 10,
        marginBottom: viewMode === 'list' ? '20px' : '0'
      }}>
        <h2 style={{ 
          color: viewMode === 'grid' ? '#333' : '#fff', // 列表模式下（未登录首页）为白色
          margin: 0,
          display: 'inline-block', 
          fontWeight: 700,
          fontSize: '1.8rem',
          textShadow: viewMode === 'list' ? '0 2px 4px rgba(0,0,0,0.2)' : 'none'
        }}>
          {t('public.latest')}
        </h2>
        
        {/* 搜索框 - 仅在 grid 模式（弹窗）下显示 */}
        {viewMode === 'grid' && (
          <div className="search-box" style={{ display: 'flex', gap: '10px', marginRight: '60px' }}>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('search.placeholder')}
              style={{
                padding: '10px 16px',
                borderRadius: '24px',
                border: '1px solid #eee',
                outline: 'none',
                width: '300px',
                fontSize: '1rem',
                background: '#f9f9f9'
              }}
            />
            <button 
              onClick={handleSearch}
              style={{
                background: 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: '24px',
                padding: '10px 24px',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              {t('search.button')}
            </button>
          </div>
        )}
      </div>

      {error && <div className="error-message" style={{ color: '#ff6b6b', margin: '20px 40px' }}>{error}</div>}

      {viewMode === 'grid' ? (
        // Grid View (用于全屏弹窗)
        <div className="public-articles" style={{ overflow: 'visible', padding: '40px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '30px', maxWidth: '1600px', margin: '0 auto' }}>
          {articles.map((article, idx) => (
            <div 
              key={article.id} 
              className="article-card-item"
              onClick={() => handleViewArticle(article.id)}
              style={{
                ...getCardStyle(idx),
                marginBottom: 0, // Grid布局不需要margin-bottom
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflow: 'hidden'
              }}
              onMouseEnter={() => enableHoverEffect && setHoveredIndex(idx)}
              onMouseLeave={() => enableHoverEffect && setHoveredIndex(null)}
            >
              {/* 文章封面图 - 上方显示 */}
              {article.cover_image && (
                <div className="article-cover" style={{ 
                  width: '100%', 
                  height: '180px',
                  flexShrink: 0,
                  backgroundImage: `url(${article.cover_image})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }} />
              )}
              
              <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h3 className="article-title" style={{ fontWeight: 600, fontSize: '1.2rem', marginBottom: '12px', lineHeight: 1.4 }}>{article.title}</h3>
                <div className="article-meta" style={{ marginBottom: '16px', fontSize: '0.85rem' }}>
                  <span className="article-author" style={{ display: 'flex', alignItems: 'center' }}>
                    {article.author?.avatar && (
                      <img src={article.author.avatar} alt={article.author.username} className="author-avatar-small" />
                    )}
                    {article.author?.nickname || article.author?.username || '未知'}
                  </span>
                  <span className="article-date">{new Date(article.created_at).toLocaleDateString()}</span>
                </div>
                {article.excerpt && <p className="article-excerpt" style={{ fontSize: '0.95rem', color: '#666', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', flex: 1 }}>{article.excerpt}</p>}
                
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f5f5f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: '#999' }}>
                  <span>{t('public.read')} {article.view_count}</span>
                  <span style={{ color: 'var(--primary)', fontWeight: 500 }}>阅读全文 →</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // List View (用于未登录首页)
        <div className="public-articles" style={{ overflow: 'visible', padding: '20px 0', display: 'flex', flexDirection: 'column', gap: enableHoverEffect ? '20px' : '12px' }}>
          {articles.map((article, idx) => (
            <div 
              key={article.id} 
              className="article-card-item"
              onClick={() => handleViewArticle(article.id)}
              style={getCardStyle(idx)}
              onMouseEnter={() => enableHoverEffect && setHoveredIndex(idx)}
              onMouseLeave={() => enableHoverEffect && setHoveredIndex(null)}
            >
              {/* 文章封面图 - 左侧显示 */}
              <div className="article-content-wrapper" style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
                {article.cover_image && (
                  <div className="article-cover" style={{ 
                    width: '200px', 
                    flexShrink: 0,
                    backgroundImage: `url(${article.cover_image})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    borderTopLeftRadius: '8px',
                    borderBottomLeftRadius: '8px'
                  }} />
                )}
                
                <div style={{ ...getContentStyle(idx), flex: 1 }}>
                  <h3 className="article-title" style={{ fontWeight: 600 }}>{article.title}</h3>
                  <div className="article-meta">
                    <span className="article-author">
                      {article.author?.avatar && (
                        <img src={article.author.avatar} alt={article.author.username} className="author-avatar-small" />
                      )}
                      {t('public.author')}: {article.author?.nickname || article.author?.username || '未知'}
                    </span>
                    <span className="article-date">{new Date(article.created_at).toLocaleDateString()}</span>
                    <span className="article-views">{t('public.read')}: {article.view_count}</span>
                  </div>
                  {article.excerpt && <p className="article-excerpt">{article.excerpt}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {articles.length === 0 && (
        <div className="empty-state" style={{ color: 'var(--text-secondary)' }}>
          {t('public.empty')}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination" style={{ color: 'var(--text-secondary)' }}>
          <button 
            disabled={pagination.page === 1}
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            style={{ 
              background: 'var(--bg-card)', 
              color: 'var(--text-main)', 
              border: '1px solid var(--border-color)', 
              padding: '8px 16px', 
              margin: '0 5px', 
              borderRadius: '4px',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            上一页
          </button>
          <span>第 {pagination.page} / {totalPages} 页</span>
          <button 
            disabled={pagination.page === totalPages}
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            style={{ 
              background: 'var(--bg-card)', 
              color: 'var(--text-main)', 
              border: '1px solid var(--border-color)', 
              padding: '8px 16px', 
              margin: '0 5px', 
              borderRadius: '4px',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
