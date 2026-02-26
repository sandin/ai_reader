'use client';

interface ContextMenuProps {
  visible: boolean;
  position: { x: number; y: number };
  selection: string;
  onCopy: () => void;
  onAddToAssistant: () => void;
  onAddToAssistantNewChat: () => void;
  onAddComment: () => void;
  onClose: () => void;
}

export default function ContextMenu({
  visible,
  position,
  selection,
  onCopy,
  onAddToAssistant,
  onAddToAssistantNewChat,
  onAddComment,
  onClose,
}: ContextMenuProps) {
  if (!visible || !selection) return null;

  return (
    <div
      className="fixed z-50 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[140px]"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <button
        onClick={onCopy}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <span>复制</span>
      </button>
      <button
        onClick={onAddToAssistant}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span>选中</span>
      </button>
      <button
        onClick={onAddToAssistantNewChat}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-green-600 hover:bg-green-50 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span>选中并创建新对话</span>
      </button>
      <button
        onClick={onAddComment}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
        <span>评论</span>
      </button>
    </div>
  );
}
