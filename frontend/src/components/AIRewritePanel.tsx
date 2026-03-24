import { useState, useEffect } from 'react';
import { aiRewriteArticle, ReviewResult } from '../services/aiRewriteApi';
import { useLanguage } from '../contexts/LanguageContext';
import './AIRewritePanel.css';

interface AIRewritePanelProps {
  title: string;
  content: string;
  reviewResults: ReviewResult[];
  onApply: (newTitle: string, newContent: string) => void;
  onCancel: () => void;
}

interface RewriteRound {
  round_num: number;
  new_title: string;
  new_content: string;
  explanation: string;
}

const AIRewritePanel: React.FC<AIRewritePanelProps> = ({
  title,
  content,
  reviewResults,
  onApply,
  onCancel,
}) => {
  const { t } = useLanguage();
  const [isRewriting, setIsRewriting] = useState(false);
  const [currentRound, setCurrentRound] = useState(0);
  const [rounds, setRounds] = useState<RewriteRound[]>([]);
  const [error, setError] = useState<string>('');
  const maxRounds = 1; // 固定只修改一轮
  
  // 组件挂载后自动开始修改
  useEffect(() => {
    let isCancelled = false;
    
    const doRewrite = async () => {
      if (rounds.length === 0 && !isRewriting) {
        setIsRewriting(true);
        setError('');

        try {
          console.log('[AIRewritePanel] 开始调用 AI 修改 API');
          console.log('[AIRewritePanel] 原文标题:', title);
          console.log('[AIRewritePanel] 原文内容长度:', content?.length);
          console.log('[AIRewritePanel] 评审结果数量:', reviewResults?.length);
          
          const response = await aiRewriteArticle({
            title: title,
            content: content,
            review_results: reviewResults,
            round_num: 1,
            max_rounds: 1,
            focus_areas: [],
          });

          console.log('[AIRewritePanel] API 响应:', response);
          console.log('[AIRewritePanel] 新标题:', response.new_title);
          console.log('[AIRewritePanel] 新内容长度:', response.new_content?.length);
          console.log('[AIRewritePanel] 修改说明:', response.explanation);

          if (!isCancelled) {
            const newRound: RewriteRound = {
              round_num: response.round_num,
              new_title: response.new_title,
              new_content: response.new_content,
              explanation: response.explanation,
            };

            setRounds([newRound]);
            setCurrentRound(response.round_num);
          }
        } catch (err: any) {
          console.error('[AIRewritePanel] 修改失败:', err);
          console.error('[AIRewritePanel] 错误详情:', err.response?.data || err.message);
          if (!isCancelled) {
            setError(t('ai_rewrite.error.failed') || `修改失败: ${err.message}`);
            setIsRewriting(false);
          }
        } finally {
          if (!isCancelled) {
            setIsRewriting(false);
          }
        }
      }
    };
    
    doRewrite();
    
    return () => {
      isCancelled = true;
    };
  }, [title, content, reviewResults]);

  // 继续下一轮修改（当前只支持一轮）
  const continueRewrite = () => {
    // 当前只支持一轮修改
    console.log('当前只支持一轮修改');
  };

  // 应用修改
  const handleApply = () => {
    console.log('[AIRewritePanel] 应用修改按钮被点击');
    console.log('[AIRewritePanel] rounds 数量:', rounds.length);
    if (rounds.length > 0) {
      const lastRound = rounds[rounds.length - 1];
      console.log('[AIRewritePanel] 应用修改 - 新标题:', lastRound.new_title);
      console.log('[AIRewritePanel] 应用修改 - 新内容前200字符:', lastRound.new_content?.substring(0, 200));
      onApply(lastRound.new_title, lastRound.new_content);
    } else {
      console.warn('[AIRewritePanel] 没有可应用的修改 rounds');
    }
  };

  // 选择重点优化方向（当前版本不使用）
  // const toggleFocusArea = (value: string) => {
  //   // 功能保留但当前不使用
  //   console.log('Toggle focus area:', value);
  // };

  // 渲染加载界面（自动开始，不需要配置）
  const renderLoading = () => (
    <div className="rewrite-loading">
      <div className="loading-spinner"></div>
      <h3>AI 正在根据评审意见修改文章...</h3>
      <p>请稍候，AI 正在分析评审结果并优化文章</p>
    </div>
  );

  // 渲染修改结果
  const renderResult = () => {
    if (rounds.length === 0) return null;

    const currentResult = rounds[rounds.length - 1];
    const prevContent = currentRound === 1 ? content : rounds[rounds.length - 2]?.new_content;

    return (
      <div className="rewrite-result">
        <div className="result-header">
          <h3>
            {(t('ai_rewrite.round_result') || '第 {round} 轮修改结果')
              .replace('{round}', currentResult.round_num.toString())}
          </h3>
          <div className="round-indicator">
            {Array.from({ length: maxRounds }, (_, i) => (
              <span
                key={i}
                className={`round-dot ${i < currentRound ? 'completed' : ''} ${
                  i === currentRound - 1 ? 'current' : ''
                }`}
              />
            ))}
          </div>
        </div>

        <div className="explanation-section">
          <h4>{t('ai_rewrite.explanation') || '修改说明'}:</h4>
          <p>{currentResult.explanation}</p>
        </div>

        <div className="comparison-section">
          <h4>{t('ai_rewrite.comparison') || '修改对比'}:</h4>
          
          <div className="title-comparison">
            <div className="old-title">
              <label>{t('ai_rewrite.original_title') || '原标题'}:</label>
              <span>{currentRound === 1 ? title : rounds[rounds.length - 2]?.new_title}</span>
            </div>
            <div className="new-title">
              <label>{t('ai_rewrite.new_title') || '新标题'}:</label>
              <span>{currentResult.new_title}</span>
            </div>
          </div>

          <div className="content-comparison">
            <div className="old-content">
              <label>{t('ai_rewrite.original_content') || '原文'}:</label>
              <div
                className="content-preview"
                dangerouslySetInnerHTML={{ __html: prevContent || content }}
              />
            </div>
            <div className="new-content">
              <label>{t('ai_rewrite.new_content') || '修改后'}:</label>
              <div
                className="content-preview"
                dangerouslySetInnerHTML={{ __html: currentResult.new_content }}
              />
            </div>
          </div>
        </div>

        <div className="result-actions">
          {currentRound < maxRounds ? (
            <button
              className="btn-primary"
              onClick={continueRewrite}
              disabled={isRewriting}
            >
              {isRewriting
                ? (t('ai_rewrite.continuing') || '继续修改中...')
                : (t('ai_rewrite.continue') || '继续修改')}
            </button>
          ) : null}
          
          <button
            className="btn-success"
            onClick={handleApply}
            disabled={isRewriting}
          >
            {t('ai_rewrite.apply') || '应用修改'}
          </button>
          
          <button className="btn-secondary" onClick={onCancel}>
            {t('common.cancel') || '取消'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="ai-rewrite-panel">
      {error && <div className="error-message">{error}</div>}
      {isRewriting && rounds.length === 0 ? renderLoading() : renderResult()}

    </div>
  );
};

export default AIRewritePanel;
