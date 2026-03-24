import { useState, useEffect } from 'react';
import { postApi, PostListItem } from '../services/postApi';
import { useLoading } from '../contexts/LoadingContext';
import { useLanguage } from '../contexts/LanguageContext';
import './ArticleList.css';

interface ArticleListProps {
  onNavigateToCreate: () => void;
  onNavigateToEdit: (id: number) => void;
  initialCategoryId?: number; // 新增属性
}

export function ArticleList({ onNavigateToCreate, onNavigateToEdit, initialCategoryId }: ArticleListProps) {
  const { t } = useLanguage();
  const [articles, setArticles] = useState<PostListItem[]>([]);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    size: 10,
    total: 0,
  });
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  // 如果有initialCategoryId，将其作为初始状态，但这里其实可以直接在fetchArticles中使用props
  
  // 使用全局加载上下文
  const { setLoading } = useLoading();

  const fetchArticles = async () => {
    try {
      console.log('开始获取文章列表...');
      setLoading(true, t('common.loading'));
      const response = await postApi.getList({
        page: pagination.page,
        size: pagination.size,
        status: statusFilter || undefined,
        category_id: initialCategoryId || undefined, // 修复：确保为undefined而不是0或null
        search: searchQuery || undefined,
      });
      console.log('获取文章列表成功:', response);
      setArticles(response.items);
      setPagination(prev => ({
        ...prev,
        total: response.total,
      }));
      setError('');
    } catch (err: any) {
      console.error('获取文章列表失败:', err);
      // 如果是401错误，显示登录提示
      if (err.response?.status === 401) {
        setError('登录已过期，请重新登录');
      } else {
        setError(err instanceof Error ? err.message : t('common.error'));
      }
    } finally {
      setLoading(false);
      console.log('获取文章列表请求完成');
    }
  };

  useEffect(() => {
    fetchArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.size, statusFilter, initialCategoryId, searchQuery]); // 添加依赖

  const handleDelete = async (id: number) => {
    if (!window.confirm(t('article.delete.confirm'))) return;
    
    try {
      setLoading(true, t('common.loading'));
      await postApi.delete(id);
      fetchArticles();
    } catch (err) {
      setLoading(false);
      alert(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handleStatusChange = async (id: number, newStatus: 'draft' | 'published' | 'private') => {
    try {
      setLoading(true, t('common.loading'));
      await postApi.update(id, { status: newStatus });
      fetchArticles();
    } catch (err) {
      setLoading(false);
      alert(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      draft: t('article.status.draft'),
      published: t('article.status.published'),
      private: t('article.status.private'),
    };
    return statusMap[status] || status;
  };

  const getStatusClass = (status: string) => {
    const classMap: Record<string, string> = {
      draft: 'status-draft',
      published: 'status-published',
      private: 'status-private',
    };
    return classMap[status] || '';
  };

  const totalPages = Math.ceil(pagination.total / pagination.size);

  return (
    <div className="article-list-container" style={{
      backgroundImage: 'url(/background3.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      minHeight: 'calc(100vh - 60px)', // 减去导航栏高度
      width: '100%',
      padding: '40px',
      boxSizing: 'border-box'
    }}>
        {/* 页面操作区域 */}
        <div className="page-header">
          <h2 style={{ color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{t('article.list.title')}</h2>
          <button className="btn-primary" onClick={onNavigateToCreate}>
            {t('article.list.create')}
          </button>
        </div>
        
        {/* 搜索栏 */}
        <div className="search-bar">
          <div className="search-container">
            <input
              type="text"
              className="search-input"
              placeholder={t('search.placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && fetchArticles()}
            />
            <button
              className="search-button"
              onClick={fetchArticles}
            >
              🔍
            </button>
          </div>
        </div>
        
        <div className="filter-bar">
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="status-filter"
          >
            <option value="">{t('article.status.all')}</option>
            <option value="draft">{t('article.status.draft')}</option>
            <option value="published">{t('article.status.published')}</option>
            <option value="private">{t('article.status.private')}</option>
          </select>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* 主要内容区域 */}
        <div className="article-content">
          {/* 文章列表 */}
        <div className="article-list">
          {articles.map((article) => (
            <div 
              key={article.id} 
              className={`article-item ${expandedId === article.id ? 'expanded' : ''}`}
              onClick={() => setExpandedId(expandedId === article.id ? null : article.id)}
              style={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.95)', // 单个文章卡片保持不透明背景
                backdropFilter: 'blur(5px)'
              }}
            >
              <div className="article-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="article-title" style={{ marginBottom: 0 }}>{article.title}</h3>
                  <span style={{ color: '#ccc', fontSize: '0.8rem' }}>
                    {expandedId === article.id ? '收起 ▲' : '展开 ▼'}
                  </span>
                </div>
                <div className="article-meta" style={{ marginBottom: expandedId === article.id ? '20px' : '0', borderBottom: expandedId === article.id ? '1px solid #f5f5f5' : 'none', paddingBottom: expandedId === article.id ? '15px' : '0' }}>
                  <span>{t('public.author')}: {article.author?.nickname || article.author?.username || '未知'}</span>
                  <span>{new Date(article.created_at).toLocaleDateString()}</span>
                  <span>阅读 {article.view_count}</span>
                  <span className={`status-badge ${getStatusClass(article.status)}`}>
                    {getStatusText(article.status)}
                  </span>
                </div>
              </div>
              
              {expandedId === article.id && (
                <div className="article-details-container">
                  {article.excerpt && (
                    <p className="article-excerpt">{article.excerpt}</p>
                  )}
                  
                  {/* 文章操作按钮 */}
                  <div className="article-actions" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={article.status}
                      onChange={(e) => handleStatusChange(article.id, e.target.value as 'draft' | 'published' | 'private')}
                      className="status-select"
                    >
                      <option value="draft">{t('article.status.draft')}</option>
                      <option value="published">{t('article.status.published')}</option>
                      <option value="private">{t('article.status.private')}</option>
                    </select>
                    <button 
                      className="btn-edit"
                      onClick={() => onNavigateToEdit(article.id)}
                    >
                      {t('common.edit')}
                    </button>
                    <button 
                      className="btn-delete"
                      onClick={() => handleDelete(article.id)}
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {articles.length === 0 && (
            <div className="empty-state">
              {t('article.list.empty')}
            </div>
          )}
        </div>
        
        {/* 分页 */}
        {totalPages > 1 && (
          <div className="pagination">
            <button 
              disabled={pagination.page === 1}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            >
              上一页
            </button>
            <span>第 {pagination.page} / {totalPages} 页</span>
            <button 
              disabled={pagination.page === totalPages}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            >
              下一页
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
