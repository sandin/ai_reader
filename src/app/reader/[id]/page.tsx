'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ePub, { Book, Rendition, NavItem } from 'epubjs';

interface Chapter {
  id: string;
  label: string;
  href: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function ReaderPage() {
  const params = useParams();
  const bookId = params.id as string;

  const [book, setBook] = useState<Book | null>(null);
  const [rendition, setRendition] = useState<Rendition | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [fontSize, setFontSize] = useState(18);
  const [showToc, setShowToc] = useState(true);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [isContentReady, setIsContentReady] = useState(false);
  const [bookTitle, setBookTitle] = useState<string>('');
  const [spineItems, setSpineItems] = useState<string[]>([]);
  const [currentSpineIndex, setCurrentSpineIndex] = useState<number>(0);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Panel layout state for persistence
  const [tocWidth, setTocWidth] = useState(288); // default 72 * 4 = 288px
  const [chatWidth, setChatWidth] = useState(320); // default 80 * 4 = 320px
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  // Load panel layout from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('reader-panel-layout');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.tocWidth) setTocWidth(parsed.tocWidth);
        if (parsed.chatWidth) setChatWidth(parsed.chatWidth);
      } catch (e) {
        // ignore parse error
      }
    }
  }, []);

  // Save panel layout to localStorage
  useEffect(() => {
    localStorage.setItem('reader-panel-layout', JSON.stringify({ tocWidth, chatWidth }));
  }, [tocWidth, chatWidth]);

  // Handle left resize
  const handleMouseDownLeft = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingLeft(true);
  }, []);

  const handleMouseDownRight = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingRight(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;

      if (isResizingLeft) {
        const newWidth = e.clientX - containerRect.left;
        const minWidth = containerWidth * 0.15;
        const maxWidth = containerWidth * 0.4;
        setTocWidth(Math.min(maxWidth, Math.max(minWidth, newWidth)));
      }

      if (isResizingRight) {
        const newWidth = containerRect.right - e.clientX;
        const minWidth = containerWidth * 0.15;
        const maxWidth = containerWidth * 0.5;
        setChatWidth(Math.min(maxWidth, Math.max(minWidth, newWidth)));
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingRight(false);
    };

    if (isResizingLeft || isResizingRight) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingLeft, isResizingRight]);

  // Load font size from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('reader-font-size');
    if (saved) {
      setFontSize(parseInt(saved, 10));
    }
  }, []);

  // Save font size to localStorage
  const handleFontSizeChange = (newSize: number) => {
    const clamped = Math.min(32, Math.max(14, newSize));
    setFontSize(clamped);
    localStorage.setItem('reader-font-size', clamped.toString());
  };

  useEffect(() => {
    let bookInstance: Book | null = null;

    const initBook = async () => {
      try {
        setLoading(true);
        setError('');

        const res = await fetch(`/api/book/${bookId}`);
        if (!res.ok) {
          throw new Error('Failed to load book');
        }

        const data = await res.json();
        // Set book title from API response
        if (data.title) {
          setBookTitle(data.title);
        }

        const bookData = Uint8Array.from(atob(data.content), c => c.charCodeAt(0));
        const bookBuffer = bookData.buffer.slice(
          bookData.byteOffset,
          bookData.byteOffset + bookData.byteLength
        );

        bookInstance = ePub(bookBuffer as ArrayBuffer);
        setBook(bookInstance);

        const navigation = await bookInstance.loaded.navigation;
        const toc = navigation.toc;

        const chapterList: Chapter[] = toc.map((item: NavItem, index: number) => ({
          id: `chapter-${index}`,
          label: item.label,
          href: item.href,
        }));

        setChapters(chapterList);

        // Don't render content immediately, wait for user to select a chapter
        setIsContentReady(true);

        if (toc.length > 0) {
          // Set first chapter as default but don't render yet
          setCurrentChapter(toc[0].href);
        }
      } catch (err) {
        console.error('Error loading book:', err);
        setError('加载书籍失败');
      } finally {
        setLoading(false);
      }
    };

    if (bookId) {
      initBook();
    }

    return () => {
      if (bookInstance) {
        bookInstance.destroy();
      }
    };
  }, [bookId]);

  // Update font size when changed
  useEffect(() => {
    if (rendition) {
      rendition.themes.fontSize(`${fontSize}px`);
    }
  }, [fontSize, rendition]);

  // Get spine items between current chapter and next chapter
  const getSpineItemsForHref = useCallback((href: string): string[] => {
    if (!book) return [];
    const spine = book.spine as any;

    // Get all spine items as array
    const spineArray: any[] = spine.items ? Array.from(spine.items) : Array.from(spine);

    // Get the base href without fragment
    const baseHref = href.split('#')[0];

    // Find the index of current chapter in spine
    let currentIndex = -1;
    for (let i = 0; i < spineArray.length; i++) {
      const itemHref = spineArray[i].href.split('#')[0];
      if (itemHref === baseHref || baseHref.includes(itemHref) || itemHref.includes(baseHref)) {
        currentIndex = i;
        break;
      }
    }

    if (currentIndex === -1) {
      // If can't find, return all as fallback
      return spineArray.map((item: any) => item.href);
    }

    // Find next chapter's index (from toc)
    let nextIndex = spineArray.length;
    const currentChapterIndex = chapters.findIndex(c => c.href === href || href.includes(c.href));

    if (currentChapterIndex !== -1 && currentChapterIndex < chapters.length - 1) {
      const nextHref = chapters[currentChapterIndex + 1].href.split('#')[0];
      for (let i = currentIndex + 1; i < spineArray.length; i++) {
        const itemHref = spineArray[i].href.split('#')[0];
        if (itemHref === nextHref || nextHref.includes(itemHref) || itemHref.includes(nextHref)) {
          nextIndex = i;
          break;
        }
      }
    }

    // Return items from currentIndex to nextIndex (exclusive)
    const items: string[] = [];
    for (let i = currentIndex; i < nextIndex; i++) {
      items.push(spineArray[i].href);
    }

    // If only 1 item found, check if there are more items with similar path
    if (items.length === 1) {
      const firstItemPath = items[0].split('#')[0].replace('.html', '').replace('.xhtml', '').replace('.htm', '');
      for (let i = currentIndex + 1; i < spineArray.length; i++) {
        const itemPath = spineArray[i].href.split('#')[0].replace('.html', '').replace('.xhtml', '').replace('.htm', '');
        // Check if it's a continuation (e.g., chapter1.html, chapter1_1.html, chapter1_2.html)
        if (itemPath.startsWith(firstItemPath) || firstItemPath.startsWith(itemPath)) {
          if (!items.includes(spineArray[i].href)) {
            items.push(spineArray[i].href);
          }
        } else {
          break;
        }
      }
    }

    return items;
  }, [book, chapters]);

  const handleChapterClick = useCallback(async (href: string) => {
    // Set selected chapter first
    setSelectedChapter(href);

    // Get spine items for this chapter
    const items = getSpineItemsForHref(href);
    console.log("items", items);
    setSpineItems(items);
    setCurrentSpineIndex(0);

    // Create rendition if not exists
    if (!rendition && book && viewerRef.current) {
      // Wait for React to render the viewer container
      await new Promise(resolve => setTimeout(resolve, 50));

      if (viewerRef.current) {
        const renditionInstance = book.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          spread: 'none',
          flow: 'scrolled' as any,
        });

        renditionInstance.themes.fontSize(`${fontSize}px`);

        renditionInstance.on('relocated', (location: { start: { href: string } }) => {
          setCurrentChapter(location.start.href);
        });

        setRendition(renditionInstance);
        await renditionInstance.display(href);
      }
    } else if (rendition) {
      await rendition.display(href);
    }

    setCurrentChapter(href);
  }, [rendition, book, fontSize, getSpineItemsForHref]);

  // Navigate to previous spine item
  const handlePrevPage = useCallback(async () => {
    console.log('handlePrevPage:', { currentSpineIndex, spineItems, rendition: !!rendition });
    if (currentSpineIndex > 0 && rendition) {
      const newIndex = currentSpineIndex - 1;
      setCurrentSpineIndex(newIndex);
      try {
        await rendition.display(spineItems[newIndex]);
        console.log('Displayed prev:', spineItems[newIndex]);
      } catch (err) {
        console.error('Error displaying prev:', err);
      }
    }
  }, [currentSpineIndex, spineItems, rendition]);

  // Navigate to next spine item
  const handleNextPage = useCallback(async () => {
    console.log('handleNextPage:', { currentSpineIndex, spineItemsLength: spineItems.length, rendition: !!rendition });
    if (currentSpineIndex < spineItems.length - 1 && rendition) {
      const newIndex = currentSpineIndex + 1;
      setCurrentSpineIndex(newIndex);
      try {
        await rendition.display(spineItems[newIndex]);
        console.log('Displayed next:', spineItems[newIndex]);
      } catch (err) {
        console.error('Error displaying next:', err);
      }
    } else {
      console.log('Condition failed:', currentSpineIndex >= spineItems.length - 1, !rendition);
    }
  }, [currentSpineIndex, spineItems, rendition]);

  const handleSendMessage = () => {
    if (!input.trim() || aiLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAiLoading(true);

    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '这是一个 AI 对话功能的占位符。您可以集成自己的 AI API 来实现实际的对话功能。',
      };
      setMessages(prev => [...prev, assistantMessage]);
      setAiLoading(false);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <div className="text-lg text-slate-600">正在加载书籍...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="text-xl text-red-600 mb-4">{error}</div>
        <Link href="/" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          返回首页
        </Link>
      </div>
    );
  }

  const currentChapterTitle = chapters.find(c => c.href === currentChapter)?.label || '';

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
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
          {/* Font size controls */}
          <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => handleFontSizeChange(fontSize - 2)}
              className="w-8 h-8 flex items-center justify-center rounded text-slate-600 hover:bg-white hover:shadow-sm transition-all"
              title="减小字体"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="text-sm text-slate-600 w-8 text-center">{fontSize}</span>
            <button
              onClick={() => handleFontSizeChange(fontSize + 2)}
              className="w-8 h-8 flex items-center justify-center rounded text-slate-600 hover:bg-white hover:shadow-sm transition-all"
              title="增大字体"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {/* Toggle TOC */}
          <button
            onClick={() => setShowToc(!showToc)}
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

      {/* Main content */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        {/* Left sidebar - TOC */}
        <aside
          className={`bg-white border-r border-slate-200 overflow-y-auto shrink-0 transition-all duration-300 ${
            showToc ? 'opacity-100' : 'w-0 opacity-0 overflow-hidden'
          }`}
          style={{ width: showToc ? tocWidth : 0 }}
        >
          <div className="p-4" style={{ width: tocWidth }}>
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <h2 className="font-semibold text-slate-800">目录</h2>
            </div>
            <ul className="space-y-1">
              {chapters.map((chapter) => {
                const isActive = currentChapter.includes(chapter.href) || chapter.href.includes(currentChapter);
                return (
                  <li key={chapter.id}>
                    <button
                      onClick={() => handleChapterClick(chapter.href)}
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
              })}
            </ul>
          </div>
        </aside>

        {/* Resize handle between TOC and content */}
        {showToc && (
          <div
            className="w-1 bg-slate-200 hover:bg-indigo-400 cursor-col-resize transition-colors shrink-0"
            onMouseDown={handleMouseDownLeft}
          />
        )}

        {/* Main reader area */}
        <main className="flex-1 bg-white overflow-y-auto">
          {/* Current chapter indicator and navigation */}
          {(currentChapterTitle || selectedChapter) && (
            <div className="sticky top-0 bg-white/90 backdrop-blur-sm border-b border-slate-100 px-6 py-2 z-10 flex items-center justify-between">
              <p className="text-sm text-slate-500 truncate">{currentChapterTitle || '加载中...'}</p>
              {selectedChapter && spineItems.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrevPage}
                    disabled={currentSpineIndex === 0}
                    className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="上一页"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="text-sm text-slate-500 min-w-[60px] text-center">
                    {currentSpineIndex + 1} / {spineItems.length}
                  </span>
                  <button
                    onClick={handleNextPage}
                    disabled={currentSpineIndex >= spineItems.length - 1}
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
          {selectedChapter ? (
            <div
              ref={viewerRef}
              className="h-full min-h-[calc(100vh-120px)]"
              style={{ background: '#fff', color: '#333' }}
            />
          ) : (
            <div className="h-full min-h-[calc(100vh-120px)] flex items-center justify-center bg-slate-50">
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

        {/* Resize handle between content and chat */}
        <div
          className="w-1 bg-slate-200 hover:bg-indigo-400 cursor-col-resize transition-colors shrink-0"
          onMouseDown={handleMouseDownRight}
        />

        {/* Right sidebar - AI Chat */}
        <aside
          className="bg-white border-l border-slate-200 flex flex-col shrink-0"
          style={{ width: chatWidth }}
        >
          <div className="p-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-slate-800">AI 助手</h2>
                <p className="text-xs text-slate-500">智能问答</p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
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
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`${msg.role === 'user' ? 'ml-8' : 'mr-8'}`}
                >
                  <div
                    className={`px-4 py-3 rounded-2xl text-sm ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-md'
                        : 'bg-slate-100 text-slate-800 rounded-bl-md'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            {aiLoading && (
              <div className="mr-8">
                <div className="px-4 py-3 rounded-2xl rounded-bl-md text-sm bg-slate-100 text-slate-500 flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="p-4 border-t border-slate-100 bg-slate-50">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="输入问题..."
                className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
                disabled={aiLoading}
              />
              <button
                onClick={handleSendMessage}
                disabled={aiLoading || !input.trim()}
                className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
