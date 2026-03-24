import { useEffect, useCallback } from 'react';

interface RewriteEventDetail {
  title: string;
  content: string;
}

/**
 * 监听 AI 修改完成事件的 Hook
 * @param onRewriteApplied 修改应用时的回调函数
 */
export const useAIRewrite = (onRewriteApplied: (title: string, content: string) => void) => {
  const handleRewriteApplied = useCallback((event: Event) => {
    const customEvent = event as CustomEvent<RewriteEventDetail>;
    if (customEvent.detail) {
      onRewriteApplied(customEvent.detail.title, customEvent.detail.content);
    }
  }, [onRewriteApplied]);

  useEffect(() => {
    window.addEventListener('ai-rewrite-applied', handleRewriteApplied);
    return () => {
      window.removeEventListener('ai-rewrite-applied', handleRewriteApplied);
    };
  }, [handleRewriteApplied]);
};

export default useAIRewrite;
