'use client';

import { useState, useCallback } from 'react';
import { Chapter, TreeNode } from './types';

interface TableOfContentsProps {
  chapters: Chapter[];
  tree: TreeNode[];
  currentChapter: string;
  onChapterClick: (href: string) => void;
}

export default function TableOfContents({
  chapters,
  tree,
  currentChapter,
  onChapterClick,
}: TableOfContentsProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const toggleNode = useCallback((chapterId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chapterId)) {
        newSet.delete(chapterId);
      } else {
        newSet.add(chapterId);
      }
      return newSet;
    });
  }, []);

  // Recursive render function for tree chapters (VSCode Explorer style)
  const renderTreeChapter = useCallback((nodeList: TreeNode[], activeHref: string, level: number = 0) => {
    return nodeList.map((node) => {
      const nodeHref = node.href || '';
      // Check if current page is in this node's contents or href matches
      const isActive = node.contents.some(c =>
        activeHref.includes(c.split('#')[0].split('/').pop() || '') || c.includes(activeHref)
      ) || nodeHref.includes(activeHref.split('#')[0].split('/').pop() || '') ||
        activeHref.includes(nodeHref.split('#')[0].split('/').pop() || '');
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedNodes.has(node.chapter_id);

      return (
        <li key={node.chapter_id}>
          <div className="flex items-center">
            {/* Expand/collapse chevron */}
            {hasChildren ? (
              <button
                onClick={() => toggleNode(node.chapter_id)}
                className="p-1 hover:bg-slate-200 rounded transition-colors"
                style={{ marginLeft: `${level * 16}px` }}
              >
                <svg
                  className={`w-3 h-3 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            ) : (
              <span style={{ width: '20px', marginLeft: `${level * 16 + 4}px` }} />
            )}

            {/* Chapter icon */}
            <button
              onClick={() => node.href && onChapterClick(node.href)}
              className={`flex-1 text-left px-2 py-1.5 text-sm truncate transition-colors ${
                isActive
                  ? 'bg-indigo-100 text-indigo-700 font-medium'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {/* File/folder icon */}
              {hasChildren ? (
                <svg className="w-4 h-4 inline-block mr-1.5 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 inline-block mr-1.5 text-slate-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
              )}
              {node.chapter_name}
            </button>
          </div>

          {/* Children */}
          {hasChildren && isExpanded && (
            <ul className="ml-0">
              {renderTreeChapter(node.children, activeHref, level + 1)}
            </ul>
          )}
        </li>
      );
    });
  }, [expandedNodes, onChapterClick, toggleNode]);

  return (
    <aside
      className="h-full overflow-y-auto"
    >
      <div className="p-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <h2 className="font-semibold text-slate-800">目录</h2>
        </div>
        <ul className="space-y-1 mt-4">
          {/* Render tree structure */}
          {tree.length > 0 ? (
            renderTreeChapter(tree, currentChapter || '')
          ) : (
            // Fallback to flat chapters list
            chapters.map((chapter) => {
              const isActive = currentChapter.includes(chapter.href) || chapter.href.includes(currentChapter);
              return (
                <li key={chapter.id}>
                  <button
                    onClick={() => onChapterClick(chapter.href)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm truncate transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 font-medium'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {chapter.label}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </aside>
  );
}
