import { useState, useEffect, useRef, useCallback } from 'react';
import { recommendationApi, RecommendedPost, LLMModel } from '../services/recommendationApi';
import { userLlmApi, UserLLMConfig } from '../services/userLlmApi';
import { useLanguage } from '../contexts/LanguageContext';
import { useLoading } from '../contexts/LoadingContext';
import { UserLLMManager } from '../components/UserLLMManager';

// 扩展接口以包含反馈相关字段
interface PostWithFeedback extends RecommendedPost {
  isShown?: boolean;
}

// AI推荐结果缓存（避免重复调用API消耗Token）
interface AICache {
  posts: PostWithFeedback[];
  aiReason: string;
  timestamp: number;
  model: string;
}

// 缓存有效期：30分钟
const CACHE_DURATION = 30 * 60 * 1000;

interface RecommendedPostsProps {
  onViewArticle?: (id: number) => void;
}

export function RecommendedPosts({ onViewArticle }: RecommendedPostsProps) {
  const [posts, setPosts] = useState<PostWithFeedback[]>([]);
  const [algorithm, setAlgorithm] = useState<'ai' | 'hybrid' | 'popular' | 'collaborative' | 'content'>('popular');
  const [aiReason, setAiReason] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();
  const { setLoading: setGlobalLoading } = useLoading();

  // 检查是否登录 - 使用state确保响应式更新
  const [isAuthenticated, setIsAuthenticated] = useState(!!sessionStorage.getItem('access_token'));
  
  // 监听登录状态变化
  useEffect(() => {
    const checkAuth = () => {
      setIsAuthenticated(!!sessionStorage.getItem('access_token'));
    };
    
    // 初始检查
    checkAuth();
    
    // 监听storage事件
    window.addEventListener('storage', checkAuth);
    
    // 每秒检查一次
    const interval = setInterval(checkAuth, 1000);
    
    return () => {
      window.removeEventListener('storage', checkAuth);
      clearInterval(interval);
    };
  }, []);

  // 用于追踪已展示的文章（判断跳过）
  const shownPostsRef = useRef<Set<number>>(new Set());
  const postsRef = useRef<PostWithFeedback[]>([]);

  // AI推荐结果缓存
  const aiCacheRef = useRef<AICache | null>(null);

  // AI模型选择相关状态
  const [availableModels, setAvailableModels] = useState<LLMModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('deepseek');
  const [showModelSelector, setShowModelSelector] = useState(false);
  
  // 用户自定义模型管理
  const [showLLMManager, setShowLLMManager] = useState(false);
  const [userConfigs, setUserConfigs] = useState<UserLLMConfig[]>([]);

  useEffect(() => {
    fetchRecommendedPosts();
  }, [algorithm, selectedModel]);

  // 加载可用AI模型列表（包含用户自定义模型）- 只在组件挂载时加载一次
  useEffect(() => {
    const loadAvailableModels = async () => {
      try {
        const models = await recommendationApi.getAvailableLLMs();
        setAvailableModels(models);
        // 如果当前选择的模型不在可用列表中，选择第一个可用的
        if (models.length > 0 && !models.find(m => m.id === selectedModel)) {
          setSelectedModel(models[0].id);
        }
      } catch (err) {
        console.error('加载可用模型列表失败:', err);
      }
    };
    loadAvailableModels();
  }, []); // 只在挂载时加载

  // 加载用户自定义模型配置
  useEffect(() => {
    const loadUserConfigs = async () => {
      const token = sessionStorage.getItem('access_token');
      if (!token) {
        setUserConfigs([]);
        return;
      }
      try {
        const configs = await userLlmApi.getUserLLMConfigs();
        setUserConfigs(configs);
      } catch (err) {
        console.error('加载用户模型配置失败:', err);
      }
    };
    loadUserConfigs();
  }, []); // 只在挂载时加载

  // 更新 ref
  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  const fetchRecommendedPosts = useCallback(async () => {
    try {
      setLoading(true);
      setGlobalLoading(true, t('recommendation.loading'));
      
      // 每次调用时重新检查登录状态
      const token = sessionStorage.getItem('access_token');
      const hasAuth = !!token;

      // 检查AI推荐缓存（包括模型信息）
      if (algorithm === 'ai' && aiCacheRef.current) {
        const now = Date.now();
        const cacheAge = now - aiCacheRef.current.timestamp;

        // 缓存有效且模型相同，直接使用缓存
        if (cacheAge < CACHE_DURATION && aiCacheRef.current.model === selectedModel) {
          console.log('使用AI推荐缓存，避免重复调用API');
          setPosts(aiCacheRef.current.posts);
          setAiReason(aiCacheRef.current.aiReason);

          // 记录推荐展示（用于反馈闭环）
          if (hasAuth) {
            aiCacheRef.current.posts.forEach(post => {
              recommendationApi.recordRecommendationShow(
                post.id,
                algorithm,
                aiCacheRef.current?.aiReason
              ).catch(err => console.log('记录展示失败:', err));
            });
          }

          setLoading(false);
          setGlobalLoading(false);
          return;
        } else {
          console.log('AI推荐缓存已过期或模型已更改，重新获取');
          aiCacheRef.current = null;
        }
      }

      // 清空已展示记录
      shownPostsRef.current.clear();

      const response = await recommendationApi.getRecommendedPosts({
        algorithm,
        limit: 12,
        model: selectedModel  // 传递选择的AI模型
      });
      
      const newPosts = response.items || [];
      const newAiReason = response.ai_reason || '';
      
      setPosts(newPosts);
      setAiReason(newAiReason);
      
      // 缓存AI推荐结果
      if (algorithm === 'ai') {
        aiCacheRef.current = {
          posts: newPosts,
          aiReason: newAiReason,
          timestamp: Date.now(),
          model: selectedModel
        };
      }
      
      // 记录推荐展示（用于反馈闭环）
      if (hasAuth && response.items) {
        response.items.forEach(post => {
          recommendationApi.recordRecommendationShow(
            post.id, 
            algorithm,
            response.ai_reason
          ).catch(err => console.log('记录展示失败:', err));
        });
      }
    } catch (error) {
      console.error(t('recommendation.loading'), error);
    } finally {
      setLoading(false);
      setGlobalLoading(false);
    }
  }, [algorithm, selectedModel, t, setGlobalLoading]);

  const handlePostClick = async (postId: number, e: React.MouseEvent) => {
    e.preventDefault();
    
    const token = sessionStorage.getItem('access_token');
    if (!token) return;
    
    shownPostsRef.current.add(postId);
    
    try {
      await recommendationApi.recordRecommendationClick(postId, algorithm);
    } catch (err) {
      console.log('记录点击反馈失败:', err);
    }
    
    onViewArticle?.(postId);
  };

  // 处理跳过检测（当组件卸载或切换算法时）
  useEffect(() => {
    return () => {
      // 组件卸载时，记录跳过的文章
      const token = sessionStorage.getItem('access_token');
      if (token && postsRef.current.length > 0) {
        postsRef.current.forEach(post => {
          // 如果文章被展示过但没有被点击，则记录为跳过
          if (!shownPostsRef.current.has(post.id)) {
            recommendationApi.recordRecommendationSkip(post.id, algorithm)
              .catch(err => console.log('记录跳过失败:', err));
          }
        });
      }
    };
  }, [algorithm]);

  // 手动刷新AI推荐（清除缓存）
  const handleRefreshAI = async () => {
    aiCacheRef.current = null;
    await fetchRecommendedPosts();
  };

  const getAlgorithmLabel = (algo: string) => {
    const labels: Record<string, string> = {
      ai: t('recommendation.ai'),
      hybrid: t('recommendation.hybrid'),
      popular: t('recommendation.popular'),
      collaborative: t('recommendation.collaborative'),
      content: t('recommendation.content')
    };
    return labels[algo] || algo;
  };

  // 获取缓存状态提示
  const getCacheStatus = () => {
    if (algorithm !== 'ai') return null;
    if (!aiCacheRef.current) return null;
    
    const cacheAge = Date.now() - aiCacheRef.current.timestamp;
    const minutesLeft = Math.ceil((CACHE_DURATION - cacheAge) / 60000);
    
    if (minutesLeft > 0) {
      return t('recommendation.cache_left').replace('{minutes}', String(minutesLeft));
    }
    return null;
  };

  return (
    <div className="recommended-posts-page">
      <div className="page-header">
        <h1>{t('recommendation.title')}</h1>
        <p>{t('recommendation.subtitle')}</p>
      </div>

      {/* 推荐方式选择：AI智能推荐 + 热门推荐 */}
      <div className="algorithm-selector">
        <div className="algorithm-buttons">
          <button
            className={`algorithm-btn ${algorithm === 'ai' ? 'active' : ''}`}
            onClick={() => setAlgorithm('ai')}
            disabled={!isAuthenticated}
          >
            🤖 {t('recommendation.ai')}
            {!isAuthenticated && <span className="login-required">({t('common.login')})</span>}
          </button>
          <button
            className={`algorithm-btn ${algorithm === 'popular' ? 'active' : ''}`}
            onClick={() => setAlgorithm('popular')}
          >
            🔥 热门推荐
          </button>
        </div>
        
        {/* AI推荐刷新按钮 - 仅在AI模式下显示 */}
        {algorithm === 'ai' && (
          <button 
            className="refresh-btn"
            onClick={handleRefreshAI}
            title={t('recommendation.refresh_title')}
          >
            🔄 {t('recommendation.refresh')}
          </button>
        )}
      </div>

      {/* AI模型选择器 */}
      {algorithm === 'ai' && availableModels.length > 0 && (
        <div className="model-selector">
          <span className="model-label">{t('recommendation.ai_model')}：</span>
          <div className="model-dropdown">
            <button
              className="model-select-btn"
              onClick={() => setShowModelSelector(!showModelSelector)}
            >
              {(() => {
                const model = availableModels.find(m => m.id === selectedModel);
                if (model?.logo_url) {
                  return <img src={model.logo_url} alt="" className="model-logo" />;
                }
                return <span className="model-icon-default">🤖</span>;
              })()}
              <span className="model-name">
                {availableModels.find(m => m.id === selectedModel)?.name || selectedModel}
              </span>
              <span className="dropdown-arrow">{showModelSelector ? '▲' : '▼'}</span>
            </button>
            {showModelSelector && (
              <div className="model-options">
                {/* 系统预设模型 */}
                {availableModels.filter(m => m.type === 'system' || !m.is_user_config).map(model => (
                  <button
                    key={model.id}
                    className={`model-option ${selectedModel === model.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedModel(model.id);
                      setShowModelSelector(false);
                    }}
                  >
                    {model.logo_url ? (
                      <img src={model.logo_url} alt="" className="model-logo" />
                    ) : (
                      <span className="model-icon">🤖</span>
                    )}
                    <div className="model-info">
                      <span className="model-name">{model.name}</span>
                      <span className="model-desc">{model.description}</span>
                    </div>
                  </button>
                ))}
                
                {/* 分隔线 */}
                {availableModels.some(m => m.is_user_config) && (
                  <div className="model-divider">
                    <span>我的自定义模型</span>
                  </div>
                )}
                
                {/* 用户自定义模型 */}
                {availableModels.filter(m => m.is_user_config).map(model => (
                  <button
                    key={model.id}
                    className={`model-option user-model ${selectedModel === model.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedModel(model.id);
                      setShowModelSelector(false);
                    }}
                  >
                    {model.logo_url ? (
                      <img src={model.logo_url} alt="" className="model-logo" />
                    ) : (
                      <span className="model-icon">🤖</span>
                    )}
                    <div className="model-info">
                      <span className="model-name">
                        {model.name}
                        {!model.is_verified && <span className="unverified-badge">未验证</span>}
                      </span>
                      <span className="model-desc">{model.description}</span>
                    </div>
                  </button>
                ))}
                
                {/* 管理按钮 */}
                {isAuthenticated && (
                  <button
                    className="model-option manage-models"
                    onClick={() => {
                      setShowModelSelector(false);
                      setShowLLMManager(true);
                    }}
                  >
                    <span className="model-icon">⚙️</span>
                    <div className="model-info">
                      <span className="model-name">管理自定义模型</span>
                      <span className="model-desc">添加 Gemini、GPT-4 等模型</span>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI 推荐理由 */}
      {algorithm === 'ai' && aiReason && (
        <div className="ai-reason-box">
          <span className="ai-icon">🤖</span>
          <span className="ai-text">{aiReason}</span>
        </div>
      )}

      {/* 缓存状态提示 */}
      {algorithm === 'ai' && getCacheStatus() && (
        <div className="cache-status">
          <span className="cache-icon">💾</span>
          <span className="cache-text">{getCacheStatus()}</span>
          <span className="cache-hint">{t('recommendation.cache_hint')}</span>
        </div>
      )}

      {/* 反馈提示 */}
      {isAuthenticated && algorithm === 'ai' && (
        <div className="feedback-hint">
          <span className="hint-icon">💡</span>
          <span className="hint-text">{t('recommendation.feedback_hint')}</span>
        </div>
      )}

      {/* 用户自定义模型管理弹窗 */}
      <UserLLMManager
        isOpen={showLLMManager}
        onClose={() => setShowLLMManager(false)}
        onConfigChange={() => {
          // 刷新模型列表
          const loadAvailableModels = async () => {
            try {
              const models = await recommendationApi.getAvailableLLMs();
              setAvailableModels(models);
            } catch (err) {
              console.error('刷新模型列表失败:', err);
            }
          };
          loadAvailableModels();
        }}
      />

      {/* 文章列表 */}
      {loading ? (
        <div className="loading">{t('recommendation.loading')}</div>
      ) : posts.length === 0 ? (
        <div className="empty-state">
          <p>{t('recommendation.no_posts')}</p>
          <p>{t('recommendation.subtitle')}</p>
        </div>
      ) : (
        <div className="posts-grid">
          {posts.map((post) => (
            <article key={post.id} className="post-card">
              <a 
                href={`#/article/${post.id}`} 
                className="post-link"
                onClick={(e) => handlePostClick(post.id, e)}
              >
                <div className="post-cover">
                  {post.cover_image ? (
                    <img src={post.cover_image} alt={post.title} />
                  ) : (
                    <div className="cover-placeholder">
                      <span>{post.category_name || t('article.status.published')}</span>
                    </div>
                  )}
                </div>
                <div className="post-content">
                  <h3 className="post-title">{post.title}</h3>
                  <p className="post-excerpt">{post.excerpt}</p>
                  <div className="post-meta">
                    <span className="author">
                      {post.author_nickname || post.author_username || t('comment.anonymous_user')}
                    </span>
                    <span className="views">👁 {post.view_count}</span>
                    <span className="category">{post.category_name}</span>
                  </div>
                </div>
              </a>
            </article>
          ))}
        </div>
      )}

      <style>{`
        .recommended-posts-page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }

        .page-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .page-header h1 {
          font-size: 2rem;
          color: #333;
          margin-bottom: 10px;
        }

        .page-header p {
          color: #666;
        }

        .algorithm-selector {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 30px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
          flex-wrap: wrap;
        }

        .algorithm-buttons {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .algorithm-btn {
          padding: 8px 16px;
          border: 1px solid #ddd;
          border-radius: 20px;
          background: white;
          cursor: pointer;
          transition: all 0.3s;
        }

        .algorithm-btn:hover:not(:disabled) {
          border-color: #333333;
          color: #333333;
        }

        .algorithm-btn.active {
          background: #333333;
          color: white;
          border-color: #333333;
        }

        .algorithm-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .login-required {
          font-size: 0.8em;
          color: #999;
          margin-left: 5px;
        }

        .refresh-btn {
          padding: 8px 16px;
          border: 1px solid #28a745;
          border-radius: 20px;
          background: white;
          color: #28a745;
          cursor: pointer;
          transition: all 0.3s;
          margin-left: auto;
        }

        .refresh-btn:hover {
          background: #28a745;
          color: white;
        }

        .model-selector {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
          padding: 15px 20px;
          background: #f8f9fa;
          border-radius: 8px;
          border: 1px solid #e9ecef;
        }

        .model-label {
          font-weight: 500;
          color: #495057;
          white-space: nowrap;
        }

        .model-dropdown {
          position: relative;
          flex: 1;
        }

        .model-select-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: white;
          border: 1px solid #dee2e6;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.95rem;
          color: #333;
          transition: all 0.2s;
          width: 100%;
          justify-content: flex-start;
        }

        .model-select-btn:hover {
          border-color: #333333;
          background: #f8f9fa;
        }

        .model-select-btn .model-name {
          flex: 1;
          text-align: left;
        }

        .dropdown-arrow {
          color: #6c757d;
          font-size: 0.8rem;
        }

        .model-options {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          margin-top: 4px;
          background: white;
          border: 1px solid #dee2e6;
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 100;
          max-height: 400px;
          overflow-y: auto;
        }

        .model-divider {
          padding: 8px 16px;
          background: #f8f9fa;
          border-top: 1px solid #e9ecef;
          border-bottom: 1px solid #e9ecef;
          font-size: 0.8rem;
          color: #6c757d;
          font-weight: 500;
        }

        .model-option.user-model {
          background: #f8f9fa;
        }

        .model-option.user-model:hover {
          background: #e9ecef;
        }

        .unverified-badge {
          display: inline-block;
          margin-left: 8px;
          padding: 2px 6px;
          background: #fff3cd;
          color: #856404;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: normal;
        }

        .model-option.manage-models {
          border-top: 2px dashed #dee2e6;
          background: #f8f9fa;
          color: #495057;
        }

        .model-option.manage-models:hover {
          background: #e9ecef;
        }

        .model-option {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: white;
          border: none;
          border-bottom: 1px solid #f1f3f5;
          cursor: pointer;
          width: 100%;
          text-align: left;
          transition: background 0.2s;
        }

        .model-option:last-child {
          border-bottom: none;
        }

        .model-option:hover {
          background: #f8f9fa;
        }

        .model-option.active {
          background: #e9ecef;
          border-left: 3px solid #333333;
        }

        .model-icon {
          font-size: 1.5rem;
          width: 32px;
          text-align: center;
        }

        .model-logo {
          width: 24px;
          height: 24px;
          object-fit: contain;
        }

        .model-icon-default {
          font-size: 1.2rem;
        }

        .model-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .model-info .model-name {
          font-weight: 500;
          color: #333;
        }

        .model-info .model-desc {
          font-size: 0.85rem;
          color: #6c757d;
        }

        .ai-reason-box {
          background: linear-gradient(135deg, #444444 0%, #222222 100%);
          color: white;
          padding: 15px 20px;
          border-radius: 8px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .ai-icon {
          font-size: 1.5rem;
        }

        .ai-text {
          font-size: 0.95rem;
          line-height: 1.5;
        }

        .cache-status {
          background: #d4edda;
          border: 1px solid #c3e6cb;
          padding: 10px 16px;
          margin-bottom: 15px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.9rem;
          color: #155724;
        }

        .cache-icon {
          font-size: 1rem;
        }

        .cache-hint {
          color: #6c757d;
          font-size: 0.85rem;
          margin-left: auto;
        }

        .feedback-hint {
          background: #e8f4f8;
          border-left: 4px solid #17a2b8;
          padding: 12px 16px;
          margin-bottom: 20px;
          border-radius: 4px;
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }

        .hint-icon {
          font-size: 1.2rem;
        }

        .hint-text {
          font-size: 0.9rem;
          color: #0c5460;
          line-height: 1.5;
        }

        .posts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }

        .post-card {
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          transition: transform 0.3s, box-shadow 0.3s;
        }

        .post-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        }

        .post-link {
          text-decoration: none;
          color: inherit;
          display: block;
        }

        .post-cover {
          height: 180px;
          overflow: hidden;
          background: #f0f0f0;
        }

        .post-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .cover-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #444444 0%, #222222 100%);
          color: white;
          font-size: 1.2rem;
        }

        .post-content {
          padding: 15px;
        }

        .post-title {
          font-size: 1.1rem;
          margin-bottom: 10px;
          color: #333;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .post-excerpt {
          color: #666;
          font-size: 0.9rem;
          line-height: 1.5;
          margin-bottom: 15px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .post-meta {
          display: flex;
          gap: 15px;
          font-size: 0.85rem;
          color: #999;
        }

        .post-meta .category {
          color: #333333;
        }

        .loading, .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #666;
        }

        .empty-state p {
          margin: 10px 0;
        }
      `}</style>
    </div>
  );
}
