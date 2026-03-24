import React, { useState, useEffect } from 'react';
// import { useLanguage } from '../contexts/LanguageContext';
import api from '../services/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface AdminDashboardProps {
  onLogout: () => void;
  onNavigateHome: () => void;
}

interface AdminStats {
  total_users: number;
  total_posts: number;
  today_posts: number;
  total_views: number;
  trend_data: { name: string; views: number }[];
  pie_data: { name: string; value: number }[];
  hot_posts: { id: number; title: string; views: number }[];
}

interface User {
  id: number;
  username: string;
  email: string;
  nickname: string | null;
  role: string;
  is_active: boolean;
  can_post: boolean;
  created_at: string;
  last_login: string | null;
}

interface Post {
  id: number;
  title: string;
  author: string;
  status: string;
  created_at: string;
  view_count: number;
}

interface Comment {
  id: number;
  content: string;
  post_title: string;
  author: string;
  created_at: string;
  likes: number;
}

// interface PaginatedUsers {
//   items: User[];
//   total: number;
//   page: number;
//   size: number;
//   pages: number;
// }

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout, onNavigateHome }) => {
  // const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'articles' | 'comments' | 'settings'>('overview');
  const [stats, setStats] = useState<AdminStats>({
    total_users: 0,
    total_posts: 0,
    today_posts: 0,
    total_views: 0,
    trend_data: [],
    pie_data: [],
    hot_posts: []
  });
  
  // 用户管理相关状态
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [userSearch, setUserSearch] = useState('');

  // 文章管理相关状态
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postPage, setPostPage] = useState(1);
  const [postTotalPages, setPostTotalPages] = useState(1);
  const [postSearch, setPostSearch] = useState('');
  const [postStatusFilter, setPostStatusFilter] = useState('');

  // 评论管理相关状态
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentPage, setCommentPage] = useState(1);
  const [commentTotalPages, setCommentTotalPages] = useState(1);
  const [commentSearch, setCommentSearch] = useState('');

  // 系统公告相关状态
  const [announcementContent, setAnnouncementContent] = useState('');
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  useEffect(() => {
    if (activeTab === 'overview') {
      fetchStats();
    } else if (activeTab === 'users') {
      fetchUsers(userPage, userSearch);
    } else if (activeTab === 'articles') {
      fetchPosts(postPage, postSearch, postStatusFilter);
    } else if (activeTab === 'comments') {
      fetchComments(commentPage, commentSearch);
    }
  }, [activeTab, userPage, postPage, commentPage]); // 注意：不要把 search 加进去

  const fetchStats = async () => {
    try {
      const response = await api.get('/admin/stats');
      setStats(response.data);
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  };

  // 导航到前台
  const handleNavigateToHome = () => {
    onNavigateHome();
  };

  const fetchUsers = async (page: number, search: string = '') => {
    setUsersLoading(true);
    try {
      const response = await api.get('/admin/users', {
        params: { page, size: 10, search }
      });
      setUsers(response.data.items);
      setUserTotalPages(response.data.pages);
    } catch (error) {
      console.error('获取用户列表失败:', error);
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchPosts = async (page: number, search: string = '', status: string = '') => {
    setPostsLoading(true);
    try {
      const response = await api.get('/admin/posts', {
        params: { page, size: 10, search, status_filter: status || undefined }
      });
      setPosts(response.data.items);
      setPostTotalPages(response.data.pages);
    } catch (error) {
      console.error('获取文章列表失败:', error);
    } finally {
      setPostsLoading(false);
    }
  };

  const fetchComments = async (page: number, search: string = '') => {
    setCommentsLoading(true);
    try {
      const response = await api.get('/admin/comments', {
        params: { page, size: 10, search }
      });
      setComments(response.data.items);
      setCommentTotalPages(response.data.pages);
    } catch (error) {
      console.error('获取评论列表失败:', error);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleCommentSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCommentPage(1);
    fetchComments(1, commentSearch);
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!window.confirm('确定要删除这条评论吗？此操作不可恢复。')) {
      return;
    }
    try {
      await api.delete(`/admin/comments/${commentId}`);
      // 重新加载列表
      fetchComments(commentPage, commentSearch);
    } catch (error) {
      console.error('删除评论失败:', error);
      alert('操作失败');
    }
  };

  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementContent.trim()) return;
    
    setSendingAnnouncement(true);
    try {
      await api.post('/admin/announcements', { content: announcementContent });
      alert('系统公告发送成功！');
      setAnnouncementContent('');
    } catch (error) {
      console.error('发送公告失败:', error);
      alert('发送失败，请重试');
    } finally {
      setSendingAnnouncement(false);
    }
  };

  const handleUserSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setUserPage(1);
    fetchUsers(1, userSearch);
  };

  const handlePostSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPostPage(1);
    fetchPosts(1, postSearch, postStatusFilter);
  };

  const handlePostStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const status = e.target.value;
    setPostStatusFilter(status);
    setPostPage(1);
    fetchPosts(1, postSearch, status);
  };

  const handleUpdatePostStatus = async (postId: number, newStatus: string) => {
    try {
      await api.put(`/admin/posts/${postId}/status`, { status: newStatus });
      // 更新本地状态
      setPosts(posts.map(post => 
        post.id === postId ? { ...post, status: newStatus } : post
      ));
    } catch (error) {
      console.error('更新文章状态失败:', error);
      alert('操作失败');
    }
  };

  const handleDeletePost = async (postId: number) => {
    if (!window.confirm('确定要永久删除这篇文章吗？此操作不可恢复。')) {
      return;
    }
    try {
      await api.delete(`/admin/posts/${postId}`);
      // 重新加载列表
      fetchPosts(postPage, postSearch, postStatusFilter);
    } catch (error) {
      console.error('删除文章失败:', error);
      alert('操作失败');
    }
  };

  const handleToggleCanPost = async (userId: number, currentStatus: boolean) => {
    try {
      await api.put(`/admin/users/${userId}/status`, {
        can_post: !currentStatus
      });
      // 更新本地状态
      setUsers(users.map(user => 
        user.id === userId ? { ...user, can_post: !currentStatus } : user
      ));
    } catch (error) {
      console.error('更新用户状态失败:', error);
      alert('操作失败');
    }
  };

  const handleToggleActive = async (userId: number, currentStatus: boolean) => {
    if (!window.confirm(currentStatus ? '确定要封禁该用户吗？' : '确定要解封该用户吗？')) {
      return;
    }
    try {
      await api.put(`/admin/users/${userId}/status`, {
        is_active: !currentStatus
      });
      // 更新本地状态
      setUsers(users.map(user => 
        user.id === userId ? { ...user, is_active: !currentStatus } : user
      ));
    } catch (error) {
      console.error('更新用户状态失败:', error);
      alert('操作失败');
    }
  };

  return (
    <div className="admin-dashboard" style={{ display: 'flex', height: '100vh', backgroundColor: '#f5f7fa' }}>
      {/* 侧边栏 */}
      <div className="admin-sidebar" style={{ 
        width: '250px', 
        backgroundColor: '#1a1c23', 
        color: 'white',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #2d3748' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem' }}>管理员控制台</h2>
          <p style={{ margin: '5px 0 0', fontSize: '0.8rem', color: '#a0aec0' }}>Welcome, Administrator</p>
        </div>
        
        <nav style={{ flex: 1, padding: '20px 0' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li>
              <button 
                onClick={() => setActiveTab('overview')}
                style={{ 
                  width: '100%', 
                  textAlign: 'left', 
                  padding: '12px 20px', 
                  background: activeTab === 'overview' ? '#2d3748' : 'transparent',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                📊 总览
              </button>
            </li>
            <li>
              <button 
                onClick={() => setActiveTab('users')}
                style={{ 
                  width: '100%', 
                  textAlign: 'left', 
                  padding: '12px 20px', 
                  background: activeTab === 'users' ? '#2d3748' : 'transparent',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                👥 用户管理
              </button>
            </li>
            <li>
              <button 
                onClick={() => setActiveTab('articles')}
                style={{ 
                  width: '100%', 
                  textAlign: 'left', 
                  padding: '12px 20px', 
                  background: activeTab === 'articles' ? '#2d3748' : 'transparent',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                📝 文章管理
              </button>
            </li>
            <li>
              <button 
                onClick={() => setActiveTab('comments')}
                style={{ 
                  width: '100%', 
                  textAlign: 'left', 
                  padding: '12px 20px', 
                  background: activeTab === 'comments' ? '#2d3748' : 'transparent',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                💬 评论管理
              </button>
            </li>
            <li>
              <button 
                onClick={() => setActiveTab('settings')}
                style={{ 
                  width: '100%', 
                  textAlign: 'left', 
                  padding: '12px 20px', 
                  background: activeTab === 'settings' ? '#2d3748' : 'transparent',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                ⚙️ 系统设置
              </button>
            </li>
          </ul>
        </nav>
        
        <div style={{ padding: '20px', borderTop: '1px solid #2d3748' }}>
          <button 
            onClick={handleNavigateToHome}
            style={{ 
              display: 'block', 
              width: '100%', 
              padding: '10px', 
              marginBottom: '10px',
              backgroundColor: '#4a5568', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer' 
            }}
          >
            返回前台
          </button>
          <button  
            onClick={onLogout}
            style={{ 
              display: 'block', 
              width: '100%', 
              padding: '10px', 
              backgroundColor: '#e53e3e', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer' 
            }}
          >
            退出登录
          </button>
        </div>
      </div>
      
      {/* 主内容区 */}
      <div className="admin-content" style={{ flex: 1, overflow: 'auto' }}>
        <header style={{ 
          backgroundColor: 'white', 
          padding: '20px', 
          boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky', // 固定在顶部
          top: 0,
          zIndex: 10
        }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>
            {activeTab === 'overview' && '系统总览'}
            {activeTab === 'users' && '用户管理'}
            {activeTab === 'articles' && '文章管理'}
            {activeTab === 'settings' && '系统设置'}
          </h1>
        </header>
        
        <div style={{ padding: '30px' }}>
          {activeTab === 'overview' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h3 style={{ margin: '0 0 10px', color: '#718096' }}>总用户数</h3>
                  <p style={{ fontSize: '2rem', margin: 0, fontWeight: 'bold' }}>{stats.total_users}</p>
                </div>
                <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h3 style={{ margin: '0 0 10px', color: '#718096' }}>总文章数</h3>
                  <p style={{ fontSize: '2rem', margin: 0, fontWeight: 'bold' }}>{stats.total_posts}</p>
                </div>
                <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h3 style={{ margin: '0 0 10px', color: '#718096' }}>今日新增文章</h3>
                  <p style={{ fontSize: '2rem', margin: 0, fontWeight: 'bold' }}>{stats.today_posts}</p>
                </div>
                <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h3 style={{ margin: '0 0 10px', color: '#718096' }}>总阅读量</h3>
                  <p style={{ fontSize: '2rem', margin: 0, fontWeight: 'bold' }}>{stats.total_views}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
                <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', height: '400px' }}>
                  <h3 style={{ margin: '0 0 20px 0', color: '#2d3748' }}>近期文章发布趋势</h3>
                  <ResponsiveContainer width="100%" height="90%">
                    <BarChart
                      data={stats.trend_data}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="views" fill="#8884d8" name="新增文章" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', height: '300px' }}>
                    <h3 style={{ margin: '0 0 20px 0', color: '#2d3748' }}>文章分类占比</h3>
                    <ResponsiveContainer width="100%" height="90%">
                      <PieChart>
                        <Pie
                          data={stats.pie_data}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                          outerRadius={60}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {stats.pie_data.map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend 
                          verticalAlign="bottom" 
                          height={36} 
                          iconType="circle"
                          wrapperStyle={{ fontSize: '12px' }} // 减小图例字体
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', flex: 1, minHeight: '200px' }}>
                    <h3 style={{ margin: '0 0 15px 0', color: '#2d3748', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      🔥 今日热度榜
                    </h3>
                    {stats.hot_posts.length > 0 ? (
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {stats.hot_posts.map((post, index) => (
                          <li key={post.id} style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            padding: '10px 0',
                            borderBottom: index < stats.hot_posts.length - 1 ? '1px solid #edf2f7' : 'none'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                              <span style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                width: '24px', 
                                height: '24px', 
                                borderRadius: '50%', 
                                background: index < 3 ? '#ffe4e6' : '#edf2f7',
                                color: index < 3 ? '#e53e3e' : '#718096',
                                fontWeight: 'bold',
                                fontSize: '0.9em',
                                flexShrink: 0
                              }}>
                                {index + 1}
                              </span>
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }} title={post.title}>
                                {post.title}
                              </span>
                            </div>
                            <span style={{ color: '#718096', fontSize: '0.9em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              👀 {post.views}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ color: '#a0aec0', textAlign: 'center', margin: '20px 0' }}>暂无热度数据</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
          
          {activeTab === 'users' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>用户管理</h2>
                <form onSubmit={handleUserSearch} style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder="搜索用户名/邮箱/昵称"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    style={{ padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px', width: '250px' }}
                  />
                  <button type="submit" style={{ padding: '8px 16px', background: '#3182ce', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    搜索
                  </button>
                </form>
              </div>

              {usersLoading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
              ) : (
                <>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f7fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '12px', textAlign: 'left' }}>ID</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>用户名</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>邮箱</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>角色</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>注册时间</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>发文权限</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>账号状态</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(user => (
                        <tr key={user.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '12px' }}>{user.id}</td>
                          <td style={{ padding: '12px' }}>
                            <div>{user.username}</div>
                            {user.nickname && <div style={{ fontSize: '0.8em', color: '#718096' }}>{user.nickname}</div>}
                          </td>
                          <td style={{ padding: '12px' }}>{user.email}</td>
                          <td style={{ padding: '12px' }}>
                            <span style={{ 
                              padding: '2px 8px', 
                              borderRadius: '12px', 
                              fontSize: '0.85em',
                              background: user.role === 'admin' ? '#ebf8ff' : '#f7fafc',
                              color: user.role === 'admin' ? '#3182ce' : '#4a5568'
                            }}>
                              {user.role}
                            </span>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            {user.can_post ? (
                              <span style={{ color: '#48bb78' }}>正常</span>
                            ) : (
                              <span style={{ color: '#e53e3e', fontWeight: 'bold' }}>禁止</span>
                            )}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            {user.is_active ? (
                              <span style={{ color: '#48bb78' }}>正常</span>
                            ) : (
                              <span style={{ color: '#e53e3e', fontWeight: 'bold' }}>封禁</span>
                            )}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            {user.role !== 'admin' && (
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                <button
                                  onClick={() => handleToggleCanPost(user.id, user.can_post)}
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: '0.9em',
                                    borderRadius: '4px',
                                    border: '1px solid',
                                    cursor: 'pointer',
                                    background: user.can_post ? '#fff5f5' : '#f0fff4',
                                    borderColor: user.can_post ? '#fc8181' : '#68d391',
                                    color: user.can_post ? '#c53030' : '#2f855a'
                                  }}
                                >
                                  {user.can_post ? '禁言' : '解禁'}
                                </button>
                                <button
                                  onClick={() => handleToggleActive(user.id, user.is_active)}
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: '0.9em',
                                    borderRadius: '4px',
                                    border: '1px solid',
                                    cursor: 'pointer',
                                    background: user.is_active ? '#fff5f5' : '#f0fff4',
                                    borderColor: user.is_active ? '#fc8181' : '#68d391',
                                    color: user.is_active ? '#c53030' : '#2f855a'
                                  }}
                                >
                                  {user.is_active ? '封号' : '解封'}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {/* 分页 */}
                  <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                    <button 
                      disabled={userPage === 1}
                      onClick={() => setUserPage(p => p - 1)}
                      style={{ padding: '8px 12px', cursor: userPage === 1 ? 'not-allowed' : 'pointer' }}
                    >
                      上一页
                    </button>
                    <span style={{ padding: '8px' }}>第 {userPage} / {userTotalPages} 页</span>
                    <button 
                      disabled={userPage === userTotalPages}
                      onClick={() => setUserPage(p => p + 1)}
                      style={{ padding: '8px 12px', cursor: userPage === userTotalPages ? 'not-allowed' : 'pointer' }}
                    >
                      下一页
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          
          {activeTab === 'articles' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>文章管理</h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select 
                    value={postStatusFilter} 
                    onChange={handlePostStatusFilterChange}
                    style={{ padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px' }}
                  >
                    <option value="">所有状态</option>
                    <option value="published">已发布</option>
                    <option value="draft">草稿</option>
                    <option value="archived">已归档</option>
                  </select>
                  <form onSubmit={handlePostSearch} style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="text"
                      placeholder="搜索文章标题"
                      value={postSearch}
                      onChange={(e) => setPostSearch(e.target.value)}
                      style={{ padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px', width: '250px' }}
                    />
                    <button type="submit" style={{ padding: '8px 16px', background: '#3182ce', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                      搜索
                    </button>
                  </form>
                </div>
              </div>

              {postsLoading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
              ) : (
                <>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f7fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '12px', textAlign: 'left' }}>ID</th>
                        <th style={{ padding: '12px', textAlign: 'left', width: '30%' }}>标题</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>作者</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>状态</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>阅读量</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>发布时间</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {posts.map(post => (
                        <tr key={post.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '12px' }}>{post.id}</td>
                          <td style={{ padding: '12px' }}>
                            <a href={`#/article/${post.id}`} target="_blank" rel="noopener noreferrer" style={{ color: '#3182ce', textDecoration: 'none' }}>
                              {post.title}
                            </a>
                          </td>
                          <td style={{ padding: '12px' }}>{post.author}</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <span style={{ 
                              padding: '2px 8px', 
                              borderRadius: '12px', 
                              fontSize: '0.85em',
                              background: post.status === 'published' ? '#f0fff4' : (post.status === 'draft' ? '#fffaf0' : '#edf2f7'),
                              color: post.status === 'published' ? '#2f855a' : (post.status === 'draft' ? '#dd6b20' : '#4a5568')
                            }}>
                              {post.status === 'published' ? '已发布' : (post.status === 'draft' ? '草稿' : '已归档')}
                            </span>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>{post.view_count}</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            {new Date(post.created_at).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                              {post.status === 'published' ? (
                                <button
                                  onClick={() => handleUpdatePostStatus(post.id, 'draft')}
                                  title="屏蔽文章（设为草稿）"
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: '0.9em',
                                    borderRadius: '4px',
                                    border: '1px solid',
                                    cursor: 'pointer',
                                    background: '#fffaf0',
                                    borderColor: '#ed8936',
                                    color: '#c05621'
                                  }}
                                >
                                  屏蔽
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleUpdatePostStatus(post.id, 'published')}
                                  title="恢复发布"
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: '0.9em',
                                    borderRadius: '4px',
                                    border: '1px solid',
                                    cursor: 'pointer',
                                    background: '#f0fff4',
                                    borderColor: '#68d391',
                                    color: '#2f855a'
                                  }}
                                >
                                  发布
                                </button>
                              )}
                              <button
                                onClick={() => handleDeletePost(post.id)}
                                title="永久删除"
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '0.9em',
                                  borderRadius: '4px',
                                  border: '1px solid',
                                  cursor: 'pointer',
                                  background: '#fff5f5',
                                  borderColor: '#fc8181',
                                  color: '#c53030'
                                }}
                              >
                                删除
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {/* 分页 */}
                  <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                    <button 
                      disabled={postPage === 1}
                      onClick={() => setPostPage(p => p - 1)}
                      style={{ padding: '8px 12px', cursor: postPage === 1 ? 'not-allowed' : 'pointer' }}
                    >
                      上一页
                    </button>
                    <span style={{ padding: '8px' }}>第 {postPage} / {postTotalPages} 页</span>
                    <button 
                      disabled={postPage === postTotalPages}
                      onClick={() => setPostPage(p => p + 1)}
                      style={{ padding: '8px 12px', cursor: postPage === postTotalPages ? 'not-allowed' : 'pointer' }}
                    >
                      下一页
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          
          {activeTab === 'comments' && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>评论管理</h2>
                <form onSubmit={handleCommentSearch} style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder="搜索评论内容"
                    value={commentSearch}
                    onChange={(e) => setCommentSearch(e.target.value)}
                    style={{ padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px', width: '250px' }}
                  />
                  <button type="submit" style={{ padding: '8px 16px', background: '#3182ce', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    搜索
                  </button>
                </form>
              </div>

              {commentsLoading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
              ) : (
                <>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f7fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '12px', textAlign: 'left' }}>ID</th>
                        <th style={{ padding: '12px', textAlign: 'left', width: '40%' }}>评论内容</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>所属文章</th>
                        <th style={{ padding: '12px', textAlign: 'left' }}>作者</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>发布时间</th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comments.map(comment => (
                        <tr key={comment.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '12px' }}>{comment.id}</td>
                          <td style={{ padding: '12px' }} title={comment.content}>
                            <div style={{ 
                              maxWidth: '300px', 
                              whiteSpace: 'nowrap', 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis' 
                            }}>
                              {comment.content}
                            </div>
                          </td>
                          <td style={{ padding: '12px' }}>{comment.post_title}</td>
                          <td style={{ padding: '12px' }}>{comment.author}</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            {new Date(comment.created_at).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <button
                              onClick={() => handleDeleteComment(comment.id)}
                              title="永久删除"
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.9em',
                                borderRadius: '4px',
                                border: '1px solid',
                                cursor: 'pointer',
                                background: '#fff5f5',
                                borderColor: '#fc8181',
                                color: '#c53030'
                              }}
                            >
                              删除
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {/* 分页 */}
                  <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                    <button 
                      disabled={commentPage === 1}
                      onClick={() => setCommentPage(p => p - 1)}
                      style={{ padding: '8px 12px', cursor: commentPage === 1 ? 'not-allowed' : 'pointer' }}
                    >
                      上一页
                    </button>
                    <span style={{ padding: '8px' }}>第 {commentPage} / {commentTotalPages} 页</span>
                    <button 
                      disabled={commentPage === commentTotalPages}
                      onClick={() => setCommentPage(p => p + 1)}
                      style={{ padding: '8px 12px', cursor: commentPage === commentTotalPages ? 'not-allowed' : 'pointer' }}
                    >
                      下一页
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h2 style={{ marginTop: 0 }}>系统公告</h2>
                <p style={{ color: '#718096', marginBottom: '20px' }}>发布全站系统公告，消息将发送至所有用户的通知中心。</p>
                <form onSubmit={handleSendAnnouncement}>
                  <textarea
                    value={announcementContent}
                    onChange={(e) => setAnnouncementContent(e.target.value)}
                    placeholder="请输入公告内容..."
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      marginBottom: '15px',
                      resize: 'vertical',
                      fontFamily: 'inherit'
                    }}
                  />
                  <button
                    type="submit"
                    disabled={sendingAnnouncement || !announcementContent.trim()}
                    style={{
                      padding: '10px 20px',
                      background: sendingAnnouncement ? '#cbd5e0' : '#3182ce',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: sendingAnnouncement ? 'not-allowed' : 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    {sendingAnnouncement ? '发送中...' : '发布公告'}
                  </button>
                </form>
              </div>

              <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h2 style={{ marginTop: 0 }}>站点设置</h2>
                <p>站点配置功能开发中...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
