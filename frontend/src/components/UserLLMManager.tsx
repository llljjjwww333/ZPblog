/**
 * 用户自定义LLM模型管理组件
 */
import { useState, useEffect } from 'react';
import { userLlmApi, UserLLMConfig, CreateLLMConfigRequest } from '../services/userLlmApi';

interface UserLLMManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChange: () => void;
}

export function UserLLMManager({ isOpen, onClose, onConfigChange }: UserLLMManagerProps) {
  const [configs, setConfigs] = useState<UserLLMConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<UserLLMConfig | null>(null);
  
  // 表单状态
  const [formData, setFormData] = useState<CreateLLMConfigRequest>({
    provider_id: '',
    name: '',
    description: '',
    icon: '🤖',
    api_key: '',
    base_url: '',
    model_name: ''
  });
  const [verifyResult, setVerifyResult] = useState<{ success: boolean; message: string } | null>(null);

  // 加载用户配置
  useEffect(() => {
    if (isOpen) {
      loadConfigs();
    }
  }, [isOpen]);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const data = await userLlmApi.getUserLLMConfigs();
      setConfigs(data);
    } catch (err: any) {
      console.error('加载配置失败:', err);
      if (err.response?.status === 401) {
        alert('请先登录后再管理自定义模型');
        onClose();
      } else {
        alert('加载配置失败: ' + (err.response?.data?.detail || err.message || '未知错误'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      if (editingConfig) {
        // 更新配置
        await userLlmApi.updateLLMConfig(editingConfig.id, formData);
      } else {
        // 创建新配置
        await userLlmApi.createLLMConfig(formData);
      }
      
      // 刷新列表
      await loadConfigs();
      onConfigChange();
      
      // 重置表单
      setShowAddForm(false);
      setEditingConfig(null);
      setFormData({
        provider_id: '',
        name: '',
        description: '',
        icon: '🤖',
        api_key: '',
        base_url: '',
        model_name: ''
      });
    } catch (err: any) {
      console.error('保存配置失败:', err);
      alert(err.response?.data?.detail || '保存配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (configId: number) => {
    if (!confirm('确定要删除这个模型配置吗？')) return;
    
    try {
      setLoading(true);
      await userLlmApi.deleteLLMConfig(configId);
      await loadConfigs();
      onConfigChange();
    } catch (err) {
      console.error('删除配置失败:', err);
      alert('删除配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!formData.api_key || !formData.model_name) {
      alert('请先填写API密钥和模型名称');
      return;
    }
    
    try {
      setLoading(true);
      const result = await userLlmApi.verifyLLMConfig({
        api_key: formData.api_key,
        base_url: formData.base_url,
        model_name: formData.model_name
      });
      setVerifyResult(result);
    } catch (err) {
      console.error('验证失败:', err);
      setVerifyResult({ success: false, message: '验证请求失败' });
    } finally {
      setLoading(false);
    }
  };

  const startEdit = async (config: UserLLMConfig) => {
    try {
      // 获取完整的API密钥
      const { api_key } = await userLlmApi.getApiKey(config.id);
      
      setEditingConfig(config);
      setFormData({
        provider_id: config.provider_id,
        name: config.name,
        description: config.description || '',
        icon: config.icon,
        api_key: api_key,
        base_url: config.base_url || '',
        model_name: config.model_name
      });
      setShowAddForm(true);
    } catch (err) {
      console.error('获取API密钥失败:', err);
      alert('获取API密钥失败');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>管理自定义AI模型</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* 配置列表 */}
          {!showAddForm && (
            <>
              <div className="config-list">
                {configs.length === 0 ? (
                  <p className="empty-text">暂无自定义模型，点击下方按钮添加</p>
                ) : (
                  configs.map(config => {
                    // 根据provider_id获取对应的SVG图标
                    const getLogoUrl = (providerId: string) => {
                      if (providerId === 'gemini') return '/gemini-color.svg';
                      if (providerId === 'gpt') return '/openai.svg';
                      if (providerId === 'claude') return '/claude-color.svg';
                      return null;
                    };
                    const logoUrl = getLogoUrl(config.provider_id);
                    
                    return (
                      <div key={config.id} className={`config-item ${!config.is_active ? 'inactive' : ''}`}>
                        <div className="config-info">
                          {logoUrl ? (
                            <img src={logoUrl} alt="" className="config-logo" />
                          ) : (
                            <span className="config-icon">🤖</span>
                          )}
                          <div className="config-details">
                            <h4>{config.name}</h4>
                            <p>{config.description || config.model_name}</p>
                            <span className={`status-badge ${config.is_verified ? 'verified' : 'unverified'}`}>
                              {config.is_verified ? '✓ 已验证' : '未验证'}
                            </span>
                            <span className="usage-count">使用次数: {config.usage_count}</span>
                          </div>
                        </div>
                        <div className="config-actions">
                          <button onClick={() => startEdit(config)}>编辑</button>
                          <button onClick={() => handleDelete(config.id)} className="delete-btn">删除</button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              
              <button 
                className="add-btn"
                onClick={() => {
                  setEditingConfig(null);
                  setFormData({
                    provider_id: '',
                    name: '',
                    description: '',
                    icon: '🤖',
                    api_key: '',
                    base_url: '',
                    model_name: ''
                  });
                  setShowAddForm(true);
                  setVerifyResult(null);
                }}
              >
                + 添加新模型
              </button>
            </>
          )}

          {/* 添加/编辑表单 */}
          {showAddForm && (
            <form onSubmit={handleSubmit} className="config-form">
              <h3>{editingConfig ? '编辑模型' : '添加新模型'}</h3>
              
              <div className="form-group">
                <label>选择模型类型 *</label>
                <div className="model-type-options">
                  {[
                    { id: 'gemini', name: 'Gemini', logo: '/gemini-color.svg', defaultName: 'Gemini Pro', model: 'gemini-pro', url: 'https://generativelanguage.googleapis.com/v1beta' },
                    { id: 'gpt', name: 'GPT', logo: '/openai.svg', defaultName: 'GPT-4', model: 'gpt-4', url: 'https://api.openai.com/v1' },
                    { id: 'claude', name: 'Claude', logo: '/claude-color.svg', defaultName: 'Claude 3', model: 'claude-3-opus-20240229', url: 'https://api.anthropic.com/v1' }
                  ].map(modelType => (
                    <div
                      key={modelType.id}
                      className={`model-type-card ${formData.provider_id === modelType.id ? 'selected' : ''} ${editingConfig ? 'disabled' : ''}`}
                      onClick={() => {
                        if (editingConfig) return;
                        setFormData({
                          ...formData,
                          provider_id: modelType.id,
                          name: modelType.defaultName,
                          model_name: modelType.model,
                          base_url: modelType.url
                        });
                      }}
                    >
                      <img src={modelType.logo} alt={modelType.name} className="model-type-logo" />
                      <span className="model-type-name">{modelType.name}</span>
                    </div>
                  ))}
                </div>
                <small>仅支持 Gemini、GPT、Claude 三种模型</small>
              </div>

              <div className="form-group">
                <label>显示名称 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="如: Gemini Pro, GPT-4, Claude 3"
                  required
                />
              </div>

              <div className="form-group">
                <label>图标</label>
                <input
                  type="text"
                  value={formData.icon}
                  onChange={e => setFormData({...formData, icon: e.target.value})}
                  placeholder="🤖"
                  maxLength={10}
                />
              </div>

              <div className="form-group">
                <label>描述</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  placeholder="模型描述（可选）"
                />
              </div>

              <div className="form-group">
                <label>API密钥 *</label>
                <input
                  type="password"
                  value={formData.api_key}
                  onChange={e => setFormData({...formData, api_key: e.target.value})}
                  placeholder="sk-..."
                  required
                />
                <small>您的API密钥将被加密存储，费用自行承担</small>
              </div>

              <div className="form-group">
                <label>API基础URL</label>
                <input
                  type="text"
                  value={formData.base_url}
                  onChange={e => setFormData({...formData, base_url: e.target.value})}
                  placeholder="https://api.openai.com/v1"
                />
                <small>已自动填充默认值，如有需要可修改</small>
              </div>

              <div className="form-group">
                <label>模型名称 *</label>
                <input
                  type="text"
                  value={formData.model_name}
                  onChange={e => setFormData({...formData, model_name: e.target.value})}
                  placeholder="如: gemini-pro, gpt-4, claude-3-opus"
                  required
                />
                <small>具体模型版本，如 gemini-pro、gpt-4-turbo、claude-3-sonnet</small>
              </div>

              {/* 验证结果 */}
              {verifyResult && (
                <div className={`verify-result ${verifyResult.success ? 'success' : 'error'}`}>
                  {verifyResult.success ? '✓' : '✗'} {verifyResult.message}
                </div>
              )}

              <div className="form-actions">
                <button type="button" onClick={handleVerify} disabled={loading}>
                  {loading ? '验证中...' : '验证配置'}
                </button>
                <button type="submit" disabled={loading} className="primary">
                  {loading ? '保存中...' : (editingConfig ? '更新' : '添加')}
                </button>
                <button type="button" onClick={() => setShowAddForm(false)}>
                  取消
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
        }
        .modal-content {
          background: white;
          border-radius: 8px;
          width: 90%;
          max-width: 600px;
          max-height: 80vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #e9ecef;
        }
        .modal-header h2 {
          margin: 0;
          font-size: 1.25rem;
        }
        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #666;
        }
        .modal-body {
          padding: 20px;
          overflow-y: auto;
        }
        .empty-text {
          text-align: center;
          color: #666;
          padding: 40px 0;
        }
        .config-list {
          margin-bottom: 20px;
        }
        .config-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          border: 1px solid #e9ecef;
          border-radius: 6px;
          margin-bottom: 10px;
        }
        .config-item.inactive {
          opacity: 0.6;
        }
        .config-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .config-icon {
          font-size: 24px;
        }
        .config-details h4 {
          margin: 0 0 4px 0;
        }
        .config-details p {
          margin: 0;
          font-size: 0.9rem;
          color: #666;
        }
        .status-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.8rem;
          margin-right: 8px;
        }
        .status-badge.verified {
          background: #d4edda;
          color: #155724;
        }
        .status-badge.unverified {
          background: #fff3cd;
          color: #856404;
        }
        .usage-count {
          font-size: 0.8rem;
          color: #666;
        }
        .config-actions button {
          margin-left: 8px;
          padding: 6px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
          cursor: pointer;
        }
        .config-actions .delete-btn {
          color: #dc3545;
          border-color: #dc3545;
        }
        .add-btn {
          width: 100%;
          padding: 12px;
          border: 2px dashed #ddd;
          border-radius: 6px;
          background: #f8f9fa;
          cursor: pointer;
          font-size: 1rem;
        }
        .add-btn:hover {
          border-color: #333;
          background: #e9ecef;
        }
        .config-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .form-group label {
          font-weight: 500;
          font-size: 0.9rem;
        }
        .form-group input,
        .form-group select {
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 1rem;
        }
        .form-group select {
          background: white;
          cursor: pointer;
        }
        .form-group select:disabled {
          background: #e9ecef;
          cursor: not-allowed;
        }

        .model-type-options {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .model-type-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 16px 24px;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          min-width: 100px;
        }

        .model-type-card:hover:not(.disabled) {
          border-color: #333;
          background: #f8f9fa;
        }

        .model-type-card.selected {
          border-color: #333;
          background: #e9ecef;
        }

        .model-type-card.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .model-type-logo {
          width: 32px;
          height: 32px;
          object-fit: contain;
        }

        .model-type-name {
          font-size: 0.9rem;
          font-weight: 500;
        }

        .config-logo {
          width: 32px;
          height: 32px;
          object-fit: contain;
        }

        .form-group small {
          color: #666;
          font-size: 0.8rem;
        }
        .verify-result {
          padding: 10px;
          border-radius: 4px;
          font-size: 0.9rem;
        }
        .verify-result.success {
          background: #d4edda;
          color: #155724;
        }
        .verify-result.error {
          background: #f8d7da;
          color: #721c24;
        }
        .form-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          margin-top: 10px;
        }
        .form-actions button {
          padding: 10px 20px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
          cursor: pointer;
        }
        .form-actions button.primary {
          background: #333;
          color: white;
          border-color: #333;
        }
        .form-actions button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
