import { useState, useEffect, useRef, useCallback } from 'react';
// import { readerReviewApi } from '../services/readerReviewApi';
import { createPortal } from 'react-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { UserLLMManager } from './UserLLMManager';
import './MultiAgentReviewPanel.css';

interface Message {
  agent_name: string;
  agent_icon: string;
  logo_url?: string;
  content: string;
  message_type: 'review' | 'response' | 'consensus' | 'question';
  target_agent: string | null;
  confidence: number;
  phase: 'initial' | 'discussion' | 'consensus';
  topic?: string;
}

interface LLM {
  id: string;
  name: string;
  description: string;
  icon: string;
  logo_url?: string;
}

interface MultiAgentReviewPanelProps {
  title: string;
  content: string;
  isOpen: boolean;
  onClose: () => void;
  onApplyRewrite?: (newTitle: string, newContent: string) => void;
}

export function MultiAgentReviewPanel({ 
  title, 
  content, 
  isOpen, 
  onClose,
  onApplyRewrite 
}: MultiAgentReviewPanelProps) {
  const { t } = useLanguage();

  const [messages, setMessages] = useState<Message[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 900, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeOffset, setResizeOffset] = useState({ x: 0, y: 0 });
  const [rewriteResult, setRewriteResult] = useState<{ title: string; content: string; explanation: string } | null>(null);
  const [isGeneratingRewrite, setIsGeneratingRewrite] = useState(false);
  const [customAudience] = useState({
    name: '',
    description: ''
  });
  const [showLLMManager, setShowLLMManager] = useState(false);
  // const [showCustomAudience, setShowCustomAudience] = useState(false);

  // 大模型选择 - 双AI讨论
  const [selectedLLMs, setSelectedLLMs] = useState<string[]>(['deepseek', 'qwen']); // 默认选择两个
  const [availableLLMs, setAvailableLLMs] = useState<LLM[]>([
    { id: 'deepseek', name: 'DeepSeek', description: '深度求索大模型', icon: '🔍', logo_url: '/deepseek-color.svg' },
    { id: 'qwen', name: '千问 (Qwen)', description: '阿里云大模型', icon: '🇨🇳', logo_url: '/qwen-color.svg' }
  ]);
  
  // 获取可用的LLM列表（使用多智能体专用端点）
  useEffect(() => {
    const fetchAvailableLLMs = async () => {
      try {
        // 获取用户token
        const token = sessionStorage.getItem('token');
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch('/api/multi-agent/available-llms', {
          headers
        });
        if (response.ok) {
          const data = await response.json();
          if (data.llms && data.llms.length > 0) {
            setAvailableLLMs(data.llms);
            // 默认选择前两个（系统固定模型：DeepSeek和千问）
            if (data.system_models && data.system_models.length >= 2) {
              setSelectedLLMs([data.system_models[0], data.system_models[1]]);
            } else if (data.llms.length >= 2) {
              setSelectedLLMs([data.llms[0].id, data.llms[1].id]);
            } else if (data.llms.length === 1) {
              setSelectedLLMs([data.llms[0].id]);
            }
          }
        }
      } catch (error) {
        console.error('获取可用LLM列表失败:', error);
      }
    };
    
    if (isOpen) {
      fetchAvailableLLMs();
    }
  }, [isOpen]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // 组件打开时的初始化
  useEffect(() => {
    if (isOpen) {
      // 重置状态
      setMessages([]);
      setIsReviewing(false);
    }
  }, [isOpen]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 拖动相关事件
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target instanceof HTMLElement) {
      // 处理调整大小
      if (e.target.closest('.resize-handle')) {
        setIsResizing(true);
        setResizeOffset({
          x: e.clientX - size.width,
          y: e.clientY - size.height
        });
      }
      // 处理拖动
      else if (e.target.closest('.review-header')) {
        setIsDragging(true);
        setDragOffset({
          x: e.clientX - position.x,
          y: e.clientY - position.y
        });
      }
    }
  }, [position, size]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    } else if (isResizing) {
      // 限制最小大小
      const newWidth = Math.max(600, e.clientX - resizeOffset.x);
      const newHeight = Math.max(400, e.clientY - resizeOffset.y);
      setSize({ width: newWidth, height: newHeight });
    }
  }, [isDragging, dragOffset, isResizing, resizeOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  // 添加全局鼠标事件监听器
  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);





  const toggleLLM = (llmId: string) => {
    setSelectedLLMs(prev => {
      if (prev.includes(llmId)) {
        // 如果已经选中，取消选择（但至少保留两个）
        if (prev.length > 2) {
          return prev.filter(id => id !== llmId);
        }
        return prev;
      } else {
        // 如果未选中，添加到列表（允许多个）
        return [...prev, llmId];
      }
    });
  };

  const startCollaborativeReview = async () => {
    if (selectedLLMs.length < 2) {
      alert(t('multi_agent.select_two_llm'));
      return;
    }

    setIsReviewing(true);
    setMessages([]);
    setCurrentPhase('initial');
    setError(null);

    try {
      console.log('开始多智能体评审，选择的大模型:', selectedLLMs);
      
      // 使用 EventSource 接收流式响应
      const token = sessionStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/multi-agent-review', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title,
          content,
          custom_audience: customAudience,
          selected_llms: selectedLLMs
        })
      });

      console.log('API响应状态:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP错误: ${response.status}`);
      }

      // 读取流式响应
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error('无法读取响应流');
      }

      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // 处理 SSE 格式的数据
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // 保留不完整的部分
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              console.log('收到流数据:', data);
              
              if (data.type === 'start') {
                console.log('评审开始');
              } else if (data.type === 'phase') {
                setCurrentPhase(data.phase);
              } else if (data.type === 'thinking') {
                // 可以显示思考状态
                console.log(data.message);
              } else if (data.type === 'message') {
                // 添加新消息
                setMessages(prev => [...prev, data.message]);
              } else if (data.type === 'complete') {
                console.log('评审完成');
                setIsReviewing(false);
                setCurrentPhase('');
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            } catch (e) {
              console.error('解析流数据失败:', e, line);
            }
          }
        }
      }
      
      // 处理剩余的数据
      if (buffer.startsWith('data: ')) {
        try {
          const data = JSON.parse(buffer.slice(6));
          if (data.type === 'message') {
            setMessages(prev => [...prev, data.message]);
          }
        } catch (e) {
          console.error('解析最后流数据失败:', e);
        }
      }
      
    } catch (error) {
      console.error('多智能体评审失败:', error);
      setError(error instanceof Error ? error.message : '评审失败，请重试');
      alert('评审失败: ' + (error instanceof Error ? error.message : '请重试'));
    } finally {
      setIsReviewing(false);
      setCurrentPhase('');
    }
  };

  const handleApplyRewrite = () => {
    // 使用生成的修改结果，确保内容不为空
    if (rewriteResult && onApplyRewrite) {
      if (!rewriteResult.content || rewriteResult.content.trim() === '') {
        alert(t('multi_agent.empty_content_error') || '修改后的内容为空，无法应用');
        return;
      }
      onApplyRewrite(rewriteResult.title, rewriteResult.content);
      onClose();
    }
  };

  const getPhaseText = (phase: string) => {
    switch (phase) {
      case 'initial': return t('multi_agent.phase_initial');
      case 'discussion': return t('multi_agent.phase_discussion');
      case 'consensus': return t('multi_agent.phase_consensus');
      default: return '';
    }
  };

  const getMessageTypeText = (type: string) => {
    switch (type) {
      case 'review': return t('multi_agent.type_review');
      case 'response': return t('multi_agent.type_response');
      case 'consensus': return t('multi_agent.type_consensus');
      case 'question': return t('multi_agent.type_question');
      default: return '';
    }
  };

  const generateRewrite = async () => {
    // 找到共识消息
    const consensusMsg = messages.find(m => m.message_type === 'consensus');
    if (consensusMsg) {
      try {
        setIsGeneratingRewrite(true);
        // 基于共识内容生成修改后的文章
        const response = await fetch('/api/ai-rewrite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title,
            content,
            review_results: [{
              role: 'multi_agent_consensus',
              name: '评审委员会',
              content: consensusMsg.content
            }],
            round_num: 1,
            max_rounds: 3,
            focus_areas: ['logic', 'style', 'structure', 'clarity']
          })
        });

        const data = await response.json();
        if (data.success && data.new_content && data.new_content.trim() !== '') {
          setRewriteResult({
            title: data.new_title || title,
            content: data.new_content,
            explanation: data.explanation || '已根据评审意见修改文章'
          });
        } else {
          alert(t('multi_agent.rewrite_failed') || '生成修改建议失败，请重试');
        }
      } catch (error) {
        console.error('生成修改建议失败:', error);
        alert('生成修改建议失败，请重试');
      } finally {
        setIsGeneratingRewrite(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="multi-agent-review-overlay">
      <div 
        className="multi-agent-review-panel"
        ref={panelRef}
        style={{
          top: `${position.y}px`,
          left: `${position.x}px`,
          width: `${size.width}px`,
          height: `${size.height}px`,
          cursor: isDragging ? 'grabbing' : isResizing ? 'se-resize' : 'move'
        }}
        onMouseDown={handleMouseDown}
      >
        {/* 调整大小的手柄 */}
        <div className="resize-handle"></div>
        {/* 头部 */}
        <div className="review-header">
          <div className="review-title">
            <span className="review-icon">🤖</span>
            <span>{t('multi_agent.title')}</span>
          </div>
          <button className="review-close" onClick={onClose}>×</button>
        </div>

        {/* 大模型选择 */}
        {!isReviewing && messages.length === 0 && (
          <div className="role-selection">
            <div className="role-selection-content">
              <h3>{t('multi_agent.select_llm')}</h3>
              <div className="llm-grid">
                {availableLLMs.map(llm => (
                  <div key={llm.id} className="llm-card-wrapper">
                    <label className={`llm-card ${selectedLLMs.includes(llm.id) ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={selectedLLMs.includes(llm.id)}
                        onChange={() => toggleLLM(llm.id)}
                        disabled={isReviewing}
                      />
                      {llm.logo_url ? (
                        <img
                          src={llm.logo_url}
                          alt={llm.name}
                          className="llm-logo"
                          style={{ width: '40px', height: '40px', objectFit: 'contain' }}
                          onError={(e) => {
                            // 如果图片加载失败，显示emoji作为备用
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <span className="llm-icon">{llm.icon || '🤖'}</span>
                      )}
                      <span className="llm-name">{llm.name}</span>
                      <span className="llm-desc">{llm.description}</span>
                    </label>
                  </div>
                ))}
                {/* 添加自定义模型按钮 */}
                <div className="llm-card-wrapper">
                  <button
                    className="llm-card add-llm-card"
                    onClick={() => setShowLLMManager(true)}
                    title="添加自定义大模型（Gemini、GPT、Claude）"
                  >
                    <span className="llm-icon" style={{ fontSize: '2.5rem', color: '#666' }}>+</span>
                    <span className="llm-name" style={{ color: '#666' }}>添加模型</span>
                    <span className="llm-desc">配置 Gemini、GPT、Claude</span>
                  </button>
                </div>
              </div>
              <p className="llm-hint">
                💡 {t('multi_agent.select_hint')}
              </p>
            </div>
            <div className="role-selection-footer">
              <button 
                className="start-review-btn"
                onClick={startCollaborativeReview}
                disabled={isReviewing}
              >
                {isReviewing ? t('multi_agent.reviewing') : t('multi_agent.start_review')}
              </button>
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            <span className="error-text">{error}</span>
            <button className="error-close" onClick={() => setError(null)}>×</button>
          </div>
        )}

        {/* 评审过程 */}
        {(isReviewing || (messages.length > 0 && !rewriteResult)) && (
          <div className="review-process">
            {/* 阶段指示器 */}
            {currentPhase && (
              <div className="phase-indicator">
                <span className="phase-badge">{getPhaseText(currentPhase)}</span>
              </div>
            )}

            {/* 加载状态 */}
            {isReviewing && messages.length === 0 && (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>{t('multi_agent.initializing')}</p>
              </div>
            )}

            {/* 消息流 */}
            {!rewriteResult && (
              <div className="messages-container">
                {messages.map((msg, index) => {
                  // 优先使用后端返回的logo_url，否则根据agent_name判断
                  const logoSrc = msg.logo_url || (() => {
                    const name = msg.agent_name.toLowerCase();
                    if (name.includes('deepseek')) return '/deepseek-color.svg';
                    if (name.includes('千问') || name.includes('qwen')) return '/qwen-color.svg';
                    return null;
                  })();
                  
                  return (
                    <div 
                      key={index} 
                      className={`message ${msg.message_type} ${msg.phase}`}
                    >
                      <div className="message-header">
                        {logoSrc ? (
                          <img 
                            src={logoSrc} 
                            alt={msg.agent_name}
                            className="agent-logo"
                            style={{ width: '28px', height: '28px', objectFit: 'contain', marginRight: '10px', borderRadius: '4px' }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <span className="agent-icon" style={{ fontSize: '24px', marginRight: '10px' }}>{msg.agent_icon}</span>
                        )}
                        <span className="agent-name">{msg.agent_name}</span>
                        <span className="message-type">{getMessageTypeText(msg.message_type)}</span>
                        {msg.target_agent && (
                          <span className="target-agent">→ {msg.target_agent}</span>
                        )}
                        <span className="confidence" title="置信度">
                          {(msg.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="message-content">
                        {msg.topic && (
                          <div className="discussion-topic">💬 {msg.topic}</div>
                        )}
                        <div className="content-text">{msg.content}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* 生成修改建议 */}
            {!isReviewing && messages.length > 0 && !rewriteResult && (
              <div className="review-actions">
                <button className="btn-secondary" onClick={onClose}>
                  关闭
                </button>
                {messages.some(m => m.message_type === 'consensus') && (
                  <button 
                    className="btn-primary" 
                    onClick={generateRewrite}
                    disabled={isGeneratingRewrite}
                  >
                    {isGeneratingRewrite ? '生成中...' : '生成修改建议'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 修改建议对比 */}
        {rewriteResult && (
          <div className="review-process">
            <div className="rewrite-comparison">
              <h3>修改建议对比</h3>
              <div className="comparison-grid">
                <div className="comparison-column">
                  <h4>原文</h4>
                  <div className="content-box original">
                    <h5>{title}</h5>
                    <div className="content-text">{content}</div>
                  </div>
                </div>
                <div className="comparison-column">
                  <h4>修改后</h4>
                  <div className="content-box rewritten">
                    <h5>{rewriteResult.title}</h5>
                    <div className="content-text">{rewriteResult.content}</div>
                  </div>
                </div>
              </div>
              <div className="explanation-box">
                <h4>修改说明</h4>
                <div className="content-text">{rewriteResult.explanation}</div>
              </div>
              <div className="review-actions">
                  <button className="btn-secondary" onClick={onClose}>
                    取消
                  </button>
                  <button className="btn-secondary" onClick={() => {
                    setRewriteResult(null);
                    setMessages([]);
                  }}>
                    重新评审
                  </button>
                  <button className="btn-secondary" onClick={generateRewrite} disabled={isGeneratingRewrite}>
                    {isGeneratingRewrite ? '重新生成中...' : '重新生成'}
                  </button>
                  <button className="btn-primary" onClick={handleApplyRewrite}>
                    应用修改
                  </button>
                </div>
            </div>
          </div>
        )}
      </div>

      {/* 大模型配置管理弹窗 - 使用Portal渲染到body，避免层级问题 */}
      {showLLMManager && createPortal(
        <UserLLMManager
          isOpen={showLLMManager}
          onClose={() => setShowLLMManager(false)}
          onConfigChange={() => {
            // 配置变更后刷新可用LLM列表
            const fetchAvailableLLMs = async () => {
              try {
                const token = sessionStorage.getItem('token');
                const headers: Record<string, string> = {};
                if (token) {
                  headers['Authorization'] = `Bearer ${token}`;
                }

                const response = await fetch('/api/multi-agent/available-llms', {
                  headers
                });
                if (response.ok) {
                  const data = await response.json();
                  if (data.llms && data.llms.length > 0) {
                    setAvailableLLMs(data.llms);
                  }
                }
              } catch (error) {
                console.error('刷新LLM列表失败:', error);
              }
            };
            fetchAvailableLLMs();
          }}
        />,
        document.body
      )}
    </div>
  );
}
