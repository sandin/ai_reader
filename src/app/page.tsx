'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Book {
  id: string;
  title: string;
  author: string;
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
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            书籍列表
          </h2>
        </div>

        {data?.books.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl shadow-sm border border-slate-200">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <p className="text-slate-500 mb-2">暂无书籍</p>
            <p className="text-sm text-slate-400">请将 EPUB 文件放入 book 文件夹</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data?.books.map((book) => (
                <Link
                  key={book.id}
                  href={`/reader/${book.id}`}
                  className="block bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 p-6 group border border-slate-100 hover:border-indigo-200"
                >
                  <div className="aspect-[3/4] bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-xl mb-5 flex items-center justify-center group-hover:scale-[1.02] transition-transform">
                    <div className="w-20 h-20 bg-white/80 rounded-full flex items-center justify-center shadow-sm">
                      <svg
                        className="w-12 h-12 text-indigo-400"
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
                  <h3 className="font-semibold text-slate-900 truncate mb-1 group-hover:text-indigo-600 transition-colors">{book.title}</h3>
                  <p className="text-sm text-slate-500">{book.author}</p>
                </Link>
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
