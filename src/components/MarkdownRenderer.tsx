'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface LinkInfo {
  title: string;
  url: string;
}

export interface MarkdownRendererProps {
  content: string;
  className?: string;
  onLink?: (info: LinkInfo) => void;
}

function handleLinkClick(e: React.MouseEvent<HTMLAnchorElement>, onLink?: (info: LinkInfo) => void) {
  e.preventDefault();

  const href = e.currentTarget.getAttribute('href');
  const text = e.currentTarget.textContent || '';

  if (!href || !onLink) {
    return;
  }

  onLink({
    title: text,
    url: href,
  });
}

export default function MarkdownRenderer({ content, className = '', onLink }: MarkdownRendererProps) {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, href, children, ...props }) => {
            if (!href) {
              return <a {...props}>{children}</a>;
            }

            // 判断是否是内部链接（以 /reader/ 开头）
            const isInternalLink = href.startsWith('/reader/');

            return (
              <a
                href={href}
                onClick={(e) => {
                  if (isInternalLink && onLink) {
                    // 内部链接触发 onLink 回调，让上层处理
                    handleLinkClick(e, onLink);
                  } else {
                    // 外部链接直接跳转
                    handleLinkClick(e, onLink);
                  }
                }}
                className="text-amber-600 hover:text-amber-700 hover:underline cursor-pointer"
                {...props}
              >
                {children}
              </a>
            );
          },
          p: ({ children }) => (
            <p className="mb-3 last:mb-0">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-slate-700">{children}</li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-800">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic">{children}</em>
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded text-sm font-mono" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className={`${className} block bg-slate-100 text-slate-800 rounded p-3 text-sm font-mono overflow-x-auto`} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="mb-3 overflow-x-auto">{children}</pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-amber-300 pl-4 my-3 text-slate-600 italic">
              {children}</blockquote>
          ),
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-slate-800 mb-3">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold text-slate-800 mb-2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-slate-800 mb-2">{children}</h3>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
