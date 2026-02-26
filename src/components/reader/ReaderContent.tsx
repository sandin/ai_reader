'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Book, Rendition } from 'epubjs';

interface ReaderContentProps {
  book: Book | null;
  rendition: Rendition | null;
  currentChapter: string;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  chapterTitle: string;
  totalPages: number;
  currentPage: number;
  onRenditionReady: (rendition: Rendition) => void;
  onCreateRendition: () => Rendition | null;
  onLocationChange: (href: string, cfi: string) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
}

export default function ReaderContent({
  book,
  rendition,
  currentChapter,
  fontSize,
  fontFamily,
  lineHeight,
  chapterTitle,
  totalPages,
  currentPage,
  onRenditionReady,
  onCreateRendition,
  onLocationChange,
  onPrevPage,
  onNextPage,
}: ReaderContentProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);

  // Sync rendition ref
  useEffect(() => {
    if (rendition) {
      renditionRef.current = rendition;
    }
  }, [rendition]);

  // Update font settings when changed
  useEffect(() => {
    if (rendition) {
      rendition.themes.fontSize(`${fontSize}px`);
      rendition.themes.font(fontFamily);
      rendition.themes.override("color", '#3a3a3a', true);
      rendition.themes.override("line-height", lineHeight.toString(), true);
    }
  }, [fontSize, fontFamily, lineHeight, rendition]);

  // Handle prev/next page
  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      onPrevPage();
    }
  }, [currentPage, onPrevPage]);

  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      onNextPage();
    }
  }, [currentPage, totalPages, onNextPage]);

  return (
    <main className="flex-1 flex flex-col bg-white overflow-hidden relative">
      {/* Current chapter indicator and navigation */}
      {(chapterTitle || currentChapter) && (
        <div className="sticky top-0 bg-white/90 backdrop-blur-sm border-b border-slate-100 p-3 z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <p className="text-sm text-slate-600 truncate">
              {chapterTitle || '加载中...'}
              {currentChapter && (
                <span className="text-xs text-slate-400 ml-1">
                  ({currentChapter.split('#')[0].split('/').pop()})
                </span>
              )}
            </p>
          </div>
          {currentChapter && totalPages > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="上一页"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm text-slate-500 min-w-[80px] text-center">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="下一页"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {currentChapter ? (
        <div
          ref={viewerRef}
          className="flex-1 overflow-y-auto"
          style={{ background: '#fff', color: '#4a4a4a' }}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <p className="text-slate-500 text-lg mb-2">请从左侧选择章节</p>
            <p className="text-slate-400 text-sm">点击目录中的章节开始阅读</p>
          </div>
        </div>
      )}
    </main>
  );
}
