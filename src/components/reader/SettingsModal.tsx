'use client';

import { useState, useEffect } from 'react';
import { FONT_OPTIONS, ToolbarSettings, defaultToolbarSettings } from './types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Font settings
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  onFontSizeChange: (size: number) => void;
  onFontFamilyChange: (family: string) => void;
  onLineHeightChange: (height: number) => void;
  // Display settings
  autoScrollOnStreaming: boolean;
  highlightEnabled: boolean;
  mermaidEnabled: boolean;
  markdownBreaksEnabled: boolean;
  remarkGfmEnabled: boolean;
  onToggleAutoScroll: () => void;
  onToggleHighlight: () => void;
  onToggleMermaid: () => void;
  onToggleMarkdownBreaks: () => void;
  onToggleRemarkGfm: () => void;
  // Toolbar visibility settings
  toolbarSettings: ToolbarSettings;
  onToolbarSettingsChange: (settings: ToolbarSettings) => void;
}

type SettingsCategory = 'display' | 'markdown';

interface Category {
  id: SettingsCategory;
  label: string;
  icon: React.ReactNode;
}

const categories: Category[] = [
  {
    id: 'display',
    label: '显示',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'markdown',
    label: 'Markdown',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
];

// Custom checkbox component
function Checkbox({
  checked,
  onChange,
  title,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title?: string;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
        checked
          ? 'bg-indigo-600 border-indigo-600'
          : 'bg-white border-slate-300 hover:border-indigo-400'
      }`}
      title={title || (checked ? '在工具栏显示' : '不在工具栏显示')}
    >
      {checked && (
        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );
}

export default function SettingsModal({
  isOpen,
  onClose,
  fontSize,
  fontFamily,
  lineHeight,
  onFontSizeChange,
  onFontFamilyChange,
  onLineHeightChange,
  autoScrollOnStreaming,
  highlightEnabled,
  mermaidEnabled,
  markdownBreaksEnabled,
  remarkGfmEnabled,
  onToggleAutoScroll,
  onToggleHighlight,
  onToggleMermaid,
  onToggleMarkdownBreaks,
  onToggleRemarkGfm,
  toolbarSettings,
  onToolbarSettingsChange,
}: SettingsModalProps) {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('display');

  // Load toolbar settings from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('reader-toolbar-settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        onToolbarSettingsChange({ ...defaultToolbarSettings, ...parsed });
      } catch (e) {
        // Use defaults
      }
    }
  }, []);

  // Save toolbar settings to localStorage when changed
  const handleToolbarSettingChange = (key: keyof ToolbarSettings, value: boolean) => {
    const newSettings = { ...toolbarSettings, [key]: value };
    onToolbarSettingsChange(newSettings);
    localStorage.setItem('reader-toolbar-settings', JSON.stringify(newSettings));
  };

  if (!isOpen) return null;

  const handleFontSizeDecrease = () => onFontSizeChange(fontSize - 1);
  const handleFontSizeIncrease = () => onFontSizeChange(fontSize + 1);
  const handleLineHeightDecrease = () => onLineHeightChange(Math.round(Math.max(1.2, lineHeight - 0.1) * 10) / 10);
  const handleLineHeightIncrease = () => onLineHeightChange(Math.round(Math.min(3.0, lineHeight + 0.1) * 10) / 10);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-[800px] h-[500px] flex overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 左侧分类导航 */}
        <div className="w-44 bg-slate-50 border-r border-slate-200 p-4 shrink-0">
          <div className="text-sm font-semibold text-slate-500 mb-4 px-2">设置</div>
          <nav className="space-y-1">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  activeCategory === category.id
                    ? 'bg-indigo-100 text-indigo-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {category.icon}
                {category.label}
              </button>
            ))}
          </nav>
        </div>

        {/* 右侧设置内容 */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activeCategory === 'display' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-1">显示设置</h3>
              <p className="text-xs text-slate-400 mb-4">勾选后在工具栏显示对应设置项</p>

              {/* 字体大小 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={toolbarSettings.showFontSize}
                    onChange={(v) => handleToolbarSettingChange('showFontSize', v)}
                    title="在工具栏显示"
                  />
                  <div>
                    <div className="text-sm text-slate-600">字体大小</div>
                    <div className="text-xs text-slate-400 mt-0.5">调整阅读字体大小</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleFontSizeDecrease}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  <span className="text-sm text-slate-600 w-8 text-center">{fontSize}</span>
                  <button
                    onClick={handleFontSizeIncrease}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* 字体 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={toolbarSettings.showFontFamily}
                    onChange={(v) => handleToolbarSettingChange('showFontFamily', v)}
                    title="在工具栏显示"
                  />
                  <div>
                    <div className="text-sm text-slate-600">字体</div>
                    <div className="text-xs text-slate-400 mt-0.5">选择阅读字体</div>
                  </div>
                </div>
                <select
                  value={fontFamily}
                  onChange={(e) => onFontFamilyChange(e.target.value)}
                  className="h-9 px-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-600 cursor-pointer hover:border-slate-300 focus:outline-none focus:border-indigo-400 min-w-[160px]"
                >
                  {FONT_OPTIONS.map((font) => (
                    <option key={font.value} value={font.value}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 行距 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={toolbarSettings.showLineHeight}
                    onChange={(v) => handleToolbarSettingChange('showLineHeight', v)}
                    title="在工具栏显示"
                  />
                  <div>
                    <div className="text-sm text-slate-600">行距</div>
                    <div className="text-xs text-slate-400 mt-0.5">调整行间距</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleLineHeightDecrease}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  <span className="text-sm text-slate-600 w-10 text-center">{lineHeight.toFixed(1)}</span>
                  <button
                    onClick={handleLineHeightIncrease}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* 自动滚动 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={toolbarSettings.showAutoScroll}
                    onChange={(v) => handleToolbarSettingChange('showAutoScroll', v)}
                    title="在工具栏显示"
                  />
                  <div>
                    <div className="text-sm text-slate-600">流式输出自动滚动</div>
                    <div className="text-xs text-slate-400 mt-0.5">AI 回复时自动滚动到最新位置</div>
                  </div>
                </div>
                <button
                  onClick={onToggleAutoScroll}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    autoScrollOnStreaming ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      autoScrollOnStreaming ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {/* 高亮 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={toolbarSettings.showHighlight}
                    onChange={(v) => handleToolbarSettingChange('showHighlight', v)}
                    title="在工具栏显示"
                  />
                  <div>
                    <div className="text-sm text-slate-600">高亮功能</div>
                    <div className="text-xs text-slate-400 mt-0.5">选中的文字显示高亮背景</div>
                  </div>
                </div>
                <button
                  onClick={onToggleHighlight}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    highlightEnabled ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      highlightEnabled ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {activeCategory === 'markdown' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Markdown 设置</h3>

              {/* Mermaid 图表 */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-600">Mermaid 图表</div>
                  <div className="text-xs text-slate-400 mt-0.5">渲染 Markdown 中的 Mermaid 图表</div>
                </div>
                <button
                  onClick={onToggleMermaid}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    mermaidEnabled ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      mermaidEnabled ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {/* Markdown 换行 */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-600">Markdown 换行</div>
                  <div className="text-xs text-slate-400 mt-0.5">普通换行显示为换行</div>
                </div>
                <button
                  onClick={onToggleMarkdownBreaks}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    markdownBreaksEnabled ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      markdownBreaksEnabled ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {/* GFM 扩展 */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-600">GFM 扩展</div>
                  <div className="text-xs text-slate-400 mt-0.5">支持表格、删除线等 GitHub 风格 Markdown</div>
                </div>
                <button
                  onClick={onToggleRemarkGfm}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    remarkGfmEnabled ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      remarkGfmEnabled ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
