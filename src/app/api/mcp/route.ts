import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { setCurrentUser } from '@/lib/db';
import { searchVectorStore } from '@/lib/ai/vector';
import { query } from '@/lib/db';
import type { TreeNode } from '@/components/reader/types';

// Bearer Token 鉴权 - 使用 JWT
function authenticateBearerToken(request: Request): { userId: number; username: string } | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  console.log("[MCP] token:", token.substring(0, 50) + '...');

  const payload = verifyToken(token);
  if (!payload) {
    console.log("[MCP] payload: null)");
    return null;
  }

  // 设置当前用户 schema
  setCurrentUser(payload.userId);

  return { userId: payload.userId, username: payload.username };
}

// MCP JSON-RPC 请求类型
interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}


// 根据 chapterFile 在索引树中查找章节的完整路径（包含所有父级）
function findChapterPath(tree: TreeNode[], targetFile: string, parentPath: string[] = []): string[] | null {
  for (const node of tree) {
    // 从 href 中提取文件名进行匹配
    const nodeFile = node.href?.split('#')[0].split('/').pop() || '';
    const targetFileName = targetFile.split('#')[0].split('/').pop() || '';

    if (nodeFile === targetFileName || node.contents.some(c => c.split('#')[0].split('/').pop() === targetFileName)) {
      // 找到匹配的章节，返回完整路径
      return [...parentPath, node.chapter_name];
    }

    // 递归搜索子节点
    if (node.children && node.children.length > 0) {
      const result = findChapterPath(node.children, targetFile, [...parentPath, node.chapter_name]);
      if (result) {
        return result;
      }
    }
  }
  return null;
}

// 获取章节显示名称（包含层级）
function getChapterDisplayName(chapterFile: string, indexData: { tree: TreeNode[] } | null): string {
  if (!indexData || !indexData.tree || indexData.tree.length === 0) {
    // 如果没有索引数据，回退到原来的处理方式
    return chapterFile.replace('.html', '').replace(/_/g, ' ');
  }

  const path = findChapterPath(indexData.tree, chapterFile);
  if (path && path.length > 0) {
    return path.join(' / ');
  }

  // 如果没找到，回退到原来的处理方式
  return chapterFile.replace('.html', '').replace(/_/g, ' ');
}

// 搜索向量数据库
async function searchBooks(keyword: string, userId: number): Promise<string> {
  const searchResults = await searchVectorStore(keyword, userId, 10);

  if (searchResults.length === 0) {
    return '没有找到匹配的内容。';
  }

  interface GroupedResults {
    [bookId: number]: {
      book_title: string;
      book_author: string;
      index_data: { tree: TreeNode[] } | null;
      chapters: {
        [chapterFile: string]: {
          comments: Array<{ id: number; selected_text: string; content: string }>;
          chatMessages: Array<{ id: number; content: string }>;
        };
      };
    };
  }

  const groupedResults: GroupedResults = {};
  const seenCommentIds = new Set<number>();
  const seenMessageIds = new Set<number>();

  for (const result of searchResults) {
    const bookId = result.book_id;

    if (!groupedResults[bookId]) {
      const bookResult = await query('SELECT title, author, index_data FROM books WHERE id = $1', [bookId]);
      const book = bookResult.rows[0] || { title: '未知书籍', author: '未知作者', index_data: null };
      groupedResults[bookId] = { book_title: book.title, book_author: book.author, index_data: book.index_data, chapters: {} };
    }

    const chapterFile = result.chapter_file;
    if (!groupedResults[bookId].chapters[chapterFile]) {
      groupedResults[bookId].chapters[chapterFile] = { comments: [], chatMessages: [] };
    }

    if (result.type === 'comment' && result.comment_id) {
      const commentId = result.comment_id;
      if (seenCommentIds.has(commentId)) continue;
      seenCommentIds.add(commentId);

      const commentResult = await query('SELECT selected_text, comment_content FROM comments WHERE id = $1', [commentId]);
      if (commentResult.rows.length > 0) {
        const comment = commentResult.rows[0];
        groupedResults[bookId].chapters[chapterFile].comments.push({
          id: commentId,
          selected_text: comment.selected_text || '',
          content: comment.comment_content || '',
        });
      }
    } else if (result.type === 'session' && result.message_id) {
      const messageId = result.message_id;
      if (seenMessageIds.has(messageId)) continue;
      seenMessageIds.add(messageId);

      const messageResult = await query('SELECT message_content FROM chat_messages WHERE id = $1', [messageId]);
      if (messageResult.rows.length > 0) {
        const message = messageResult.rows[0];
        groupedResults[bookId].chapters[chapterFile].chatMessages.push({ id: messageId, content: message.message_content || '' });
      }
    }
  }

  let markdown = '';
  for (const bookId of Object.keys(groupedResults)) {
    const book = groupedResults[Number(bookId)];
    markdown += `# ${book.book_title}\n${book.book_author}\n\n`;

    for (const chapterFile of Object.keys(book.chapters).sort()) {
      const chapterName = getChapterDisplayName(chapterFile, book.index_data);
      markdown += `## ${chapterName}\n\n`;

      const chapter = book.chapters[chapterFile];
      for (const comment of chapter.comments) {
        markdown += `### comment\n`;
        if (comment.selected_text) markdown += `> ${comment.selected_text}\n\n`;
        markdown += `${comment.content}\n\n`;
      }
      for (const chat of chapter.chatMessages) {
        markdown += `### chat\n${chat.content}\n\n`;
      }
    }
    markdown += '---\n\n';
  }

  return markdown.trim();
}

// 处理 MCP 请求
async function handleMCPRequest(request: MCPRequest, userId: number) {
  const { method, params } = request;

  // 初始化
  if (method === 'initialize') {
    return {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {}, resources: {} },
      serverInfo: { name: 'ai-reader-mcp', version: '1.0.0' },
    };
  }

  // 工具列表
  if (method === 'tools/list') {
    return {
      tools: [
        {
          name: 'search_book',
          description: '当用户需要在其个人图书库（他看过的书籍）中搜索时使用此工具。可以搜索书籍中的内容，评论、笔记和AI对话内容。输入关键词，返回按书籍和章节分组的Markdown格式结果。',
          inputSchema: {
            type: 'object',
            properties: { keyword: { type: 'string', description: '搜索关键词' } },
            required: ['keyword'],
          },
        },
      ],
    };
  }

  // 调用工具
  if (method === 'tools/call') {
    const toolName = params?.name as string;
    const args = params?.arguments as { keyword?: string } | undefined;

    if (toolName === 'search_book') {
      const keyword = args?.keyword || '';
      if (!keyword.trim()) {
        return { content: [{ type: 'text', text: '请提供搜索关键词。' }] };
      }

      const result = await searchBooks(keyword, userId);
      return { content: [{ type: 'text', text: result }] };
    }

    return { content: [{ type: 'text', text: `未知工具: ${toolName}` }] };
  }

  // 资源列表
  if (method === 'resources/list') {
    return { resources: [] };
  }

  // Ping
  if (method === 'ping') {
    return {};
  }

  return { content: [{ type: 'text', text: `未知方法: ${method}` }] };
}

// Streamable HTTP 端点
export async function GET(request: Request) {
  console.log("[MCP] GET (streamable http)");
  const auth = authenticateBearerToken(request);
  if (!auth) {
    console.log("[MCP] Unauthorized");
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  return NextResponse.json(
    { jsonrpc: '2.0', id: null, result: { message: 'MCP Streamable HTTP Server' } },
    {
      headers: {
        'Content-Type': 'application/json',
        'Transfer-Encoding': 'chunked',
      },
    }
  );
}

// POST: 处理 MCP Streamable HTTP 请求
export async function POST(request: Request) {
  console.log("[MCP] POST (streamable http)");
  const auth = authenticateBearerToken(request);
  if (!auth) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  try {
    // 解析 JSON-RPC 请求数组或单个对象
    const body = await request.json();
    const requests: MCPRequest[] = Array.isArray(body) ? body : [body];

    // 使用 TransformStream 实现流式响应
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // 异步处理请求并流式返回
    (async () => {
      try {
        for (const mcpRequest of requests) {
          console.log('[MCP] ← request:', JSON.stringify(mcpRequest));

          const result = await handleMCPRequest(mcpRequest, auth.userId);

          const response = { jsonrpc: '2.0', id: mcpRequest.id, result };
          console.log('[MCP] → response:', JSON.stringify(response, null, 2));

          // 写入 JSON-RPC 响应（每行一个 JSON）
          await writer.write(encoder.encode(JSON.stringify(response) + '\n'));
        }
      } catch (error) {
        console.error('[MCP] error:', error);
        const errorResponse = { jsonrpc: '2.0', id: 1, error: { code: -32603, message: 'Internal error' } };
        await writer.write(encoder.encode(JSON.stringify(errorResponse) + '\n'));
      } finally {
        writer.close();
      }
    })();

    return new NextResponse(readable, {
      headers: {
        'Content-Type': 'application/json-seq',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('[MCP] parse error:', error);
    return NextResponse.json(
      { jsonrpc: '2.0', id: 1, error: { code: -32700, message: 'Parse error' } },
      { status: 400 }
    );
  }
}
