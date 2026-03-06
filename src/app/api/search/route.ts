import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { searchVectorStore } from '@/lib/ai';
import { query } from '@/lib/db';

// 搜索结果类型
interface SearchResult {
  content: string;
  type: 'session' | 'comment';
  session_id?: number;
  message_id?: number;
  comment_id?: number;
  book_id: number;
  chapter_file: string;
  book_title?: string;
  book_author?: string;
}

// 解析搜索语法，提取过滤类型和实际搜索词
// 支持: type:comment keyword, type:chat keyword
function parseSearchQuery(input: string): { filterType: 'session' | 'comment' | undefined; keyword: string } {
  const trimmed = input.trim();

  // 匹配 type:comment 或 type:chat
  const typeMatch = trimmed.match(/^type:(comment|chat)\s+(.+)$/i);

  if (typeMatch) {
    const type = typeMatch[1].toLowerCase();
    const keyword = typeMatch[2].trim();

    // type:comment -> comment, type:chat -> session
    return {
      filterType: type === 'comment' ? 'comment' : 'session',
      keyword,
    };
  }

  return { filterType: undefined, keyword: trimmed };
}

// GET: 搜索
export async function GET(request: Request) {
  let auth: { userId: number; username: string; schema: string };
  try {
    auth = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get('q');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);

    if (!searchQuery || !searchQuery.trim()) {
      return NextResponse.json({ results: [], total: 0, page: 1, pageSize: 10 });
    }

    // 解析搜索语法
    const { filterType, keyword } = parseSearchQuery(searchQuery);

    if (!keyword) {
      return NextResponse.json({ results: [], total: 0, page: 1, pageSize: 10 });
    }

    // 限制每页最大 20 条
    const effectivePageSize = Math.min(pageSize, 20);

    // 为了计算总数并支持分页，先获取足够多的结果（最多 100 条）
    const fetchCount = Math.max(page * effectivePageSize, 100);
    const allResults = await searchVectorStore(keyword, auth.userId, fetchCount, filterType);

    // 计算总数：如果返回的结果少于 fetchCount，说明这就是全部结果；
    // 否则说明还有更多结果，使用 (page-1)*effectivePageSize + allResults.length 作为估计
    const hasMore = allResults.length >= fetchCount;
    const total = hasMore ? fetchCount + (page - 1) * effectivePageSize : allResults.length;

    // 计算偏移量并获取当前页的结果
    const offset = (page - 1) * effectivePageSize;
    const paginatedResults = allResults.slice(offset, offset + effectivePageSize);

    // 获取书籍信息并构建结果
    const results: SearchResult[] = [];

    for (const result of paginatedResults) {
      // 获取书籍信息
      const bookResult = await query(
        'SELECT title, author FROM books WHERE id = $1',
        [result.book_id]
      );

      const book = bookResult.rows[0] || { title: '未知书籍', author: '未知作者' };

      results.push({
        ...result,
        book_title: book.title,
        book_author: book.author,
      });
    }

    return NextResponse.json({
      results,
      total,
      page,
      pageSize: effectivePageSize,
      hasMore,
      filterType: filterType || 'all',
    });
  } catch (error) {
    console.error('Error searching:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
