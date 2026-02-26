'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ePub, { Book, Rendition, NavItem } from 'epubjs';
import ReactMarkdown from 'react-markdown';

interface Chapter {
  id: string;
  label: string;
  href: string;
}

interface Block {
  id: string;
  content: string;
  cfiRange?: string;
  timestamp: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  blocks: Block[];
  timestamp: number;
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
  const [fontFamily, setFontFamily] = useState('Georgia, serif');
  const [lineHeight, setLineHeight] = useState(1.8);
  const [savedCfi, setSavedCfi] = useState<string | null>(null);
  const currentCfiRef = useRef<string>('');
  const saveProgressTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 可选字体列表 - 跨平台系统字体 + webfont
  const fontOptions = [
    // 系统字体
    { value: 'Georgia, "Times New Roman", serif', label: '衬线体' },
    { value: 'Arial, Helvetica, sans-serif', label: '无衬线' },
    { value: '"PingFang SC", "Hiragino Sans GB", "Heiti SC", sans-serif', label: '苹方 PingFang' },
    { value: '"Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif', label: '微软雅黑' },
    { value: '"SimSun", "STSong", serif', label: '宋体' },
    { value: 'Menlo, Monaco, "Courier New", monospace', label: '等宽字体' },
    { value: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif', label: '系统默认' },
    // Webfont
    { value: '"Noto Sans SC", "Microsoft YaHei", sans-serif', label: '思源黑体' },
    { value: '"Noto Serif SC", "SimSun", serif', label: '思源宋体' },
  ];
  const [showToc, setShowToc] = useState(true);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [isContentReady, setIsContentReady] = useState(false);
  const [bookTitle, setBookTitle] = useState<string>('');
  const [spineItems, setSpineItems] = useState<string[]>([]);
  const [currentSpineIndex, setCurrentSpineIndex] = useState<number>(0);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // 输入历史相关状态
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  // 加载输入历史
  useEffect(() => {
    const savedHistory = localStorage.getItem('ai-chat-input-history');
    if (savedHistory) {
      try {
        setInputHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to parse input history:', e);
      }
    }
  }, []);
  const [selectedBlocks, setSelectedBlocks] = useState<Block[]>([]);
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  const [isSelectedBlocksExpanded, setIsSelectedBlocksExpanded] = useState(false);

  // Session management
  const [sessions, setSessions] = useState<Array<{
    id: string;
    title: string;
    selectedBlocks: Block[];
    messages: Message[];
    timestamp: number;
  }>>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Edit session modal state
  const [showEditSession, setShowEditSession] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionTitle, setEditingSessionTitle] = useState('');

  // Context menu state
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuSelection, setContextMenuSelection] = useState('');
  const [contextMenuCfiRange, setContextMenuCfiRange] = useState('');

  // Tab state: 'chat' or 'comment'
  const [activeTab, setActiveTab] = useState<'chat' | 'comment'>('chat');

  // Comment data structures
  interface Comment {
    id: string;
    content: string;
    selectedText: string;
    cfiRange: string;
    chapter: string;
    timestamp: number;
  }
  const [comments, setComments] = useState<Comment[]>([]);
  const [currentCommentText, setCurrentCommentText] = useState('');
  const [commentSelection, setCommentSelection] = useState('');
  const [commentCfiRange, setCommentCfiRange] = useState('');

  // Comment annotation refs
  const commentRefs = useRef<Map<string, string>>(new Map());

  // Panel layout state for persistence
  const [tocWidth, setTocWidth] = useState(288); // default 72 * 4 = 288px
  const [chatWidth, setChatWidth] = useState(320); // default 80 * 4 = 320px
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const selectionHandlerAdded = useRef(false);
  const isResizingRef = useRef(false);

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
    isResizingRef.current = true;
    setIsResizingLeft(true);
  }, []);

  const handleMouseDownRight = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
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

    const handleMouseUp = async () => {
      isResizingRef.current = false;
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
  }, [currentChapter, rendition, isResizingLeft, isResizingRight]);

  // Load font settings from localStorage
  useEffect(() => {
    const savedFontSize = localStorage.getItem('reader-font-size');
    if (savedFontSize) {
      setFontSize(parseInt(savedFontSize, 10));
    }
    const savedFontFamily = localStorage.getItem('reader-font-family');
    if (savedFontFamily) {
      setFontFamily(savedFontFamily);
    }
    const savedLineHeight = localStorage.getItem('reader-line-height');
    if (savedLineHeight) {
      setLineHeight(parseFloat(savedLineHeight));
    }
  }, []);

  // Save font size to localStorage
  const handleFontSizeChange = (newSize: number) => {
    const clamped = Math.min(32, Math.max(14, newSize));
    setFontSize(clamped);
    localStorage.setItem('reader-font-size', clamped.toString());
  };

  // Hide context menu when selection changes
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setShowContextMenu(false);
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

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

        // Try to load saved reading progress
        let defaultChapter = toc.length > 0 ? toc[0].href : '';
        let loadedCfi: string | null = null;
        try {
          const progressRes = await fetch(`/api/progress?bookId=${bookId}`);
          if (progressRes.ok) {
            const progressData = await progressRes.json();
            if (progressData.chapter) {
              // Verify the saved chapter exists in this book
              const savedChapterExists = chapterList.some(
                (c: Chapter) => c.href.startsWith(progressData.chapter) || progressData.chapter.includes(c.href.split('#')[0])
              );
              if (savedChapterExists) {
                defaultChapter = progressData.chapter;
              }
            }
            // Save CFI for bookmark restoration
            if (progressData.cfi) {
              loadedCfi = progressData.cfi;
            }
          }
        } catch (err) {
          console.error('Failed to load reading progress:', err);
        }

        // Set saved CFI for later use when displaying
        setSavedCfi(loadedCfi);

        if (defaultChapter) {
          // Set default chapter and auto-display it
          setCurrentChapter(defaultChapter);
          setSelectedChapter(defaultChapter);

          // Get spine items for the chapter
          const items = getSpineItemsForHref(defaultChapter);
          setSpineItems(items);
          setCurrentSpineIndex(0);
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

  // Auto-display saved chapter when book is loaded
  useEffect(() => {
    if (isContentReady && book && selectedChapter && !rendition && viewerRef.current) {
      // Wait for viewer to be ready
      const timer = setTimeout(async () => {
        if (!viewerRef.current) return;

        const renditionInstance = book.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          spread: 'none',
          flow: 'scrolled' as any,
        });

        renditionInstance.themes.fontSize(`${fontSize}px`);
        renditionInstance.themes.font(fontFamily);
        renditionInstance.themes.register('*', {
          'line-height': lineHeight.toString(),
          'color': '#4a4a4a',
        });

        renditionInstance.on('relocated', (location: { start: { href: string; cfi: string } }) => {
          setCurrentChapter(location.start.href);

          // Save CFI for bookmark
          const cfi = location.start.cfi;
          currentCfiRef.current = cfi;

          // Debounce save progress (save every 2 seconds of no movement)
          if (saveProgressTimeoutRef.current) {
            clearTimeout(saveProgressTimeoutRef.current);
          }
          saveProgressTimeoutRef.current = setTimeout(() => {
            const htmlFile = location.start.href.split('#')[0];
            saveProgress(htmlFile, cfi);
          }, 2000);
        });

        // Handle text selection
        if (!selectionHandlerAdded.current) {
          selectionHandlerAdded.current = true;
          renditionInstance.on('rendered', () => {
            const tryBind = (attempts: number) => {
              if (attempts <= 0) return;
              const container = viewerRef.current;
              const iframe = container?.querySelector('iframe');

              if (iframe && iframe.contentWindow) {
                const win = iframe.contentWindow;

                // Load notes when rendered
                setTimeout(() => {
                  if (bookId && selectedChapter) {
                    const htmlFile = selectedChapter.split('#')[0];
                    const encodedHtmlFile = encodeURIComponent(htmlFile);
                    fetch(`/api/note/${bookId}/${encodedHtmlFile}`)
                      .then(res => res.json())
                      .then(data => {
                        if (data.sessions && data.sessions.length > 0) {
                          const loadedSessions = data.sessions.map((session: any) => ({
                            id: session.id,
                            title: session.title || `对话 ${data.sessions.indexOf(session) + 1}`,
                            selectedBlocks: session.selectedBlocks || [],
                            messages: session.messages || [],
                            timestamp: session.timestamp,
                          }));
                          setSessions(loadedSessions);
                          const mostRecent = loadedSessions.sort((a: any, b: any) => b.timestamp - a.timestamp)[0];
                          setCurrentSessionId(mostRecent.id);
                          setMessages(mostRecent.messages || []);
                          setSelectedBlocks(mostRecent.selectedBlocks || []);
                        } else {
                          setSessions([]);
                          setCurrentSessionId(null);
                          setMessages([]);
                          setSelectedBlocks([]);
                        }
                      })
                      .catch(err => console.error('Failed to load notes:', err));

                    // Load comments inline
                    if (bookId && selectedChapter) {
                      const commentHtmlFile = selectedChapter.split('#')[0];
                      const commentEncodedHtmlFile = encodeURIComponent(commentHtmlFile);
                      fetch(`/api/note/${bookId}/${commentEncodedHtmlFile}`)
                        .then(res => res.json())
                        .then(data => {
                          // Filter comments for current chapter only
                          const currentChapterFile = commentHtmlFile.split('/').pop() || commentHtmlFile;
                          const filteredComments = (data.comments || []).filter((comment: any) => {
                            const commentChapter = comment.chapter || '';
                            const commentChapterFile = commentChapter.split('/').pop() || commentChapter;
                            return commentChapterFile === currentChapterFile ||
                                   currentChapterFile.replace(/\.[^/.]+$/, '') === commentChapterFile.replace(/\.[^/.]+$/, '');
                          });
                          if (filteredComments.length > 0) {
                            setComments(filteredComments);
                          } else {
                            setComments([]);
                          }
                        })
                        .catch(err => console.error('Failed to load comments:', err));
                    }
                  }
                }, 100);

                // Handle right-click
                win.addEventListener('contextmenu', (e: MouseEvent) => {
                  e.preventDefault();
                  setTimeout(() => {
                    const selection = win.getSelection();
                    const selectedText = selection ? selection.toString().trim() : '';

                    if (selectedText && selection && selection.rangeCount > 0) {
                      const iframeRect = iframe.getBoundingClientRect();
                      setContextMenuPosition({
                        x: iframeRect.left + e.clientX,
                        y: iframeRect.top + e.clientY
                      });
                      setContextMenuSelection(selectedText);
                      setShowContextMenu(true);
                    }
                  }, 10);
                });

                renditionInstance.on('selected', (cfiRange: string) => {
                  setContextMenuCfiRange(cfiRange);
                });
              } else {
                setTimeout(() => tryBind(attempts - 1), 500);
              }
            };
            tryBind(5);
          });
        }

        setRendition(renditionInstance);

        // Use saved CFI to restore bookmark if available
        if (savedCfi) {
          await renditionInstance.display(savedCfi);
          setSavedCfi(null); // Clear after use
        } else {
          await renditionInstance.display(selectedChapter);
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isContentReady, book, selectedChapter, rendition, fontSize, fontFamily, lineHeight, bookId, savedCfi]);

  // Update font settings when changed
  useEffect(() => {
    if (rendition) {
      rendition.themes.fontSize(`${fontSize}px`);
      rendition.themes.font(fontFamily);
      rendition.themes.override("color", '#3a3a3a', true);
      rendition.themes.override("line-height", lineHeight.toString(), true);
    }
  }, [fontSize, fontFamily, lineHeight, rendition]);

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

  // Save reading progress to server
  const saveProgress = useCallback((chapter: string, cfi?: string) => {
    if (!bookId || !chapter) return;
    const htmlFile = chapter.split('#')[0];
    fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookId,
        chapter: htmlFile,
        cfi: cfi || '',
      }),
    }).catch(err => console.error('Failed to save progress:', err));
  }, [bookId]);

  const handleChapterClick = useCallback(async (href: string) => {
    // Set selected chapter first
    setSelectedChapter(href);

    // Get spine items for this chapter
    const items = getSpineItemsForHref(href);
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
        renditionInstance.themes.font(fontFamily);
        renditionInstance.themes.register('*', {
          'line-height': lineHeight.toString(),
          'color': '#4a4a4a',
        });

        renditionInstance.on('relocated', (location: { start: { href: string; cfi: string } }) => {
          setCurrentChapter(location.start.href);

          // Save CFI for bookmark
          const cfi = location.start.cfi;
          currentCfiRef.current = cfi;

          // Debounce save progress (save every 2 seconds of no movement)
          if (saveProgressTimeoutRef.current) {
            clearTimeout(saveProgressTimeoutRef.current);
          }
          saveProgressTimeoutRef.current = setTimeout(() => {
            const htmlFile = location.start.href.split('#')[0];
            saveProgress(htmlFile, cfi);
          }, 2000);
        });

        // Handle text selection via mouseup event
        if (!selectionHandlerAdded.current) {
          selectionHandlerAdded.current = true;
          renditionInstance.on('rendered', () => {
            // Try to find iframe in the rendition's container
            const tryBind = (attempts: number) => {
              if (attempts <= 0) return;

              // Find iframe in the viewer container
              const container = viewerRef.current;
              const iframe = container?.querySelector('iframe');

              if (iframe && iframe.contentWindow) {
                const win = iframe.contentWindow;

                // Load notes when rendered (directly call, not via ref)
                setTimeout(() => {
                  // Call loadNotesForChapter directly since it's in scope
                  if (bookId) {
                    const htmlFile = href.split('#')[0];
                    const encodedHtmlFile = encodeURIComponent(htmlFile);
                    fetch(`/api/note/${bookId}/${encodedHtmlFile}`)
                      .then(res => res.json())
                      .then(data => {
                        // Load from sessions (new format)
                        if (data.sessions && data.sessions.length > 0) {
                          const loadedSessions = data.sessions.map((session: any) => ({
                            id: session.id,
                            title: session.title || `对话 ${data.sessions.indexOf(session) + 1}`,
                            selectedBlocks: session.selectedBlocks || [],
                            messages: session.messages || [],
                            timestamp: session.timestamp,
                          }));
                          setSessions(loadedSessions);
                          const mostRecent = loadedSessions.sort((a: any, b: any) => b.timestamp - a.timestamp)[0];
                          setCurrentSessionId(mostRecent.id);
                          setMessages(mostRecent.messages || []);
                          setSelectedBlocks(mostRecent.selectedBlocks || []);
                        } else {
                          setSessions([]);
                          setCurrentSessionId(null);
                          setMessages([]);
                          setSelectedBlocks([]);
                        }
                      })
                      .catch(err => console.error('Failed to load notes:', err));

                    // Comments will be loaded via useEffect when currentChapter changes
                  }
                }, 100);

                // Handle right-click to show context menu
                win.addEventListener('contextmenu', (e: MouseEvent) => {
                  e.preventDefault();
                  setTimeout(() => {
                    const selection = win.getSelection();
                    const selectedText = selection ? selection.toString().trim() : '';

                    if (selectedText && selection && selection.rangeCount > 0) {
                      // Get iframe position relative to parent document
                      const iframeRect = iframe.getBoundingClientRect();
                      // Show context menu at mouse position (add iframe offset for parent document)
                      setContextMenuPosition({
                        x: iframeRect.left + e.clientX,
                        y: iframeRect.top + e.clientY
                      });
                      setContextMenuSelection(selectedText);
                      setShowContextMenu(true);
                    }
                  }, 10);
                });

                // Also listen to epubjs selected event to get CFI
                renditionInstance.on('selected', (cfiRange: string) => {
                  setContextMenuCfiRange(cfiRange);
                });
              } else {
                setTimeout(() => tryBind(attempts - 1), 500);
              }
            };
            tryBind(5);
          });
        }

        setRendition(renditionInstance);
        await renditionInstance.display(href);
      }
    } else if (rendition) {
      await rendition.display(href);
    }

    setCurrentChapter(href);
    saveProgress(href);
  }, [rendition, book, fontSize, getSpineItemsForHref, saveProgress]);

  // Navigate to previous spine item
  const handlePrevPage = useCallback(async () => {
    if (currentSpineIndex > 0 && rendition) {
      const newIndex = currentSpineIndex - 1;
      setCurrentSpineIndex(newIndex);
      const newHref = spineItems[newIndex];
      setCurrentChapter(newHref);
      saveProgress(newHref);
      try {
        await rendition.display(newHref);
      } catch (err) {
        console.error('Error displaying prev:', err);
      }
    }
  }, [currentSpineIndex, spineItems, rendition, saveProgress]);

  // Navigate to next spine item
  const handleNextPage = useCallback(async () => {
    if (currentSpineIndex < spineItems.length - 1 && rendition) {
      const newIndex = currentSpineIndex + 1;
      setCurrentSpineIndex(newIndex);
      const newHref = spineItems[newIndex];
      setCurrentChapter(newHref);
      saveProgress(newHref);
      try {
        await rendition.display(newHref);
      } catch (err) {
        console.error('Error displaying next:', err);
      }
    }
  }, [currentSpineIndex, spineItems, rendition, saveProgress]);

  const handleSendMessage = async () => {
    if (!input.trim() || aiLoading) return;

    // 检查是否是第一次发送消息
    const isFirstMessage = messages.length === 0;

    // 构建用户消息内容，只有第一次发送时才包含选中文本
    let userContent = input;
    if (isFirstMessage && selectedBlocks && selectedBlocks.length > 0) {
      const selectedText = selectedBlocks.map(b => b.content).join('\n\n');
      userContent = `选中文本：\n${selectedText}\n\n${input}`;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      blocks: [{
        id: Date.now().toString(),
        content: userContent,
        timestamp: Date.now(),
      }],
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAiLoading(true);
    setHistoryIndex(-1);
    setShowSuggestions(false);

    // 保存输入到历史记录
    if (input.trim()) {
      const newHistory = [input, ...inputHistory.filter(h => h !== input)].slice(0, 50);
      setInputHistory(newHistory);
      localStorage.setItem('ai-chat-input-history', JSON.stringify(newHistory));
    }

    try {
      // 准备历史消息
      const history = messages.map(msg => ({
        role: msg.role,
        content: msg.blocks.map(b => b.content).join('\n\n'),
      }));

      // 创建初始的空 assistant 消息用于流式更新
      const assistantMessageId = (Date.now() + 1).toString();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        blocks: [{
          id: assistantMessageId,
          content: '',
          timestamp: Date.now(),
        }],
        timestamp: Date.now(),
      };

      const newMessages = [...messages, userMessage, assistantMessage];
      setMessages(newMessages);

      // Create new session if doesn't exist, or update existing session
      let sessionId = currentSessionId;
      if (!sessionId) {
        sessionId = Date.now().toString();
        setCurrentSessionId(sessionId);
        const newSession = {
          id: sessionId,
          title: `对话 ${sessions.length + 1}`,
          selectedBlocks,
          messages: newMessages,
          timestamp: Date.now(),
        };
        setSessions(prev => [...prev, newSession]);
      } else {
        // Update existing session's messages
        setSessions(prev => prev.map(s =>
          s.id === sessionId
            ? { ...s, messages: newMessages, timestamp: Date.now() }
            : s
        ));
      }

      // 使用流式 fetch
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userContent,
          history,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                accumulatedContent += parsed.content;
                // 实时更新消息内容
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        blocks: [{
                          ...msg.blocks[0],
                          content: accumulatedContent,
                        }],
                      }
                    : msg
                ));
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }

      // 最终保存会话
      const finalMessages = newMessages.map(msg =>
        msg.id === assistantMessageId
          ? {
              ...msg,
              blocks: [{
                ...msg.blocks[0],
                content: accumulatedContent,
              }],
            }
          : msg
      );

      // Update session with final messages
      if (sessionId) {
        setSessions(prev => prev.map(s =>
          s.id === sessionId
            ? { ...s, messages: finalMessages, timestamp: Date.now() }
            : s
        ));
      }

      // Save current session with the new messages
      await saveCurrentSession(finalMessages);
    } catch (err) {
      console.error('Error calling LLM:', err);
      const errorData = err instanceof Error ? err.message : String(err);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        blocks: [{
          id: (Date.now() + 1).toString(),
          content: `抱歉，调用 AI 服务失败：${errorData}`,
          timestamp: Date.now(),
        }],
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setAiLoading(false);
    }
  };

  // Handle copy to clipboard
  const handleCopyToClipboard = async () => {
    if (contextMenuSelection) {
      try {
        await navigator.clipboard.writeText(contextMenuSelection);
        setShowContextMenu(false);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };


  // Load notes from local JSON file for the current chapter
  const loadNotesForChapter = useCallback(async (chapterHref: string) => {
    if (!chapterHref || !bookId) return;

    try {
      // Extract HTML filename from chapter href
      const htmlFile = chapterHref.split('#')[0];
      // Encode the htmlFile for URL
      const encodedHtmlFile = encodeURIComponent(htmlFile);

      const res = await fetch(`/api/note/${bookId}/${encodedHtmlFile}`);
      if (res.ok) {
        const data = await res.json();

        // Load sessions
        if (data.sessions && data.sessions.length > 0) {
          const loadedSessions = data.sessions.map((session: any) => ({
            id: session.id,
            title: session.title || `对话 ${data.sessions.indexOf(session) + 1}`,
            selectedBlocks: session.selectedBlocks || [],
            messages: session.messages || [],
            timestamp: session.timestamp,
          }));
          setSessions(loadedSessions);
          // Select the most recent session
          const mostRecent = loadedSessions.sort((a: any, b: any) => b.timestamp - a.timestamp)[0];
          setCurrentSessionId(mostRecent.id);
          setMessages(mostRecent.messages || []);
          setSelectedBlocks(mostRecent.selectedBlocks || []);
        } else {
          setSessions([]);
          setCurrentSessionId(null);
          setMessages([]);
          setSelectedBlocks([]);
        }
      }
    } catch (err) {
      console.error('Failed to load notes:', err);
      setSelectedBlocks([]);
      setSessions([]);
    }
  }, [bookId]);

  // Save current session
  const saveCurrentSession = useCallback(async (messagesToSave?: Message[]) => {
    if (!currentSessionId || !bookId || !currentChapter) return;

    const messagesToUse = messagesToSave ?? messages;
    const currentSession = sessions.find(s => s.id === currentSessionId);
    const title = currentSession?.title || '';

    try {
      const htmlFile = currentChapter.split('#')[0];
      const encodedHtmlFile = encodeURIComponent(htmlFile);

      await fetch(`/api/note/${bookId}/${encodedHtmlFile}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: currentSessionId,
          title,
          selectedBlocks,
          messages: messagesToUse,
        }),
      });
    } catch (err) {
      console.error('Failed to save session:', err);
    }
  }, [bookId, currentChapter, currentSessionId, selectedBlocks, messages, sessions]);

  // Save session when selectedBlocks change
  const prevSelectedBlocksRef = useRef<string>('');
  useEffect(() => {
    if (!currentSessionId || !bookId || !currentChapter) return;

    const currentBlocksKey = JSON.stringify(selectedBlocks.map(b => ({ id: b.id, content: b.content })));
    if (prevSelectedBlocksRef.current === '') {
      prevSelectedBlocksRef.current = currentBlocksKey;
      return;
    }
    if (prevSelectedBlocksRef.current === currentBlocksKey) return;

    prevSelectedBlocksRef.current = currentBlocksKey;

    // Debounce save
    const timer = setTimeout(() => {
      saveCurrentSession(messages);
    }, 500);

    return () => clearTimeout(timer);
  }, [currentSessionId, bookId, currentChapter, selectedBlocks, messages, saveCurrentSession]);

  // Auto scroll to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Create a new session
  const createNewSession = useCallback(() => {
    // 清除当前高亮
    clearHighlights();

    const newSessionId = Date.now().toString();
    setCurrentSessionId(newSessionId);
    setMessages([]);
    setSelectedBlocks([]);
    const newSession = {
      id: newSessionId,
      title: `对话 ${sessions.length + 1}`,
      selectedBlocks: [],
      messages: [],
      timestamp: Date.now(),
    };
    setSessions(prev => [...prev, newSession]);
  }, [selectedBlocks]);

  // 高亮管理
  const highlightRefs = useRef<Map<string, string>>(new Map());

  // 清除所有高亮
  const clearHighlights = useCallback(() => {
    if (!rendition) return;
    highlightRefs.current.forEach((cfiRange, blockId) => {
      try {
        rendition.annotations.remove(cfiRange, 'highlight');
      } catch (e) {
        console.warn('Failed to remove highlight:', e);
      }
    });
    highlightRefs.current.clear();
  }, [rendition]);

  // 添加高亮
  const highlightBlock = useCallback((block: Block) => {
    if (!rendition || !block.cfiRange) return;

    // 如果已经高亮过，先移除
    if (highlightRefs.current.has(block.id)) {
      try {
        rendition.annotations.remove(block.cfiRange, 'highlight');
      } catch (e) {
        console.warn('Failed to remove old highlight:', e);
      }
    }

    try {
      const highlightId = rendition.annotations.highlight(
        block.cfiRange,
        {},
        () => {}
      );
      highlightRefs.current.set(block.id, block.cfiRange);
    } catch (e) {
      console.warn('Failed to highlight block:', e);
    }
  }, [rendition]);

  // 刷新当前 session 的高亮
  const refreshHighlights = useCallback((blocks: Block[]) => {
    clearHighlights();
    blocks.forEach(block => highlightBlock(block));
  }, [clearHighlights, highlightBlock]);

  // Switch to an existing session
  const switchToSession = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
      setMessages(session.messages || []);
      setSelectedBlocks(session.selectedBlocks || []);
      // 刷新高亮
      refreshHighlights(session.selectedBlocks || []);
    }
  }, [sessions, refreshHighlights]);

  // Edit session title
  const handleEditSession = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setEditingSessionId(sessionId);
      setEditingSessionTitle(session.title);
      setShowEditSession(true);
    }
  }, [sessions]);

  const handleSaveSessionTitle = useCallback(async () => {
    if (!editingSessionId || !editingSessionTitle.trim()) return;

    // Update local state
    setSessions(prev => prev.map(s =>
      s.id === editingSessionId
        ? { ...s, title: editingSessionTitle.trim() }
        : s
    ));

    // Save to server
    const session = sessions.find(s => s.id === editingSessionId);
    if (session && currentSessionId && currentChapter && bookId) {
      try {
        const htmlFile = currentChapter.split('#')[0];
        const encodedHtmlFile = encodeURIComponent(htmlFile);
        await fetch(`/api/note/${bookId}/${encodedHtmlFile}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: editingSessionId,
            selectedBlocks: session.selectedBlocks,
            messages: session.messages,
            title: editingSessionTitle.trim(),
          }),
        });
      } catch (err) {
        console.error('Failed to save session title:', err);
      }
    }

    setShowEditSession(false);
    setEditingSessionId(null);
    setEditingSessionTitle('');
  }, [editingSessionId, editingSessionTitle, sessions, currentSessionId, currentChapter, bookId]);

  // Delete a session
  const deleteSession = useCallback(async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const newSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(newSessions);

    // 调用 API 删除服务器上的 session
    if (currentChapter && bookId) {
      const htmlFile = currentChapter.split('#')[0];
      const encodedHtmlFile = encodeURIComponent(htmlFile);
      try {
        await fetch(`/api/note/${bookId}/${encodedHtmlFile}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
      } catch (err) {
        console.error('Failed to delete session from server:', err);
      }
    }

    // If deleting current session, switch to another or clear
    if (currentSessionId === sessionId) {
      if (newSessions.length > 0) {
        switchToSession(newSessions[newSessions.length - 1].id);
      } else {
        // 删除所有 session 时，清空选中文字和高亮
        setCurrentSessionId(null);
        setMessages([]);
        setSelectedBlocks([]);
        clearHighlights();
      }
    }
  }, [sessions, currentSessionId, switchToSession, clearHighlights, currentChapter, bookId]);

  // Load comments for current chapter
  const loadCommentsForChapter = useCallback(async (href: string) => {
    try {
      const htmlFile = href.split('#')[0];
      const encodedHtmlFile = encodeURIComponent(htmlFile);

      const res = await fetch(`/api/note/${bookId}/${encodedHtmlFile}`);
      const data = await res.json();

      // Filter comments for current chapter only
      const currentChapterFile = htmlFile.split('/').pop() || htmlFile;
      const filteredComments = (data.comments || []).filter((comment: any) => {
        const commentChapter = comment.chapter || '';
        const commentChapterFile = commentChapter.split('/').pop() || commentChapter;
        return commentChapterFile === currentChapterFile ||
               currentChapterFile.replace(/\.[^/.]+$/, '') === commentChapterFile.replace(/\.[^/.]+$/, '');
      });

      if (filteredComments.length > 0) {
        setComments(filteredComments);
      } else {
        setComments([]);
      }
    } catch (err) {
      console.error('Failed to load comments:', err);
      setComments([]);
    }
  }, [bookId]);

  // Load notes and comments when currentChapter changes
  useEffect(() => {
    if (currentChapter && isContentReady) {
      loadNotesForChapter(currentChapter);
      loadCommentsForChapter(currentChapter);
    }
  }, [currentChapter, isContentReady, loadNotesForChapter, loadCommentsForChapter]);

  // 当 isContentReady 变为 true 时，加载当前 session 的高亮
  useEffect(() => {
    if (isContentReady && selectedBlocks.length > 0) {
      refreshHighlights(selectedBlocks);
    }
  }, [isContentReady]);

  // Handle add to AI assistant
  const handleAddToAssistant = async () => {
    if (contextMenuSelection && rendition) {
      const blockId = Date.now().toString();

      const newBlock: Block = {
        id: blockId,
        content: contextMenuSelection,
        timestamp: Date.now(),
        cfiRange: contextMenuCfiRange,
      };

      const newSelectedBlocks = [...selectedBlocks, newBlock];
      setSelectedBlocks(newSelectedBlocks);
      highlightBlock(newBlock);
      setShowContextMenu(false);

      // Create session if doesn't exist
      let sessionId = currentSessionId;
      if (!sessionId) {
        sessionId = Date.now().toString();
        setCurrentSessionId(sessionId);
        const newSession = {
          id: sessionId,
          title: `对话 ${sessions.length + 1}`,
          selectedBlocks: newSelectedBlocks,
          messages: [],
          timestamp: Date.now(),
        };
        setSessions(prev => [...prev, newSession]);
      }

      // Save to local JSON file via API
      try {
        const htmlFile = currentChapter.split('#')[0];
        const encodedHtmlFile = encodeURIComponent(htmlFile);

        await fetch(`/api/note/${bookId}/${encodedHtmlFile}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: currentSessionId || sessionId,
            selectedBlocks: newSelectedBlocks,
            messages,
          }),
        });
      } catch (err) {
        console.error('Failed to save note:', err);
      }
    }
  };

  // Handle add to AI assistant with new conversation
  const handleAddToAssistantNewChat = async () => {
    if (contextMenuSelection && rendition) {
      const blockId = Date.now().toString();

      const newBlock: Block = {
        id: blockId,
        content: contextMenuSelection,
        timestamp: Date.now(),
        cfiRange: contextMenuCfiRange,
      };

      // Always create a new session
      const newSessionId = Date.now().toString();
      const newSelectedBlocks = [newBlock];

      setCurrentSessionId(newSessionId);
      setMessages([]);
      setSelectedBlocks(newSelectedBlocks);
      highlightBlock(newBlock);

      const newSession = {
        id: newSessionId,
        title: `对话 ${sessions.length + 1}`,
        selectedBlocks: newSelectedBlocks,
        messages: [],
        timestamp: Date.now(),
      };

      setSessions(prev => [...prev, newSession]);
      setShowContextMenu(false);

      // Save to local JSON file via API
      try {
        const htmlFile = currentChapter.split('#')[0];
        const encodedHtmlFile = encodeURIComponent(htmlFile);

        await fetch(`/api/note/${bookId}/${encodedHtmlFile}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: newSessionId,
            selectedBlocks: newSelectedBlocks,
            messages: [],
          }),
        });
      } catch (err) {
        console.error('Failed to save note:', err);
      }
    }
  };

  // Handle add comment - opens comment tab with selection
  const handleAddComment = () => {
    if (contextMenuSelection) {
      setCommentSelection(contextMenuSelection);
      setCommentCfiRange(contextMenuCfiRange);
      setCurrentCommentText('');
      setActiveTab('comment');
      setShowContextMenu(false);
    }
  };

  // Save comment with underline annotation
  const handleSaveComment = async () => {
    if (!currentCommentText.trim() || !commentSelection) return;

    const newComment: Comment = {
      id: Date.now().toString(),
      content: currentCommentText.trim(),
      selectedText: commentSelection,
      cfiRange: commentCfiRange,
      chapter: currentChapter,
      timestamp: Date.now(),
    };

    const updatedComments = [...comments, newComment];
    setComments(updatedComments);

    // Add underline annotation
    if (rendition && commentCfiRange) {
      try {
        rendition.annotations.underline(commentCfiRange);
        // Use cfiRange as the reference since we can't get annotation ID
        commentRefs.current.set(newComment.id, commentCfiRange);
      } catch (e) {
        console.warn('Failed to add underline:', e);
      }
    }

    // Clear input
    setCurrentCommentText('');
    setCommentSelection('');
    setCommentCfiRange('');

    // Save comments to API
    try {
      const htmlFile = currentChapter.split('#')[0];
      const encodedHtmlFile = encodeURIComponent(htmlFile);

      await fetch(`/api/note/${bookId}/${encodedHtmlFile}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comments: updatedComments,
        }),
      });
    } catch (err) {
      console.error('Failed to save comment:', err);
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId: string) => {
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;

    // Remove underline annotation
    if (rendition && commentRefs.current.has(commentId)) {
      try {
        rendition.annotations.remove(commentRefs.current.get(commentId)!, 'underline');
        commentRefs.current.delete(commentId);
      } catch (e) {
        console.warn('Failed to remove underline:', e);
      }
    }

    const updatedComments = comments.filter(c => c.id !== commentId);
    setComments(updatedComments);

    // Save to API
    try {
      const htmlFile = currentChapter.split('#')[0];
      const encodedHtmlFile = encodeURIComponent(htmlFile);

      await fetch(`/api/note/${bookId}/${encodedHtmlFile}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comments: updatedComments,
        }),
      });
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  // Render comments as underlines when loaded
  useEffect(() => {
    if (!rendition || comments.length === 0) return;

    comments.forEach(comment => {
      if (comment.cfiRange && !commentRefs.current.has(comment.id)) {
        try {
          rendition.annotations.underline(comment.cfiRange);
          commentRefs.current.set(comment.id, comment.cfiRange);
        } catch (e) {
          console.warn('Failed to add underline for comment:', e);
        }
      }
    });
  }, [rendition, comments]);

  // Handle remove block
  const handleRemoveBlock = async (id: string) => {
    // 找到要删除的 block 并清除高亮
    const removedBlock = selectedBlocks.find(b => b.id === id);
    if (removedBlock && removedBlock.cfiRange && rendition) {
      try {
        rendition.annotations.remove(removedBlock.cfiRange, 'highlight');
        highlightRefs.current.delete(id);
      } catch (e) {
        console.warn('Failed to remove highlight:', e);
      }
    }

    // Remove from local state
    const newSelectedBlocks = selectedBlocks.filter(b => b.id !== id);
    setSelectedBlocks(newSelectedBlocks);
    setExpandedBlocks(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    // Update current session's selectedBlocks
    if (currentSessionId) {
      setSessions(prev => prev.map(s =>
        s.id === currentSessionId
          ? { ...s, selectedBlocks: newSelectedBlocks, timestamp: Date.now() }
          : s
      ));
      // Save to JSON file
      try {
        const htmlFile = currentChapter.split('#')[0];
        const encodedHtmlFile = encodeURIComponent(htmlFile);
        await fetch(`/api/note/${bookId}/${encodedHtmlFile}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: currentSessionId,
            selectedBlocks: newSelectedBlocks,
            messages,
          }),
        });
      } catch (err) {
        console.error('Failed to save after removing block:', err);
      }
    }

    // Hide context menu after removing block
    setShowContextMenu(false);
    setContextMenuSelection('');
  };

  // Handle toggle block expand/collapse
  const handleToggleExpand = (id: string) => {
    setExpandedBlocks(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Hide context menu when clicking outside
  const handleClickOutside = useCallback(() => {
    setShowContextMenu(false);
    setContextMenuSelection('');
  }, []);

  useEffect(() => {
    if (showContextMenu) {
      const handleDocumentMouseDown = (e: MouseEvent) => {
        // Don't hide if clicking on the context menu itself
        const target = e.target as HTMLElement;
        if (target.closest('.fixed.z-50')) {
          return;
        }
        handleClickOutside();
      };

      document.addEventListener('mousedown', handleDocumentMouseDown);
      return () => {
        document.removeEventListener('mousedown', handleDocumentMouseDown);
      };
    }
  }, [showContextMenu, handleClickOutside]);

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

  const currentChapterTitle = chapters.find(c => currentChapter.includes(c.href) || c.href.includes(currentChapter))?.label || '';

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
          {/* Font settings */}
          <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
            {/* Font size controls */}
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

            {/* Divider */}
            <div className="w-px h-6 bg-slate-300 mx-1"></div>

            {/* Font family dropdown */}
            <select
              value={fontFamily}
              onChange={(e) => {
                setFontFamily(e.target.value);
                localStorage.setItem('reader-font-family', e.target.value);
              }}
              className="h-8 px-2 text-sm bg-white border border-slate-200 rounded text-slate-600 cursor-pointer hover:border-slate-300 focus:outline-none focus:border-indigo-400"
              title="字体"
            >
              {fontOptions.map((font) => (
                <option key={font.value} value={font.value}>
                  {font.label}
                </option>
              ))}
            </select>

            {/* Divider */}
            <div className="w-px h-6 bg-slate-300 mx-1"></div>

            {/* Line height controls */}
            <button
              onClick={() => {
                const newHeight = Math.max(1.2, lineHeight - 0.2);
                setLineHeight(newHeight);
                localStorage.setItem('reader-line-height', newHeight.toString());
              }}
              className="w-8 h-8 flex items-center justify-center rounded text-slate-600 hover:bg-white hover:shadow-sm transition-all"
              title="减小行距"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="text-sm text-slate-600 w-10 text-center">{lineHeight}</span>
            <button
              onClick={() => {
                const newHeight = Math.min(3.0, lineHeight + 0.2);
                setLineHeight(newHeight);
                localStorage.setItem('reader-line-height', newHeight.toString());
              }}
              className="w-8 h-8 flex items-center justify-center rounded text-slate-600 hover:bg-white hover:shadow-sm transition-all"
              title="增大行距"
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
          <div className="p-3 border-b border-slate-100" style={{ width: tocWidth }}>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <h2 className="font-semibold text-slate-800">目录</h2>
            </div>
            <ul className="space-y-1 mt-4">
              {chapters.map((chapter) => {
                const activeHref = selectedChapter || currentChapter;
                const isActive = activeHref.includes(chapter.href) || chapter.href.includes(activeHref);
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
        <main className="flex-1 bg-white overflow-y-auto relative">
          {/* Context menu for right-click */}
          {showContextMenu && (
            <div
              className="fixed z-50 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[140px]"
              style={{
                left: contextMenuPosition.x,
                top: contextMenuPosition.y,
              }}
            >
              <button
                onClick={handleCopyToClipboard}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>复制</span>
              </button>
              <button
                onClick={handleAddToAssistant}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>选中</span>
              </button>
              <button
                onClick={handleAddToAssistantNewChat}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-green-600 hover:bg-green-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>选中并创建新对话</span>
              </button>
              <button
                onClick={handleAddComment}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                <span>评论</span>
              </button>
            </div>
          )}

          {/* Current chapter indicator and navigation */}
          {(currentChapterTitle || selectedChapter) && (
            <div className="sticky top-0 bg-white/90 backdrop-blur-sm border-b border-slate-100 p-3 z-10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <p className="text-sm text-slate-600 truncate">
                  {currentChapterTitle || '加载中...'}
                  {currentChapter && (
                    <span className="text-xs text-slate-400 ml-1">
                      ({currentChapter.split('#')[0].split('/').pop()})
                    </span>
                  )}
                </p>
              </div>
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
              style={{ background: '#fff', color: '#4a4a4a' }}
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
          {/* Tab navigation */}
          <div className="border-b border-slate-100 flex">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                activeTab === 'chat'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              AI 助手
            </button>
            <button
              onClick={() => setActiveTab('comment')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                activeTab === 'comment'
                  ? 'text-amber-600 border-b-2 border-amber-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              评论 ({comments.length})
            </button>
          </div>

          {/* AI Chat Tab Content */}
          {activeTab === 'chat' && (
            <div className="p-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <h2 className="font-semibold text-slate-800">AI 助手</h2>
              </div>
              <button
                onClick={createNewSession}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
                title="新建对话"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          )}

          {/* Comment Tab Content */}
          {activeTab === 'comment' && (
            <div className="p-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                <h2 className="font-semibold text-slate-800">评论</h2>
              </div>
            </div>
          )}

          {/* Chat content - only show when on chat tab */}
          {activeTab === 'chat' && (
            <>
              {/* Session tabs */}
              {sessions.length > 0 && (
            <div className="border-b border-slate-100 overflow-x-auto">
              <div className="flex gap-1 px-2 py-2 min-w-max">
                {sessions.slice().sort((a, b) => a.timestamp - b.timestamp).map((session) => (
                  <div
                    key={session.id}
                    className={`flex items-center gap-1 pr-1 rounded-lg text-xs whitespace-nowrap transition-colors ${
                      currentSessionId === session.id
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <button
                      onClick={() => switchToSession(session.id)}
                      className="px-2 py-1.5 hover:opacity-70 transition-opacity"
                    >
                      {session.title}
                    </button>
                    <button
                      onClick={() => handleEditSession(session.id)}
                      className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
                      title="重命名"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => deleteSession(session.id, e)}
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

          {/* Selected text blocks - always show title, content is collapsible */}
          {selectedBlocks.length > 0 && (
            <div className="border-b border-slate-100 bg-slate-50">
              <button
                onClick={() => setIsSelectedBlocksExpanded(!isSelectedBlocksExpanded)}
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
                <div className="px-4 pb-4 space-y-2 overflow-y-auto">
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
                              onClick={() => handleToggleExpand(block.id)}
                              className="w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:text-indigo-500 hover:bg-indigo-50"
                              title={isExpanded ? '收起' : '展开'}
                            >
                              <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveBlock(block.id)}
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
              messages.map((msg, index) => (
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
                    {msg.role === 'assistant' ? (
                      (() => {
                        const content = msg.blocks.map(b => b.content).join('\n\n');
                        const isStreaming = aiLoading && index === messages.length - 1;

                        if (isStreaming && !content) {
                          // Show loading indicator inside the streaming message
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
                            components={{
                              p: ({ children }) => <p className="mb-2">{children}</p>,
                              ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
                              li: ({ children }) => <li className="mb-1">{children}</li>,
                              code: ({ className, children }) => {
                                const isInline = !className;
                                return isInline ? (
                                  <code className="bg-slate-200 px-1 py-0.5 rounded text-xs">{children}</code>
                                ) : (
                                  <code className={`${className} block bg-slate-800 text-slate-100 p-2 rounded-lg overflow-x-auto mb-2 text-xs`}>
                                    {children}
                                  </code>
                                );
                              },
                              pre: ({ children }) => <pre className="mb-2">{children}</pre>,
                              h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-base font-bold mb-1">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                              blockquote: ({ children }) => <blockquote className="border-l-2 border-slate-300 pl-2 italic mb-2">{children}</blockquote>,
                            }}
                          >
                            {content}
                          </ReactMarkdown>
                        );
                      })()
                    ) : (
                      // 如果是第一条用户消息，隐藏"选中文本："部分
                      (() => {
                        const isFirstUserMessage = index === 0 && msg.role === 'user';
                        const content = msg.blocks.map(b => b.content).join('\n\n');
                        if (isFirstUserMessage) {
                          // 移除"选中文本："开头的部分
                          return content.replace(/^选中文本：[\s\S]*?\n\n/, '');
                        }
                        return content;
                      })()
                    )}
                  </div>
                </div>
              ))
            )}
            {/* Loading indicator is now integrated into streaming message - no separate loading shown */}
          </div>

          {/* Input area */}
          <div className="p-4 border-t border-slate-100 bg-slate-50">
            <div className="flex gap-2 items-end relative">
              <textarea
                ref={(el) => {
                  if (el) {
                    el.style.height = 'auto';
                    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                  }
                }}
                value={input}
                onChange={(e) => {
                  const value = e.target.value;
                  setInput(value);
                  // 重置历史索引
                  setHistoryIndex(-1);

                  // 自动补全建议
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

                  // Auto-resize
                  setTimeout(() => {
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                  }, 0);
                }}
                onKeyDown={(e) => {
                  // Tab 自动补全
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

                  // 上下箭头切换历史
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

                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="输入问题..."
                className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow resize-none overflow-hidden"
                disabled={aiLoading}
                rows={1}
              />
              {/* 自动补全建议列表 */}
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
                onClick={handleSendMessage}
                disabled={aiLoading || !input.trim()}
                className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>

          {/* Edit Session Title Modal */}
          {showEditSession && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-xl p-6 w-80 max-w-[90vw]">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">重命名对话</h3>
                <input
                  type="text"
                  value={editingSessionTitle}
                  onChange={(e) => setEditingSessionTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveSessionTitle();
                    } else if (e.key === 'Escape') {
                      setShowEditSession(false);
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="输入新名称..."
                  autoFocus
                />
                <div className="flex gap-2 mt-4 justify-end">
                  <button
                    onClick={() => setShowEditSession(false)}
                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveSessionTitle}
                    className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          )}
          </>
        )}

        {/* Comment Tab Content */}
        {activeTab === 'comment' && (
          <div className="flex flex-col h-full">
            {/* Comment input area */}
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              {commentSelection ? (
                <div className="mb-3">
                  <p className="text-xs text-slate-500 mb-1">选中的文字:</p>
                  <p className="text-sm text-slate-700 bg-white p-2 rounded border border-slate-200 line-clamp-3">
                    {commentSelection}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-400 mb-3">请先选中一段文字，然后右键选择"评论"</p>
              )}
              <textarea
                value={currentCommentText}
                onChange={(e) => setCurrentCommentText(e.target.value)}
                placeholder="输入评论..."
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                rows={3}
                disabled={!commentSelection}
              />
              <button
                onClick={handleSaveComment}
                disabled={!currentCommentText.trim() || !commentSelection}
                className="mt-2 w-full px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                保存评论
              </button>
            </div>

            {/* Comments list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {comments.length === 0 ? (
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
                    className="bg-white border border-slate-200 rounded-lg p-3 hover:border-amber-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-xs text-slate-500 line-clamp-2 flex-1">
                        "{comment.selectedText}"
                      </p>
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50"
                        title="删除"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{comment.content}</p>
                    <p className="text-xs text-slate-400 mt-2">
                      {new Date(comment.timestamp).toLocaleString('zh-CN')}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        </aside>
      </div>
    </div>
  );
}
