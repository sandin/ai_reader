'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface SearchResult {
  content: string;
  type: 'session' | 'comment';
  session_id?: number;
  message_id?: number;
  comment_id?: number;
  book_id: number;
  chapter_file: string;
  book_title?: string;
  book_author?: string;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FilterType = 'all' | 'session' | 'comment';

const filterOptions: { value: FilterType; label: string; color: string }[] = [
  { value: 'all', label: '全部', color: 'bg-slate-800' },
  { value: 'session', label: '对话', color: 'bg-blue-600' },
  { value: 'comment', label: '评论', color: 'bg-green-600' },
];

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [pageSize] = useState(10);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const currentFilter = filterOptions.find(f => f.value === filterType) || filterOptions[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilterDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPage(1);
      setTotal(0);
      setHasMore(false);
      setFilterType('all');
      const cachedQuery = localStorage.getItem('searchQuery');
      if (cachedQuery) {
        setQuery(cachedQuery);
        const cachedFilter = localStorage.getItem('searchFilterType');
        if (cachedFilter) {
          setFilterType(cachedFilter as FilterType);
        }
      }
    }
  }, [isOpen]);

  // Build final search query with filter
  const buildSearchQuery = useCallback((inputQuery: string, filter: FilterType): string => {
    if (filter === 'all' || !inputQuery) {
      return inputQuery;
    }
    const filterPrefix = filter === 'session' ? 'type:chat' : 'type:comment';
    return `${filterPrefix} ${inputQuery}`;
  }, []);

  const fetchSearchResults = useCallback(async (searchQuery: string, filter: FilterType, pageNum: number) => {
    setLoading(true);
    try {
      const fullQuery = buildSearchQuery(searchQuery, filter);
      const res = await fetch(`/api/search?q=${encodeURIComponent(fullQuery)}&page=${pageNum}&pageSize=${pageSize}`);
      const data = await res.json();

      if (res.ok) {
        setResults(data.results || []);
        setTotal(data.total || 0);
        setHasMore(data.hasMore ?? false);
        localStorage.setItem('searchQuery', searchQuery);
        localStorage.setItem('searchFilterType', filter);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [buildSearchQuery, pageSize]);

  const handleSearch = useCallback(() => {
    if (!query.trim()) return;
    setPage(1);
    setSearched(true);
    fetchSearchResults(query, filterType, 1);
  }, [query, filterType, fetchSearchResults]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchSearchResults(query, filterType, newPage);
  };

  const handleFilterChange = (filter: FilterType) => {
    setFilterType(filter);
    setShowFilterDropdown(false);
    // 如果已经搜索过，重新搜索
    if (searched) {
      setPage(1);
      fetchSearchResults(query, filter, 1);
    }
  };

  const handleClear = () => {
    setQuery('');
    setFilterType('all');
    setResults([]);
    setSearched(false);
    setPage(1);
    setTotal(0);
    setHasMore(false);
    localStorage.removeItem('searchQuery');
    localStorage.removeItem('searchFilterType');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleResultClick = (result: SearchResult) => {
    router.push(`/reader/${result.book_id}?chapter=${encodeURIComponent(result.chapter_file)}`);
    onClose();
  };

  const truncateContent = (content: string, maxLength: number = 300) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  // Determine if we should show pagination
  const showPagination = (total > pageSize) || hasMore || (results.length === pageSize);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl mx-4 bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Search Input */}
        <div className="p-4 border-b border-slate-200">
          <div className="relative flex items-center gap-3">
            <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>

            {/* Filter dropdown */}
            <div className="relative flex-shrink-0" ref={filterRef}>
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-md border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <span className={`w-2 h-2 rounded-full ${currentFilter.color}`} />
                <span>{currentFilter.label}</span>
                <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown menu */}
              {showFilterDropdown && (
                <div className="absolute top-full left-0 mt-1 w-32 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                  {filterOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleFilterChange(option.value)}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 first:rounded-t-lg last:rounded-b-lg ${
                        filterType === option.value ? 'bg-slate-50' : ''
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${option.color}`} />
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="w-px h-6 bg-slate-200 flex-shrink-0" />

            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="搜索对话和评论..."
              className="flex-1 text-lg outline-none placeholder:text-slate-400"
            />

            {/* Syntax hint */}
            {query && (
              <span className="text-xs text-slate-400 flex-shrink-0">
                使用 <span className="font-mono">type:chat</span> / <span className="font-mono">type:comment</span> 过滤
              </span>
            )}

            <button
              onClick={handleClear}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
              title="清除"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              {loading ? '搜索中...' : '搜索'}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
          ) : searched && results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <svg className="w-12 h-12 mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>未找到相关内容</p>
            </div>
          ) : results.length > 0 ? (
            <>
              {/* Total count and filter info */}
              {total > 0 && (
                <div className="px-4 py-2 text-sm text-slate-500 border-b border-slate-100 flex items-center gap-2">
                  <span>找到 {total} 条结果</span>
                  {filterType !== 'all' && (
                    <span className={`px-2 py-0.5 text-xs rounded-full text-white ${filterType === 'session' ? 'bg-blue-600' : 'bg-green-600'}`}>
                      {filterType === 'session' ? '仅对话' : '仅评论'}
                    </span>
                  )}
                </div>
              )}
              <div className="divide-y divide-slate-100">
                {results.map((result, index) => (
                  <div
                    key={`${result.type}-${result.book_id}-${result.chapter_file}-${index}`}
                    onClick={() => handleResultClick(result)}
                    className="p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            result.type === 'session'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {result.type === 'session' ? '对话' : '评论'}
                          </span>
                          <span className="text-sm font-medium text-slate-800 truncate">
                            {result.book_title}
                          </span>
                          {result.book_author && (
                            <span className="text-sm text-slate-500">
                              — {result.book_author}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-3">
                      {truncateContent(result.content)}
                    </p>
                    <p className="text-xs text-slate-400 mt-2">
                      章节: {result.chapter_file}
                    </p>
                  </div>
                ))}
              </div>
              {/* Pagination */}
              {showPagination && (
                <div className="flex items-center justify-center gap-2 p-4 border-t border-slate-200">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                    className="px-3 py-1 text-sm rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    上一页
                  </button>
                  <span className="text-sm text-slate-600">
                    第 {page} 页
                    {total > 0 && ` / 约 ${Math.ceil(total / pageSize)} 页`}
                  </span>
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={!hasMore && results.length < pageSize}
                    className="px-3 py-1 text-sm rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    下一页
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p>输入关键词搜索对话和评论</p>
              <div className="mt-2 text-xs text-slate-400">
                使用 <span className="font-mono">type:chat</span> 只搜索对话，
                <span className="font-mono">type:comment</span> 只搜索评论
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
