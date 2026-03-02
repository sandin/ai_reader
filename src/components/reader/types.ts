// Reader 页面共享类型定义

export interface Chapter {
  id: string;
  label: string;
  href: string;
}

// Tree structure for TOC
export interface TreeNode {
  chapter_id: string;
  chapter_name: string;
  href: string;
  contents: string[];
  children: TreeNode[];
}

export interface ChapterIndex {
  tree: TreeNode[];
  htmlOrder: string[];
}

export interface Block {
  id: string;
  content: string;
  cfiRange?: string;
  timestamp: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Session {
  id: string;
  title: string;
  selectedBlocks: Block[];
  messages: Message[];
  timestamp: number;
  created_at: number;
}

export interface Comment {
  id: string;
  content: string;
  selectedText: string;
  cfiRange: string;
  chapter: string;
  timestamp: number;
}

// Font options
export interface FontOption {
  value: string;
  label: string;
}

// Toolbar visibility settings
export interface ToolbarSettings {
  showFontSize: boolean;
  showFontFamily: boolean;
  showLineHeight: boolean;
  showAutoScroll: boolean;
  showHighlight: boolean;
  showMermaid: boolean;
}

export const defaultToolbarSettings: ToolbarSettings = {
  showFontSize: true,
  showFontFamily: true,
  showLineHeight: true,
  showAutoScroll: true,
  showHighlight: true,
  showMermaid: true,
};

export const FONT_OPTIONS: FontOption[] = [
  { value: 'Georgia, "Times New Roman", serif', label: '衬线体' },
  { value: 'Arial, Helvetica, sans-serif', label: '无衬线' },
  { value: '"PingFang SC", "Hiragino Sans GB", "Heiti SC", sans-serif', label: '苹方 PingFang' },
  { value: '"Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif', label: '微软雅黑' },
  { value: '"SimSun", "STSong", serif', label: '宋体' },
  { value: 'Menlo, Monaco, "Courier New", monospace', label: '等宽字体' },
  { value: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif', label: '系统默认' },
  { value: '"Noto Sans SC", "Microsoft YaHei", sans-serif', label: '思源黑体' },
  { value: '"Noto Serif SC", "SimSun", serif', label: '思源宋体' },
];
