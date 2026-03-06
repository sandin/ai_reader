import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authenticateRequest, requireAuth } from '@/lib/auth';
import { syncCommentToVectorStore, deleteCommentFromVectorStore } from '@/app/api/agent';

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

// POST: 保存/更新单条评论
export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookId: string; htmlFile: string }> }
) {
  let auth: { userId: number; username: string; schema: string };
  try {
    auth = await requireAuth(request);
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

    const { comment } = body;

    if (!bookId || !htmlFile) {
      return NextResponse.json({ error: 'Missing required parameters: bookId, htmlFile' }, { status: 400 });
    }

    if (!comment || !comment.content) {
      return NextResponse.json({ error: 'Missing required field: comment.content' }, { status: 400 });
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
    let commentId: number;

    if (comment.id) {
      // 更新现有评论
      await query(
        'UPDATE comments SET comment_content = $1, selected_text = $2, cfi_range = $3, comment_timestamp = $4 WHERE id = $5 AND book_id = $6',
        [
          comment.content,
          comment.selectedText || '',
          comment.cfiRange || '',
          now,
          comment.id,
          numericBookId
        ]
      );
      commentId = comment.id;

      // 从向量存储中删除旧的，重新添加
      try {
        await deleteCommentFromVectorStore(commentId, auth.userId);
      } catch (e) {
        console.error('Failed to delete comment from vector store:', e);
      }
    } else {
      // 新增评论
      const result = await query(
        'INSERT INTO comments (book_id, chapter_file, comment_content, selected_text, cfi_range, comment_timestamp) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [
          numericBookId,
          chapterFile,
          comment.content,
          comment.selectedText || '',
          comment.cfiRange || '',
          comment.timestamp || now
        ]
      );
      commentId = result.rows[0].id;
    }

    // 同步到向量存储
    try {
      await syncCommentToVectorStore(
        commentId,
        comment.content,
        comment.selectedText || '',
        auth.userId,
        numericBookId,
        chapterFile
      );
    } catch (e) {
      console.error('Failed to sync comment to vector store:', e);
    }

    return NextResponse.json({ success: true, commentId });
  } catch (error) {
    console.error('Error saving comment:', error);
    return NextResponse.json({ error: 'Failed to save comment' }, { status: 500 });
  }
}

// DELETE: 删除单条评论
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ bookId: string; htmlFile: string }> }
) {
  let auth: { userId: number; username: string; schema: string };
  try {
    auth = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { bookId, htmlFile } = await params;
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('commentId');

    if (!bookId || !htmlFile) {
      return NextResponse.json({ error: 'Missing required parameters: bookId, htmlFile' }, { status: 400 });
    }

    if (!commentId) {
      return NextResponse.json({ error: 'Missing required parameter: commentId' }, { status: 400 });
    }

    const numericBookId = parseInt(bookId, 10);
    const numericCommentId = parseInt(commentId, 10);

    if (isNaN(numericBookId) || isNaN(numericCommentId)) {
      return NextResponse.json({ error: 'Invalid book ID or comment ID' }, { status: 400 });
    }

    // 从向量存储中删除
    try {
      await deleteCommentFromVectorStore(numericCommentId, auth.userId);
    } catch (e) {
      console.error('Failed to delete comment from vector store:', e);
    }

    // 从数据库中删除
    await query(
      'DELETE FROM comments WHERE id = $1 AND book_id = $2',
      [numericCommentId, numericBookId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
}
