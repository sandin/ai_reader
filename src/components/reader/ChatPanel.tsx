'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import mermaid from 'mermaid';
import { Panel, Group as PanelGroup, Separator } from 'react-resizable-panels';
import { Block, Message, Session } from './types';

interface ChatPanelProps {
  sessions: Session[];
  currentSessionId: string | null;
  messages: Message[];
  selectedBlocks: Block[];
  expandedBlocks: Set<string>;
  isSelectedBlocksExpanded: boolean;
  aiLoading: boolean;
  inputHistory: string[];
  // Input layout from localStorage
  inputLayout?: { [key: string]: number };
  // Reader style
  fontSize?: number;
  fontFamily?: string;
  lineHeight?: number;
  // Auto-scroll setting
  autoScrollOnStreaming: boolean;
  onToggleAutoScroll?: (enabled: boolean) => void;
  // Mermaid setting
  mermaidEnabled?: boolean;
  // Callbacks
  onSendMessage: (input: string, isFirstMessage: boolean) => void;
  onSwitchSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onDeleteSession: (sessionId: string, e: React.MouseEvent) => void;
  onEditSession: (sessionId: string) => void;
  onRemoveBlock: (id: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onToggleExpandBlock: (id: string) => void;
  onToggleSelectedBlocksExpand: () => void;
  onInputLayoutChange?: (sizes: { [key: string]: number }) => void;
  onOpenCompress?: (content: string, messageId: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
}

export default function ChatPanel({
  sessions,
  currentSessionId,
  messages,
  selectedBlocks,
  expandedBlocks,
  isSelectedBlocksExpanded,
  aiLoading,
  inputHistory,
  inputLayout,
  fontSize = 18,
  fontFamily = 'Georgia, serif',
  lineHeight = 1.8,
  autoScrollOnStreaming,
  onToggleAutoScroll,
  mermaidEnabled = true,
  onSendMessage,
  onSwitchSession,
  onCreateSession,
  onDeleteSession,
  onEditSession,
  onRemoveBlock,
  onDeleteMessage,
  onToggleExpandBlock,
  onToggleSelectedBlocksExpand,
  onInputLayoutChange,
  onOpenCompress,
  onEditMessage,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  const isAutoScrollingRef = useRef(false);

  // Handle auto-scroll during streaming
  useEffect(() => {
    if (autoScrollOnStreaming && aiLoading && chatContainerRef.current) {
      isAutoScrollingRef.current = true;
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      // Reset the flag after the scroll animation completes
      setTimeout(() => {
        isAutoScrollingRef.current = false;
      }, 100);
    }
  }, [messages, aiLoading, autoScrollOnStreaming]);

  // Handle manual scroll - disable auto-scroll when user scrolls manually
  const handleScroll = useCallback(() => {
    // Only handle manual scroll, not auto-scroll triggered by streaming
    if (!isAutoScrollingRef.current && autoScrollOnStreaming && onToggleAutoScroll) {
      onToggleAutoScroll(false);
    }
  }, [autoScrollOnStreaming, onToggleAutoScroll]);

  const handleInputChange = (value: string) => {
    setInput(value);
    // Reset history index
    setHistoryIndex(-1);

    // Auto-complete suggestions
    if (value.trim()) {
      const matched = inputHistory.filter(h => h.toLowerCase().includes(value.toLowerCase())).slice(0, 5);
      if (matched.length > 0) {
        setSuggestions(matched);
        setShowSuggestions(true);
        setSelectedSuggestionIndex(0);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSubmit = useCallback(() => {
    if (!input.trim() || aiLoading) return;
    const isFirstMessage = messages.length === 0;
    onSendMessage(input, isFirstMessage);

    // Save to history
    if (input.trim()) {
      const newHistory = [input, ...inputHistory.filter(h => h !== input)].slice(0, 50);
      localStorage.setItem('ai-chat-input-history', JSON.stringify(newHistory));
    }

    setInput('');
    setHistoryIndex(-1);
    setShowSuggestions(false);
  }, [input, aiLoading, messages.length, inputHistory, onSendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab auto-complete
    if (e.key === 'Tab') {
      if (showSuggestions && suggestions.length > 0) {
        e.preventDefault();
        const selected = suggestions[selectedSuggestionIndex >= 0 ? selectedSuggestionIndex : 0];
        if (selected) {
          setInput(selected);
          setShowSuggestions(false);
          setSelectedSuggestionIndex(-1);
        }
      }
      return;
    }

    // Arrow up - history
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (inputHistory.length > 0) {
        const newIndex = historyIndex < inputHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setInput(inputHistory[newIndex]);
        setShowSuggestions(false);
      }
      return;
    }

    // Arrow down - history
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(inputHistory[newIndex]);
        setShowSuggestions(false);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
        setShowSuggestions(false);
      }
      return;
    }

    // Enter to send
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Save input history to localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('ai-chat-input-history');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        // Input history is managed in parent
      } catch (e) {
        console.error('Failed to parse input history:', e);
      }
    }
  }, []);

  return (
    <PanelGroup
      orientation="vertical"
      className="h-full"
      defaultLayout={inputLayout as unknown as { [key: string]: number } | undefined}
      onLayoutChanged={(sizes) => {
        onInputLayoutChange?.(sizes as unknown as { [key: string]: number });
      }}
    >
      {/* Messages panel - flexible height */}
      <Panel id="messages" defaultSize={80} minSize={30}>
        <div className="flex flex-col h-full">
          {/* Session tabs */}
          {sessions.length > 0 && (
            <div className="border-b border-slate-100 overflow-x-auto shrink-0">
              <div className="flex gap-1 px-2 py-2 min-w-max">
                {sessions.slice().sort((a, b) => a.created_at - b.created_at).map((session) => (
                  <div
                    key={session.id}
                    className={`flex items-center gap-1 pr-1 rounded-lg text-xs whitespace-nowrap transition-colors ${
                      currentSessionId === session.id
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <button
                      onClick={() => onSwitchSession(session.id)}
                      className="px-2 py-1.5 hover:opacity-70 transition-opacity"
                    >
                      {session.title}
                    </button>
                    <button
                      onClick={() => onEditSession(session.id)}
                      className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
                      title="重命名"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => onDeleteSession(session.id, e)}
                      className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="删除对话"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selected text blocks */}
          {selectedBlocks.length > 0 && (
            <div className="border-b border-slate-100 bg-slate-50 shrink-0">
              <button
                onClick={onToggleSelectedBlocksExpand}
                className="flex items-center justify-between w-full px-4 py-2"
              >
                <h3 className="text-sm font-medium text-slate-700">选中的文字 ({selectedBlocks.length})</h3>
                <svg
                  className={`w-4 h-4 text-slate-400 transition-transform ${isSelectedBlocksExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isSelectedBlocksExpanded && (
                <div className="px-4 pb-4 space-y-2 overflow-y-auto max-h-40">
                  {selectedBlocks.map((block) => {
                    const isExpanded = expandedBlocks.has(block.id);
                    const shouldTruncate = block.content.length > 200;
                    const displayContent = !isExpanded && shouldTruncate
                      ? block.content.slice(0, 200) + '...'
                      : block.content;

                    return (
                      <div
                        key={block.id}
                        className="relative bg-white border border-slate-200 rounded-lg p-3 text-sm text-slate-700 hover:border-indigo-300 transition-colors"
                      >
                        <p className="whitespace-pre-wrap break-words">{displayContent}</p>
                        <div className="absolute top-2 right-2 flex items-center gap-1">
                          {shouldTruncate && (
                            <button
                              onClick={() => onToggleExpandBlock(block.id)}
                              className="w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:text-indigo-500 hover:bg-indigo-50"
                              title={isExpanded ? '收起' : '展开'}
                            >
                              <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => onRemoveBlock(block.id)}
                            className="w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50"
                            title="删除"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          <div
            ref={chatContainerRef}
            onScroll={handleScroll}
            className={`flex-1 overflow-y-auto p-4 space-y-4 ${selectedBlocks.length > 0 ? 'min-h-0' : ''}`}
          >
            {messages.length === 0 && selectedBlocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-500 mb-1">选择一段文字，</p>
                <p className="text-sm text-slate-500">向 AI 提问关于内容的问题</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, index) => (
                  <div key={msg.id} className="group">
                    {/* Role indicator */}
                    <div className="text-xs text-slate-400 mb-1">
                      {msg.role === 'user' ? '你' : 'AI'}
                    </div>
                    <div className="text-[#3a3a3a] px-2">
                      {msg.role === 'assistant' ? (
                        <MessageContent
                          content={msg.content}
                          isStreaming={aiLoading && index === messages.length - 1}
                          fontSize={fontSize}
                          fontFamily={fontFamily}
                          lineHeight={lineHeight}
                          mermaidEnabled={mermaidEnabled}
                        />
                      ) : (
                        <UserMessageContent
                          content={msg.content}
                          index={index}
                          fontSize={fontSize}
                          fontFamily={fontFamily}
                          lineHeight={lineHeight}
                        />
                      )}
                    </div>
                    {/* Copy and delete buttons row - always visible space, buttons show on hover */}
                    <div className="h-6 mt-1 flex justify-end items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {msg.role === 'assistant' && (
                        <button
                          onClick={() => {
                            const content = msg.content;
                            onOpenCompress?.(content, msg.id);
                          }}
                          className="w-5 h-5 flex items-center justify-center rounded text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
                          title="编辑"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                      {msg.role === 'user' && (
                        <button
                          onClick={() => {
                            const content = msg.content;
                            setEditingMessage({ id: msg.id, content });
                          }}
                          className="w-5 h-5 flex items-center justify-center rounded text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
                          title="编辑"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const content = msg.content;
                          navigator.clipboard.writeText(content);
                          setCopiedMessageId(msg.id);
                          setTimeout(() => setCopiedMessageId(null), 2000);
                        }}
                        className="w-5 h-5 flex items-center justify-center rounded text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
                        title="复制内容"
                      >
                        {copiedMessageId === msg.id ? (
                          <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setDeletingMessageId(msg.id);
                          setShowDeleteConfirm(true);
                        }}
                        className="w-5 h-5 flex items-center justify-center rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="删除此消息"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Panel>

      {/* Resize handle */}
      <Separator className="h-1 bg-slate-200 hover:bg-indigo-400 transition-colors cursor-row-resize" />

      {/* Input panel - default 120px, no max */}
      <Panel id="input" defaultSize={10} minSize={80}>
        <div className="h-full flex flex-col p-4 border-t border-slate-100 bg-slate-50">
          <div className="flex gap-2 items-stretch flex-1 min-h-0">
            <button
              onClick={onCreateSession}
              className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition-colors shrink-0 self-end"
              title="新建对话"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <textarea
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入问题..."
              className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow resize-none overflow-y-auto"
              disabled={aiLoading}
              rows={1}
            />
            {/* Auto-complete suggestions */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute bottom-full left-0 right-14 mb-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto z-10">
                {suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className={`px-3 py-2 text-sm cursor-pointer truncate ${
                      index === selectedSuggestionIndex
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'hover:bg-slate-50'
                    }`}
                    onClick={() => {
                      setInput(suggestion);
                      setShowSuggestions(false);
                    }}
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={handleSubmit}
              disabled={aiLoading || !input.trim()}
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow shrink-0 self-end"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </Panel>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">确认删除</h3>
            <p className="text-slate-600 mb-6">确定要删除这条消息吗？此操作无法撤销。</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingMessageId(null);
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (deletingMessageId) {
                    onDeleteMessage(deletingMessageId);
                  }
                  setShowDeleteConfirm(false);
                  setDeletingMessageId(null);
                }}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit message dialog */}
      {editingMessage && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg mx-4 w-full">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">编辑消息</h3>
            <textarea
              value={editingMessage.content}
              onChange={(e) => setEditingMessage({ ...editingMessage, content: e.target.value })}
              className="w-full h-48 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              autoFocus
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setEditingMessage(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (editingMessage.content.trim()) {
                    onEditMessage?.(editingMessage.id, editingMessage.content);
                  }
                  setEditingMessage(null);
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </PanelGroup>
  );
}

// Message content component for AI responses
function MessageContent({
  content,
  isStreaming,
  fontSize = 18,
  fontFamily = 'Georgia, serif',
  lineHeight = 1.8,
  mermaidEnabled = true,
}: {
  content: string;
  isStreaming: boolean;
  fontSize?: number;
  fontFamily?: string;
  lineHeight?: number;
  mermaidEnabled?: boolean;
}) {
  if (isStreaming && !content) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    );
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p className="mb-3" style={{ fontSize: `${fontSize}px`, fontFamily, lineHeight, color: '#3a3a3a' }}>
            {children}
          </p>
        ),
        h1: ({ children }) => (
          <h1 className="text-xl font-bold mt-4 mb-3 text-[#383838]" style={{ fontFamily }}>
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-lg font-bold mt-4 mb-2 text-[#383838]" style={{ fontFamily }}>
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-semibold mt-3 mb-2 text-[#383838]" style={{ fontFamily }}>
            {children}
          </h3>
        ),
        h4: ({ children }) => (
          <h4 className="text-base font-semibold mt-3 mb-2 text-[#383838]" style={{ fontFamily }}>
            {children}
          </h4>
        ),
        h5: ({ children }) => (
          <h5 className="text-base font-semibold mt-3 mb-2 text-[#383838]" style={{ fontFamily }}>
            {children}
          </h5>
        ),
        h6: ({ children }) => (
          <h6 className="text-base font-semibold mt-3 mb-2 text-[#383838]" style={{ fontFamily }}>
            {children}
          </h6>
        ),
        ul: ({ children }) => (
          <ul className="list-disc ml-5 mb-3 space-y-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal ml-5 mb-3 space-y-1">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-[#3a3a3a]" style={{ fontSize: `${fontSize}px`, fontFamily, lineHeight }}>
            {children}
          </li>
        ),
        code: ({ className, children }) => {
          const isInline = !className;
          const codeContent = String(children).replace(/\n$/, '');
          const isMermaid = className?.includes('language-mermaid');

          if (isMermaid && mermaidEnabled) {
            return <MermaidChart code={codeContent} />;
          }

          if (isMermaid && !mermaidEnabled) {
            return (
              <code className="block bg-slate-800 text-slate-100 p-3 rounded-lg overflow-x-auto mb-3 text-sm">
                {children}
              </code>
            );
          }

          return isInline ? (
            <code className="bg-slate-100 text-pink-600 px-1.5 py-0.5 rounded text-sm font-mono">
              {children}
            </code>
          ) : (
            <code className={`${className} block bg-slate-800 text-slate-100 p-3 rounded-lg overflow-x-auto mb-3 text-sm`}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => <pre className="mb-3">{children}</pre>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-indigo-300 pl-3 py-1 my-3 bg-indigo-50 rounded-r text-[#4a4a4a] italic">
            {children}
          </blockquote>
        ),
        strong: ({ children }) => (
          <strong className="font-bold text-[#2a2a2a]">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-[#4a4a4a]">{children}</em>
        ),
        a: ({ children, href }) => (
          <a
            href={href}
            className="text-indigo-600 underline hover:text-indigo-800"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
        hr: () => <hr className="my-4 border-t border-slate-200" />,
        table: ({ children }) => (
          <div className="overflow-x-auto mb-3">
            <table className="min-w-full border border-slate-200 rounded-lg overflow-hidden">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-slate-50">{children}</thead>
        ),
        tbody: ({ children }) => (
          <tbody className="divide-y divide-slate-100">{children}</tbody>
        ),
        tr: ({ children }) => (
          <tr className="hover:bg-slate-50/50 transition-colors">{children}</tr>
        ),
        th: ({ children }) => (
          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider bg-slate-50">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-4 py-2.5 text-sm text-slate-700">{children}</td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// User message content component - shows only content after "用户输入：" for first message
function UserMessageContent({
  content,
  index,
  fontSize = 18,
  fontFamily = 'Georgia, serif',
  lineHeight = 1.8,
}: {
  content: string;
  index: number;
  fontSize?: number;
  fontFamily?: string;
  lineHeight?: number;
}) {
  const isFirstUserMessage = index === 0;
  let text = content;
  if (isFirstUserMessage) {
    const match = content.match(/用户输入：([\s\S]*)/);
    text = match ? match[1] : content;
  }
  return (
    <div
      className="whitespace-pre-wrap"
      style={{ fontSize: `${fontSize}px`, fontFamily, lineHeight, color: '#3a3a3a' }}
    >
      {text}
    </div>
  );
}

// Mermaid chart component
function MermaidChart({ code }: { code: string }) {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const idRef = useRef<string>(`mermaid-${Math.random().toString(36).substring(2, 11)}`);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
    });

    const renderChart = async () => {
      try {
        const { svg } = await mermaid.render(idRef.current, code);
        setSvg(svg);
        setError('');
      } catch (err) {
        console.error('Mermaid render error:', err);
        setError(err instanceof Error ? err.message : '图表渲染失败');
        setSvg('');
      }
    };

    renderChart();
  }, [code]);

  if (error) {
    return (
      <div className="mb-3">
        <div className="bg-yellow-50 border border-yellow-200 rounded-t-lg px-3 py-2 text-yellow-700 text-sm">
          ⚠️ Mermaid 图表渲染失败
        </div>
        <pre className="bg-slate-800 text-slate-100 p-3 rounded-b-lg overflow-x-auto text-sm">
          <code>{code}</code>
        </pre>
      </div>
    );
  }

  return (
    <div
      className="mb-3 overflow-x-auto flex justify-center"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
