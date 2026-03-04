'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface Highlight {
  id: string;
  text: string;
  start: number;
  end: number;
}

interface CompressModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  messageId: string;
  modelId?: string;
  onSubmit: (messageId: string, content: string) => void;
}

export default function CompressModal({
  isOpen,
  onClose,
  content,
  messageId,
  modelId,
  onSubmit,
}: CompressModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [editedContent, setEditedContent] = useState('');
  const [compressLoading, setCompressLoading] = useState(false);

  // 当模态框打开时，重置状态
  useEffect(() => {
    if (isOpen) {
      setHighlights([]);
      setEditedContent('');
    }
  }, [isOpen]);

  // 高亮选中的文字
  const handleHighlightSelected = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      alert('请先选中一段文字');
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    if (!contentRef.current) return;

    // 使用更可靠的方式获取选中的位置
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(contentRef.current);
    preCaretRange.setEnd(range.startContainer, range.startOffset);

    // 获取纯文本内容用于位置计算
    const fullText = contentRef.current.textContent || '';
    const beforeSelection = preCaretRange.toString();

    // 查找实际开始位置（处理可能的空白符差异）
    let start = fullText.indexOf(selectedText, Math.max(0, beforeSelection.length - selectedText.length));
    if (start === -1) {
      // 尝试从头开始搜索
      start = fullText.indexOf(selectedText);
    }
    const end = start + selectedText.length;

    if (start === -1) {
      selection.removeAllRanges();
      return;
    }

    // 检查是否与现有高亮重叠
    const hasOverlap = highlights.some(
      h => (start >= h.start && start < h.end) || (end > h.start && end <= h.end)
    );

    if (hasOverlap) {
      alert('这段文字已经被高亮过了');
      selection.removeAllRanges();
      return;
    }

    const newHighlight: Highlight = {
      id: Date.now().toString(),
      text: selectedText,
      start,
      end,
    };

    setHighlights(prev => [...prev, newHighlight]);
    selection.removeAllRanges();
  }, [highlights]);

  // 渲染带高亮的文本
  const renderHighlightedContent = useCallback(() => {
    if (!content) return null;

    // 无高亮时直接返回原始内容
    if (highlights.length === 0) {
      return <span className="whitespace-pre-wrap">{content}</span>;
    }

    // 按位置排序高亮
    const sortedHighlights = [...highlights].sort((a, b) => a.start - b.start);

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    sortedHighlights.forEach((highlight) => {
      // 添加非高亮部分
      if (highlight.start > lastIndex) {
        const textContent = content.slice(lastIndex, highlight.start);
        parts.push(
          <span key={`text-${lastIndex}`} className="whitespace-pre-wrap">
            {textContent}
          </span>
        );
      }

      // 添加高亮部分
      parts.push(
        <mark
          key={`highlight-${highlight.id}`}
          className="bg-yellow-200 text-yellow-900 px-0.5 rounded"
        >
          {highlight.text}
        </mark>
      );

      lastIndex = highlight.end;
    });

    // 添加剩余非高亮部分
    if (lastIndex < content.length) {
      parts.push(
        <span key={`text-${lastIndex}`} className="whitespace-pre-wrap">{content.slice(lastIndex)}</span>
      );
    }

    return parts;
  }, [content, highlights]);

  // 删除高亮
  const removeHighlight = (id: string) => {
    setHighlights(prev => prev.filter(h => h.id !== id));
  };

  // 清空所有高亮
  const clearHighlights = () => {
    setHighlights([]);
  };

  // AI压缩 - 使用流式响应
  const handleCompress = async () => {
    setCompressLoading(true);
    setEditedContent('');

    try {
      const response = await fetch('/api/compress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          highlights: highlights.map(h => h.text),
          modelId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '压缩失败');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应');
      }

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                setEditedContent(prev => prev + parsed.content);
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      console.error('Compress error:', error);
      alert('压缩失败，请重试');
    } finally {
      setCompressLoading(false);
    }
  };

  // 提交
  const handleSubmit = () => {
    onSubmit(messageId, editedContent || content);
    // Reset state
    setHighlights([]);
    setEditedContent('');
    onClose();
  };

  // 关闭时重置状态
  const handleClose = () => {
    setHighlights([]);
    setEditedContent('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-xl shadow-2xl w-full h-full max-w-7xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 rounded-t-xl">
          <h1 className="text-lg font-semibold text-slate-800">AI 压缩</h1>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 bg-slate-50">
          <button
            onClick={handleHighlightSelected}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Highlight
          </button>

          {highlights.length > 0 && (
            <>
              <span className="text-sm text-slate-500">
                已选择 {highlights.length} 处
              </span>
              <button
                onClick={clearHighlights}
                className="text-sm text-red-500 hover:text-red-600"
              >
                清空
              </button>
            </>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 flex min-h-0">
          {/* Original content */}
          <div className="flex-1 flex flex-col border-r border-slate-200">
            <div className="px-4 py-2 bg-slate-100 border-b border-slate-200">
              <span className="text-sm font-medium text-slate-600">原始内容</span>
            </div>
            <div
              ref={contentRef}
              className="flex-1 p-4 overflow-y-auto whitespace-pre-wrap text-slate-700 select-text"
              style={{ fontSize: '16px', lineHeight: 1.8 }}
            >
              {highlights.length > 0 ? renderHighlightedContent() : content}
            </div>
          </div>

          {/* Edited content */}
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-2 bg-slate-100 border-b border-slate-200">
              <span className="text-sm font-medium text-slate-600">编辑后内容</span>
            </div>
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="flex-1 p-4 resize-none outline-none text-slate-700 bg-white"
              style={{ fontSize: '16px', lineHeight: 1.8 }}
              placeholder={compressLoading ? '压缩中...' : '点击"AI压缩"按钮进行压缩，或手动编辑...'}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <button
            onClick={handleCompress}
            disabled={compressLoading}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-sm font-medium hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-all"
          >
            {compressLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                压缩中...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                AI压缩
              </>
            )}
          </button>

          <button
            onClick={handleSubmit}
            disabled={!editedContent && !content}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            提交
          </button>
        </div>
      </div>
    </div>
  );
}
