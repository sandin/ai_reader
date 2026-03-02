import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authenticateRequest, requireAuth } from '@/lib/auth';

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

    // Parse bookId as numeric ID
    const numericBookId = parseInt(bookId, 10);
    if (isNaN(numericBookId)) {
      return NextResponse.json({ error: 'Invalid book ID', comments: [] }, { status: 400 });
    }

    // Check if book exists
    const bookResult = await query('SELECT id FROM books WHERE id = $1', [numericBookId]);
    if (bookResult.rows.length === 0) {
      return NextResponse.json({ comments: [] });
    }

    const commentsResult = await query(
      'SELECT id, comment_content, selected_text, cfi_range, comment_timestamp FROM comments WHERE book_id = $1 AND chapter_file = $2 ORDER BY id',
      [numericBookId, chapterFile]
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

    // Parse bookId as numeric ID
    const numericBookId = parseInt(bookId, 10);
    if (isNaN(numericBookId)) {
      return NextResponse.json({ error: 'Invalid book ID' }, { status: 400 });
    }

    // Check if book exists
    const bookResult = await query('SELECT id FROM books WHERE id = $1', [numericBookId]);
    if (bookResult.rows.length === 0) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    const now = Math.floor(Date.now());

    // Handle comments
    if (comments && Array.isArray(comments)) {
      await query(
        'DELETE FROM comments WHERE book_id = $1 AND chapter_file = $2',
        [numericBookId, chapterFile]
      );

      for (const comment of comments) {
        await query(
          'INSERT INTO comments (book_id, chapter_file, comment_content, selected_text, cfi_range, comment_timestamp) VALUES ($1, $2, $3, $4, $5, $6)',
          [
            numericBookId,
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
