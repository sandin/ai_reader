'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface Book {
  id: string;
  title: string;
  author: string;
  cover?: string;
  filename: string;
}

interface BooksResponse {
  books: Book[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function Home() {
  const [data, setData] = useState<BooksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [hoveredBook, setHoveredBook] = useState<string | null>(null);
  const [deletingBook, setDeletingBook] = useState<string | null>(null);
  const [renamingBook, setRenamingBook] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBooks = async (page: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/books?page=${page}&limit=6`);
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error('Failed to fetch books:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks(1);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.epub')) {
      alert('请选择 EPUB 文件');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/books/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (res.ok) {
        fetchBooks(1);
      } else {
        alert(result.error || '上传失败');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('上传失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (book: Book) => {
    if (!confirm(`确定要删除《${book.title}》吗？`)) return;

    setDeletingBook(book.id);
    try {
      const res = await fetch(`/api/books/${book.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchBooks(data?.page || 1);
      } else {
        const result = await res.json();
        alert(result.error || '删除失败');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('删除失败');
    } finally {
      setDeletingBook(null);
    }
  };

  const handleRename = (book: Book) => {
    setRenamingBook(book.id);
    setRenameValue(book.title);
  };

  const submitRename = async (book: Book) => {
    const newName = renameValue.trim();
    if (!newName || newName === book.title) {
      setRenamingBook(null);
      return;
    }

    try {
      const res = await fetch(`/api/books/${book.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });

      const result = await res.json();

      if (res.ok) {
        fetchBooks(data?.page || 1);
      } else {
        alert(result.error || '重命名失败');
      }
    } catch (error) {
      console.error('Rename error:', error);
      alert('重命名失败');
    } finally {
      setRenamingBook(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <div className="text-lg text-slate-600">加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">AI Reader</h1>
              <p className="text-sm text-slate-500">EPUB 阅读器 with AI 对话</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <input
          ref={fileInputRef}
          type="file"
          accept=".epub"
          onChange={handleFileUpload}
          className="hidden"
        />
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            书籍列表
          </h2>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200"
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                上传中...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                上传书籍
              </>
            )}
          </button>
        </div>

        {data?.books.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl shadow-sm border border-slate-200">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <p className="text-slate-500 mb-2">暂无书籍</p>
            <p className="text-sm text-slate-400 mb-4">点击上方上传按钮添加 EPUB 文件</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              选择文件上传
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {data?.books.map((book) => (
                <div
                  key={book.id}
                  onMouseEnter={() => setHoveredBook(book.id)}
                  onMouseLeave={() => {
                    setHoveredBook(null);
                    if (renamingBook === book.id) {
                      setRenamingBook(null);
                    }
                  }}
                  className="relative bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300 p-3 group border border-slate-100 hover:border-indigo-200"
                >
                  {/* Action buttons - visible on hover */}
                  <div className={`absolute top-3 right-3 z-10 flex gap-2 transition-opacity duration-200 ${hoveredBook === book.id ? 'opacity-100' : 'opacity-0'}`}>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRename(book);
                      }}
                      disabled={renamingBook === book.id}
                      className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 shadow-sm transition-all"
                      title="重命名"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(book);
                      }}
                      disabled={deletingBook === book.id}
                      className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600 shadow-sm transition-all"
                      title="删除"
                    >
                      {deletingBook === book.id ? (
                        <div className="w-4 h-4 border-2 border-red-200 border-t-red-600 rounded-full animate-spin"></div>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* Book content */}
                  <Link href={`/reader/${book.id}`} className="block">
                    <div className="aspect-[3/4] bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-lg mb-2 overflow-hidden group-hover:scale-[1.02] transition-transform">
                      {book.cover ? (
                        <img
                          src={book.cover}
                          alt={book.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-10 h-10 bg-white/80 rounded-full flex items-center justify-center shadow-sm">
                            <svg
                              className="w-6 h-6 text-indigo-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                              />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                    {renamingBook === book.id ? (
                      <div className="mb-1" onClick={(e) => e.preventDefault()}>
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submitRename(book);
                            if (e.key === 'Escape') setRenamingBook(null);
                          }}
                          onBlur={() => submitRename(book)}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                          className="w-full px-2 py-1 text-sm font-medium text-slate-900 bg-indigo-50 border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    ) : (
                      <h3 className="font-medium text-slate-900 truncate group-hover:text-indigo-600 transition-colors text-xs">{book.title}</h3>
                    )}
                    <p className="text-xs text-slate-500">{book.author}</p>
                  </Link>
                </div>
              ))}
            </div>

            {data && data.totalPages > 1 && (
              <div className="mt-10 flex justify-center items-center gap-3">
                <button
                  onClick={() => fetchBooks(data.page - 1)}
                  disabled={data.page <= 1}
                  className="flex items-center gap-1 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  上一页
                </button>
                <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-600">
                  <span className="font-medium text-indigo-600">{data.page}</span> / {data.totalPages}
                </div>
                <button
                  onClick={() => fetchBooks(data.page + 1)}
                  disabled={data.page >= data.totalPages}
                  className="flex items-center gap-1 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  下一页
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
