'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import ePub, { Book, Rendition, NavItem } from 'epubjs';
import {
  Chapter,
  ChapterIndex,
  Block,
  Message,
  Session,
  Comment,
  ReaderHeader,
  TableOfContents,
  ChatPanel,
  CommentPanel,
  ContextMenu,
  EditSessionModal,
  SettingsModal,
  CompressModal,
  LoadingState,
  ErrorState,
  defaultToolbarSettings,
} from '@/components/reader';

export default function ReaderPage() {
  const params = useParams();
  const bookId = params.id as string;

  // Book and rendition state
  const [book, setBook] = useState<Book | null>(null);
  const [rendition, setRendition] = useState<Rendition | null>(null);

  // Chapter and navigation state
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState<string>('');
  const [chapterIndex, setChapterIndex] = useState<ChapterIndex>({ tree: [], htmlOrder: [] });

  // Loading and error state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Font settings state - initialize from localStorage directly
  const [fontSize, setFontSize] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('reader-font-size');
      return saved ? parseInt(saved, 10) : 18;
    }
    return 18;
  });
  const [fontFamily, setFontFamily] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('reader-font-family');
      return saved || 'Georgia, serif';
    }
    return 'Georgia, serif';
  });
  const [lineHeight, setLineHeight] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('reader-line-height');
      return saved ? parseFloat(saved) : 1.8;
    }
    return 1.8;
  });

  // Reading progress state
  const [savedCfi, setSavedCfi] = useState<string | null>(null);

  // UI state
  const [showToc, setShowToc] = useState(true);
  const [autoScrollOnStreaming, setAutoScrollOnStreaming] = useState(false);
  const [highlightEnabled, setHighlightEnabled] = useState(true);
  const [mermaidEnabled, setMermaidEnabled] = useState(true);
  const [isContentReady, setIsContentReady] = useState(false);
  const [bookTitle, setBookTitle] = useState<string>('');

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedBlocks, setSelectedBlocks] = useState<Block[]>([]);
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  const [isSelectedBlocksExpanded, setIsSelectedBlocksExpanded] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [inputHistory, setInputHistory] = useState<string[]>([]);

  // Session state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Edit session modal state
  const [showEditSession, setShowEditSession] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionTitle, setEditingSessionTitle] = useState('');

  // Settings modal state
  const [showSettings, setShowSettings] = useState(false);
  const [toolbarSettings, setToolbarSettings] = useState(defaultToolbarSettings);

  // Compress modal state
  const [showCompress, setShowCompress] = useState(false);
  const [compressContent, setCompressContent] = useState('');
  const [compressMessageId, setCompressMessageId] = useState('');

  // Context menu state
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuSelection, setContextMenuSelection] = useState('');
  const [contextMenuCfiRange, setContextMenuCfiRange] = useState('');

  // Tab state
  const [activeTab, setActiveTab] = useState<'chat' | 'comment'>('chat');

  // Comment state
  const [comments, setComments] = useState<Comment[]>([]);
  const [currentCommentText, setCurrentCommentText] = useState('');
  const [commentSelection, setCommentSelection] = useState('');
  const [commentCfiRange, setCommentCfiRange] = useState('');

  // Comment annotation refs
  const commentRefs = useRef<Map<string, string>>(new Map());

  // Highlight refs
  const highlightRefs = useRef<Map<string, string>>(new Map());

  // Panel layout state (loaded from localStorage)
  const [tocLayout, setTocLayout] = useState<{ [key: string]: number } | null>(null);
  const [rightLayout, setRightLayout] = useState<{ [key: string]: number } | null>(null);
  const [chatInputLayout, setChatInputLayout] = useState<{ [key: string]: number } | null>(null);

  // Refs
  const viewerRef = useRef<HTMLDivElement>(null);
  const selectionHandlerAdded = useRef(false);
  const saveProgressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savedCfiRef = useRef<string | null>(null);
  const isInitialLocationRef = useRef(true); // Track if this is the initial location (don't save)

  // ==================== Initialization ====================

  // Load other settings from localStorage (these don't need immediate value)
  useEffect(() => {
    const savedAutoScroll = localStorage.getItem('ai-chat-auto-scroll');
    if (savedAutoScroll === 'true') setAutoScrollOnStreaming(true);

    const savedHighlightEnabled = localStorage.getItem('reader-highlight-enabled');
    if (savedHighlightEnabled !== null) {
      setHighlightEnabled(savedHighlightEnabled !== 'false');
    } else {
      // Default to true if not set
      setHighlightEnabled(true);
    }

    const savedMermaidEnabled = localStorage.getItem('reader-mermaid-enabled');
    if (savedMermaidEnabled !== null) {
      setMermaidEnabled(savedMermaidEnabled !== 'false');
    } else {
      // Default to true if not set
      setMermaidEnabled(true);
    }

    const savedHistory = localStorage.getItem('ai-chat-input-history');
    if (savedHistory) {
      try {
        setInputHistory(JSON.parse(savedHistory));
      } catch (e) { /* ignore */ }
    }

    // Load panel layout from localStorage
    const savedLayout = localStorage.getItem('reader-layout');
    if (savedLayout) {
      try {
        const layout = JSON.parse(savedLayout);
        if (layout.toc) setTocLayout(layout.toc);
        if (layout.right) setRightLayout(layout.right);
        if (layout.chatInput) setChatInputLayout(layout.chatInput);
      } catch (e) { /* ignore */ }
    }

    // Load toolbar settings from localStorage
    const savedToolbarSettings = localStorage.getItem('reader-toolbar-settings');
    if (savedToolbarSettings) {
      try {
        setToolbarSettings({ ...defaultToolbarSettings, ...JSON.parse(savedToolbarSettings) });
      } catch (e) { /* ignore */ }
    }
  }, []);

  // Save font settings
  useEffect(() => {
    localStorage.setItem('reader-font-size', fontSize.toString());
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem('reader-line-height', lineHeight.toString());
  }, [lineHeight]);

  // ==================== Book Loading ====================

  useEffect(() => {
    let bookInstance: Book | null = null;

    const initBook = async () => {
      try {
        setLoading(true);
        setError('');

        const res = await fetch(`/api/book/${bookId}`);
        if (!res.ok) throw new Error('Failed to load book');

        const data = await res.json();
        if (data.title) setBookTitle(data.title);

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

        // Build chapter index
        const tree = await buildChapterIndex(bookInstance, toc);

        // Load saved progress
        await loadSavedProgress(chapterList, tree);

        setIsContentReady(true);
      } catch (err) {
        console.error('Error loading book:', err);
        setError('加载书籍失败');
      } finally {
        setLoading(false);
      }
    };

    if (bookId) initBook();

    return () => {
      if (bookInstance) bookInstance.destroy();
    };
  }, [bookId]);

  // Build chapter index
  const buildChapterIndex = async (bookInstance: Book, toc: NavItem[]) => {
    try {
      const indexRes = await fetch(`/api/index?bookId=${bookId}`);
      let loadedIndex: ChapterIndex = { tree: [], htmlOrder: [] };
      if (indexRes.ok) loadedIndex = await indexRes.json();

      let tree: any[] = [];
      if (!loadedIndex.tree || loadedIndex.tree.length === 0) {
        const spine = bookInstance.spine as any;
        const spineItems = spine ? Array.from(spine.items || spine) : [];
        const htmlOrder = spineItems
          .filter((item: any) => item.href)
          .map((item: any) => item.href);

        const buildTree = (navItems: any[]): any[] => {
          return navItems.map((nav, i) => {
            const href = nav.href || '';
            const firstHtml = href.split('#')[0];
            const contents: string[] = [];
            const currentIndex = htmlOrder.findIndex(h => h.includes(firstHtml.split('/').pop() || ''));

            if (currentIndex !== -1) {
              for (let j = currentIndex; j < htmlOrder.length; j++) {
                const nextChapterHref = navItems[i + 1]?.href || '';
                const nextChapterFirstHtml = nextChapterHref.split('#')[0];
                const nextChapterIndex = htmlOrder.findIndex(h => h.includes(nextChapterFirstHtml.split('/').pop() || ''));
                if (nextChapterIndex !== -1 && j >= nextChapterIndex) break;
                contents.push(htmlOrder[j]);
              }
            }

            const childItems = nav.subitems || nav.children || [];
            return {
              chapter_id: nav.id || `chapter_${i}`,
              chapter_name: (nav.label || '').trim(),
              href: nav.href || '',
              contents,
              children: childItems.length > 0 ? buildTree(childItems) : [],
            };
          });
        };

        tree = buildTree(toc);

        await fetch('/api/index', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookId, tree, htmlOrder }),
        });

        setChapterIndex({ tree, htmlOrder });
      } else {
        tree = loadedIndex.tree;
        setChapterIndex(loadedIndex);
      }
      return tree;
    } catch (err) {
      console.error('Failed to build chapter index:', err);
      return [];
    }
  };

  // Load saved reading progress
  const loadSavedProgress = async (chapterList: Chapter[], tree: any[] = []) => {
    try {
      console.log('[Reader] Loading progress for bookId:', bookId);
      const progressRes = await fetch(`/api/progress?bookId=${bookId}`);
      if (progressRes.ok) {
        const progressData = await progressRes.json();
        console.log('[Reader] Progress data:', progressData);

        // Always try to set CFI if available, regardless of chapter existence
        if (progressData.cfi) {
          console.log('[Reader] Setting savedCfi:', progressData.cfi);
          savedCfiRef.current = progressData.cfi;
          setSavedCfi(progressData.cfi);
        }

        if (progressData.htmlFile) {
          const savedChapterExists = chapterList.some(
            (c: Chapter) => c.href.includes(progressData.htmlFile) || progressData.htmlFile.includes(c.href.split('#')[0].split('/').pop() || '')
          );
          console.log('[Reader] Saved chapter exists:', savedChapterExists, 'htmlFile:', progressData.htmlFile);
          console.log('[Reader] Chapter list sample:', chapterList.slice(0, 3).map(c => c.href));
          if (savedChapterExists) {
            const htmlFileName = progressData.htmlFile.split('/').pop() || progressData.htmlFile;
            const findInTree = (nodes: any[]): any => {
              for (const node of nodes) {
                if (node.contents.some((c: string) => c.includes(htmlFileName) || htmlFileName.includes(c))) return node;
                if (node.children && node.children.length > 0) {
                  const found = findInTree(node.children);
                  if (found) return found;
                }
              }
              return null;
            };
            const searchTree = tree.length > 0 ? tree : chapterIndex.tree;
            const indexInfo = findInTree(searchTree);
            console.log('[Reader] Index info:', indexInfo);
            if (indexInfo) {
              // 使用保存的 htmlFile，而不是第一个
              setCurrentChapter(progressData.htmlFile);
              console.log('[Reader] Set currentChapter to:', progressData.htmlFile);
            } else {
              const matched = chapterList.find((c: Chapter) => c.href.split('#')[0].split('/').pop() === htmlFileName);
              if (matched) {
                setCurrentChapter(matched.href);
                console.log('[Reader] Set currentChapter to (fallback):', matched.href);
              }
            }
          } else if (chapterList.length > 0) {
            // Chapter not found in TOC, but we have CFI - try to use first chapter anyway
            // The CFI will be used to restore position within that chapter
            console.log('[Reader] Chapter not in TOC, will try to use first chapter with CFI');
            setCurrentChapter(chapterList[0].href);
            console.log('[Reader] Set currentChapter to first chapter:', chapterList[0].href);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load reading progress:', err);
    }
  };

  // ==================== Rendition ====================

  // Create rendition instance
  const createRenditionInstance = useCallback(() => {
    if (!viewerRef.current || !book) return null;
    return book.renderTo(viewerRef.current, {
      width: '100%',
      height: '100%',
      spread: 'none',
      flow: 'scrolled' as any,
    });
  }, [book]);

  // Setup rendition
  const setupRendition = useCallback(async (renditionInstance: Rendition, initialChapter?: string) => {
    renditionInstance.themes.fontSize(`${fontSize}px`);
    renditionInstance.themes.font(fontFamily);
    renditionInstance.themes.override("color", '#3a3a3a', true);
    renditionInstance.themes.override("line-height", lineHeight.toString(), true);

    // Location change handler
    renditionInstance.on('relocated', (location: { start: { href: string; cfi: string } }) => {
      const href = location.start.href;
      setCurrentChapter(href);
      const cfi = location.start.cfi;

      // Skip saving on initial location to avoid duplicate API calls
      if (isInitialLocationRef.current) {
        isInitialLocationRef.current = false;
        return;
      }

      if (saveProgressTimeoutRef.current) clearTimeout(saveProgressTimeoutRef.current);
      saveProgressTimeoutRef.current = setTimeout(() => {
        const htmlFile = href.split('#')[0];
        saveProgress(htmlFile, cfi);
      }, 2000);
    });

    // Bind iframe events
    if (!selectionHandlerAdded.current) {
      selectionHandlerAdded.current = true;
      renditionInstance.on('rendered', () => {
        const tryBind = (attempts: number) => {
          if (attempts <= 0) return;
          const container = viewerRef.current;
          const iframe = container?.querySelector('iframe');

          if (iframe && iframe.contentWindow) {
            const win = iframe.contentWindow;

            // Context menu
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

            // Selected event for CFI
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

    // Display initial chapter
    if (initialChapter) {
      const cfiToRestore = savedCfiRef.current;
      if (cfiToRestore) {
        console.log('[Reader] Attempting to restore CFI:', cfiToRestore);
        try {
          await renditionInstance.display(cfiToRestore);
          console.log('[Reader] Successfully restored CFI');
          savedCfiRef.current = null;
          setSavedCfi(null);
        } catch (cfiError) {
          console.warn('[Reader] Failed to restore CFI, falling back to chapter:', cfiError);
          await renditionInstance.display(initialChapter);
        }
      } else {
        await renditionInstance.display(initialChapter);
      }
    }
  }, [fontSize, fontFamily, lineHeight, bookId]);

  // Auto-display saved chapter when book is loaded
  useEffect(() => {
    if (isContentReady && book && currentChapter && !rendition && viewerRef.current) {
      const timer = setTimeout(async () => {
        const renditionInstance = createRenditionInstance();
        if (!renditionInstance) return;
        setupRendition(renditionInstance, currentChapter);
        setRendition(renditionInstance);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isContentReady, book, currentChapter, rendition, createRenditionInstance, setupRendition]);

  // Update font settings when changed
  useEffect(() => {
    if (rendition) {
      rendition.themes.fontSize(`${fontSize}px`);
      rendition.themes.font(fontFamily);
      rendition.themes.override("color", '#3a3a3a', true);
      rendition.themes.override("line-height", lineHeight.toString(), true);
    }
  }, [fontSize, fontFamily, lineHeight, rendition]);

  // Restore saved position when savedCfi is available and rendition is ready
  useEffect(() => {
    if (rendition && savedCfi) {
      console.log('[Reader] useEffect: Attempting to restore CFI:', savedCfi);
      rendition.display(savedCfi).then(() => {
        console.log('[Reader] useEffect: Successfully restored CFI');
        setSavedCfi(null);
      }).catch((err) => {
        console.warn('[Reader] useEffect: Failed to restore CFI:', err);
      });
    }
  }, [rendition, savedCfi]);

  // ==================== Save Progress ====================

  const saveProgress = useCallback((chapter: string, cfi?: string) => {
    if (!bookId || !chapter) return;
    const htmlFile = chapter.split('#')[0].split('/').pop() || chapter;
    fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId, chapter: htmlFile, cfi: cfi || '' }),
    }).catch(err => console.error('Failed to save progress:', err));
  }, [bookId]);

  // ==================== Chapter Navigation ====================

  const handleChapterClick = useCallback(async (href: string) => {
    if (!rendition && book && viewerRef.current) {
      await new Promise(resolve => setTimeout(resolve, 50));
      if (viewerRef.current) {
        const renditionInstance = createRenditionInstance();
        if (!renditionInstance) return;
        setupRendition(renditionInstance, href);
        setRendition(renditionInstance);
      }
    } else if (rendition) {
      await rendition.display(href);
    }

    setCurrentChapter(href);
    saveProgress(href);
  }, [rendition, book, createRenditionInstance, setupRendition, saveProgress]);

  // Get current page number
  const getCurrentPageNumber = () => {
    if (!currentChapter || !chapterIndex.htmlOrder || chapterIndex.htmlOrder.length === 0) return 0;
    const currentHtml = currentChapter.split('#')[0];
    const index = chapterIndex.htmlOrder.findIndex(h => h.includes(currentHtml.split('/').pop() || ''));
    return index >= 0 ? index + 1 : 0;
  };

  const currentPage = getCurrentPageNumber();
  const totalPages = chapterIndex.htmlOrder?.length || 0;

  // Navigate prev/next page
  const handlePrevPage = useCallback(async () => {
    if (currentPage > 1 && rendition) {
      const newIndex = currentPage - 2;
      const newHref = chapterIndex.htmlOrder[newIndex];
      setCurrentChapter(newHref);
      saveProgress(newHref);
      await rendition.display(newHref);
    }
  }, [currentPage, chapterIndex.htmlOrder, rendition, saveProgress]);

  const handleNextPage = useCallback(async () => {
    if (currentPage < totalPages && rendition) {
      const newHref = chapterIndex.htmlOrder[currentPage];
      setCurrentChapter(newHref);
      saveProgress(newHref);
      await rendition.display(newHref);
    }
  }, [currentPage, totalPages, chapterIndex.htmlOrder, rendition, saveProgress]);

  // ==================== Chat ====================

  const handleSendMessage = async (input: string, isFirstMessage: boolean) => {
    if (!input.trim() || aiLoading || !currentSessionId) return;

    // Save to history
    if (input.trim()) {
      const newHistory = [input, ...inputHistory.filter(h => h !== input)].slice(0, 50);
      setInputHistory(newHistory);
      localStorage.setItem('ai-chat-input-history', JSON.stringify(newHistory));
    }

    // Prepare message - include selected text if first message
    let message = input;
    let selectedTextForApi = '';
    if (isFirstMessage && selectedBlocks.length > 0) {
      selectedTextForApi = selectedBlocks.map(b => b.content).join('\n\n');
    }

    // Optimistically add user message to UI
    const tempUserMessageId = `temp-${Date.now()}`;
    const tempAssistantMessageId = `temp-${Date.now() + 1}`;
    const userMessage: Message = {
      id: tempUserMessageId,
      role: 'user',
      content: selectedTextForApi ? `选中文本：\n${selectedTextForApi}\n\n用户输入：${input}` : input,
      timestamp: Date.now(),
    };
    const assistantMessage: Message = {
      id: tempAssistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setAiLoading(true);

    try {
      // Send to server - server will save message and return streaming response
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId,
          message: input,
          selectedText: selectedTextForApi || undefined,
        }),
      });

      if (!response.body) throw new Error('No response body');

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
                setMessages(prev => prev.map(msg =>
                  msg.id === tempAssistantMessageId
                    ? { ...msg, content: accumulatedContent }
                    : msg
                ));
              }
            } catch (e) { /* ignore */ }
          }
        }
      }

      // Reload session from server to get updated messages (with IDs from DB)
      await reloadCurrentSession();
    } catch (err) {
      console.error('Error calling LLM:', err);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `抱歉，调用 AI 服务失败：${err}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setAiLoading(false);
    }
  };

  // Reload current session from server
  const reloadCurrentSession = useCallback(async () => {
    if (!currentSessionId || !bookId || !currentChapter) return;
    try {
      const htmlFile = currentChapter.split('#')[0];
      const encodedHtmlFile = encodeURIComponent(htmlFile);
      const res = await fetch(`/api/chat/${bookId}/${encodedHtmlFile}?sessionId=${currentSessionId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.sessions?.length > 0) {
          const session = data.sessions.find((s: any) => String(s.id) === String(currentSessionId));
          if (session) {
            setMessages(session.messages || []);
            setSessions(prev => prev.map(s =>
              String(s.id) === String(currentSessionId) ? { ...s, messages: session.messages || [] } : s
            ));
          }
        }
      }
    } catch (err) {
      console.error('Failed to reload session:', err);
    }
  }, [currentSessionId, bookId, currentChapter]);

  // ==================== Session Management ====================

  const createNewSession = useCallback(async () => {
    if (!bookId || !currentChapter) return;
    clearHighlights();

    try {
      const htmlFile = currentChapter.split('#')[0];
      const encodedHtmlFile = encodeURIComponent(htmlFile);
      const res = await fetch(`/api/chat/${bookId}/${encodedHtmlFile}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          title: `对话 ${sessions.length + 1}`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.session) {
          const newSession: Session = {
            id: String(data.session.id),
            title: data.session.title,
            selectedBlocks: data.session.selectedBlocks || [],
            messages: data.session.messages || [],
            timestamp: data.session.timestamp,
            created_at: data.session.created_at,
          };
          setSessions(prev => [...prev, newSession]);
          setCurrentSessionId(String(data.session.id));
          setMessages([]);
          setSelectedBlocks([]);
        }
      }
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  }, [bookId, currentChapter, sessions.length]);

  const switchToSession = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
      setMessages(session.messages || []);
      setSelectedBlocks(session.selectedBlocks || []);
      refreshHighlights(session.selectedBlocks || []);
    }
  }, [sessions]);

  const deleteSession = useCallback(async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(newSessions);

    if (currentChapter && bookId) {
      const htmlFile = currentChapter.split('#')[0];
      const encodedHtmlFile = encodeURIComponent(htmlFile);
      try {
        await fetch(`/api/chat/${bookId}/${encodedHtmlFile}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
      } catch (err) { /* ignore */ }
    }

    if (currentSessionId === sessionId) {
      if (newSessions.length > 0) {
        switchToSession(newSessions[newSessions.length - 1].id);
      } else {
        setCurrentSessionId(null);
        setMessages([]);
        setSelectedBlocks([]);
        clearHighlights();
      }
    }
  }, [sessions, currentSessionId, currentChapter, bookId, switchToSession]);

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

    setSessions(prev => prev.map(s =>
      s.id === editingSessionId ? { ...s, title: editingSessionTitle.trim() } : s
    ));

    const session = sessions.find(s => s.id === editingSessionId);
    if (session && currentChapter && bookId) {
      const htmlFile = currentChapter.split('#')[0];
      const encodedHtmlFile = encodeURIComponent(htmlFile);
      try {
        const res = await fetch(`/api/chat/${bookId}/${encodedHtmlFile}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: editingSessionId,
            selectedBlocks: session.selectedBlocks,
            messages: session.messages,
            title: editingSessionTitle.trim(),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          // If backend returns a different sessionId, update local state
          if (data.sessionId && String(data.sessionId) !== editingSessionId) {
            const newId = String(data.sessionId);
            setSessions(prev => prev.map(s =>
              s.id === editingSessionId ? { ...s, id: newId } : s
            ));
            if (currentSessionId === editingSessionId) {
              setCurrentSessionId(newId);
            }
          }
        }
      } catch (err) { /* ignore */ }
    }

    setShowEditSession(false);
    setEditingSessionId(null);
    setEditingSessionTitle('');
  }, [editingSessionId, editingSessionTitle, sessions, currentChapter, bookId]);

  // ==================== Highlights ====================

  const clearHighlights = useCallback(() => {
    if (!rendition) return;
    highlightRefs.current.forEach((cfiRange) => {
      try { rendition.annotations.remove(cfiRange, 'highlight'); } catch (e) { /* ignore */ }
    });
    highlightRefs.current.clear();
  }, [rendition]);

  const highlightBlock = useCallback((block: Block) => {
    if (!rendition || !block.cfiRange || !highlightEnabled) return;
    if (highlightRefs.current.has(block.id)) {
      try { rendition.annotations.remove(block.cfiRange, 'highlight'); } catch (e) { /* ignore */ }
    }
    try {
      rendition.annotations.highlight(block.cfiRange, {}, () => {});
      highlightRefs.current.set(block.id, block.cfiRange);
    } catch (e) { /* ignore */ }
  }, [rendition, highlightEnabled]);

  const refreshHighlights = useCallback((blocks: Block[]) => {
    // 先清空旧的高亮，再应用新的
    clearHighlights();

    if (!highlightEnabled) {
      return;
    }
    blocks.forEach(block => highlightBlock(block));
  }, [clearHighlights, highlightBlock, highlightEnabled]);

  // Handle highlight enabled toggle (when switching sessions or when highlightEnabled changes)
  useEffect(() => {
    if (!rendition) return;

    if (highlightEnabled) {
      refreshHighlights(selectedBlocks);
    } else {
      clearHighlights();
    }
  }, [highlightEnabled, selectedBlocks, rendition, refreshHighlights, clearHighlights]);

  // ==================== Blocks ====================

  const handleRemoveBlock = useCallback(async (id: string) => {
    const removedBlock = selectedBlocks.find(b => b.id === id);
    if (removedBlock?.cfiRange && rendition) {
      try {
        rendition.annotations.remove(removedBlock.cfiRange, 'highlight');
        highlightRefs.current.delete(id);
      } catch (e) { /* ignore */ }
    }

    const newSelectedBlocks = selectedBlocks.filter(b => b.id !== id);
    setSelectedBlocks(newSelectedBlocks);
    setExpandedBlocks(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    if (currentSessionId) {
      setSessions(prev => prev.map(s =>
        s.id === currentSessionId ? { ...s, selectedBlocks: newSelectedBlocks, timestamp: Date.now() } : s
      ));
    }
  }, [selectedBlocks, rendition, currentSessionId, messages]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    // Call API to delete message from database
    if (bookId && currentSessionId && currentChapter) {
      try {
        const htmlFile = currentChapter.split('#')[0];
        const encodedHtmlFile = encodeURIComponent(htmlFile);
        await fetch(`/api/chat/${bookId}/${encodedHtmlFile}?sessionId=${currentSessionId}&messageId=${messageId}`, {
          method: 'DELETE',
        });
      } catch (err) {
        console.error('Failed to delete message from server:', err);
      }
    }

    // Update local state
    const newMessages = messages.filter(msg => msg.id !== messageId);
    setMessages(newMessages);

    if (currentSessionId) {
      setSessions(prev => prev.map(s =>
        s.id === currentSessionId ? { ...s, messages: newMessages, timestamp: Date.now() } : s
      ));
    }
  }, [messages, currentSessionId, selectedBlocks, bookId, currentChapter]);

  const handleCompressSubmit = useCallback(async (messageId: string, content: string) => {
    // Update the message content
    const newMessages = messages.map(msg => {
      if (msg.id === messageId) {
        return {
          ...msg,
          content
        };
      }
      return msg;
    });
    setMessages(newMessages);

    if (currentSessionId) {
      setSessions(prev => prev.map(s =>
        s.id === currentSessionId ? { ...s, messages: newMessages, timestamp: Date.now() } : s
      ));
    }
  }, [messages, currentSessionId, selectedBlocks]);

  const handleToggleExpandBlock = useCallback((id: string) => {
    setExpandedBlocks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ==================== Chat and Comments ====================

  const loadChatForChapter = useCallback(async (href: string) => {
    if (!href || !bookId) return;
    try {
      const htmlFile = href.split('#')[0];
      const encodedHtmlFile = encodeURIComponent(htmlFile);
      const res = await fetch(`/api/chat/${bookId}/${encodedHtmlFile}`);
      if (res.ok) {
        const data = await res.json();
        if (data.sessions?.length > 0) {
          const loadedSessions = data.sessions.map((s: any) => ({
            id: s.id,
            title: s.title || `对话 ${data.sessions.indexOf(s) + 1}`,
            selectedBlocks: s.selectedBlocks || [],
            messages: s.messages || [],
            timestamp: s.timestamp,
            created_at: s.created_at || s.timestamp || Date.now(),
          }));
          setSessions(loadedSessions);
          const mostRecent = loadedSessions.sort((a: any, b: any) => b.created_at - a.created_at)[0];
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
    }
  }, [bookId]);

  const loadCommentsForChapter = useCallback(async (href: string) => {
    try {
      const htmlFile = href.split('#')[0];
      const encodedHtmlFile = encodeURIComponent(htmlFile);
      const res = await fetch(`/api/comment/${bookId}/${encodedHtmlFile}`);
      const data = await res.json();

      const currentChapterFile = htmlFile.split('/').pop() || htmlFile;
      const filteredComments = (data.comments || []).filter((comment: any) => {
        const commentChapter = comment.chapter || '';
        const commentChapterFile = commentChapter.split('/').pop() || commentChapter;
        return commentChapterFile === currentChapterFile ||
               currentChapterFile.replace(/\.[^/.]+$/, '') === commentChapterFile.replace(/\.[^/.]+$/, '');
      });

      setComments(filteredComments.length > 0 ? filteredComments : []);
    } catch (err) {
      console.error('Failed to load comments:', err);
      setComments([]);
    }
  }, [bookId]);

  // Load chat/comments when chapter changes
  useEffect(() => {
    if (currentChapter && isContentReady) {
      loadChatForChapter(currentChapter);
      loadCommentsForChapter(currentChapter);
    }
  }, [currentChapter, isContentReady, loadChatForChapter, loadCommentsForChapter]);

  // Render comments as underlines
  useEffect(() => {
    if (!rendition || comments.length === 0) return;
    comments.forEach(comment => {
      if (comment.cfiRange && !commentRefs.current.has(comment.id)) {
        try {
          rendition.annotations.underline(comment.cfiRange);
          commentRefs.current.set(comment.id, comment.cfiRange);
        } catch (e) { /* ignore */ }
      }
    });
  }, [rendition, comments]);

  // ==================== Context Menu ====================

  const handleCopyToClipboard = async () => {
    if (contextMenuSelection) {
      try {
        await navigator.clipboard.writeText(contextMenuSelection);
        setShowContextMenu(false);
      } catch (err) { /* ignore */ }
    }
  };

  const handleAddToAssistant = async () => {
    if (!contextMenuSelection || !rendition) return;
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

    // If no current session, create one via API
    if (!currentSessionId && currentChapter && bookId) {
      const htmlFile = currentChapter.split('#')[0];
      const encodedHtmlFile = encodeURIComponent(htmlFile);
      try {
        const res = await fetch(`/api/chat/${bookId}/${encodedHtmlFile}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            title: `对话 ${sessions.length + 1}`,
            selectedBlocks: newSelectedBlocks,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.session) {
            const newSession: Session = {
              id: String(data.session.id),
              title: data.session.title,
              selectedBlocks: newSelectedBlocks,
              messages: [],
              timestamp: data.session.timestamp,
              created_at: data.session.created_at,
            };
            setSessions(prev => [...prev, newSession]);
            setCurrentSessionId(String(data.session.id));
          }
        }
      } catch (err) {
        console.error('Failed to create session:', err);
      }
    } else if (currentChapter && bookId) {
      // Save to existing session
      const htmlFile = currentChapter.split('#')[0];
      const encodedHtmlFile = encodeURIComponent(htmlFile);
      try {
        await fetch(`/api/chat/${bookId}/${encodedHtmlFile}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: currentSessionId,
            selectedBlocks: newSelectedBlocks,
            messages,
          }),
        });
      } catch (err) { /* ignore */ }
    }
  };

  const handleAddToAssistantNewChat = async () => {
    if (!contextMenuSelection || !rendition || !bookId || !currentChapter) return;
    const blockId = Date.now().toString();
    const newBlock: Block = {
      id: blockId,
      content: contextMenuSelection,
      timestamp: Date.now(),
      cfiRange: contextMenuCfiRange,
    };

    const newSelectedBlocks = [newBlock];

    // Call API to create new session
    const htmlFile = currentChapter.split('#')[0];
    const encodedHtmlFile = encodeURIComponent(htmlFile);
    try {
      const res = await fetch(`/api/chat/${bookId}/${encodedHtmlFile}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          title: `对话 ${sessions.length + 1}`,
          selectedBlocks: newSelectedBlocks,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.session) {
          const newSession: Session = {
            id: String(data.session.id),
            title: data.session.title,
            selectedBlocks: newSelectedBlocks,
            messages: [],
            timestamp: data.session.timestamp,
            created_at: data.session.created_at,
          };
          setSessions(prev => [...prev, newSession]);
          setCurrentSessionId(String(data.session.id));
          setMessages([]);
          setSelectedBlocks(newSelectedBlocks);
          refreshHighlights(newSelectedBlocks);
        }
      }
    } catch (err) {
      console.error('Failed to create session:', err);
    }

    setShowContextMenu(false);
  };

  const handleAddComment = () => {
    if (contextMenuSelection) {
      setCommentSelection(contextMenuSelection);
      setCommentCfiRange(contextMenuCfiRange);
      setCurrentCommentText('');
      setActiveTab('comment');
      setShowContextMenu(false);
    }
  };

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

    if (rendition && commentCfiRange) {
      try {
        rendition.annotations.underline(commentCfiRange);
        commentRefs.current.set(newComment.id, commentCfiRange);
      } catch (e) { /* ignore */ }
    }

    setCurrentCommentText('');
    setCommentSelection('');
    setCommentCfiRange('');

    if (currentChapter && bookId) {
      const htmlFile = currentChapter.split('#')[0];
      const encodedHtmlFile = encodeURIComponent(htmlFile);
      try {
        await fetch(`/api/comment/${bookId}/${encodedHtmlFile}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comments: updatedComments }),
        });
      } catch (err) { /* ignore */ }
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;

    if (rendition && commentRefs.current.has(commentId)) {
      try {
        rendition.annotations.remove(commentRefs.current.get(commentId)!, 'underline');
        commentRefs.current.delete(commentId);
      } catch (e) { /* ignore */ }
    }

    const updatedComments = comments.filter(c => c.id !== commentId);
    setComments(updatedComments);

    if (currentChapter && bookId) {
      const htmlFile = currentChapter.split('#')[0];
      const encodedHtmlFile = encodeURIComponent(htmlFile);
      try {
        await fetch(`/api/comment/${bookId}/${encodedHtmlFile}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comments: updatedComments }),
        });
      } catch (err) { /* ignore */ }
    }
  };

  // Hide context menu on click outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowContextMenu(false);
      setContextMenuSelection('');
    };

    if (showContextMenu) {
      const handleDocumentMouseDown = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('.fixed.z-50')) return;
        handleClickOutside();
      };
      document.addEventListener('mousedown', handleDocumentMouseDown);
      return () => document.removeEventListener('mousedown', handleDocumentMouseDown);
    }
  }, [showContextMenu]);

  // ==================== Helper Functions ====================

  const findChapterInTree = (tree: any[], htmlFile: string): any => {
    for (const node of tree) {
      if (node.contents.some((c: string) => c.includes(htmlFile) || htmlFile.includes(c))) return node;
      if (node.children.length > 0) {
        const found = findChapterInTree(node.children, htmlFile);
        if (found) return found;
      }
    }
    return null;
  };

  const getChapterInfo = (href: string) => {
    const htmlFileName = href.split('#')[0].split('/').pop() || '';
    const found = findChapterInTree(chapterIndex.tree, htmlFileName);
    if (found) return { chapterTitle: found.chapter_name, chapterHref: found.contents[0] || href };
    const matched = chapters.find(c => c.href.includes(htmlFileName) || htmlFileName.includes(c.href.split('#')[0].split('/').pop() || ''));
    if (matched) return { chapterTitle: matched.label, chapterHref: matched.href };
    return null;
  };

  const currentChapterInfo = getChapterInfo(currentChapter);
  const currentChapterTitle = currentChapterInfo?.chapterTitle || '';

  // ==================== Render ====================

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      <ReaderHeader
        bookTitle={bookTitle}
        fontSize={fontSize}
        fontFamily={fontFamily}
        lineHeight={lineHeight}
        showToc={showToc}
        autoScrollOnStreaming={autoScrollOnStreaming}
        highlightEnabled={highlightEnabled}
        mermaidEnabled={mermaidEnabled}
        onFontSizeChange={(size) => setFontSize(Math.min(32, Math.max(14, size)))}
        onFontFamilyChange={setFontFamily}
        onLineHeightChange={setLineHeight}
        onToggleToc={() => setShowToc(!showToc)}
        onToggleAutoScroll={() => {
          const newValue = !autoScrollOnStreaming;
          setAutoScrollOnStreaming(newValue);
          localStorage.setItem('ai-chat-auto-scroll', String(newValue));
        }}
        onToggleHighlight={() => {
          const newValue = !highlightEnabled;
          setHighlightEnabled(newValue);
          localStorage.setItem('reader-highlight-enabled', String(newValue));
        }}
        onToggleMermaid={() => {
          const newValue = !mermaidEnabled;
          setMermaidEnabled(newValue);
          localStorage.setItem('reader-mermaid-enabled', String(newValue));
        }}
        onOpenSettings={() => setShowSettings(true)}
        toolbarSettings={toolbarSettings}
      />

      <PanelGroup
        className="flex-1 flex overflow-hidden"
        defaultLayout={tocLayout || undefined}
        onLayoutChanged={(sizes) => {
          localStorage.setItem('reader-layout', JSON.stringify({
            ...JSON.parse(localStorage.getItem('reader-layout') || '{}'),
            toc: sizes
          }));
        }}
      >
        {/* TOC Sidebar */}
        {showToc && (
          <>
            <Panel
              id="toc"
              defaultSize={400}
              minSize={50}
              maxSize={800}
              className="bg-white border-r border-slate-200 overflow-y-auto"
            >
              <TableOfContents
                chapters={chapters}
                tree={chapterIndex.tree}
                currentChapter={currentChapter}
                onChapterClick={handleChapterClick}
              />
            </Panel>
            <PanelResizeHandle className="w-1 bg-slate-200 hover:bg-indigo-400 transition-colors" />
          </>
        )}

        {/* Content Area with Right Sidebar */}
        <Panel id="content" minSize={30} className="flex flex-col bg-white overflow-hidden">
          <PanelGroup
            orientation="horizontal"
            className="flex flex-1 overflow-hidden"
            defaultLayout={rightLayout || undefined}
            onLayoutChanged={(sizes) => {
              localStorage.setItem('reader-layout', JSON.stringify({
                ...JSON.parse(localStorage.getItem('reader-layout') || '{}'),
                right: sizes
              }));
            }}
          >
            {/* Main Content */}
            <Panel id="reader" minSize={30} className="flex flex-col bg-white overflow-hidden relative">
              <ContextMenu
                visible={showContextMenu}
                position={contextMenuPosition}
                selection={contextMenuSelection}
                onCopy={handleCopyToClipboard}
                onAddToAssistant={handleAddToAssistant}
                onAddToAssistantNewChat={handleAddToAssistantNewChat}
                onAddComment={handleAddComment}
                onClose={() => setShowContextMenu(false)}
              />

              {/* Chapter navigation */}
              {(currentChapterTitle || currentChapter) && (
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
                  {currentChapter && totalPages > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handlePrevPage}
                        disabled={currentPage <= 1}
                        className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Epub viewer */}
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
            </Panel>

            <PanelResizeHandle className="w-1 bg-slate-200 hover:bg-indigo-400 transition-colors" />

            {/* Right Sidebar */}
            <Panel
              id="right"
              defaultSize={400}
              minSize={50}
              className="bg-white border-l border-slate-200 flex flex-col"
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

              {/* Chat Panel */}
              {activeTab === 'chat' && (
                <ChatPanel
                  sessions={sessions}
                  currentSessionId={currentSessionId}
                  messages={messages}
                  selectedBlocks={selectedBlocks}
                  expandedBlocks={expandedBlocks}
                  isSelectedBlocksExpanded={isSelectedBlocksExpanded}
                  aiLoading={aiLoading}
                  inputHistory={inputHistory}
                  inputLayout={chatInputLayout || undefined}
                  fontSize={fontSize}
                  fontFamily={fontFamily}
                  lineHeight={lineHeight}
                  autoScrollOnStreaming={autoScrollOnStreaming}
                  mermaidEnabled={mermaidEnabled}
                  onToggleAutoScroll={(enabled) => {
                    setAutoScrollOnStreaming(enabled);
                    localStorage.setItem('ai-chat-auto-scroll', String(enabled));
                  }}
                  onSendMessage={(input, isFirst) => handleSendMessage(input, isFirst)}
                  onSwitchSession={switchToSession}
                  onCreateSession={createNewSession}
                  onDeleteSession={deleteSession}
                  onEditSession={handleEditSession}
                  onRemoveBlock={handleRemoveBlock}
                  onDeleteMessage={handleDeleteMessage}
                  onToggleExpandBlock={handleToggleExpandBlock}
                  onToggleSelectedBlocksExpand={() => setIsSelectedBlocksExpanded(!isSelectedBlocksExpanded)}
                  onInputLayoutChange={(sizes) => {
                    localStorage.setItem('reader-layout', JSON.stringify({
                      ...JSON.parse(localStorage.getItem('reader-layout') || '{}'),
                      chatInput: sizes
                    }));
                    setChatInputLayout(sizes);
                  }}
                  onOpenCompress={(content, messageId) => {
                    setCompressContent(content);
                    setCompressMessageId(messageId);
                    setShowCompress(true);
                  }}
                  onEditMessage={async (messageId, newContent) => {
                    // Call API to update message in database
                    if (bookId && currentChapter) {
                      try {
                        const htmlFile = currentChapter.split('#')[0];
                        const encodedHtmlFile = encodeURIComponent(htmlFile);
                        await fetch(`/api/chat/${bookId}/${encodedHtmlFile}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ messageId, content: newContent }),
                        });
                      } catch (err) {
                        console.error('Failed to update message on server:', err);
                      }
                    }

                    // Update local state
                    setMessages(prev => prev.map(msg =>
                      msg.id === messageId
                        ? {
                            ...msg,
                            content: newContent
                          }
                        : msg
                    ));
                  }}
                />
              )}

              {/* Comment Panel */}
              {activeTab === 'comment' && (
                <CommentPanel
                  comments={comments}
                  selectedText={commentSelection}
                  inputText={currentCommentText}
                  onInputChange={setCurrentCommentText}
                  onSave={handleSaveComment}
                  onDelete={handleDeleteComment}
                />
              )}
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>

      {/* Edit Session Modal */}
      <EditSessionModal
        visible={showEditSession}
        title={editingSessionTitle}
        bookId={bookId}
        currentChapter={currentChapter}
        sessionId={editingSessionId || undefined}
        onTitleChange={setEditingSessionTitle}
        onSave={handleSaveSessionTitle}
        onClose={() => setShowEditSession(false)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        fontSize={fontSize}
        fontFamily={fontFamily}
        lineHeight={lineHeight}
        onFontSizeChange={(size) => setFontSize(Math.min(32, Math.max(14, size)))}
        onFontFamilyChange={setFontFamily}
        onLineHeightChange={setLineHeight}
        autoScrollOnStreaming={autoScrollOnStreaming}
        highlightEnabled={highlightEnabled}
        mermaidEnabled={mermaidEnabled}
        onToggleAutoScroll={() => {
          const newValue = !autoScrollOnStreaming;
          setAutoScrollOnStreaming(newValue);
          localStorage.setItem('ai-chat-auto-scroll', String(newValue));
        }}
        onToggleHighlight={() => {
          const newValue = !highlightEnabled;
          setHighlightEnabled(newValue);
          localStorage.setItem('reader-highlight-enabled', String(newValue));
        }}
        onToggleMermaid={() => {
          const newValue = !mermaidEnabled;
          setMermaidEnabled(newValue);
          localStorage.setItem('reader-mermaid-enabled', String(newValue));
        }}
        toolbarSettings={toolbarSettings}
        onToolbarSettingsChange={setToolbarSettings}
      />

      {/* Compress Modal */}
      <CompressModal
        isOpen={showCompress}
        onClose={() => setShowCompress(false)}
        content={compressContent}
        messageId={compressMessageId}
        onSubmit={handleCompressSubmit}
      />
    </div>
  );
}
