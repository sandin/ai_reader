'use client';

import { useState } from 'react';

interface EditSessionModalProps {
  visible: boolean;
  title: string;
  bookId?: string;
  currentChapter?: string;
  sessionId?: string;
  fastModelId?: string;
  onTitleChange: (title: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export default function EditSessionModal({
  visible,
  title,
  bookId,
  currentChapter,
  sessionId,
  fastModelId,
  onTitleChange,
  onSave,
  onClose,
}: EditSessionModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  if (!visible) return null;

  const handleGenerateTitle = async () => {
    if (!bookId || !currentChapter || !sessionId || isGenerating) return;

    setIsGenerating(true);
    try {
      const response = await fetch('/api/chat/title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId,
          htmlFile: currentChapter,
          sessionId,
          fastModelId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate title');
      }

      const data = await response.json();
      if (data.title) {
        onTitleChange(data.title);
      }
    } catch (error) {
      console.error('Error generating title:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-80 max-w-[90vw]">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">重命名对话</h3>
        <div className="relative">
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSave();
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
            className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="输入新名称..."
            autoFocus
          />
          <button
            onClick={handleGenerateTitle}
            disabled={isGenerating || !sessionId}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-indigo-500 hover:bg-indigo-50 disabled:opacity-30 disabled:hover:bg-transparent"
            title="AI 自动生成标题"
          >
            {isGenerating ? (
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            )}
          </button>
        </div>
        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
