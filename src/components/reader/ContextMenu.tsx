'use client';

import { useMemo } from 'react';

interface ContextMenuProps {
  visible: boolean;
  position: { x: number; y: number };
  selection: string;
  cfiRange?: string;
  onCopy: () => void;
  onCopyLocation: () => void;
  onAddToAssistant: () => void;
  onAddToAssistantNewChat: () => void;
  onAddComment: () => void;
  onAddHighlight: () => void;
  onSummarize: () => void;
  onClose: () => void;
}

export default function ContextMenu({
  visible,
  position,
  selection,
  cfiRange,
  onCopy,
  onCopyLocation,
  onAddToAssistant,
  onAddToAssistantNewChat,
  onAddComment,
  onAddHighlight,
  onSummarize,
  onClose,
}: ContextMenuProps) {
  if (!visible || !selection) return null;

  // 菜单位置计算，确保不超出视口
  const menuPosition = useMemo(() => {
    const menuWidth = 180; // min-w-[160px] + padding
    const menuHeight = 400; // 约8个菜单项的高度

    let x = position.x;
    let y = position.y;

    // 检查右侧是否超出视口
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }

    // 检查下方是否超出视口
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }

    return { x, y };
  }, [position.x, position.y]);

  return (
    <div
      className="fixed z-50 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[160px]"
      style={{
        left: menuPosition.x,
        top: menuPosition.y,
      }}
    >
      {/* common group */}
      <button
        onClick={onCopy}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <span>复制</span>
      </button>
      {cfiRange && (
        <button
          onClick={onCopyLocation}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>拷贝位置</span>
        </button>
      )}
      <button
        onClick={onClose}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
        <span>取消</span>
      </button>

      {/* separator */}
      <div className="my-1 border-t border-slate-200" />

      {/* comment group */}
      <button
        onClick={onAddComment}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
        <span>添加评论</span>
      </button>
      <button
        onClick={onAddHighlight}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <svg className="w-4 h-4" fill="#EAB308" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        <span>划重点</span>
      </button>

      {/* separator */}
      <div className="my-1 border-t border-slate-200" />

      {/* chat group */}
      <button
        onClick={onAddToAssistantNewChat}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span>选中并创建新对话</span>
      </button>
      <button
        onClick={onSummarize}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span>选中并总结</span>
      </button>
      <button
        onClick={onAddToAssistant}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span>添加选中</span>
      </button>
    </div>
  );
}
