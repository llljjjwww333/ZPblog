import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { authApi } from '../services/api';
import { UserLLMManager } from '../components/UserLLMManager';

interface User {
  id: number;
  username: string;
  email: string;
  nickname?: string;
  avatar?: string;
  bio?: string;
  background_image?: string;
  created_at: string;
}

interface UserStats {
  article_count: number;
  comment_count: number;
  like_count: number;
}

interface ProfileProps {
  user: User | null;
  onNavigateToArticles: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ user, onNavigateToArticles }) => {
  const { t } = useLanguage();
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bio, setBio] = useState(user?.bio || '');
  const [currentUser, setCurrentUser] = useState(user);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [showLLMManager, setShowLLMManager] = useState(false);
  
  const bgInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      try {
        const data = await authApi.getUserStats();
        setStats(data);
      } catch (err) {
        console.error('Failed to fetch user stats:', err);
      }
    };
    fetchStats();
  }, [user]);

  if (!currentUser) return null;

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('请选择图片文件');
        return;
    }

    // 限制文件大小 (10MB)
    if (file.size > 10 * 1024 * 1024) {
        alert('图片大小不能超过 10MB');
        return;
    }

    try {
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result as string;
            try {
                const updatedUser = await authApi.updateCurrentUser({ background_image: base64String });
                setCurrentUser(updatedUser);
                // Update session storage if needed, though App.tsx might need a callback to sync
                sessionStorage.setItem('user', JSON.stringify(updatedUser));
            } catch (err: any) {
                console.error('Failed to update background:', err);
                const status = err.response?.status;
                const detail = err.response?.data?.detail || err.message;
                alert(`更新背景失败: ${status ? `[${status}] ` : ''}${detail}`);
            }
        };
        reader.readAsDataURL(file);
    } catch (err) {
        console.error('File reading failed:', err);
        alert('读取文件失败');
    }
  };

  const handleBioSave = async () => {
      try {
          const updatedUser = await authApi.updateCurrentUser({ bio });
          setCurrentUser(updatedUser);
          sessionStorage.setItem('user', JSON.stringify(updatedUser));
          setIsEditingBio(false);
      } catch (err: any) {
          console.error('Failed to update bio:', err);
          const status = err.response?.status;
          const detail = err.response?.data?.detail || err.message;
          alert(`更新简介失败: ${status ? `[${status}] ` : ''}${detail}`);
      }
  };

  return (
    <div className="profile-page animate-fade-in">
      {/* Header / Banner */}
      <div className="profile-header">
        <div 
            className="profile-cover" 
            style={currentUser.background_image ? { backgroundImage: `url(${currentUser.background_image})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
            onClick={() => bgInputRef.current?.click()}
            title="点击更换背景图"
        >
            <input 
                type="file" 
                ref={bgInputRef} 
                style={{ display: 'none' }} 
                accept="image/*"
                onChange={handleBgUpload}
            />
            <div className="cover-overlay">
                <span>📷 {t('profile.change_bg')}</span>
            </div>
        </div>
        <div className="profile-info-container">
          <div className="profile-avatar">
            {currentUser.avatar ? (
              <img src={currentUser.avatar} alt={currentUser.username} />
            ) : (
              <div className="avatar-placeholder">
                {currentUser.username.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="profile-text">
            <h1 className="profile-nickname">{currentUser.nickname || currentUser.username}</h1>
            <p className="profile-username">@{currentUser.username}</p>
            
            <div className="profile-bio-section">
                {isEditingBio ? (
                    <div className="bio-edit">
                        <textarea 
                            value={bio} 
                            onChange={(e) => setBio(e.target.value)}
                            maxLength={500}
                            placeholder={t('profile.edit.bio')}
                        />
                        <div className="bio-actions">
                            <button className="btn-save" onClick={handleBioSave}>{t('common.save')}</button>
                            <button className="btn-cancel" onClick={() => {
                                setBio(currentUser.bio || '');
                                setIsEditingBio(false);
                            }}>{t('common.cancel')}</button>
                        </div>
                    </div>
                ) : (
                    <div className="bio-display">
                        <p className="profile-bio">{currentUser.bio || "这是您的个人空间。在这里，您可以管理您的个人资料和查看您的活动概览。"}</p>
                    </div>
                )}
            </div>

            <div className="profile-meta">
               <span>📅 {t('user.created_at')}: {new Date(currentUser.created_at).toLocaleDateString()}</span>
               <span>📧 {currentUser.email}</span>
            </div>

            <div className="profile-actions">
                <button className="btn-primary" onClick={onNavigateToArticles}>
                {t('nav.articles')}
                </button>
                <button 
                className="btn-secondary" 
                onClick={() => setIsEditingBio(true)}
                disabled={isEditingBio}
                style={{
                    opacity: isEditingBio ? 0.5 : 1,
                    cursor: isEditingBio ? 'not-allowed' : 'pointer',
                    minWidth: '80px',
                    textAlign: 'center'
                }}
                >
                {isEditingBio ? t('common.editing') || 'Editing...' : t('common.edit')}
                </button>
                <button 
                className="btn-secondary" 
                onClick={() => setShowLLMManager(true)}
                style={{
                    minWidth: '100px',
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}
                title="管理自定义大模型API配置"
                >
                <span>🤖</span>
                <span>大模型配置</span>
                </button>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics or Content */}
      <div className="profile-content">
        <div className="stat-card">
           <h3>{t('profile.stats.articles')}</h3>
           <p className="stat-number">{stats?.article_count ?? '-'}</p> 
        </div>
         <div className="stat-card">
           <h3>{t('profile.stats.comments')}</h3>
           <p className="stat-number">{stats?.comment_count ?? '-'}</p>
        </div>
         <div className="stat-card">
           <h3>{t('profile.stats.likes')}</h3>
           <p className="stat-number">{stats?.like_count ?? '-'}</p>
        </div>
      </div>

      {/* 大模型配置管理弹窗 */}
      <UserLLMManager 
        isOpen={showLLMManager}
        onClose={() => setShowLLMManager(false)}
        onConfigChange={() => {
          // 配置变更后的回调，可以刷新相关数据
          console.log('LLM配置已更新');
        }}
      />

      <style>{`
        .profile-page {
          width: 100%;
          box-sizing: border-box;
          max-width: 1000px;
          margin: 0 auto;
          padding: 40px 20px;
        }
        .profile-header {
          width: 100%;
          box-sizing: border-box;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.05);
          margin-bottom: 30px;
          border: 1px solid var(--border-light);
        }
        .profile-cover {
          height: 200px;
          background: linear-gradient(135deg, var(--primary-light), var(--primary));
          opacity: 0.8;
          position: relative;
          cursor: pointer;
        }
        .profile-cover:hover .cover-overlay {
          opacity: 1;
        }
        .cover-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          opacity: 0;
          transition: opacity 0.2s;
          font-weight: 500;
        }
        .profile-bio-section {
            margin-bottom: 16px;
        }
        .bio-display {
            padding: 8px 0;
            transition: none;
        }
        .bio-edit textarea {
            width: 100%;
            min-height: 80px;
            padding: 8px;
            border: 1px solid var(--border-light);
            border-radius: 4px;
            font-family: inherit;
            resize: vertical;
            margin-bottom: 8px;
            box-sizing: border-box; /* Ensure padding doesn't affect width */
        }
        .bio-actions {
            display: flex;
            gap: 8px;
        }
        .btn-save {
            padding: 4px 12px;
            background: var(--primary);
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9rem;
        }
        .btn-cancel {
            padding: 4px 12px;
            background: #f0f0f0;
            color: #666;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9rem;
        }
        .profile-info-container {
          padding: 0 40px 40px;
          position: relative;
          display: flex;
          align-items: flex-start;
          gap: 30px;
        }
        .profile-avatar {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          border: 4px solid white;
          background: white;
          margin-top: -60px;
          overflow: hidden;
          flex-shrink: 0;
          box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        }
        .profile-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .avatar-placeholder {
          width: 100%;
          height: 100%;
          background: var(--primary);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 3rem;
          font-weight: bold;
        }
        .profile-text {
          flex: 1;
          min-width: 0; /* Prevent flex item from overflowing */
          padding-top: 60px; /* Adjust top padding to align better with avatar visually */
        }
        .profile-nickname {
          margin: 0;
          font-size: 2rem;
          color: var(--text-dark);
          font-weight: 600;
          font-family: "Cormorant Garamond", "Noto Serif SC", serif;
        }
        .profile-username {
          margin: 4px 0 12px;
          color: var(--text-muted);
          font-size: 1rem;
        }
        .profile-bio {
          margin-bottom: 16px;
          color: var(--text-main);
          line-height: 1.6;
          word-break: break-word; /* Ensure long words break */
          white-space: pre-wrap; /* Preserve line breaks */
        }
        .profile-meta {
          display: flex;
          gap: 20px;
          font-size: 0.9rem;
          color: var(--text-secondary);
        }
        .profile-actions {
          margin-top: 20px;
          display: flex;
          gap: 12px;
          justify-content: flex-start;
        }
        .profile-content {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
        }
        .stat-card {
          background: white;
          padding: 24px;
          border-radius: 8px;
          border: 1px solid var(--border-light);
          text-align: center;
        }
        .stat-card h3 {
          margin: 0 0 10px;
          color: var(--text-muted);
          font-size: 1rem;
          font-weight: normal;
        }
        .stat-number {
          margin: 0;
          font-size: 2rem;
          font-weight: 600;
          color: var(--primary-dark);
          font-family: "Cormorant Garamond", serif;
        }
        
        @media (max-width: 768px) {
          .profile-info-container {
            flex-direction: column;
            align-items: center;
            text-align: center;
            padding: 0 20px 30px;
          }
          .profile-avatar {
            margin-top: -60px;
          }
          .profile-meta {
            justify-content: center;
            flex-wrap: wrap;
          }
          .profile-actions {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};
