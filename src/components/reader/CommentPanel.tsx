'use client';

import { Comment } from './types';

interface CommentPanelProps {
  comments: Comment[];
  selectedText: string;
  inputText: string;
  onInputChange: (text: string) => void;
  onSave: () => void;
  onDelete: (commentId: string) => void;
  commentLoading?: boolean;
}

export default function CommentPanel({
  comments,
  selectedText,
  inputText,
  onInputChange,
  onSave,
  onDelete,
  commentLoading = false,
}: CommentPanelProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Comment input area */}
      <div className="p-4 border-b border-slate-100 bg-slate-50">
        {selectedText ? (
          <div className="mb-3">
            <p className="text-xs text-slate-500 mb-1">选中的文字:</p>
            <p className="text-sm text-slate-700 bg-white p-2 rounded border border-slate-200 line-clamp-3">
              {selectedText}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-400 mb-3">请先选中一段文字，然后右键选择"评论"</p>
        )}
        <textarea
          value={inputText}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="输入评论..."
          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
          rows={3}
          disabled={!selectedText}
        />
        <button
          onClick={onSave}
          disabled={!inputText.trim() || !selectedText}
          className="mt-2 w-full px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        >
          保存评论
        </button>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {commentLoading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="flex items-center gap-2 text-slate-400">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm">加载中...</span>
            </div>
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500">暂无评论</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="bg-white border border-slate-200 rounded-lg p-3 hover:border-amber-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-xs text-slate-500 line-clamp-2 flex-1">
                  "{comment.selectedText}"
                </p>
                <button
                  onClick={() => onDelete(comment.id)}
                  className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50"
                  title="删除"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{comment.content}</p>
              <p className="text-xs text-slate-400 mt-2">
                {new Date(comment.timestamp).toLocaleString('zh-CN')}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
