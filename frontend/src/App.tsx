import { useState, useEffect, useRef } from 'react'
import { ArticleList } from './pages/ArticleList'
import { ArticleEditor } from './pages/ArticleEditor'
import { ArticleDetail } from './pages/ArticleDetail'
import { CategoryManagement } from './pages/CategoryManagement'
import { PublicArticleList } from './pages/PublicArticleList'
import { RecommendedPosts } from './pages/RecommendedPosts'
import { GuestHome } from './pages/GuestHome'
import { Profile } from './pages/Profile'
import { AdminDashboard } from './pages/AdminDashboard'
import Friends from './pages/Friends'
import Chat from './pages/Chat'
import { authApi } from './services/api';
// import { messageApi } from './services/socialApi';
import { postApi, PostListItem } from './services/postApi';
import { categoryApi, Category } from './services/categoryApi';
import { useLoading } from './contexts/LoadingContext'
import './styles/animations.css'
import './styles/App.css'
import { LanguageProvider, useLanguage } from './contexts/LanguageContext'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import Cropper from 'react-easy-crop'

import { NotificationCenter } from './components/NotificationCenter'
import { Footer } from './components/Footer'

interface User {
  id: number;
  username: string;
  email: string;
  nickname?: string;
  avatar?: string; // 新增头像字段
  created_at: string;
}



function AppContent() {
  const [showPublicArticlesModal, setShowPublicArticlesModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showUserInfoModal, setShowUserInfoModal] = useState(false);
  const [currentPage, setCurrentPage] = useState<'home' | 'articles' | 'article-editor' | 'categories' | 'article-detail' | 'profile' | 'friends' | 'chat' | 'recommended'>('home');
  const [isChatOpening, setIsChatOpening] = useState(false);
  const [editingArticleId, setEditingArticleId] = useState<number | undefined>();
  const [viewingArticleId, setViewingArticleId] = useState<number | undefined>(); // 新增：用于查看文章详情
  const [previousPage, setPreviousPage] = useState<typeof currentPage>('home'); // 记录进入文章详情前的页面
  const [returnToModal, setReturnToModal] = useState(false); // 返回时是否重新打开弹窗
  const [viewingCategoryId, setViewingCategoryId] = useState<number | undefined>();
  const [activeNav, setActiveNav] = useState<'home' | 'articles' | 'categories'>('home');

  
  // 文章数据状态
  const [latestArticles, setLatestArticles] = useState<PostListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // 图片裁剪相关状态
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);  
  // 语言上下文
  const { t, language, setLanguage } = useLanguage();
  // 主题上下文
  const { theme, toggleTheme } = useTheme();
  
  // 用户信息状态
  const [userInfo, setUserInfo] = useState<User | null>(null);
  
  // 使用全局加载上下文
  const { setLoading } = useLoading();
  
  // 表单数据状态
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '', confirmPassword: '', nickname: '' });
  
  // 昵称编辑状态
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [editingNickname, setEditingNickname] = useState('');
  
  // 书架滚动引用
  const bookshelfRef = useRef<HTMLDivElement>(null);

  // 书架滚动函数
  const scrollBookshelf = (direction: 'left' | 'right') => {
    if (bookshelfRef.current) {
      const scrollAmount = 600; // 滚动距离
      bookshelfRef.current.scrollBy({
        left: direction === 'right' ? scrollAmount : -scrollAmount,
        behavior: 'smooth'
      });
    }
  };
  
  // 错误状态
  const [error, setError] = useState('');
  
  // 检查会话存储，实现会话内保持登录
  useEffect(() => {
    const token = sessionStorage.getItem('access_token');
    const userStr = sessionStorage.getItem('user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as User;
        setUserInfo(user);
        setIsLoggedIn(true);
      } catch (err) {
        console.error('解析用户信息失败:', err);
        // 清除无效的用户信息
        sessionStorage.removeItem('access_token');
        sessionStorage.removeItem('user');
      }
    } else {
      // 未登录时，强制使用中文
      setLanguage('zh');
    }
  }, []);

  // 监听 URL hash 变化，处理路由
  useEffect(() => {
    const handleHashChange = () => {
      // 保存当前滚动位置
      const scrollY = window.scrollY;
      
      const hash = window.location.hash;
      if (hash.startsWith('#/chat/')) {
        setIsChatOpening(true);
        setTimeout(() => {
          setCurrentPage('chat');
          // 恢复滚动位置
          window.scrollTo(0, scrollY);
        }, 300);
      } else if (hash.startsWith('#/friends')) {
        setIsChatOpening(false);
        setCurrentPage('friends');
        // 恢复滚动位置
        window.scrollTo(0, scrollY);
      } else {
        setIsChatOpening(false);
      }
    };

    // 初始检查
    handleHashChange();

    // 监听 hash 变化
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isLoggedIn]);

  // 监听登录状态变化，未登录时强制中文
  // useEffect(() => {
  //   if (!isLoggedIn) {
  //     // 再次检查是否有token，防止在初始化过程中覆盖语言设置
  //     const token = sessionStorage.getItem('access_token');
  //     if (!token) {
  //       setLanguage('zh');
  //     }
  //   }
  // }, [isLoggedIn, setLanguage]);

  // WebSocket连接管理
  useEffect(() => {
    if (!isLoggedIn) return;

    const token = sessionStorage.getItem('access_token');
    const userStr = sessionStorage.getItem('user');
    if (!token || !userStr) return;

    const user = JSON.parse(userStr);
    let websocket: WebSocket | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectDelay = 3000; // 3秒

    const connectWebSocket = () => {
      const wsUrl = `ws://localhost:8000/ws/chat/${user.id}?token=${token}`;
      websocket = new WebSocket(wsUrl);

      websocket.onopen = () => {
        console.log('WebSocket连接已建立');
        reconnectAttempts = 0;
        // 连接建立后立即发送ping消息
        websocket!.send('ping');
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_notification') {
            // 处理新通知
            console.log('收到新通知:', data.notification);
            // 触发自定义事件，通知NotificationCenter组件
            window.dispatchEvent(new CustomEvent('websocketMessage', { detail: data }));
          } else if (data.type === 'new_comment') {
            // 处理新评论
            console.log('收到新评论:', data.comment);
            // 触发自定义事件
            window.dispatchEvent(new CustomEvent('websocketMessage', { detail: data }));
          } else if (data.type === 'new_message') {
            // 处理新消息（聊天功能）
            console.log('收到新消息:', data.message);
            // 触发自定义事件，通知NotificationCenter组件
            window.dispatchEvent(new CustomEvent('websocketMessage', { detail: data }));
          } else if (data.type === 'new_friend_request') {
            // 处理好友请求
            console.log('收到好友请求:', data.request);
            // 触发自定义事件，通知NotificationCenter组件
            window.dispatchEvent(new CustomEvent('websocketMessage', { detail: data }));
          } else if (data.type === 'pong') {
            // 心跳响应，不需要处理
          }
        } catch (error) {
          console.error('WebSocket消息解析失败:', error);
        }
      };

      websocket.onerror = (error) => {
        console.error('WebSocket错误:', error);
      };

      websocket.onclose = () => {
        console.log('WebSocket连接已关闭');
        
        // 自动重连
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          console.log(`尝试重新连接WebSocket... (${reconnectAttempts}/${maxReconnectAttempts})`);
          setTimeout(connectWebSocket, reconnectDelay);
        } else {
          console.error('WebSocket重连失败，已达到最大尝试次数');
        }
      };
    };

    // 初始连接
    connectWebSocket();

    // 心跳检测
    const heartbeatInterval = setInterval(() => {
      if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send('ping');
      }
    }, 10000);

    // 清理函数
    return () => {
      clearInterval(heartbeatInterval);
      if (websocket && (websocket.readyState === WebSocket.OPEN || websocket.readyState === WebSocket.CONNECTING)) {
        websocket.close();
      }
    };
  }, [isLoggedIn]);
  
  // 获取当前用户信息
  const fetchCurrentUser = async () => {
    try {
      setLoading(true, '加载用户信息中...');
      const user = await authApi.getCurrentUser();
      setUserInfo(user);
      // 更新sessionStorage中的用户信息
      sessionStorage.setItem('user', JSON.stringify(user));
    } catch (err) {
      console.error('获取用户信息失败:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // 当用户信息模态框打开时，获取最新的用户信息
  useEffect(() => {
    if (showUserInfoModal && isLoggedIn) {
      fetchCurrentUser();
    }
  }, [showUserInfoModal, isLoggedIn]);
  
  // 获取最新文章数据
  const fetchLatestArticles = async () => {
    try {
      setLoading(true, '加载文章数据...');
      // 首页显示所有用户的公开文章，而不是仅显示当前用户的文章
      const response = await postApi.getPublicList({ size: 100 });
      setLatestArticles(response.items);
    } catch (err) {
      console.error('获取文章数据失败:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // 获取分类数据
  const fetchCategories = async () => {
    try {
      setLoading(true, '加载分类数据...');
      const response = await categoryApi.getList();
      setCategories(response);
    } catch (err) {
      console.error('获取分类数据失败:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // 当登录状态变化时，获取文章和分类数据
  useEffect(() => {
    if (isLoggedIn) {
      // 先获取分类数据，再获取文章数据
      fetchCategories().then(() => {
        return fetchLatestArticles();
      });
    }
  }, [isLoggedIn]);

  // 处理登录
  const handleLogin = async () => {
    if (!loginForm.username || !loginForm.password) {
      setError('请填写所有必填字段');
      return;
    }
    
    setLoading(true, '登录中...');
    setError('');
    
    try {
      const response = await authApi.login(loginForm.username, loginForm.password);
      // 保存令牌和用户信息到会话存储
      sessionStorage.setItem('access_token', response.access_token);
      sessionStorage.setItem('user', JSON.stringify(response.user));
      
      // 设置用户信息状态
      setUserInfo(response.user);
      setIsLoggedIn(true);
      setShowLoginModal(false);
      setLoginForm({ username: '', password: '' });
    } catch (err: any) {
      // 处理不同类型的错误响应，确保显示中文错误信息
      let errorMessage = '登录失败，请检查用户名和密码';
      
      console.error('登录错误详情:', err);
      
      if (err.response) {
        // 服务器返回了错误响应
        if (err.response.status === 401) {
          // 401错误通常是用户名或密码错误
          errorMessage = '用户名或密码错误，请重新输入';
        } else if (err.response.data?.detail) {
          const detail = err.response.data.detail;
          if (typeof detail === 'string') {
            // 字符串类型的错误信息
            errorMessage = detail;
          } else if (Array.isArray(detail)) {
            // 数组类型的错误信息，通常是Pydantic验证错误
            errorMessage = detail.map((err: any) => err.msg).join('; ');
          } else if (typeof detail === 'object') {
            // 对象类型的错误信息
            errorMessage = detail.msg || '登录数据验证失败';
          }
        } else {
          errorMessage = `登录失败，服务器返回错误 ${err.response.status}`;
        }
      } else if (err.request) {
        // 请求已发送但没有收到响应
        errorMessage = '登录失败，无法连接到服务器，请检查网络连接';
      } else {
        // 请求配置错误
        errorMessage = `登录失败，请求错误: ${err.message}`;
      }
      
      // 确保显示中文错误信息，避免显示英文错误
      if (!/[\u4e00-\u9fa5]/.test(errorMessage)) {
        errorMessage = '登录失败，请检查用户名和密码';
      }
      
      setError(errorMessage);
      // 保持登录窗口打开，不跳转到主页
      // setShowLoginModal(true); // 不需要，因为只有成功登录才会关闭模态框
    } finally {
      setLoading(false);
    }
  };

  // 处理注册
  const handleRegister = async () => {
    // 表单验证
    if (!registerForm.username || !registerForm.email || !registerForm.password || !registerForm.confirmPassword) {
      setError('请填写所有必填字段');
      return;
    }
    
    // 密码确认验证
    if (registerForm.password !== registerForm.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    
    setLoading(true, '注册中...');
    setError('');
    
    try {
      // 注册成功后跳转到登录页面
      await authApi.register(
        registerForm.username, 
        registerForm.email, 
        registerForm.password, 
        registerForm.nickname
      );
      
      // 注册成功，显示成功信息并跳转到登录页
      setError('注册成功，请使用您的账号登录');
      setActiveTab('login');
      setRegisterForm({ username: '', email: '', password: '', confirmPassword: '', nickname: '' });
    } catch (err: any) {
      // 处理不同类型的错误响应
      let errorMessage = '注册失败，请稍后重试';
      
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (typeof detail === 'string') {
          // 字符串类型的错误信息
          errorMessage = detail;
        } else if (Array.isArray(detail)) {
          // 数组类型的错误信息，通常是Pydantic验证错误
          errorMessage = detail.map((err: any) => err.msg).join('; ');
        } else if (typeof detail === 'object') {
          // 对象类型的错误信息
          errorMessage = detail.msg || '注册数据验证失败';
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 处理登出
  const handleLogout = () => {
    // 清除会话存储
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('user');
    
    setIsLoggedIn(false);
    setShowUserInfoModal(false);
    setCurrentPage('home');
    setEditingArticleId(undefined);
  };

  // 导航到文章列表
  const navigateToArticles = (categoryId?: number) => {
    setCurrentPage('articles');
    setActiveNav('articles');
    setViewingCategoryId(categoryId); // 设置当前查看的分类ID
    // 清除 URL hash
    window.history.pushState("", document.title, window.location.pathname + window.location.search);
  };

  // 导航到首页
  const navigateToHome = () => {
    setCurrentPage('home');
    setActiveNav('home');
    setViewingCategoryId(undefined);
    // 清除 URL hash
    window.history.pushState("", document.title, window.location.pathname + window.location.search);
  };

  // 导航到创建文章
  const navigateToCreateArticle = () => {
    setEditingArticleId(undefined);
    setCurrentPage('article-editor');
    setViewingCategoryId(undefined);
  };

  // 导航到编辑文章
  const navigateToEditArticle = (id: number) => {
    setEditingArticleId(id);
    setCurrentPage('article-editor');
    setViewingCategoryId(undefined);
  };

  // 从编辑页返回
  const handleBackFromEditor = () => {
    setEditingArticleId(undefined);
    setCurrentPage('articles');
    // 保持 viewingCategoryId 不变，这样返回时可以回到之前的分类
  };

  // 导航到分类管理
  const navigateToCategories = () => {
    setCurrentPage('categories');
    setActiveNav('categories');
    setViewingCategoryId(undefined);
    // 清除 URL hash
    window.history.pushState("", document.title, window.location.pathname + window.location.search);
  };

  // 导航到文章详情（公开查看）
  const navigateToArticleDetail = (id: number, fromModal: boolean = false) => {
    // 移除未登录用户的查看功能
    if (!isLoggedIn) return;
    // 记录进入文章详情前的页面
    setPreviousPage(currentPage);
    // 记录是否从弹窗进入
    setReturnToModal(fromModal);
    setViewingArticleId(id);
    setCurrentPage('article-detail');
  };

  // 从文章详情返回 - 返回到之前的页面
  const handleBackFromDetail = () => {
    setViewingArticleId(undefined);
    if (returnToModal) {
      // 从弹窗进入的，返回时重新打开弹窗
      setShowPublicArticlesModal(true);
      setCurrentPage('home');
    } else {
      // 返回到进入文章详情前的页面
      setCurrentPage(previousPage);
    }
    setReturnToModal(false);
  };

  // 导航到个人空间
  const navigateToProfile = () => {
    setCurrentPage('profile');
    setShowUserInfoModal(false);
    setViewingCategoryId(undefined);
    setActiveNav('home'); // Reset or keep current, doesn't matter much as it's not in top nav
    // 清除 URL hash
    window.history.pushState("", document.title, window.location.pathname + window.location.search);
  };

  // 处理头像上传
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 简单验证文件类型
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件');
      return;
    }

    // 限制文件大小 (2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('图片大小不能超过 2MB');
      return;
    }

    try {
      // 临时方案：将图片转换为Base64字符串存储
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setCropImage(base64String);
        setShowCropModal(true);
      };
      reader.readAsDataURL(file);
      
    } catch (err) {
      console.error('上传头像失败:', err);
      alert('上传头像失败');
    }
  };

  // 处理裁剪完成
  const handleCropComplete = (_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  // 处理确认裁剪
  const handleConfirmCrop = async () => {
    if (!cropImage || !croppedAreaPixels) return;

    try {
      // 创建一个canvas来裁剪图片
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const image = new Image();
      
      image.onload = async () => {
        canvas.width = croppedAreaPixels.width;
        canvas.height = croppedAreaPixels.height;
        
        ctx?.drawImage(
          image,
          croppedAreaPixels.x,
          croppedAreaPixels.y,
          croppedAreaPixels.width,
          croppedAreaPixels.height,
          0,
          0,
          croppedAreaPixels.width,
          croppedAreaPixels.height
        );
        
        // 将canvas转换为Blob并上传
        canvas.toBlob(async (blob) => {
          if (!blob) {
            console.error('Canvas to Blob conversion failed');
            alert('图片处理失败');
            return;
          }
          
          try {
            // 1. 上传图片
            const file = new File([blob], "avatar.png", { type: "image/png" });
            const uploadResult = await authApi.uploadImage(file);
            
            // 2. 更新用户信息
            const updatedUser = await authApi.updateCurrentUser({ avatar: uploadResult.url });
            
            setUserInfo(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
            alert('头像修改成功！');
            setShowCropModal(false);
            setCropImage(null);
            setCrop({ x: 0, y: 0 });
            setZoom(1);
            setCroppedAreaPixels(null);
          } catch (err) {
            console.error('更新头像失败:', err);
            alert('更新头像失败，请稍后重试');
          }
        }, 'image/png');
      };
      
      image.src = cropImage;
      
    } catch (err) {
      console.error('裁剪图片失败:', err);
      alert('裁剪图片失败，请稍后重试');
    }
  };

  // 处理更新昵称
  const handleUpdateNickname = async () => {
    try {
      setLoading(true, '更新昵称中...');
      const updatedUser = await authApi.updateCurrentUser({ nickname: editingNickname });
      setUserInfo(updatedUser);
      sessionStorage.setItem('user', JSON.stringify(updatedUser));
      setIsEditingNickname(false);
    } catch (err) {
      console.error('更新昵称失败:', err);
      alert('更新昵称失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 检查用户是否为管理员
  const isAdmin = userInfo?.role === 'admin' || userInfo?.role === 'superadmin';

  // 渲染主内容
  const renderMainContent = () => {
    // 如果是管理员，显示管理后台
    if (isAdmin) {
      return (
        <AdminDashboard 
          onLogout={handleLogout}
          onNavigateHome={navigateToHome}
        />
      );
    }

    switch (currentPage) {
      case 'articles':
        return (
          <ArticleList
            onNavigateToCreate={navigateToCreateArticle}
            onNavigateToEdit={navigateToEditArticle}
            initialCategoryId={viewingCategoryId} // 传递分类ID
          />
        );
      case 'article-editor':
        return (
          <ArticleEditor
            articleId={editingArticleId}
            onBack={handleBackFromEditor}
          />
        );
      case 'categories':
        return (
          <CategoryManagement 
            onViewCategory={(categoryId) => navigateToArticles(categoryId)}
          />
        );
      case 'article-detail':
        return viewingArticleId ? (
          <ArticleDetail 
            articleId={viewingArticleId} 
            onBack={handleBackFromDetail}
            isLoggedIn={isLoggedIn}
            currentUserId={userInfo?.id}
          />
        ) : null;
      case 'profile':
        return (
          <Profile 
            user={userInfo} 
            onNavigateToArticles={navigateToArticles} 
          />
        );
      case 'friends':
      case 'chat':
        return (
          <div className={`social-container ${isChatOpening ? 'chat-open' : ''}`}>
            <div className="friends-section">
              <Friends />
            </div>
            {(currentPage === 'chat' || isChatOpening) && (
              <div className="chat-section">
                <Chat />
              </div>
            )}
          </div>
        );
      case 'recommended':
        return <RecommendedPosts onViewArticle={(id) => navigateToArticleDetail(id)} />;
      case 'home':
        return (
          <div className="dashboard-home-bg" style={{
            minHeight: '100%',
            // 在暗黑模式下，可以考虑降低背景图亮度或者换一张图，这里简单使用遮罩层思路
            backgroundImage: theme === 'dark' 
              ? 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url(/background2.jpg)' 
              : 'url(/background2.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed',
            transition: 'background-image 0.3s'
          }}>
            <div className="dashboard-home" style={{
              padding: '40px 60px',
              maxWidth: '1400px',
              margin: '0 auto',
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif",
              color: 'var(--text-main)' // 使用变量
            }}>
            {/* Welcome Section */}
            <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <h1 style={{ 
                  fontSize: '2.5rem', 
                  fontWeight: '600', 
                  marginBottom: '10px',
                  letterSpacing: '-0.5px',
                  color: '#fff',
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                }}>
                  {t('dashboard.welcome_message')}, {userInfo?.nickname || userInfo?.username}
                </h1>
                <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '1.1rem', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                  {new Date().toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
            </div>

            {/* Stats Grid */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
              gap: '24px',
              marginBottom: '48px'
            }}>
              {/* Stat Card 1: Articles */}
              <div style={{
                background: 'var(--bg-card)', // 使用变量
                padding: '30px',
                borderRadius: '16px',
                boxShadow: 'var(--shadow-sm)', // 使用变量
                border: '1px solid var(--border-light)', // 使用变量
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'transform 0.2s',
                cursor: 'default'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('dashboard.total_articles')}</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{latestArticles.length}</div>
                </div>
                <div style={{ 
                  width: '60px', 
                  height: '60px', 
                  background: '#f8f9fa', 
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.8rem'
                }}>
                  📝
                </div>
              </div>

              {/* Stat Card 2: Views */}
              <div style={{
                background: 'var(--bg-card)',
                padding: '30px',
                borderRadius: '16px',
                boxShadow: 'var(--shadow-sm)',
                border: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'transform 0.2s',
                cursor: 'default'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('dashboard.total_views')}</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                    {latestArticles.reduce((acc, curr) => acc + (curr.view_count || 0), 0)}
                  </div>
                </div>
                <div style={{ 
                  width: '60px', 
                  height: '60px', 
                  background: '#f8f9fa', 
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.8rem'
                }}>
                  👁️
                </div>
              </div>
              
              {/* Stat Card 3: Categories */}
              <div style={{
                background: 'var(--bg-card)',
                padding: '30px',
                borderRadius: '16px',
                boxShadow: 'var(--shadow-sm)',
                border: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'transform 0.2s',
                cursor: 'default'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('dashboard.categories')}</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{categories.length}</div>
                </div>
                <div style={{ 
                  width: '60px', 
                  height: '60px', 
                  background: '#f8f9fa', 
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.8rem'
                }}>
                  🏷️
                </div>
              </div>
            </div>

            {/* Recent Articles (Bookshelf) */}
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: '600',
                  color: '#fff',
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                }}>{t('dashboard.recent_articles')}</h2>
                <button 
                  onClick={() => setShowPublicArticlesModal(true)}
                  style={{ 
                    background: 'rgba(255,255,255,0.2)',  
                    border: 'none', 
                    color: '#fff', 
                    cursor: 'pointer',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 12px',
                    borderRadius: '6px',
                    transition: 'all 0.2s',
                    backdropFilter: 'blur(5px)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.3)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {t('common.view_all')} →
                </button>
              </div>
              
              <div className="bookshelf-wrapper">
                {/* 左右导航按钮 */}
                <button 
                  className="bookshelf-nav-btn prev"
                  onClick={(e) => { e.stopPropagation(); scrollBookshelf('left'); }}
                  aria-label="Previous"
                >
                  ‹
                </button>
                <button 
                  className="bookshelf-nav-btn next"
                  onClick={(e) => { e.stopPropagation(); scrollBookshelf('right'); }}
                  aria-label="Next"
                >
                  ›
                </button>

                <div className="bookshelf-container" ref={bookshelfRef}>
                  {latestArticles.slice(0, 10).map(article => (
                    <div 
                      key={article.id} 
                      className="book-item"
                      onClick={() => navigateToArticleDetail(article.id)}
                    >
                      <div className="book-cover" style={{
                        backgroundColor: article.cover_image ? '#fff' : ['#f5f5f5', '#e8e8e8', '#d0d0d0', '#e0e0e0'][article.id % 4]
                      }}>
                        <div className="book-spine-effect"></div>
                        {article.cover_image ? (
                          <div style={{ height: '100%', width: '100%', position: 'relative' }}>
                            <img 
                              src={article.cover_image} 
                              alt={article.title} 
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                            />
                            <div style={{
                              position: 'absolute',
                              bottom: 0,
                              left: 0,
                              right: 0,
                              padding: '10px',
                              background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                              color: '#fff'
                            }}>
                              <div style={{ fontSize: '0.9rem', fontWeight: 'bold', lineHeight: '1.2' }}>{article.title}</div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ padding: '15px 10px 10px 15px', height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }}>
                              {article.title}
                            </div>
                            <div style={{ marginTop: 'auto', fontSize: '0.8rem', color: '#666' }}>
                              {new Date(article.created_at).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US')}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {latestArticles.length === 0 && (
                    <div style={{ padding: '40px', color: '#fff', textAlign: 'center', width: '100%' }}>
                      {t('dashboard.no_articles')}
                    </div>
                  )}
                </div>
                <div className="wood-shelf"></div>
              </div>
            </div>
          </div>
          </div>
        );
    }
  };

  // 如果已登录，显示主界面
  if (isLoggedIn) {
    return (
      <div className="main-container">
        {/* 顶部导航栏 */}
        <header className="top-nav">
          <div className="nav-left">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: '30px' }}>
              <img src="/logo.png" alt="Logo" style={{ width: '32px', height: '32px' }} />
              <span style={{ 
                fontFamily: '"Cormorant Garamond", "Noto Serif SC", serif',
                fontSize: '1.2rem',
                fontWeight: 'bold',
                color: 'var(--text-main)', // 改为使用变量
                letterSpacing: '0.1em'
              }}></span>
            </div>
            <nav className="main-nav">
              <ul>
                <li>
                  <a 
                    href="#" 
                    className={`nav-item ${activeNav === 'home' ? 'active' : ''}`}
                    onClick={(e) => { e.preventDefault(); navigateToHome(); }}
                  >
                    {t('nav.home')}
                  </a>
                </li>
                <li>
                  <a 
                    href="#" 
                    className={`nav-item ${activeNav === 'articles' ? 'active' : ''}`}
                    onClick={(e) => { e.preventDefault(); navigateToArticles(); }}
                  >
                    {t('nav.articles')}
                  </a>
                </li>
                <li>
                  <a 
                    href="#" 
                    className={`nav-item ${activeNav === 'categories' ? 'active' : ''}`}
                    onClick={(e) => { e.preventDefault(); navigateToCategories(); }}
                  >
                    {t('nav.categories')}
                  </a>
                </li>
                <li>
                  <a 
                    href="#" 
                    className={`nav-item ${currentPage === 'recommended' ? 'active' : ''}`}
                    onClick={(e) => { 
                      e.preventDefault(); 
                      setCurrentPage('recommended');
                      setActiveNav('home');
                    }}
                  >
                    {t('nav.recommended')}
                  </a>
                </li>

              </ul>
            </nav>
          </div>
          <div className="nav-right">
            {/* 页面标题 */}
            <div className="page-title">
              <h3>
                {currentPage === 'article-editor' ? 
                  (editingArticleId ? t('nav.edit_article') : t('nav.create_article')) : 
                  (currentPage === 'articles' ? t('article.list.title') : 
                  (currentPage === 'categories' ? t('category.title') : t('nav.welcome_back')))
                }
              </h3>
            </div>
            {/* 社交按钮 */}
            <a 
              href="#/friends" 
              className={`nav-item ${currentPage === 'friends' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setCurrentPage('friends'); }}
              style={{ marginRight: '20px', fontWeight: 'bold' }}
            >
              {t('nav.friends')}
            </a>
            {/* 个人头像 */}
            <div className="user-info" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div 
                className="avatar" 
                onClick={() => setShowUserInfoModal(!showUserInfoModal)}
              >
                {userInfo && userInfo.avatar ? (
                  <img src={userInfo.avatar} alt={userInfo.username} className="avatar-image-small" />
                ) : (
                  <span className="avatar-text">{userInfo ? userInfo.username.charAt(0).toUpperCase() : 'U'}</span>
                )}
              </div>

              {/* 消息中心 */}
              <NotificationCenter 
                onNavigateToArticle={(articleId) => {
                  setViewingArticleId(articleId);
                  setCurrentPage('article-detail');
                }} 
              />
              
              {/* 个人信息弹出框 */}
              {showUserInfoModal && userInfo && (
                <div className="user-info-modal">
                  <div className="user-info-header">
                    <h4>{t('user.info')}</h4>
                  </div>
                  <div className="user-info-content">
                    {/* 头像修改区域 */}
                    <div className="avatar-section">
                      <div className="current-avatar">
                        {userInfo.avatar ? (
                          <img src={userInfo.avatar} alt={userInfo.username} className="avatar-image" />
                        ) : (
                          <span className="avatar-text">{userInfo.username.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <label className="change-avatar-btn" style={{ cursor: 'pointer', display: 'inline-block' }} onClick={(e) => e.stopPropagation()}>
                        {t('user.change_avatar')}
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleAvatarUpload}
                          style={{ display: 'none' }}
                        />
                      </label>
                    </div>
                    
                    {/* 用户基本信息 */}
                    <div className="user-detail">
                      <span className="label">{t('user.username')}：</span>
                      <span className="value">{userInfo.username}</span>
                    </div>
                    <div className="user-detail">
                      <span className="label">{t('user.email')}：</span>
                      <span className="value">{userInfo.email}</span>
                    </div>
                    <div className="user-detail" style={{ alignItems: isEditingNickname ? 'flex-start' : 'center' }}>
                      <span className="label" style={{ marginTop: isEditingNickname ? '6px' : '0' }}>{t('user.nickname')}：</span>
                      {isEditingNickname ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                          <input 
                            type="text" 
                            value={editingNickname}
                            onChange={(e) => setEditingNickname(e.target.value)}
                            style={{ 
                              padding: '4px 8px', 
                              borderRadius: '4px', 
                              border: '1px solid #ccc',
                              width: '100%'
                            }}
                          />
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              onClick={handleUpdateNickname}
                              style={{ 
                                padding: '4px 8px', 
                                cursor: 'pointer',
                                backgroundColor: 'var(--primary)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '12px',
                                flex: 1
                              }}
                            >
                              {t('common.save')}
                            </button>
                            <button 
                              onClick={() => setIsEditingNickname(false)}
                              style={{ 
                                padding: '4px 8px', 
                                cursor: 'pointer',
                                backgroundColor: '#ccc',
                                color: '#333',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '12px',
                                flex: 1
                              }}
                            >
                              {t('common.cancel')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="value">{userInfo.nickname || t('user.no_nickname')}</span>
                          <button 
                            onClick={() => {
                              setEditingNickname(userInfo.nickname || '');
                              setIsEditingNickname(true);
                            }}
                            style={{ 
                              background: 'none', 
                              border: 'none', 
                              cursor: 'pointer',
                              fontSize: '14px',
                              opacity: 0.6
                            }}
                            title={t('common.edit')}
                          >
                            ✏️
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="user-detail">
                      <span className="label">{t('user.created_at')}：</span>
                      <span className="value">{new Date(userInfo.created_at).toLocaleDateString()}</span>
                    </div>
                    
                    {/* 社交链接 */}
                    <div style={{ marginTop: '16px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
                      {/* GitHub 图标 */}
                      <a 
                        href="https://github.com" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: '#f0f0f0',
                          color: '#333',
                          textDecoration: 'none',
                          fontSize: '20px',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e0e0e0'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                        title="GitHub"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                        </svg>
                      </a>
                      {/* Gitee 图标 */}
                      <a 
                        href="https://gitee.com" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: '#f0f0f0',
                          color: '#333333',
                          textDecoration: 'none',
                          fontSize: '20px',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e0e0e0'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                        title="Gitee"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                          <path d="M2 17l10 5 10-5"></path>
                          <path d="M2 12l10 5 10-5"></path>
                        </svg>
                      </a>
                    </div>
                    
                    <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                      <button 
                        onClick={navigateToProfile}
                        style={{
                          width: '100%',
                          padding: '10px',
                          backgroundColor: 'var(--primary)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          fontSize: '0.95rem'
                        }}
                      >
                        {t('user.profile')}
                      </button>
                    </div>
                  </div>
                  <div className="user-info-footer">
                    <button className="logout-btn" onClick={handleLogout}>
                      {t('common.logout')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 主内容区 */}
        <main className="content">

          {/* 主要内容 */}
          {renderMainContent()}
          
          {/* 固定在左下角的设置按钮 */}
          <button 
            className="settings-btn fixed-bottom-left" 
            onClick={() => setShowSettingsModal(true)}
            title={t('common.settings')}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '8px',
              lineHeight: 1,
              borderRadius: '50%',
              transition: 'transform 0.3s, background-color 0.3s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)';
              e.currentTarget.style.transform = 'rotate(90deg)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.transform = 'rotate(0deg)';
            }}
          >
            
          </button>
        </main>
        
        <Footer />

        {/* 公开文章列表弹窗 */}
        {showPublicArticlesModal && (
          <div className="modal-overlay" onClick={() => setShowPublicArticlesModal(false)} style={{ 
            position: 'fixed', 
            top: '60px', // 避开导航栏高度
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 900, // 确保在导航栏之下但在内容之上
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'flex-start', // 改为从顶部开始对齐
            justifyContent: 'center',
            padding: '0' // 移除内边距，让内容填满
          }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ 
              width: '100%', 
              height: '100%', 
              maxWidth: 'none',
              maxHeight: 'none',
              borderRadius: '0', // 移除圆角
              display: 'flex', 
              flexDirection: 'column', 
              padding: '0',
              overflow: 'hidden',
              border: 'none', // 移除边框
              boxShadow: 'none' // 移除阴影
            }}>
              <div className="modal-header" style={{ padding: '20px 40px', borderBottom: '1px solid #eee' }}>
                <h2>{t('public.latest')}</h2>
                <button 
                  className="close-btn" 
                  onClick={() => setShowPublicArticlesModal(false)}
                >
                  ×
                </button>
              </div>
              <div className="modal-body" style={{ flex: 1, overflow: 'auto', padding: '0' }}>
                <PublicArticleList 
                  viewMode="grid"
                  enableHoverEffect={false} // 禁用悬停特效
                  onNavigateToDetail={(id) => {
                    setShowPublicArticlesModal(false);
                    navigateToArticleDetail(id, true); // true 表示从弹窗进入
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* 设置弹窗 - 只在登录后显示 */}
        {showSettingsModal && (
          <div className="modal-overlay" onClick={() => setShowSettingsModal(false)} style={{ position: 'fixed', zIndex: 2000 }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{t('common.settings')}</h2>
                <button 
                  className="close-btn" 
                  onClick={() => setShowSettingsModal(false)}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>{t('common.language')}</label>
                  <select 
                    value={language} 
                    onChange={(e) => setLanguage(e.target.value as 'zh' | 'en')}
                    className="form-control"
                  >
                    <option value="zh">中文</option>
                    <option value="en">English</option>
                  </select>
                </div>
                
                <div className="form-group" style={{ marginTop: '20px' }}>
                  <label>外观设置</label>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--bg-input)'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
                      {theme === 'dark' ? '夜间模式' : '日间模式'}
                    </span>
                    <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '24px' }}>
                      <input 
                        type="checkbox" 
                        checked={theme === 'dark'}
                        onChange={toggleTheme}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span className="slider round" style={{
                        position: 'absolute',
                        cursor: 'pointer',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: theme === 'dark' ? 'var(--primary)' : '#ccc',
                        transition: '.4s',
                        borderRadius: '24px'
                      }}></span>
                      <span style={{
                        position: 'absolute',
                        content: '""',
                        height: '16px',
                        width: '16px',
                        left: '4px',
                        bottom: '4px',
                        backgroundColor: 'white',
                        transition: '.4s',
                        borderRadius: '50%',
                        transform: theme === 'dark' ? 'translateX(26px)' : 'translateX(0)'
                      }}></span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  className="btn-primary" 
                  onClick={() => setShowSettingsModal(false)}
                >
                  {t('common.close')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 图片裁剪弹窗 */}
        {showCropModal && cropImage && (
          <div className="modal-overlay" onClick={() => setShowCropModal(false)} style={{ position: 'fixed', zIndex: 3000 }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
              <div className="modal-header">
                <h2>裁剪头像</h2>
                <button 
                  className="close-btn" 
                  onClick={() => setShowCropModal(false)}
                >
                  ×
                </button>
              </div>
              <div className="modal-body" style={{ padding: '0' }}>
                <div style={{ height: '400px', position: 'relative' }}>
                  <Cropper
                    image={cropImage}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={handleCropComplete}
                    style={{
                      containerStyle: {
                        width: '100%',
                        height: '100%'
                      },
                      cropAreaStyle: {
                        border: '2px solid white',
                        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)'
                      }
                    }}
                  />
                </div>
                <div style={{ padding: '20px', textAlign: 'center' }}>
                  <p>拖动裁剪框选择头像区域，使用鼠标滚轮或双指缩放调整大小</p>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  className="btn-secondary" 
                  onClick={() => setShowCropModal(false)}
                >
                  取消
                </button>
                <button 
                  className="btn-primary" 
                  onClick={handleConfirmCrop}
                >
                  确认裁剪
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 未登录，显示登录/注册界面
  return (
    <>
      <GuestHome onLoginClick={() => setShowLoginModal(true)} />

      {/* 登录/注册弹出界面 */}
      {showLoginModal && (
        <div 
          onClick={() => setShowLoginModal(false)} 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 3000,
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUp {
              from {
                opacity: 0;
                transform: translateY(20px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}</style>
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(20px) saturate(180%)',
              border: '1px solid rgba(255, 255, 255, 0.5)',
              borderRadius: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)',
              width: '100%',
              maxWidth: '420px',
              animation: 'slideUp 0.3s ease-out',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '40px 40px 0 40px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}>
              <div>
                <h2 style={{
                  fontSize: '28px',
                  fontWeight: 300,
                  letterSpacing: '2px',
                  margin: '0 0 8px 0',
                  color: '#1a1a1a',
                }}>
                  {activeTab === 'login' ? t('user.login.title') : t('user.register.title')}
                </h2>
                <p style={{
                  fontSize: '14px',
                  color: '#999999',
                  margin: 0,
                  letterSpacing: '0.5px',
                }}>
                  {activeTab === 'login' ? t('user.login.subtitle') : t('user.register.subtitle')}
                </p>
              </div>
              <button
                onClick={() => setShowLoginModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '28px',
                  color: '#999999',
                  cursor: 'pointer',
                  padding: '0',
                  lineHeight: 1,
                  transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#1a1a1a';
                  e.currentTarget.style.transform = 'rotate(90deg) scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#999999';
                  e.currentTarget.style.transform = 'rotate(0deg) scale(1)';
                }}
              >
                ×
              </button>
            </div>

            {/* Tabs */}
            <div style={{
              display: 'flex',
              padding: '30px 40px 0 40px',
              gap: '30px',
            }}>
              <button
                onClick={() => setActiveTab('login')}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: activeTab === 'login' ? 500 : 400,
                  color: activeTab === 'login' ? '#1a1a1a' : '#999999',
                  cursor: 'pointer',
                  padding: '8px 0',
                  letterSpacing: '0.5px',
                  position: 'relative',
                  transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {t('common.login')}
                {activeTab === 'login' && (
                  <span style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: '#1a1a1a',
                  }} />
                )}
              </button>
              <button
                onClick={() => setActiveTab('register')}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: activeTab === 'register' ? 500 : 400,
                  color: activeTab === 'register' ? '#1a1a1a' : '#999999',
                  cursor: 'pointer',
                  padding: '8px 0',
                  letterSpacing: '0.5px',
                  position: 'relative',
                  transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {t('common.register')}
                {activeTab === 'register' && (
                  <span style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '2px',
                    background: '#1a1a1a',
                  }} />
                )}
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '40px' }}>
              {error && (
                <div style={{
                  background: '#f5f5f5',
                  border: '1px solid #cccccc',
                  color: '#333333',
                  padding: '14px 18px',
                  marginBottom: '24px',
                  fontSize: '13px',
                  letterSpacing: '0.3px',
                }}>
                  {error}
                </div>
              )}
              
              {activeTab === 'login' ? (
                <div style={{ animation: 'slideUp 0.3s ease-out' }}>
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '12px',
                      color: '#555555',
                      marginBottom: '8px',
                      letterSpacing: '0.5px',
                    }}>
                      {t('user.username_or_email')}
                    </label>
                    <input 
                      type="text" 
                      placeholder={t('user.login.username_placeholder')}
                      value={loginForm.username}
                      onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                      onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        fontSize: '14px',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        background: 'rgba(255, 255, 255, 0.5)',
                        borderRadius: '12px',
                        outline: 'none',
                        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        boxSizing: 'border-box',
                        letterSpacing: '0.3px',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.3)';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.8)';
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.5)';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '32px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '12px',
                      color: '#555555',
                      marginBottom: '8px',
                      letterSpacing: '0.5px',
                    }}>
                      {t('user.password')}
                    </label>
                    <input 
                      type="password" 
                      placeholder={t('user.login.password_placeholder')}
                      value={loginForm.password}
                      onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                      onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        fontSize: '14px',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        background: 'rgba(255, 255, 255, 0.5)',
                        borderRadius: '12px',
                        outline: 'none',
                        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        boxSizing: 'border-box',
                        letterSpacing: '0.3px',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.3)';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.8)';
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.5)';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    />
                  </div>
                  <button 
                    onClick={handleLogin}
                    style={{
                      width: '100%',
                      padding: '16px',
                      fontSize: '14px',
                      fontWeight: 500,
                      letterSpacing: '1px',
                      background: 'rgba(26, 26, 26, 0.9)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(26, 26, 26, 1)';
                      e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)';
                      e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(26, 26, 26, 0.9)';
                      e.currentTarget.style.transform = 'translateY(0) scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {t('common.login')}
                  </button>
                </div>
              ) : (
                <div style={{ animation: 'slideUp 0.3s ease-out' }}>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '12px',
                      color: '#666666',
                      marginBottom: '8px',
                      letterSpacing: '0.5px',
                    }}>
                      {t('user.username')}
                    </label>
                    <input 
                      type="text" 
                      placeholder={t('user.register.username_placeholder')}
                      value={registerForm.username}
                      onChange={(e) => setRegisterForm(prev => ({ ...prev, username: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        fontSize: '14px',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        background: 'rgba(255, 255, 255, 0.5)',
                        borderRadius: '12px',
                        outline: 'none',
                        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        boxSizing: 'border-box',
                        letterSpacing: '0.3px',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.3)';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.8)';
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.5)';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '12px',
                      color: '#555555',
                      marginBottom: '8px',
                      letterSpacing: '0.5px',
                    }}>
                      {t('user.email')}
                    </label>
                    <input 
                      type="email" 
                      placeholder={t('user.register.email_placeholder')}
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm(prev => ({ ...prev, email: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        fontSize: '14px',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        background: 'rgba(255, 255, 255, 0.5)',
                        borderRadius: '12px',
                        outline: 'none',
                        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        boxSizing: 'border-box',
                        letterSpacing: '0.3px',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.3)';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.8)';
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.5)';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '12px',
                      color: '#555555',
                      marginBottom: '8px',
                      letterSpacing: '0.5px',
                    }}>
                      {t('user.nickname')} {t('common.optional')}
                    </label>
                    <input 
                      type="text" 
                      placeholder={t('user.register.nickname_placeholder')}
                      value={registerForm.nickname}
                      onChange={(e) => setRegisterForm(prev => ({ ...prev, nickname: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        fontSize: '14px',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        background: 'rgba(255, 255, 255, 0.5)',
                        borderRadius: '12px',
                        outline: 'none',
                        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        boxSizing: 'border-box',
                        letterSpacing: '0.3px',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.3)';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.8)';
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.5)';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '12px',
                      color: '#555555',
                      marginBottom: '8px',
                      letterSpacing: '0.5px',
                    }}>
                      {t('user.password')}
                    </label>
                    <input 
                      type="password" 
                      placeholder={t('user.register.password_placeholder')}
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm(prev => ({ ...prev, password: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        fontSize: '14px',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        background: 'rgba(255, 255, 255, 0.5)',
                        borderRadius: '12px',
                        outline: 'none',
                        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        boxSizing: 'border-box',
                        letterSpacing: '0.3px',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.3)';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.8)';
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.5)';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '32px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '12px',
                      color: '#555555',
                      marginBottom: '8px',
                      letterSpacing: '0.5px',
                    }}>
                      {t('user.register.confirm_password')}
                    </label>
                    <input 
                      type="password" 
                      placeholder={t('user.register.confirm_password_placeholder')}
                      value={registerForm.confirmPassword}
                      onChange={(e) => setRegisterForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        fontSize: '14px',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        background: 'rgba(255, 255, 255, 0.5)',
                        borderRadius: '12px',
                        outline: 'none',
                        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        boxSizing: 'border-box',
                        letterSpacing: '0.3px',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.3)';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.8)';
                        e.currentTarget.style.transform = 'scale(1.02)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.1)';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.5)';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    />
                  </div>
                  <button 
                    onClick={handleRegister}
                    style={{
                      width: '100%',
                      padding: '16px',
                      fontSize: '14px',
                      fontWeight: 500,
                      letterSpacing: '1px',
                      background: 'rgba(26, 26, 26, 0.9)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(26, 26, 26, 1)';
                      e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)';
                      e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(26, 26, 26, 0.9)';
                      e.currentTarget.style.transform = 'translateY(0) scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {t('common.register')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </LanguageProvider>
  );
}

export default App
