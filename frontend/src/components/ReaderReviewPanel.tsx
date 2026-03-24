import { useState, useEffect } from 'react';
import { readerReviewApi, ReaderRole } from '../services/readerReviewApi';
import { ReaderReviewChat } from './ReaderReviewChat';
import { useLanguage } from '../contexts/LanguageContext';
// import { useLoading } from '../contexts/LoadingContext';

interface ReaderReviewPanelProps {
  title: string;
  content: string;
  onApplyRewrite?: (newTitle: string, newContent: string) => void;
  onOpenMultiAgentReview?: () => void;
}

// 自定义读者类型
interface CustomPersona {
  id: string;
  name: string;
  description: string;
}

export function ReaderReviewPanel({ title, content, onApplyRewrite, onOpenMultiAgentReview }: ReaderReviewPanelProps) {
  const { t, language } = useLanguage();
  // const { setLoading } = useLoading();
  const [roles, setRoles] = useState<ReaderRole[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  // const [selectedPersona, setSelectedPersona] = useState<string>('');
  // const [reviewResults, setReviewResults] = useState<ReviewResult[]>([]);
  const [isReviewing] = useState(false);
  // const [activeTab, setActiveTab] = useState<number>(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // 自定义读者相关状态
  const [customPersonas, setCustomPersonas] = useState<CustomPersona[]>([]);
  const [newPersonaName, setNewPersonaName] = useState('');
  const [newPersonaDesc, setNewPersonaDesc] = useState('');
  const [showCustomPersonaForm, setShowCustomPersonaForm] = useState(false);

  // 加载角色列表
  useEffect(() => {
    console.log('ReaderReviewPanel: 开始加载角色列表');
    loadRoles();
  }, [language]);

  const loadRoles = async () => {
    try {
      console.log('ReaderReviewPanel: 调用 API 获取角色');
      const data = await readerReviewApi.getRoles(language);
      console.log('ReaderReviewPanel: 获取到角色数据:', data);
      setRoles(data.roles);
    } catch (err) {
      console.error('ReaderReviewPanel: 加载角色失败:', err);
    }
  };

  // 选择/取消选择角色
  const toggleRole = (roleId: string) => {
    const newSelected = new Set(selectedRoles);
    if (newSelected.has(roleId)) {
      newSelected.delete(roleId);
    } else {
      newSelected.add(roleId);
    }
    setSelectedRoles(newSelected);
  };

  // 开始评审 - 打开聊天窗口
  const startReview = () => {
    if (selectedRoles.size === 0) return;
    if (!title.trim() || !content.trim()) {
      alert(t('reader_review.error.empty_content'));
      return;
    }

    // 检查是否选择了读者画像角色但没有添加自定义读者
    if (selectedRoles.has('persona_reader') && customPersonas.length === 0) {
      alert(t('reader_review.error.add_persona_first'));
      return;
    }

    // 打开聊天窗口
    setIsChatOpen(true);
  };

  // 获取选中的角色完整信息
  const getSelectedRolesInfo = (): ReaderRole[] => {
    return roles.filter(role => selectedRoles.has(role.id)).map(role => {
      // 如果是读者画像角色，只使用自定义读者（不再包含预定义读者）
      if (role.id === 'persona_reader') {
        // 如果没有自定义读者，返回空personas的角色（评审时会提示用户）
        return {
          ...role,
          personas: customPersonas.map(p => ({
            id: `custom_${p.id}`,
            name: p.name,
            description: p.description
          }))
        };
      }
      return role;
    });
  };

  // 添加自定义读者
  const addCustomPersona = () => {
    if (!newPersonaName.trim() || !newPersonaDesc.trim()) return;
    
    const newPersona: CustomPersona = {
      id: `${Date.now()}`,  // 不需要 custom_ 前缀，getSelectedRolesInfo 会添加
      name: newPersonaName.trim(),
      description: newPersonaDesc.trim()
    };
    
    setCustomPersonas([...customPersonas, newPersona]);
    setNewPersonaName('');
    setNewPersonaDesc('');
    setShowCustomPersonaForm(false);
  };

  // 删除自定义读者
  const removeCustomPersona = (id: string) => {
    setCustomPersonas(customPersonas.filter(p => p.id !== id));
  };

  // 渲染角色选择卡片
  const renderRoleCard = (role: ReaderRole) => {
    const isSelected = selectedRoles.has(role.id);
    const isPersonaReader = role.id === 'persona_reader';
    
    return (
      <div key={role.id} className="role-card-wrapper">
        <div
          className={`role-card ${isSelected ? 'selected' : ''}`}
          onClick={() => toggleRole(role.id)}
        >
          <div className="role-icon">{role.icon}</div>
          <div className="role-info">
            <div className="role-name">{role.name}</div>
            <div className="role-desc">
              {role.description}
              {isPersonaReader && <span className="custom-hint">{t('reader_review.custom_required')}</span>}
            </div>
          </div>
          <div className="role-checkbox">
            {isSelected ? '✓' : ''}
          </div>
        </div>
        
        {/* 目标读者画像角色 - 显示自定义读者选项 */}
        {isPersonaReader && isSelected && (
          <div className="custom-persona-section" onClick={(e) => e.stopPropagation()}>
            {/* 已添加的自定义读者 */}
            {customPersonas.length > 0 && (
              <div className="custom-persona-list">
                {customPersonas.map(persona => (
                  <div key={persona.id} className="custom-persona-tag">
                    <span className="tag-name">{persona.name}</span>
                    <button 
                      className="tag-remove"
                      onClick={() => removeCustomPersona(persona.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* 添加自定义读者按钮 */}
            {!showCustomPersonaForm ? (
              <button
                className="btn-add-persona"
                onClick={() => setShowCustomPersonaForm(true)}
              >
                + {t('reader_review.add_custom_persona')}
              </button>
            ) : (
              <div className="custom-persona-form">
                <input
                  type="text"
                  placeholder={t('reader_review.persona_name_placeholder')}
                  value={newPersonaName}
                  onChange={(e) => setNewPersonaName(e.target.value)}
                  className="persona-input"
                />
                <textarea
                  placeholder={t('reader_review.persona_desc_placeholder')}
                  value={newPersonaDesc}
                  onChange={(e) => setNewPersonaDesc(e.target.value)}
                  className="persona-textarea"
                  rows={2}
                />
                <div className="persona-form-actions">
                  <button
                    className="btn-confirm"
                    onClick={addCustomPersona}
                    disabled={!newPersonaName.trim() || !newPersonaDesc.trim()}
                  >
                    {t('common.confirm')}
                  </button>
                  <button
                    className="btn-cancel"
                    onClick={() => {
                      setShowCustomPersonaForm(false);
                      setNewPersonaName('');
                      setNewPersonaDesc('');
                    }}
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // 渲染评审结果（暂时未使用）
  /*
  const renderReviewResult = (result: ReviewResult, index: number) => {
    if (!result.success) {
      return (
        <div key={index} className="review-result error">
          <div className="result-header">
            <span className="result-icon">{result.icon}</span>
            <span className="result-name">{result.role_name}</span>
          </div>
          <div className="result-error">{result.error}</div>
        </div>
      );
    }

    return (
      <div key={index} className="review-result">
        <div className="result-header">
          <span className="result-icon">{result.icon}</span>
          <span className="result-name">{result.role_name}</span>
        </div>
        
        <div className="result-content">
          {result.parsed_review.summary && (
            <div className="result-section">
              <div className="section-title">{t('reader_review.summary')}</div>
              <div className="section-content summary">{result.parsed_review.summary}</div>
            </div>
          )}

          {result.parsed_review.issues.length > 0 && (
            <div className="result-section">
              <div className="section-title">{t('reader_review.issues')}</div>
              <ul className="issue-list">
                {result.parsed_review.issues.map((issue, i) => (
                  <li key={i} className="issue-item">{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {result.parsed_review.suggestions.length > 0 && (
            <div className="result-section">
              <div className="section-title">{t('reader_review.suggestions')}</div>
              <ul className="suggestion-list">
                {result.parsed_review.suggestions.map((suggestion, i) => (
                  <li key={i} className="suggestion-item">{suggestion}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="result-section">
            <div className="section-title">{t('reader_review.full_review')}</div>
            <div className="full-review-text">{result.raw_review}</div>
          </div>
        </div>
      </div>
    );
  };
  */

  return (
    <div className="reader-review-panel">
      <div className="panel-header">
        <h3>{t('reader_review.title')}</h3>
        <p className="panel-desc">{t('reader_review.description')}</p>
      </div>

      {/* 角色选择区 */}
      <div className="roles-section">
        <div className="section-title">{t('reader_review.select_roles')} ({roles.length})</div>
        <div className="roles-grid">
          {roles.length === 0 ? (
            <div className="loading-roles">{t('reader_review.loading_roles')}</div>
          ) : (
            roles.map(renderRoleCard)
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="actions-section">
        <button
          className="btn-review"
          onClick={startReview}
          disabled={selectedRoles.size === 0 || isReviewing}
        >
          {isReviewing ? t('reader_review.reviewing') : t('reader_review.start_review')}
        </button>
        <button
          className="btn-multi-agent"
          onClick={() => onOpenMultiAgentReview?.()}
          disabled={isReviewing}
        >
          🤖 {t('reader_review.multi_agent')}
        </button>
        {selectedRoles.size > 0 && (
          <span className="selected-count">
            {t('reader_review.selected_count', { count: selectedRoles.size })}
          </span>
        )}
      </div>

      {/* 聊天窗口 */}
      <ReaderReviewChat
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        title={title}
        content={content}
        selectedRoles={getSelectedRolesInfo()}
        onApplyRewrite={onApplyRewrite}
      />

      <style>{`
        .reader-review-panel {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 20px;
          margin-top: 20px;
        }

        .panel-header {
          margin-bottom: 20px;
        }

        .panel-header h3 {
          margin: 0 0 8px 0;
          font-size: 1.2rem;
          color: #333;
        }

        .panel-desc {
          margin: 0;
          color: #666;
          font-size: 0.9rem;
        }

        .roles-section {
          margin-bottom: 20px;
        }

        .section-title {
          font-weight: 600;
          margin-bottom: 12px;
          color: #333;
        }

        .roles-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 16px;
          width: 100%;
        }

        .role-card-wrapper {
          display: flex;
          flex-direction: column;
          height: 100%;
          min-width: 0;
        }

        .role-card {
          background: white;
          border: 2px solid #e1e4e8;
          border-radius: 8px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          min-height: 120px;
          flex: 1;
          width: 100%;
          box-sizing: border-box;
        }

        .role-card:hover {
          border-color: #333333;
          transform: translateY(-2px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .role-card.selected {
          border-color: #333333;
          background: #f5f5f5;
        }

        .role-icon {
          font-size: 1.5rem;
          flex-shrink: 0;
        }

        .role-info {
          flex: 1;
        }

        .custom-hint {
          color: #666666;
          font-size: 0.8rem;
          margin-left: 4px;
        }

        .custom-persona-section {
          margin-top: 10px;
          padding: 12px;
          background: #f8f9fa;
          border-radius: 6px;
          border: 1px solid #e1e4e8;
        }

        .custom-persona-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 10px;
        }

        .custom-persona-tag {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #e8e8e8;
          color: #333333;
          padding: 4px 10px;
          border-radius: 16px;
          font-size: 0.85rem;
        }

        .tag-remove {
          background: none;
          border: none;
          color: #666666;
          cursor: pointer;
          font-size: 1rem;
          padding: 0;
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .tag-remove:hover {
          color: #333333;
        }

        .btn-add-persona {
          width: 100%;
          padding: 8px;
          background: white;
          border: 1px dashed #666666;
          color: #333333;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.2s;
        }

        .btn-add-persona:hover {
          background: #f5f5f5;
          border-style: solid;
        }

        .custom-persona-form {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .persona-input,
        .persona-textarea {
          padding: 8px 10px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 0.9rem;
          font-family: inherit;
        }

        .persona-input:focus,
        .persona-textarea:focus {
          outline: none;
          border-color: #333333;
        }

        .persona-textarea {
          resize: vertical;
          min-height: 50px;
        }

        .persona-form-actions {
          display: flex;
          gap: 8px;
        }

        .btn-confirm,
        .btn-cancel {
          flex: 1;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.85rem;
          transition: all 0.2s;
        }

        .btn-confirm {
          background: #333333;
          color: white;
          border: none;
        }

        .btn-confirm:hover:not(:disabled) {
          background: #1a1a1a;
        }

        .btn-confirm:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .btn-cancel {
          background: white;
          color: #666;
          border: 1px solid #ddd;
        }

        .btn-cancel:hover {
          background: #f5f5f5;
        }

        .role-name {
          font-weight: 600;
          color: #333;
          margin-bottom: 4px;
        }

        .role-desc {
          font-size: 0.85rem;
          color: #666;
          line-height: 1.4;
        }

        .role-checkbox {
          width: 24px;
          height: 24px;
          border: 2px solid #ddd;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          color: #333333;
          flex-shrink: 0;
        }

        .role-card.selected .role-checkbox {
          border-color: #333333;
          background: #333333;
          color: white;
        }

        .actions-section {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid #e1e4e8;
        }

        .btn-review {
          padding: 10px 24px;
          background: #333333;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          min-width: 140px;
        }

        .btn-review:hover:not(:disabled) {
          background: #1a1a1a;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .btn-multi-agent {
          padding: 10px 24px;
          background: linear-gradient(135deg, #555555 0%, #333333 100%);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          min-width: 140px;
        }

        .btn-multi-agent:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .btn-multi-agent:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .selected-count {
          color: #666;
          font-size: 0.9rem;
        }

        .results-section {
          background: white;
          border-radius: 8px;
          overflow: hidden;
        }

        .results-tabs {
          display: flex;
          gap: 4px;
          padding: 12px;
          background: #f1f3f4;
          overflow-x: auto;
        }

        .tab-btn {
          padding: 8px 16px;
          border: none;
          background: white;
          border-radius: 6px;
          cursor: pointer;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
        }

        .tab-btn:hover {
          background: #e8f0fe;
        }

        .tab-btn.active {
          background: #333333;
          color: white;
        }

        .tab-icon {
          font-size: 1rem;
        }

        .tab-name {
          font-size: 0.9rem;
        }

        .results-content {
          padding: 20px;
          max-height: 500px;
          overflow-y: auto;
        }

        .review-result {
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .review-result.error {
          background: #fff3cd;
          border: 1px solid #ffc107;
          border-radius: 6px;
          padding: 15px;
        }

        .result-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 15px;
          padding-bottom: 15px;
          border-bottom: 2px solid #e1e4e8;
        }

        .result-icon {
          font-size: 1.5rem;
        }

        .result-name {
          font-size: 1.1rem;
          font-weight: 600;
          color: #333;
        }

        .result-error {
          color: #856404;
        }

        .result-content {
          space-y: 15px;
        }

        .result-section {
          margin-bottom: 20px;
        }

        .result-section .section-title {
          font-weight: 600;
          color: #333;
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px solid #e1e4e8;
        }

        .section-content.summary {
          background: #e8f4f8;
          padding: 12px;
          border-radius: 6px;
          border-left: 4px solid #17a2b8;
          color: #0c5460;
        }

        .issue-list,
        .suggestion-list {
          margin: 0;
          padding-left: 20px;
        }

        .issue-item {
          color: #721c24;
          margin-bottom: 8px;
          line-height: 1.5;
        }

        .suggestion-item {
          color: #155724;
          margin-bottom: 8px;
          line-height: 1.5;
        }

        .full-review-text {
          white-space: pre-wrap;
          background: #f8f9fa;
          padding: 15px;
          border-radius: 6px;
          font-size: 0.9rem;
          line-height: 1.6;
          color: #333;
          max-height: 300px;
          overflow-y: auto;
        }

        .loading-roles {
          grid-column: 1 / -1;
          text-align: center;
          padding: 30px;
          color: #666;
          font-size: 0.9rem;
        }
      `}</style>
    </div>
  );
}
