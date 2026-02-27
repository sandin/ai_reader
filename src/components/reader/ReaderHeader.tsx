'use client';

import Link from 'next/link';
import { FONT_OPTIONS } from './types';

interface ReaderHeaderProps {
  bookTitle: string;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  showToc: boolean;
  autoScrollOnStreaming: boolean;
  highlightEnabled: boolean;
  onFontSizeChange: (size: number) => void;
  onFontFamilyChange: (family: string) => void;
  onLineHeightChange: (height: number) => void;
  onToggleToc: () => void;
  onToggleAutoScroll: () => void;
  onToggleHighlight: () => void;
}

export default function ReaderHeader({
  bookTitle,
  fontSize,
  fontFamily,
  lineHeight,
  showToc,
  autoScrollOnStreaming,
  highlightEnabled,
  onFontSizeChange,
  onFontFamilyChange,
  onLineHeightChange,
  onToggleToc,
  onToggleAutoScroll,
  onToggleHighlight,
}: ReaderHeaderProps) {
  const handleFontSizeDecrease = () => onFontSizeChange(fontSize - 1);
  const handleFontSizeIncrease = () => onFontSizeChange(fontSize + 1);

  const handleLineHeightDecrease = () => {
    const newHeight = Math.max(1.2, lineHeight - 0.2);
    onLineHeightChange(newHeight);
  };

  const handleLineHeightIncrease = () => {
    const newHeight = Math.min(3.0, lineHeight + 0.2);
    onLineHeightChange(newHeight);
  };

  const handleFontFamilyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onFontFamilyChange(value);
    localStorage.setItem('reader-font-family', value);
  };

  return (
    <header className="h-14 bg-white/80 backdrop-blur-sm border-b border-slate-200 flex items-center px-4 justify-between shrink-0 shadow-sm">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-medium">返回</span>
        </Link>
        <div className="h-6 w-px bg-slate-200"></div>
        <h1 className="text-base font-semibold text-slate-800 truncate max-w-xs lg:max-w-md">
          {bookTitle}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {/* 工具栏 */}
        <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
          {/* Font size controls */}
          <button
            onClick={handleFontSizeDecrease}
            className="w-8 h-8 flex items-center justify-center rounded text-slate-600 hover:bg-white hover:shadow-sm transition-all"
            title="减小字体"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="text-sm text-slate-600 w-8 text-center">{fontSize}</span>
          <button
            onClick={handleFontSizeIncrease}
            className="w-8 h-8 flex items-center justify-center rounded text-slate-600 hover:bg-white hover:shadow-sm transition-all"
            title="增大字体"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-slate-300 mx-1"></div>

          {/* Font family dropdown */}
          <select
            value={fontFamily}
            onChange={handleFontFamilyChange}
            className="h-8 px-2 text-sm bg-white border border-slate-200 rounded text-slate-600 cursor-pointer hover:border-slate-300 focus:outline-none focus:border-indigo-400"
            title="字体"
          >
            {FONT_OPTIONS.map((font) => (
              <option key={font.value} value={font.value}>
                {font.label}
              </option>
            ))}
          </select>

          {/* Divider */}
          <div className="w-px h-6 bg-slate-300 mx-1"></div>

          {/* Line height controls */}
          <button
            onClick={handleLineHeightDecrease}
            className="w-8 h-8 flex items-center justify-center rounded text-slate-600 hover:bg-white hover:shadow-sm transition-all"
            title="减小行距"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="text-sm text-slate-600 w-10 text-center">{lineHeight}</span>
          <button
            onClick={handleLineHeightIncrease}
            className="w-8 h-8 flex items-center justify-center rounded text-slate-600 hover:bg-white hover:shadow-sm transition-all"
            title="增大行距"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-slate-300 mx-1"></div>

          {/* Auto-scroll toggle */}
          <button
            onClick={onToggleAutoScroll}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors ${
              autoScrollOnStreaming
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-white text-slate-500 hover:bg-slate-50'
            }`}
            title={autoScrollOnStreaming ? '流式输出时自动滚动已开启' : '流式输出时自动滚动已关闭'}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            滚动
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-slate-300 mx-1"></div>

          {/* Highlight toggle */}
          <button
            onClick={onToggleHighlight}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors ${
              highlightEnabled
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-white text-slate-500 hover:bg-slate-50'
            }`}
            title={highlightEnabled ? '高亮已开启' : '高亮已关闭'}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            高亮
          </button>
        </div>

        {/* Toggle TOC */}
        <button
          onClick={onToggleToc}
          className={`p-2 rounded-lg transition-colors ${
            showToc ? 'bg-indigo-100 text-indigo-600' : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="目录"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
    </header>
  );
}
