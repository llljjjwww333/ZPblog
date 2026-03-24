import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useLoading } from '../contexts/LoadingContext';
import { categoryApi, Category, CategoryCreate } from '../services/categoryApi';
import { authApi } from '../services/api';

interface CategoryManagementProps {
  onViewCategory?: (categoryId: number) => void;
}



export function CategoryManagement({ onViewCategory }: CategoryManagementProps) {
  const { t } = useLanguage();
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<CategoryCreate>({
    name: '',
    description: '',
    image: undefined,
    parent_id: undefined
  });
  
  // 使用全局加载上下文
  const { setLoading } = useLoading();

  // 处理图片上传
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('图片大小不能超过 2MB');
      return;
    }

    try {
      setLoading(true, '上传图片中...');
      const result = await authApi.uploadImage(file);
      handleFormChange('image', result.url);
    } catch (err) {
      console.error('上传图片失败:', err);
      alert('上传图片失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 加载分类列表
  const fetchCategories = async () => {
    try {
      setLoading(true, t('common.loading'));
      const data = await categoryApi.getList();
      setCategories(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchCategories();
  }, []);

  // 处理分类点击
  const handleCategoryClick = (category: Category) => {
    setSelectedCategory(category);
    if (onViewCategory) {
      onViewCategory(category.id);
    }
  };

  // 处理删除分类
  const handleDelete = async (category: Category) => {
    if (!window.confirm(t('category.delete.confirm', { name: category.name }))) {
      return;
    }

    try {
      setLoading(true, t('common.loading'));
      await categoryApi.delete(category.id);
      if (selectedCategory?.id === category.id) {
        setSelectedCategory(null);
      }
      await fetchCategories();
    } catch (err: any) {
      // 处理400错误（通常是因为分类下有文章）
      if (err.response?.status === 400) {
        alert(`删除失败：${err.response.data.detail || '该分类下可能有文章或子分类，无法删除'}`);
      } else {
        alert(err instanceof Error ? err.message : t('common.error'));
      }
    } finally {
      setLoading(false);
    }
  };

  // 处理创建分类
  const handleCreate = async () => {
    try {
      setLoading(true, t('common.saving'));
      
      // 创建新分类
      await categoryApi.create(formData);
      
      setShowCreateModal(false);
      setFormData({
        name: '',
        description: '',
        image: undefined,
        parent_id: undefined
      });
      await fetchCategories();
    } catch (err) {
      alert(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  // 处理表单变化
  const handleFormChange = (field: keyof CategoryCreate, value: string | number | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="category-management-container">

      
      {/* 顶部操作栏 */}
      <div className="page-header">
        <h2>{t('category.title')}</h2>
        <div className="category-actions">
          <button 
            className="btn-primary" 
            onClick={() => setShowCreateModal(true)}
          >
            {t('category.create')}
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* 主要内容区域 */}
      <div className="category-content">
        {/* 左侧分类列表 */}
        <div className="category-main">
          {/* 分类列表 */}
          <div className="category-grid">
            {categories.map(category => (
              <div
                key={category.id}
                className={`category-card ${selectedCategory?.id === category.id ? 'selected' : ''}`}
                onClick={() => handleCategoryClick(category)}
                style={{ cursor: 'pointer' }}
              >
                {/* 预留图片位置 */}
                <div className="category-image-placeholder">
                  {category.image ? (
                    <img 
                      src={category.image} 
                      alt={category.name} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                  ) : (
                    <span>{category.name.charAt(0)}</span>
                  )}
                </div>
                
                <div className="category-card-header">
                  <h3>{category.name}</h3>
                  <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                     <button 
                      className="btn-icon delete"
                      onClick={() => handleDelete(category)}
                      title={t('common.delete')}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                {category.description && (
                  <p className="category-description">{category.description}</p>
                )}
              </div>
            ))}

            {categories.length === 0 && (
              <div className="empty-state">
                {t('category.empty')}
              </div>
            )}
          </div>
        </div>
        

      </div>

      {/* 创建分类弹窗 */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('category.create')}</h2>
              <button 
                className="close-btn" 
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="category-name">{t('category.form.name')}</label>
                <input
                  type="text"
                  id="category-name"
                  value={formData.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  placeholder={t('category.form.name.placeholder')}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>封面图片</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '10px' }}>
                    {formData.image && (
                        <div style={{ width: '100px', height: '100px', border: '1px solid #ccc', overflow: 'hidden' }}>
                            <img src={formData.image} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                    )}
                    <label className="btn-secondary" style={{ cursor: 'pointer', display: 'inline-block', margin: 0 }}>
                        {formData.image ? '更换图片' : '上传图片'}
                        <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                    </label>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="category-description">{t('category.form.desc')}</label>
                <textarea
                  id="category-description"
                  value={formData.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  placeholder={t('category.form.desc.placeholder')}
                  rows={3}
                  className="form-textarea"
                />
              </div>

              <div className="form-group">
                <label htmlFor="category-parent">{t('category.form.parent')}</label>
                <select
                  id="category-parent"
                  value={formData.parent_id || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    handleFormChange('parent_id', value ? parseInt(value) : undefined);
                  }}
                  className="form-select"
                >
                  <option value="">{t('category.form.parent.none')}</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn-secondary" 
                onClick={() => setShowCreateModal(false)}
              >
                {t('common.cancel')}
              </button>
              <button 
                className="btn-primary" 
                onClick={handleCreate}
                disabled={!formData.name}
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <style>{`
        .category-management-container {
          max-width: 100%;
          margin: 0;
          padding: 40px;
          font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 1px solid #eee;
        }

        .page-header h2 {
          font-size: 2rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0;
          color: #333;
        }
        
        .category-actions {
          display: flex;
          gap: 10px;
        }
        
        .btn-primary {
          background-color: #2c2c2c;
          color: #fff;
          border: none;
          padding: 10px 24px;
          cursor: pointer;
          font-size: 0.9rem;
          font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          border-radius: 8px;
          transition: all 0.3s ease;
        }
        
        .btn-primary:hover {
          background-color: #000;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          background-color: #ccc;
          color: #fff;
          transform: none;
          box-shadow: none;
        }
        
        .category-content {
          width: 100%;
        }
        
        .category-main {
          width: 100%;
        }
        
        .category-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 30px;
        }
        
        .category-card {
          background: #fff;
          padding: 0;
          border: 1px solid #eee;
          border-radius: 16px;
          transition: all 0.3s ease;
          position: relative;
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }
        
        .category-card.selected {
          border-color: #2c2c2c;
          box-shadow: 0 0 0 2px rgba(44, 44, 44, 0.1);
        }
        
        .category-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.08);
          border-color: transparent;
        }
        
        .category-image-placeholder {
          width: 100%;
          height: 180px;
          background-color: #f9f9f9;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 3rem;
          color: #ddd;
          font-family: 'Poppins', sans-serif;
          border-bottom: 1px solid #eee;
        }
        
        .category-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 10px;
          padding: 20px 20px 0;
        }
        
        .category-card-header h3 {
          font-size: 1.2rem;
          font-weight: 600;
          margin: 0;
          color: #333;
        }
        
        .card-actions {
          display: flex;
          gap: 5px;
        }
        
        .btn-icon {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 1.1rem;
          padding: 4px;
          border-radius: 4px;
          transition: background-color 0.2s;
          opacity: 0.6;
        }
        
        .btn-icon:hover {
          background-color: #f0f0f0;
          opacity: 1;
        }
        
        .btn-icon.delete:hover {
          background-color: #fff2f0;
          color: #ff4d4f;
        }
        
        .category-description {
          font-size: 0.95rem;
          line-height: 1.5;
          color: #666;
          margin: 0;
          padding: 0 20px 20px;
          flex-grow: 1;
        }
        
        .empty-state {
          grid-column: 1 / -1;
          text-align: center;
          padding: 80px 20px;
          color: #888;
          font-size: 1.1rem;
          background: #f9f9f9;
          border-radius: 16px;
          border: 1px dashed #ddd;
        }
        
        .error-message {
          background-color: #fff2f0;
          color: #ff4d4f;
          padding: 12px;
          margin: 20px 0;
          text-align: center;
          border: 1px solid #ffccc7;
          border-radius: 8px;
        }
        
        /* 弹窗样式 */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }
        
        .modal-content {
          background: #fff;
          padding: 40px;
          border-radius: 16px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
          width: 90%;
          max-width: 500px;
          border: none;
        }
        
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          padding-bottom: 15px;
          border-bottom: 1px solid #eee;
        }
        
        .modal-header h2 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 600;
          color: #333;
        }
        
        .close-btn {
          background: none;
          border: none;
          font-size: 1.8rem;
          cursor: pointer;
          color: #999;
          padding: 0;
          line-height: 1;
          transition: all 0.2s;
        }
        
        .close-btn:hover {
          color: #333;
          transform: rotate(90deg);
        }
        
        .modal-body {
          margin-bottom: 30px;
        }
        
        .form-group {
          margin-bottom: 24px;
        }
        
        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          color: #333;
          font-size: 0.9rem;
          text-transform: none;
          letter-spacing: 0;
        }
        
        .form-input, .form-textarea, .form-select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 1rem;
          font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
          transition: all 0.2s;
          background: #fff;
          box-sizing: border-box;
        }
        
        .form-input:focus, .form-textarea:focus, .form-select:focus {
          outline: none;
          border-color: #2c2c2c;
          box-shadow: 0 0 0 2px rgba(44, 44, 44, 0.1);
        }
        
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 15px;
          padding-top: 10px;
        }
        
        .btn-secondary {
          background-color: #f5f5f5;
          color: #333;
          border: none;
          padding: 10px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.9rem;
          font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 500;
          transition: all 0.2s;
        }
        
        .btn-secondary:hover {
          background-color: #e0e0e0;
          color: #000;
        }
        
        @media (max-width: 768px) {
          .category-management-container {
            padding: 20px 15px;
          }
          
          .category-grid {
            grid-template-columns: 1fr;
          }
          
          .modal-content {
            padding: 25px;
          }
        }
      `}</style>
    </div>
  );
}