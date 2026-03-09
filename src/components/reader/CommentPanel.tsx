'use client';

import { useState } from 'react';
import { Comment } from './types';
import { formatRelativeTime } from '@/lib/utils';
import MarkdownRenderer, { LinkInfo } from '@/components/MarkdownRenderer';

interface CommentPanelProps {
  comments: Comment[];
  selectedText: string;
  inputText: string;
  onInputChange: (text: string) => void;
  onSave: () => void;
  onDelete: (commentId: string) => void;
  onEdit: (commentId: string, newContent: string, newSelectedText?: string, newCfiRange?: string) => void;
  onJumpToCfi?: (cfiRange: string) => void;
  onLink?: (info: LinkInfo) => void;
  commentLoading?: boolean;
  getCurrentSelection?: () => string;
  getCurrentCfiRange?: () => string;
}

export default function CommentPanel({
  comments,
  selectedText,
  inputText,
  onInputChange,
  onSave,
  onDelete,
  onEdit,
  onJumpToCfi,
  onLink,
  commentLoading = false,
  getCurrentSelection,
  getCurrentCfiRange,
}: CommentPanelProps) {
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [editingSelectedText, setEditingSelectedText] = useState('');
  const [editingCfiRange, setEditingCfiRange] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  const handleEditClick = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditingContent(comment.content);
    setEditingSelectedText(comment.selectedText);
    setEditingCfiRange(comment.cfiRange || '');
  };

  const handleEditSave = () => {
    if (editingCommentId && editingContent.trim()) {
      onEdit(editingCommentId, editingContent.trim(), editingSelectedText, editingCfiRange);
      setEditingCommentId(null);
      setEditingContent('');
      setEditingSelectedText('');
      setEditingCfiRange('');
    }
  };

  const handleEditCancel = () => {
    setEditingCommentId(null);
    setEditingContent('');
    setEditingSelectedText('');
    setEditingCfiRange('');
  };

  // 更新选中的文字和cfiRange
  const handleUpdateSelectedText = () => {
    const selectedText = getCurrentSelection ? getCurrentSelection() : '';
    const cfiRange = getCurrentCfiRange ? getCurrentCfiRange() : '';
    if (selectedText) {
      setEditingSelectedText(selectedText);
      if (cfiRange) {
        setEditingCfiRange(cfiRange);
      }
    }
  };

  const handleDeleteClick = (commentId: string) => {
    setDeletingCommentId(commentId);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (deletingCommentId) {
      onDelete(deletingCommentId);
    }
    setShowDeleteConfirm(false);
    setDeletingCommentId(null);
  };

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
              className="group bg-white border border-slate-200 rounded-lg p-3 hover:border-amber-300 transition-colors"
            >
              <div className="flex flex-col gap-2 mb-2">
                {editingCommentId === comment.id ? (
                  <>
                    <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded border border-slate-200">
                      {editingSelectedText || '在正文中选择文字更新引用'}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-slate-400">提示：先在正文中重新选择一段文字</p>
                      <button
                        onClick={handleUpdateSelectedText}
                        className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200 transition-colors"
                      >
                        更新引文
                      </button>
                    </div>
                  </>
                ) : (
                  <p
                    className="text-xs text-slate-500 cursor-pointer hover:text-amber-600 hover:underline"
                    onClick={() => onJumpToCfi?.(comment.cfiRange)}
                    title="点击跳转到原文"
                  >
                    "{comment.selectedText}"
                  </p>
                )}
              </div>

              {/* Edit mode */}
              {editingCommentId === comment.id ? (
                <div>
                  <textarea
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                    rows={3}
                    autoFocus
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      onClick={handleEditCancel}
                      className="px-3 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleEditSave}
                      className="px-3 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors"
                    >
                      保存
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <MarkdownRenderer
                    content={comment.content}
                    className="text-sm text-slate-700"
                    onLink={onLink}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-slate-400">
                      {formatRelativeTime(comment.timestamp)}
                    </p>
                    {/* Action buttons - show on hover */}
                    <div className="h-6 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEditClick(comment)}
                        className="w-5 h-5 flex items-center justify-center rounded text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
                        title="编辑"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteClick(comment.id)}
                        className="w-5 h-5 flex items-center justify-center rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="删除"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">确认删除</h3>
            <p className="text-slate-600 mb-6">确定要删除这条评论吗？此操作无法撤销。</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingCommentId(null);
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
