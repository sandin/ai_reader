import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authenticateRequest, requireAuth } from '@/lib/auth';

// Helper to decode bookId (base64 encoded book key)
function decodeBookId(bookId: string): string {
  const standardBase64 = bookId.replace(/-/g, '+').replace(/_/g, '/');
  const padded = standardBase64 + '=='.slice(0, (4 - standardBase64.length % 4) % 4);
  const decodedBookId = Buffer.from(padded, 'base64').toString('utf-8');
  return decodedBookId.replace(/\.epub$/, '');
}

// Get book ID - supports both numeric ID and base64 encoded book key
async function parseBookId(bookId: string): Promise<number | null> {
  const numericId = parseInt(bookId);
  if (!isNaN(numericId)) {
    return numericId;
  }
  const bookKey = decodeBookId(bookId);
  const result = await query('SELECT id FROM books WHERE book_key = $1', [bookKey]);
  return result.rows[0]?.id || null;
}

// GET: 获取章节的评论
export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookId: string; htmlFile: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized', comments: [] }, { status: 401 });
    }

    const { bookId, htmlFile } = await params;

    if (!bookId || !htmlFile) {
      return NextResponse.json(
        { error: 'Missing required parameters: bookId, htmlFile', comments: [] },
        { status: 400 }
      );
    }

    const chapterFile = htmlFile.split('/').pop() || htmlFile;
    const bookIdNum = await parseBookId(bookId);

    if (!bookIdNum) {
      return NextResponse.json({ comments: [] });
    }

    const commentsResult = await query(
      'SELECT id, comment_content, selected_text, cfi_range, comment_timestamp FROM comments WHERE book_id = $1 AND chapter_file = $2 ORDER BY id',
      [bookIdNum, chapterFile]
    );

    const comments = commentsResult.rows.map((c: { id: number; comment_content: string; selected_text: string; cfi_range: string; comment_timestamp: number }) => ({
      id: c.id,
      content: c.comment_content,
      selectedText: c.selected_text,
      cfiRange: c.cfi_range,
      chapter: chapterFile,
      timestamp: c.comment_timestamp,
    }));

    return NextResponse.json({ comments });
  } catch (error) {
    console.error('Error getting comments:', error);
    return NextResponse.json({ comments: [] });
  }
}

// POST: 保存评论
export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookId: string; htmlFile: string }> }
) {
  try {
    await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { bookId, htmlFile } = await params;
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Failed to parse JSON body:', parseError);
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { comments } = body;

    if (!bookId || !htmlFile) {
      return NextResponse.json({ error: 'Missing required parameters: bookId, htmlFile' }, { status: 400 });
    }

    const chapterFile = htmlFile.split('/').pop() || htmlFile;
    const bookIdNum = await parseBookId(bookId);
    if (!bookIdNum) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    const now = Math.floor(Date.now());

    // Handle comments
    if (comments && Array.isArray(comments)) {
      await query(
        'DELETE FROM comments WHERE book_id = $1 AND chapter_file = $2',
        [bookIdNum, chapterFile]
      );

      for (const comment of comments) {
        await query(
          'INSERT INTO comments (book_id, chapter_file, comment_content, selected_text, cfi_range, comment_timestamp) VALUES ($1, $2, $3, $4, $5, $6)',
          [
            bookIdNum,
            chapterFile,
            comment.content,
            comment.selectedText || '',
            comment.cfiRange || '',
            comment.timestamp || now
          ]
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving comments:', error);
    return NextResponse.json({ error: 'Failed to save comments' }, { status: 500 });
  }
}
