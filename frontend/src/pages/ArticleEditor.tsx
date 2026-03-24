import { useState, useEffect, useRef } from 'react';
import { postApi, PostCreate, PostUpdate } from '../services/postApi';
import { categoryApi, Category } from '../services/categoryApi';
import { fileApi } from '../services/fileApi';
import { aiWritingApi } from '../services/aiWritingApi';
import { ReaderReviewPanel } from '../components/ReaderReviewPanel';
import { MultiAgentReviewPanel } from '../components/MultiAgentReviewPanel';
import { useLoading } from '../contexts/LoadingContext';
import { useLanguage } from '../contexts/LanguageContext';

interface ArticleEditorProps {
  articleId?: number;
  onBack: () => void;
}

export function ArticleEditor({ articleId, onBack }: ArticleEditorProps) {
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isEdit, setIsEdit] = useState(false);
  const [formData, setFormData] = useState<PostCreate>({
    title: '',
    content_markdown: '',
    excerpt: '',
    cover_image: '',
    category_id: undefined,
    status: 'draft'
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<'local' | 'url'>('local');
  const [imageConfig, setImageConfig] = useState({
    url: '',
    alt: '',
    width: '100',
    align: 'center' as 'left' | 'center' | 'right',
    caption: ''
  });
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [isImportingPdf, setIsImportingPdf] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const { setLoading } = useLoading();
  
  // 撤销/重做历史记录
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const maxHistorySize = 50; // 最大历史记录数
  
  // 图片调整大小状态
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
  // const [isResizing, setIsResizing] = useState(false);
  // const resizeStartPos = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // AI 润色相关状态
  const [showAiPolishDialog, setShowAiPolishDialog] = useState(false);
  const [aiPolishStyle, setAiPolishStyle] = useState<'professional' | 'fluent' | 'concise' | 'creative'>('fluent');
  const [isAiPolishing, setIsAiPolishing] = useState(false);
  const [polishedText, setPolishedText] = useState('');
  const [showAiContinueDialog, setShowAiContinueDialog] = useState(false);
  const [isAiContinuing, setIsAiContinuing] = useState(false);
  const [aiContinueContext, setAiContinueContext] = useState('');
  const [continuedText, setContinuedText] = useState('');

  // 多智能体协作评审状态
  const [showMultiAgentReview, setShowMultiAgentReview] = useState(false);

  useEffect(() => {
    fetchCategories();
    if (articleId) {
      setIsEdit(true);
      fetchArticle();
    }
  }, [articleId]);

  const fetchCategories = async () => {
    try {
      const data = await categoryApi.getList();
      setCategories(data);
    } catch (err) {
      console.error('获取分类列表失败:', err);
    }
  };

  const fetchArticle = async () => {
    if (!articleId) return;
    
    try {
      setLoading(true, t('common.loading'));
      const article = await postApi.getById(articleId);
      setFormData({
        title: article.title,
        content_markdown: article.content_markdown || '',
        excerpt: article.excerpt || '',
        cover_image: article.cover_image || '',
        category_id: article.category_id || undefined,
        status: article.status,
      });
      // 通过 ref 设置编辑器内容，避免光标位置问题
      if (contentRef.current && article.content_markdown) {
        contentRef.current.innerHTML = article.content_markdown;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof PostCreate, value: string | number | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true, '上传中...');
      const response = await fileApi.uploadImage(file);
      handleChange('cover_image', response.url);
    } catch (err) {
      console.error('上传图片失败:', err);
      setError('上传图片失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (status?: 'draft' | 'published') => {
    const submitStatus = status || formData.status;
    
    try {
      setLoading(true, t('common.saving'));
      setError('');
      setSaving(true);

      if (isEdit && articleId) {
        const updateData: PostUpdate = {
          ...formData,
          status: submitStatus,
        };
        await postApi.update(articleId, updateData);
      } else {
        const createData: PostCreate = {
          ...formData,
          status: submitStatus,
        } as PostCreate;
        await postApi.create(createData);
      }

      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSaving(false);
      setLoading(false);
    }
  };

  // 保存当前选区
  const savedRange = useRef<Range | null>(null);

  // 保存选区
  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      savedRange.current = selection.getRangeAt(0);
    }
  };

  // 恢复选区
  const restoreSelection = () => {
    if (savedRange.current && contentRef.current) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(savedRange.current);
      }
    }
  };

  // 执行编辑器命令
  const execCommand = (command: string, value: string | undefined = undefined) => {
    restoreSelection();
    document.execCommand(command, false, value);
    if (contentRef.current) {
      handleChange('content_markdown', contentRef.current.innerHTML);
    }
  };

  // 插入标题
  const insertHeading = (level: number) => {
    execCommand('formatBlock', `H${level}`);
  };

  // 插入图片
  const insertImageToEditor = () => {
    if (!imageConfig.url) return;
    
    const alignStyle = {
      left: 'float: left; margin-right: 15px;',
      center: 'display: block; margin: 0 auto;',
      right: 'float: right; margin-left: 15px;'
    };

    const imgHtml = `
      <div style="text-align: ${imageConfig.align}; margin: 10px 0;">
        <img src="${imageConfig.url}" alt="${imageConfig.alt}" style="${alignStyle[imageConfig.align]} width: ${imageConfig.width}%; max-width: 100%;" />
        ${imageConfig.caption ? `<p style="text-align: center; color: #666; font-size: 14px; margin-top: 8px;">${imageConfig.caption}</p>` : ''}
      </div>
      <p style="clear: both;"></p>
    `;
    
    execCommand('insertHTML', imgHtml);
    setShowImageDialog(false);
    // 插入后立即保存历史记录
    setTimeout(() => saveHistory(), 100);
  };

  // 处理本地图片上传
  const handleLocalImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件');
      return;
    }

    try {
      setLoading(true, '上传图片中...');
      const response = await fileApi.uploadImage(file);
      setImageConfig({ ...imageConfig, url: response.url });
      setError('');
    } catch (err) {
      console.error('上传图片失败:', err);
      setError('上传图片失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 处理 PDF 导入
  const handlePdfImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('请选择 PDF 文件');
      return;
    }

    try {
      setIsImportingPdf(true);
      setLoading(true, '正在解析 PDF...');

      // 创建 FormData 上传 PDF 到后端解析
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://localhost:8000/api/parse-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('PDF 解析失败');
      }

      const data = await response.json();
      const fullText = data.text || '';

      // 将提取的文本插入到编辑器
      if (contentRef.current && fullText) {
        // 保留原始格式：将换行符转换为 <br> 或段落
        const lines = fullText.split('\n');
        let htmlContent = '';
        let currentParagraph = '';
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          
          if (trimmedLine === '') {
            // 空行表示段落结束
            if (currentParagraph) {
              htmlContent += `<p>${currentParagraph}</p>`;
              currentParagraph = '';
            }
          } else {
            // 非空行，添加到当前段落
            if (currentParagraph) {
              currentParagraph += '<br>' + trimmedLine;
            } else {
              currentParagraph = trimmedLine;
            }
          }
        }
        
        // 处理最后一个段落
        if (currentParagraph) {
          htmlContent += `<p>${currentParagraph}</p>`;
        }
        
        // 如果编辑器为空，直接设置内容
        if (!contentRef.current.innerHTML || contentRef.current.innerHTML === '<p>开始写作...</p>') {
          contentRef.current.innerHTML = htmlContent;
        } else {
          // 否则在末尾追加
          contentRef.current.innerHTML += htmlContent;
        }
        
        handleChange('content_markdown', contentRef.current.innerHTML);
      }

      // 使用文件名作为标题（如果标题为空）
      // 注意：这里使用组件状态的 formData，不是本地的 FormData 对象
      const currentTitle = (document.getElementById('title') as HTMLInputElement)?.value;
      if (!currentTitle) {
        const fileName = file.name.replace('.pdf', '');
        handleChange('title', fileName);
      }

      setError('');
    } catch (err) {
      console.error('PDF 解析失败:', err);
      setError('PDF 解析失败，请确保文件格式正确');
    } finally {
      setLoading(false);
      setIsImportingPdf(false);
    }
  };

  // 保存历史记录
  const saveHistory = () => {
    if (contentRef.current) {
      const currentContent = contentRef.current.innerHTML;
      
      // 如果内容没有变化，不保存
      if (historyIndex >= 0 && history[historyIndex] === currentContent) {
        return;
      }
      
      // 删除当前位置之后的历史记录（当用户撤销后进行了新操作）
      const newHistory = history.slice(0, historyIndex + 1);
      
      // 添加新记录
      newHistory.push(currentContent);
      
      // 限制历史记录数量
      if (newHistory.length > maxHistorySize) {
        newHistory.shift();
      }
      
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  };

  // 撤销操作
  const undo = () => {
    if (historyIndex > 0 && contentRef.current) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      contentRef.current.innerHTML = history[newIndex];
      handleChange('content_markdown', history[newIndex]);
    }
  };

  // 重做操作
  const redo = () => {
    if (historyIndex < history.length - 1 && contentRef.current) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      contentRef.current.innerHTML = history[newIndex];
      handleChange('content_markdown', history[newIndex]);
    }
  };

  // AI 润色功能
  const handleAiPolish = async () => {
    const selectedText = window.getSelection()?.toString();
    const content = selectedText || contentRef.current?.innerText || '';
    
    if (!content.trim()) {
      alert(t('ai.polish.error.empty'));
      return;
    }

    setIsAiPolishing(true);
    try {
      const response = await aiWritingApi.polishText({
        text: content,
        style: aiPolishStyle
      });
      
      if (response.data.success) {
        setPolishedText(response.data.polished);
      } else {
        alert(t('ai.polish.error.failed') + ': ' + response.data.error);
      }
    } catch (err) {
      console.error('AI polish failed:', err);
      alert(t('ai.polish.error.failed'));
    } finally {
      setIsAiPolishing(false);
    }
  };

  // 应用润色后的文本
  const applyPolishedText = () => {
    if (contentRef.current && polishedText) {
      const selectedText = window.getSelection()?.toString();
      if (selectedText) {
        // 如果有选中的文本，只替换选中的部分
        document.execCommand('insertText', false, polishedText);
      } else {
        // 如果没有选中的文本，替换全部内容
        contentRef.current.innerText = polishedText;
      }
      handleChange('content_markdown', contentRef.current.innerHTML);
      saveHistory();
      setShowAiPolishDialog(false);
      setPolishedText('');
    }
  };

  // AI 续写功能
  const handleAiContinue = async () => {
    const content = contentRef.current?.innerText || '';
    
    if (!content.trim()) {
      alert(t('ai.continue.error.empty'));
      return;
    }

    setIsAiContinuing(true);
    try {
      const response = await aiWritingApi.continueWriting({
        text: content,
        context: aiContinueContext
      });
      
      if (response.data.success) {
        setContinuedText(response.data.continuation);
      } else {
        alert(t('ai.continue.error.failed') + ': ' + response.data.error);
      }
    } catch (err) {
      console.error('AI continue failed:', err);
      alert(t('ai.continue.error.failed'));
    } finally {
      setIsAiContinuing(false);
    }
  };

  // 应用续写的文本
  const applyContinuedText = () => {
    if (contentRef.current && continuedText) {
      // 在内容末尾添加续写的内容
      const currentContent = contentRef.current.innerHTML;
      const newContent = currentContent + '<p>' + continuedText + '</p>';
      contentRef.current.innerHTML = newContent;
      handleChange('content_markdown', newContent);
      saveHistory();
      setShowAiContinueDialog(false);
      setContinuedText('');
      setAiContinueContext('');
    }
  };

  // 处理内容变化（带防抖的历史记录保存）
  const saveHistoryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const handleContentChange = () => {
    if (contentRef.current) {
      handleChange('content_markdown', contentRef.current.innerHTML);
      
      // 防抖保存历史记录（1秒后保存）
      if (saveHistoryTimeoutRef.current) {
        clearTimeout(saveHistoryTimeoutRef.current);
      }
      saveHistoryTimeoutRef.current = setTimeout(() => {
        saveHistory();
      }, 1000);
    }
  };

  // 初始化历史记录
  useEffect(() => {
    if (contentRef.current && history.length === 0) {
      const initialContent = contentRef.current.innerHTML;
      setHistory([initialContent]);
      setHistoryIndex(0);
    }
  }, []);

  // 监听键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z 撤销
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Ctrl+Y 或 Ctrl+Shift+Z 重做
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      // Escape 取消图片选择
      if (e.key === 'Escape') {
        setSelectedImage(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, historyIndex]);

  // 处理编辑器点击事件（用于选择图片）
  const handleEditorClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // 如果点击的是调整手柄，不处理
    if (target.classList.contains('resize-handle')) {
      return;
    }
    
    // 如果点击的是图片，选中它
    if (target.tagName === 'IMG') {
      e.preventDefault();
      e.stopPropagation();
      const img = target as HTMLImageElement;
      setSelectedImage(img);
      // 立即添加调整手柄到图片
      addResizeHandlesToImage(img);
    } else {
      // 点击其他地方，取消选择
      if (selectedImage) {
        removeResizeHandlesFromImage(selectedImage);
      }
      setSelectedImage(null);
    }
  };

  // 添加调整手柄到图片
  const addResizeHandlesToImage = (img: HTMLImageElement) => {
    // 先移除已有的手柄
    removeResizeHandlesFromImage(img);
    
    // 将图片包装在一个相对定位的容器中
    const wrapper = document.createElement('div');
    wrapper.className = 'image-resize-wrapper';
    wrapper.style.cssText = `
      position: relative;
      display: inline-block;
      line-height: 0;
    `;
    
    // 创建手柄容器
    const handleContainer = document.createElement('div');
    handleContainer.className = 'image-resize-handles-container';
    handleContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      border: 2px solid #333333;
      pointer-events: none;
      z-index: 1000;
    `;
    
    // 创建四个角的手柄
    const corners = [
      { name: 'nw', cursor: 'nw-resize' },
      { name: 'ne', cursor: 'ne-resize' },
      { name: 'sw', cursor: 'sw-resize' },
      { name: 'se', cursor: 'se-resize' }
    ];
    
    corners.forEach(corner => {
      const handle = document.createElement('div');
      handle.className = `resize-handle resize-handle-${corner.name}`;
      
      // 设置手柄位置
      let positionStyles = '';
      if (corner.name.includes('n')) positionStyles += 'top: -6px;';
      if (corner.name.includes('s')) positionStyles += 'bottom: -6px;';
      if (corner.name.includes('w')) positionStyles += 'left: -6px;';
      if (corner.name.includes('e')) positionStyles += 'right: -6px;';
      
      handle.style.cssText = `
        position: absolute;
        width: 12px;
        height: 12px;
        background: #333333;
        border: 2px solid white;
        border-radius: 50%;
        cursor: ${corner.cursor};
        pointer-events: auto;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        ${positionStyles}
      `;
      
      // 绑定鼠标事件
      handle.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = img.offsetWidth;
        const startHeight = img.offsetHeight;
        
        const onMouseMove = (moveEvent: MouseEvent) => {
          const deltaX = moveEvent.clientX - startX;
          const deltaY = moveEvent.clientY - startY;
          
          let newWidth = startWidth;
          let newHeight = startHeight;
          
          // 根据角计算新尺寸
          if (corner.name === 'se') {
            newWidth = Math.max(50, startWidth + deltaX);
            newHeight = Math.max(50, startHeight + deltaY);
          } else if (corner.name === 'sw') {
            newWidth = Math.max(50, startWidth - deltaX);
            newHeight = Math.max(50, startHeight + deltaY);
          } else if (corner.name === 'ne') {
            newWidth = Math.max(50, startWidth + deltaX);
            newHeight = Math.max(50, startHeight - deltaY);
          } else if (corner.name === 'nw') {
            newWidth = Math.max(50, startWidth - deltaX);
            newHeight = Math.max(50, startHeight - deltaY);
          }
          
          // 保持宽高比
          const aspectRatio = startWidth / startHeight;
          if (Math.abs(deltaX) > Math.abs(deltaY)) {
            newHeight = newWidth / aspectRatio;
          } else {
            newWidth = newHeight * aspectRatio;
          }
          
          img.style.width = newWidth + 'px';
          img.style.height = newHeight + 'px';
        };
        
        const onMouseUp = () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          // 保存历史记录
          if (contentRef.current) {
            handleChange('content_markdown', contentRef.current.innerHTML);
            setTimeout(() => saveHistory(), 100);
          }
        };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      };
      
      handleContainer.appendChild(handle);
    });
    
    // 将图片包装在容器中
    if (img.parentNode) {
      img.parentNode.insertBefore(wrapper, img);
      wrapper.appendChild(img);
      wrapper.appendChild(handleContainer);
    }
  };

  // 移除图片的调整手柄
  const removeResizeHandlesFromImage = (img: HTMLImageElement) => {
    const wrapper = img.closest('.image-resize-wrapper');
    if (wrapper && wrapper.parentNode) {
      wrapper.parentNode.insertBefore(img, wrapper);
      wrapper.remove();
    }
  };

  // 开始调整大小（暂时未使用）
  /*
  const startResize = (e: React.MouseEvent, corner: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!selectedImage) return;
    
    // setIsResizing(true);
    resizeStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      width: selectedImage.offsetWidth,
      height: selectedImage.offsetHeight
    };

    // 强制重新渲染手柄以隐藏它（调整过程中不显示手柄）
    const currentSelectedImage = selectedImage;
    setSelectedImage(null);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!currentSelectedImage) return;
      
      const deltaX = moveEvent.clientX - resizeStartPos.current.x;
      const deltaY = moveEvent.clientY - resizeStartPos.current.y;
      
      let newWidth = resizeStartPos.current.width;
      let newHeight = resizeStartPos.current.height;
      
      // 根据拖拽的角计算新尺寸
      // corner 可能是: 'nw', 'ne', 'sw', 'se'
      if (corner === 'se' || corner === 'ne') {
        // 右侧手柄：向右拖动增加宽度
        newWidth = Math.max(50, resizeStartPos.current.width + deltaX);
      }
      if (corner === 'nw' || corner === 'sw') {
        // 左侧手柄：向右拖动减小宽度
        newWidth = Math.max(50, resizeStartPos.current.width - deltaX);
      }
      if (corner === 'se' || corner === 'sw') {
        // 底部手柄：向下拖动增加高度
        newHeight = Math.max(50, resizeStartPos.current.height + deltaY);
      }
      if (corner === 'nw' || corner === 'ne') {
        // 顶部手柄：向下拖动减小高度
        newHeight = Math.max(50, resizeStartPos.current.height - deltaY);
      }
      
      // 保持宽高比
      const aspectRatio = resizeStartPos.current.width / resizeStartPos.current.height;
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        newHeight = newWidth / aspectRatio;
      } else {
        newWidth = newHeight * aspectRatio;
      }
      
      currentSelectedImage.style.width = `${newWidth}px`;
      currentSelectedImage.style.height = `${newHeight}px`;
    };

    const handleMouseUp = () => {
      // setIsResizing(false);
      // 重新添加手柄到调整后的图片
      if (currentSelectedImage) {
        addResizeHandlesToImage(currentSelectedImage);
      }
      // 保存历史记录
      if (contentRef.current) {
        handleChange('content_markdown', contentRef.current.innerHTML);
        setTimeout(() => saveHistory(), 100);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  */

  return (
    <div className="editor-layout">
      {/* 页面头部操作区 */}
      <div className="editor-header-bar">
        <div className="header-content">
          <h2 className="editor-title">{isEdit ? t('article.editor.edit') : t('article.editor.new')}</h2>
          <button className="btn-back" onClick={onBack} disabled={saving}>
            {t('common.back')}
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* 主编辑区域 - 上下结构 */}
      <div className="editor-main-container">
        {/* 上部：标题和正文编辑区 */}
        <div className="editor-content-section">
          <div className="title-section">
            <div className="title-input-wrapper">
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder={t('article.editor.title.placeholder')}
                disabled={saving}
                className="main-title-input"
              />
            </div>
          </div>

          <div className="editor-workspace">
            <div className="editor-tabs">
              <span className="editor-label">{t('article.editor.content')}</span>
            </div>

            {/* 工具栏 */}
            <div className="toolbar">
              <div className="toolbar-group">
                <button className="toolbar-btn" onClick={undo} title="撤销 (Ctrl+Z)" disabled={historyIndex <= 0}>↩️ 撤销</button>
                <button className="toolbar-btn" onClick={redo} title="重做 (Ctrl+Y)" disabled={historyIndex >= history.length - 1}>↪️ 重做</button>
              </div>
              <div className="toolbar-divider"></div>
              <div className="toolbar-group">
                <button className="toolbar-btn" onClick={() => insertHeading(1)} title="大标题">H1</button>
                <button className="toolbar-btn" onClick={() => insertHeading(2)} title="中标题">H2</button>
                <button className="toolbar-btn" onClick={() => insertHeading(3)} title="小标题">H3</button>
              </div>
              <div className="toolbar-divider"></div>
              <div className="toolbar-group">
                <button className="toolbar-btn" onClick={() => execCommand('bold')} title="粗体"><b>B</b></button>
                <button className="toolbar-btn" onClick={() => execCommand('italic')} title="斜体"><i>I</i></button>
                <button className="toolbar-btn" onClick={() => execCommand('underline')} title="下划线"><u>U</u></button>
                <button className="toolbar-btn" onClick={() => execCommand('strikeThrough')} title="删除线"><s>S</s></button>
              </div>
              <div className="toolbar-divider"></div>
              <div className="toolbar-group">
                <button className="toolbar-btn" onClick={() => execCommand('insertUnorderedList')} title="无序列表">• 列表</button>
                <button className="toolbar-btn" onClick={() => execCommand('insertOrderedList')} title="有序列表">1. 列表</button>
              </div>
              <div className="toolbar-divider"></div>
              <div className="toolbar-group">
                <button className="toolbar-btn" onClick={() => execCommand('justifyLeft')} title="左对齐">⬅️</button>
                <button className="toolbar-btn" onClick={() => execCommand('justifyCenter')} title="居中">⬇️</button>
                <button className="toolbar-btn" onClick={() => execCommand('justifyRight')} title="右对齐">➡️</button>
              </div>
              <div className="toolbar-divider"></div>
              <div className="toolbar-group">
                <button className="toolbar-btn" onClick={() => {
                  saveSelection();
                  setShowLinkDialog(true);
                }} title="插入链接">🔗 链接</button>
                <button className="toolbar-btn" onClick={() => {
                  saveSelection();
                  setShowImageDialog(true);
                }} title="插入图片">🖼️ 图片</button>
                <label className="toolbar-btn" title="导入 PDF" style={{ cursor: 'pointer' }}>
                  📄 PDF
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handlePdfImport}
                    style={{ display: 'none' }}
                    disabled={isImportingPdf}
                  />
                </label>
              </div>
              <div className="toolbar-divider"></div>
              <div className="toolbar-group">
                <button 
                  className="toolbar-btn ai-btn" 
                  onClick={() => setShowAiPolishDialog(true)}
                  title={t('ai.polish.title')}
                  disabled={isAiPolishing}
                >
                  {t('ai.polish.title')}
                </button>
                <button 
                  className="toolbar-btn ai-btn" 
                  onClick={() => setShowAiContinueDialog(true)}
                  title={t('ai.continue.title')}
                  disabled={isAiContinuing}
                >
                  {t('ai.continue.title')}
                </button>
              </div>
            </div>

            {/* 编辑器内容区 */}
            <div
              ref={contentRef}
              className="content-editor"
              contentEditable
              onInput={handleContentChange}
              onClick={handleEditorClick}
              data-placeholder="开始写作..."
            />
          </div>
        </div>

        {/* 下部：设置选项区 */}
        <div className="editor-settings-section">
          <div className="settings-grid">
            <div className="setting-card">
              <h4 className="setting-title">{t('article.editor.publish')}</h4>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value as 'draft' | 'published' | 'private')}
                className="setting-select"
              >
                <option value="draft">{t('article.status.draft')}</option>
                <option value="published">{t('article.status.published')}</option>
                <option value="private">{t('article.status.private')}</option>
              </select>
              <div className="setting-actions">
                <button 
                  className="btn-publish" 
                  onClick={() => handleSubmit('published')}
                  disabled={saving || !formData.title}
                >
                  {saving ? t('common.saving') : t('article.editor.publish')}
                </button>
                <button 
                  className="btn-draft" 
                  onClick={() => handleSubmit('draft')}
                  disabled={saving || !formData.title}
                >
                  {t('article.editor.save_draft')}
                </button>
              </div>
            </div>

            <div className="setting-card">
              <h4 className="setting-title">{t('article.editor.category')}</h4>
              <select
                value={formData.category_id || ''}
                onChange={(e) => handleChange('category_id', e.target.value ? parseInt(e.target.value) : undefined)}
                className="setting-select"
              >
                <option value="">{t('article.editor.category.select')}</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="setting-card">
              <h4 className="setting-title">{t('article.editor.excerpt')}</h4>
              <textarea
                value={formData.excerpt}
                onChange={(e) => handleChange('excerpt', e.target.value)}
                placeholder={t('article.editor.excerpt.placeholder')}
                className="setting-textarea"
                rows={3}
              />
            </div>

            <div className="setting-card">
              <h4 className="setting-title">{t('article.editor.cover')}</h4>
              {formData.cover_image && (
                <div className="cover-preview">
                  <img src={formData.cover_image} alt="Cover" />
                  <button 
                    className="btn-remove-cover"
                    onClick={() => handleChange('cover_image', '')}
                  >
                    ×
                  </button>
                </div>
              )}
              <label className="btn-upload">
                {formData.cover_image ? '更换图片' : '上传图片'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
              </label>
              <input
                type="text"
                value={formData.cover_image || ''}
                onChange={(e) => handleChange('cover_image', e.target.value)}
                placeholder="或输入图片 URL"
                className="setting-input"
              />
            </div>
          </div>
        </div>

        {/* 读者评审区 */}
        <div className="editor-review-section">
          <ReaderReviewPanel 
            title={formData.title}
            content={formData.content_markdown}
            onApplyRewrite={(newTitle, newContent) => {
              console.log('[ArticleEditor] onApplyRewrite 被调用');
              console.log('[ArticleEditor] 新标题:', newTitle);
              console.log('[ArticleEditor] 新内容长度:', newContent?.length);
              console.log('[ArticleEditor] 新内容前200字符:', newContent?.substring(0, 200));
              // 更新状态
              setFormData(prev => ({
                ...prev,
                title: newTitle,
                content_markdown: newContent
              }));
              // 同步更新编辑器内容
              if (contentRef.current) {
                console.log('[ArticleEditor] 更新编辑器内容');
                contentRef.current.innerHTML = newContent;
              } else {
                console.warn('[ArticleEditor] contentRef.current 为空');
              }
              // 保存到历史记录
              saveHistory();
              // 提示用户
              alert('AI 修改已应用到文章！');
            }}
            onOpenMultiAgentReview={() => setShowMultiAgentReview(true)}
          />
        </div>
      </div>

      {/* 多智能体协作评审面板 */}
      <MultiAgentReviewPanel
        isOpen={showMultiAgentReview}
        onClose={() => setShowMultiAgentReview(false)}
        title={formData.title}
        content={formData.content_markdown}
        onApplyRewrite={(newTitle, newContent) => {
          setFormData(prev => ({
            ...prev,
            title: newTitle,
            content_markdown: newContent
          }));
          if (contentRef.current) {
            contentRef.current.innerHTML = newContent;
          }
          saveHistory();
          alert('多智能体评审建议已应用！');
        }}
      />

      {/* 链接插入对话框 */}
      {showLinkDialog && (
        <div className="modal-overlay" onClick={() => setShowLinkDialog(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>插入链接</h3>
              <button className="modal-close" onClick={() => setShowLinkDialog(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <label className="form-label">链接文字</label>
                <input
                  type="text"
                  className="form-input"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="显示的文字"
                  autoFocus
                />
              </div>
              <div className="form-row">
                <label className="form-label">链接地址</label>
                <input
                  type="text"
                  className="form-input"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowLinkDialog(false)}>
                取消
              </button>
              <button 
                className="btn-insert" 
                onClick={() => {
                  if (linkUrl && contentRef.current) {
                    // 自动添加 http:// 前缀（如果没有协议）
                    let url = linkUrl.trim();
                    if (!url.startsWith('http://') && !url.startsWith('https://')) {
                      url = 'https://' + url;
                    }
                    
                    restoreSelection();
                    
                    // 创建链接元素
                    const selection = window.getSelection();
                    if (selection && selection.rangeCount > 0) {
                      const range = selection.getRangeAt(0);
                      const selectedText = range.toString();
                      
                      // 创建链接元素
                      const link = document.createElement('a');
                      link.href = url;
                      link.target = '_blank';
                      link.rel = 'noopener noreferrer';
                      link.textContent = linkText || selectedText || url;
                      link.style.color = '#333333';
                      link.style.textDecoration = 'underline';
                      link.style.cursor = 'pointer';
                      
                      if (selectedText) {
                        range.deleteContents();
                      }
                      range.insertNode(link);
                      
                      // 将光标移到链接后面
                      range.setStartAfter(link);
                      range.setEndAfter(link);
                      selection.removeAllRanges();
                      selection.addRange(range);
                      
                      // 更新内容
                      handleChange('content_markdown', contentRef.current.innerHTML);
                      // 插入后立即保存历史记录
                      setTimeout(() => saveHistory(), 100);
                    }
                    
                    setShowLinkDialog(false);
                    setLinkUrl('');
                    setLinkText('');
                  }
                }}
                disabled={!linkUrl}
              >
                插入链接
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 图片插入对话框 */}
      {showImageDialog && (
        <div className="modal-overlay" onClick={() => setShowImageDialog(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>插入图片</h3>
              <button className="modal-close" onClick={() => setShowImageDialog(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="upload-tabs">
                <button 
                  className={`upload-tab ${uploadMethod === 'local' ? 'active' : ''}`}
                  onClick={() => setUploadMethod('local')}
                >
                  📁 本地上传
                </button>
                <button 
                  className={`upload-tab ${uploadMethod === 'url' ? 'active' : ''}`}
                  onClick={() => setUploadMethod('url')}
                >
                  🔗 网络链接
                </button>
              </div>

              {uploadMethod === 'local' ? (
                <div className="form-row">
                  <label className="form-label">从本地选择图片</label>
                  <div className="file-upload-area">
                    <input
                      type="file"
                      id="local-image-upload"
                      accept="image/*"
                      onChange={handleLocalImageUpload}
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="local-image-upload" className="file-upload-btn">
                      📤 选择图片文件
                    </label>
                    <p className="file-upload-hint">支持 JPG、PNG、GIF 等常见图片格式</p>
                  </div>
                </div>
              ) : (
                <div className="form-row">
                  <label className="form-label">图片 URL *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={imageConfig.url}
                    onChange={(e) => setImageConfig({ ...imageConfig, url: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
              )}

              <div className="form-row">
                <label className="form-label">替代文本</label>
                <input
                  type="text"
                  className="form-input"
                  value={imageConfig.alt}
                  onChange={(e) => setImageConfig({ ...imageConfig, alt: e.target.value })}
                  placeholder="图片描述"
                />
              </div>

              <div className="form-row">
                <label className="form-label">图片宽度</label>
                <div className="width-selector">
                  <input
                    type="range"
                    min="20"
                    max="100"
                    value={imageConfig.width}
                    onChange={(e) => setImageConfig({ ...imageConfig, width: e.target.value })}
                    className="width-slider"
                  />
                  <span className="width-value">{imageConfig.width}%</span>
                </div>
              </div>

              <div className="form-row">
                <label className="form-label">对齐方式</label>
                <div className="align-options">
                  <button
                    className={`align-btn ${imageConfig.align === 'left' ? 'active' : ''}`}
                    onClick={() => setImageConfig({ ...imageConfig, align: 'left' })}
                  >
                    ⬅️ 左
                  </button>
                  <button
                    className={`align-btn ${imageConfig.align === 'center' ? 'active' : ''}`}
                    onClick={() => setImageConfig({ ...imageConfig, align: 'center' })}
                  >
                    ⬇️ 中
                  </button>
                  <button
                    className={`align-btn ${imageConfig.align === 'right' ? 'active' : ''}`}
                    onClick={() => setImageConfig({ ...imageConfig, align: 'right' })}
                  >
                    ➡️ 右
                  </button>
                </div>
              </div>

              <div className="form-row">
                <label className="form-label">图片说明（可选）</label>
                <textarea
                  className="form-textarea"
                  value={imageConfig.caption}
                  onChange={(e) => setImageConfig({ ...imageConfig, caption: e.target.value })}
                  placeholder="为图片添加说明文字"
                  rows={2}
                />
              </div>

              {imageConfig.url && (
                <div className="form-row">
                  <label className="form-label">预览</label>
                  <div className="image-preview-container">
                    <img 
                      src={imageConfig.url} 
                      alt={imageConfig.alt}
                      style={{ 
                        width: `${imageConfig.width}%`,
                        maxWidth: '100%',
                        display: imageConfig.align === 'center' ? 'block' : 'inline',
                        marginLeft: imageConfig.align === 'right' ? 'auto' : '0',
                        marginRight: imageConfig.align === 'left' ? 'auto' : '0'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowImageDialog(false)}>
                取消
              </button>
              <button 
                className="btn-insert" 
                onClick={insertImageToEditor}
                disabled={!imageConfig.url}
              >
                插入图片
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI 润色对话框 */}
      {showAiPolishDialog && (
        <div className="modal-overlay" onClick={() => setShowAiPolishDialog(false)}>
          <div className="modal-content ai-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('ai.polish.title')}</h3>
              <button className="modal-close" onClick={() => setShowAiPolishDialog(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <label className="form-label">{t('ai.polish.style')}</label>
                <select
                  className="form-select"
                  value={aiPolishStyle}
                  onChange={(e) => setAiPolishStyle(e.target.value as any)}
                >
                  <option value="fluent">{t('ai.polish.style.fluent')}</option>
                  <option value="professional">{t('ai.polish.style.professional')}</option>
                  <option value="concise">{t('ai.polish.style.concise')}</option>
                  <option value="creative">{t('ai.polish.style.creative')}</option>
                </select>
              </div>
              
              {!polishedText ? (
                <div className="ai-action-area">
                  <p className="ai-hint">
                    {window.getSelection()?.toString() 
                      ? t('ai.polish.hint.selected')
                      : t('ai.polish.hint.full')}
                  </p>
                  <button
                    className="btn-ai-action"
                    onClick={handleAiPolish}
                    disabled={isAiPolishing}
                  >
                    {isAiPolishing ? t('ai.polish.polishing') : t('ai.polish.start')}
                  </button>
                </div>
              ) : (
                <div className="ai-result-area">
                  <div className="form-row">
                    <label className="form-label">{t('ai.polish.result')}</label>
                    <textarea
                      className="form-textarea"
                      value={polishedText}
                      onChange={(e) => setPolishedText(e.target.value)}
                      rows={10}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => {
                setShowAiPolishDialog(false);
                setPolishedText('');
              }}>
                {t('ai.cancel')}
              </button>
              {polishedText && (
                <button 
                  className="btn-insert" 
                  onClick={applyPolishedText}
                >
                  {t('ai.polish.apply')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI 续写对话框 */}
      {showAiContinueDialog && (
        <div className="modal-overlay" onClick={() => setShowAiContinueDialog(false)}>
          <div className="modal-content ai-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('ai.continue.title')}</h3>
              <button className="modal-close" onClick={() => setShowAiContinueDialog(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <label className="form-label">{t('ai.continue.context')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={aiContinueContext}
                  onChange={(e) => setAiContinueContext(e.target.value)}
                  placeholder={t('ai.continue.context.placeholder')}
                />
              </div>
              
              {!continuedText ? (
                <div className="ai-action-area">
                  <p className="ai-hint">
                    {t('ai.continue.hint')}
                  </p>
                  <button
                    className="btn-ai-action"
                    onClick={handleAiContinue}
                    disabled={isAiContinuing}
                  >
                    {isAiContinuing ? t('ai.continue.continuing') : t('ai.continue.start')}
                  </button>
                </div>
              ) : (
                <div className="ai-result-area">
                  <div className="form-row">
                    <label className="form-label">{t('ai.continue.result')}</label>
                    <textarea
                      className="form-textarea"
                      value={continuedText}
                      onChange={(e) => setContinuedText(e.target.value)}
                      rows={10}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => {
                setShowAiContinueDialog(false);
                setContinuedText('');
                setAiContinueContext('');
              }}>
                {t('ai.cancel')}
              </button>
              {continuedText && (
                <button 
                  className="btn-insert" 
                  onClick={applyContinuedText}
                >
                  {t('ai.continue.insert')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      
      <style>{`
        .editor-layout {
          width: 100%;
          margin: 0;
          padding: 0;
        }

        .editor-header-bar {
          background: white;
          border-bottom: 2px solid #e1e4e8;
        }

        .header-content {
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .editor-title {
          font-size: 24px;
          font-weight: 600;
          color: #24292e;
          margin: 0;
        }

        .btn-back {
          padding: 8px 16px;
          background: #f6f8fa;
          border: 1px solid #d1d5da;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .btn-back:hover {
          background: #e1e4e8;
        }

        .editor-main-container {
          display: flex;
          flex-direction: column;
          gap: 30px;
          padding: 30px;
          background: #f6f8fa;
        }

        .editor-content-section {
          width: 100%;
        }

        .title-section {
          margin-bottom: 20px;
        }

        .title-input-wrapper {
          max-width: 1400px;
          margin: 0 auto;
        }

        .main-title-input {
          width: 100%;
          padding: 16px 20px;
          font-size: 28px;
          font-weight: 700;
          border: 2px solid #e1e4e8;
          border-radius: 8px;
          transition: all 0.2s;
          background: white;
        }

        .main-title-input:focus {
          outline: none;
          border-color: #333333;
          box-shadow: 0 0 0 3px rgba(0,0,0,0.1);
        }

        .editor-workspace {
          background: white;
          border: 1px solid #e1e4e8;
          border-radius: 8px;
          overflow: hidden;
          width: 100%;
          position: relative;
        }

        .editor-tabs {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #f6f8fa;
          border-bottom: 1px solid #e1e4e8;
        }

        .editor-label {
          font-weight: 600;
          color: #24292e;
          font-size: 14px;
        }

        .toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          padding: 12px 16px;
          background: #fafbfc;
          border-bottom: 1px solid #e1e4e8;
          align-items: center;
        }

        .toolbar-group {
          display: flex;
          gap: 4px;
        }

        .toolbar-divider {
          width: 1px;
          height: 24px;
          background: #d1d5da;
          margin: 0 4px;
        }

        .toolbar-btn {
          padding: 6px 12px;
          background: white;
          border: 1px solid #d1d5da;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
          min-width: 36px;
        }

        .toolbar-btn:hover {
          background: #f6f8fa;
          border-color: #333333;
        }

        .toolbar-btn:active {
          background: #e1e4e8;
        }

        .content-editor {
          min-height: 500px;
          padding: 24px 32px;
          font-size: 16px;
          line-height: 1.8;
          outline: none;
        }

        .content-editor:empty:before {
          content: attr(placeholder);
          color: #999;
          font-style: italic;
        }

        .content-editor h1 {
          font-size: 2em;
          margin: 0.67em 0;
          font-weight: bold;
        }

        .content-editor h2 {
          font-size: 1.5em;
          margin: 0.75em 0;
          font-weight: bold;
        }

        .content-editor h3 {
          font-size: 1.17em;
          margin: 0.83em 0;
          font-weight: bold;
        }

        .content-editor p {
          margin: 1em 0;
        }

        .content-editor ul, .content-editor ol {
          margin: 1em 0;
          padding-left: 40px;
        }

        .content-editor li {
          margin: 0.5em 0;
        }

        .content-editor img {
          max-width: 100%;
          height: auto;
        }

        .content-editor a {
          color: #333333;
          text-decoration: underline;
        }

        .editor-settings-section {
          width: 100%;
          max-width: 1400px;
          margin: 0 auto;
        }

        .settings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
        }

        .setting-card {
          background: white;
          padding: 24px;
          border: 1px solid #e1e4e8;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .setting-title {
          font-size: 14px;
          font-weight: 600;
          color: #24292e;
          margin: 0 0 12px 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .setting-select,
        .setting-textarea,
        .setting-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #d1d5da;
          border-radius: 6px;
          font-size: 14px;
          transition: all 0.2s;
        }

        .setting-select:focus,
        .setting-textarea:focus,
        .setting-input:focus {
          outline: none;
          border-color: #333333;
          box-shadow: 0 0 0 3px rgba(0,0,0,0.1);
        }

        .setting-textarea {
          resize: vertical;
          font-family: inherit;
        }

        .setting-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 12px;
        }

        .btn-publish {
          padding: 10px 16px;
          background: #333333;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .btn-publish:hover:not(:disabled) {
          background: #1a1a1a;
        }

        .btn-publish:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-draft {
          padding: 10px 16px;
          background: #f6f8fa;
          color: #24292e;
          border: 1px solid #d1d5da;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .btn-draft:hover {
          background: #e1e4e8;
        }

        .cover-preview {
          position: relative;
          width: 100%;
          margin-bottom: 12px;
          border-radius: 6px;
          overflow: hidden;
        }

        .cover-preview img {
          width: 100%;
          height: 150px;
          object-fit: cover;
        }

        .btn-remove-cover {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 28px;
          height: 28px;
          background: rgba(0,0,0,0.7);
          color: white;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          font-size: 18px;
          line-height: 1;
        }

        .btn-upload {
          display: inline-block;
          padding: 8px 16px;
          background: #f6f8fa;
          border: 1px solid #d1d5da;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          width: 100%;
          text-align: center;
          transition: all 0.2s;
        }

        .btn-upload:hover {
          background: #e1e4e8;
        }

        .error-message {
          background: #f5f5f5;
          color: #333333;
          padding: 12px 16px;
          border-radius: 6px;
          margin-bottom: 20px;
          border: 1px solid #cccccc;
        }

        /* 图片插入对话框样式 */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-content {
          background: white;
          border-radius: 8px;
          width: 100%;
          max-width: 600px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #e1e4e8;
        }

        .modal-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #24292e;
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 28px;
          color: #666;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          line-height: 1;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .modal-close:hover {
          background: #f6f8fa;
          color: #24292e;
        }

        .modal-body {
          padding: 24px;
        }

        .upload-tabs {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }

        .upload-tab {
          flex: 1;
          padding: 12px 16px;
          background: #f6f8fa;
          border: 2px solid #d1d5da;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
          text-align: center;
        }

        .upload-tab:hover {
          background: #e1e4e8;
          border-color: #333333;
        }

        .upload-tab.active {
          background: #333333;
          color: white;
          border-color: #333333;
        }

        .form-row {
          margin-bottom: 20px;
        }

        .form-label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #24292e;
          font-size: 14px;
        }

        .form-input,
        .form-textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5da;
          border-radius: 6px;
          font-size: 14px;
          transition: all 0.2s;
          box-sizing: border-box;
        }

        .form-input:focus,
        .form-textarea:focus {
          outline: none;
          border-color: #333333;
          box-shadow: 0 0 0 3px rgba(0,0,0,0.1);
        }

        .form-textarea {
          resize: vertical;
          font-family: inherit;
        }

        .file-upload-area {
          padding: 30px;
          background: #f6f8fa;
          border: 2px dashed #d1d5da;
          border-radius: 6px;
          text-align: center;
          transition: all 0.2s;
        }

        .file-upload-area:hover {
          border-color: #333333;
          background: #f5f5f5;
        }

        .file-upload-btn {
          display: inline-block;
          padding: 12px 24px;
          background: #333333;
          color: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
          margin-bottom: 10px;
        }

        .file-upload-btn:hover {
          background: #1a1a1a;
        }

        .file-upload-hint {
          margin: 0;
          color: #666;
          font-size: 13px;
        }

        .width-selector {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .width-slider {
          flex: 1;
          height: 6px;
          border-radius: 3px;
          cursor: pointer;
        }

        .width-value {
          min-width: 50px;
          text-align: right;
          font-weight: 600;
          color: #333333;
          font-size: 14px;
        }

        .align-options {
          display: flex;
          gap: 8px;
        }

        .align-btn {
          flex: 1;
          padding: 10px;
          background: #f6f8fa;
          border: 2px solid #d1d5da;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .align-btn:hover {
          background: #e1e4e8;
          border-color: #333333;
        }

        .align-btn.active {
          background: #333333;
          color: white;
          border-color: #333333;
        }

        .image-preview-container {
          padding: 20px;
          background: #f6f8fa;
          border-radius: 6px;
          text-align: center;
        }

        .image-preview-container img {
          max-width: 100%;
          border-radius: 4px;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid #e1e4e8;
        }

        .btn-cancel {
          padding: 10px 20px;
          background: #f6f8fa;
          color: #24292e;
          border: 1px solid #d1d5da;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .btn-cancel:hover {
          background: #e1e4e8;
        }

        .btn-insert {
          padding: 10px 20px;
          background: #333333;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .btn-insert:hover:not(:disabled) {
          background: #1a1a1a;
        }

        .btn-insert:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* AI 功能样式 */
        .toolbar-btn.ai-btn {
          background: linear-gradient(135deg, #444444 0%, #222222 100%);
          color: white;
          border: none;
          font-weight: 500;
        }

        .toolbar-btn.ai-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #333333 0%, #111111 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .toolbar-btn.ai-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .ai-modal {
          max-width: 700px;
          width: 90%;
        }

        .form-select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5da;
          border-radius: 6px;
          font-size: 14px;
          background: white;
          cursor: pointer;
          transition: all 0.2s;
        }

        .form-select:focus {
          outline: none;
          border-color: #333333;
          box-shadow: 0 0 0 3px rgba(0,0,0,0.1);
        }

        .ai-action-area {
          text-align: center;
          padding: 30px 20px;
          background: #f6f8fa;
          border-radius: 8px;
          margin-top: 20px;
        }

        .ai-hint {
          color: #666;
          font-size: 14px;
          margin-bottom: 20px;
        }

        .btn-ai-action {
          padding: 12px 32px;
          background: linear-gradient(135deg, #444444 0%, #222222 100%);
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 500;
          transition: all 0.2s;
        }

        .btn-ai-action:hover:not(:disabled) {
          background: linear-gradient(135deg, #333333 0%, #111111 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .btn-ai-action:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .ai-result-area {
          margin-top: 20px;
        }



        @media (max-width: 768px) {
          .editor-layout {
            padding: 0;
          }

          .editor-title {
            font-size: 20px;
          }

          .main-title-input {
            font-size: 20px;
          }

          .content-editor {
            min-height: 400px;
            padding: 16px;
          }

          .toolbar {
            padding: 8px;
          }

          .toolbar-btn {
            padding: 4px 8px;
            font-size: 12px;
          }

          .settings-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
