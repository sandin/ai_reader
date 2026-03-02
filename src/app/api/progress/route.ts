import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function POST(request: Request) {
  let auth;
  try {
    auth = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { bookId, chapter, cfi } = body;

    if (!bookId || !chapter) {
      return NextResponse.json(
        { error: 'Missing required fields: bookId, chapter' },
        { status: 400 }
      );
    }

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

    // Update reading progress directly in books table
    await query(
      'UPDATE books SET current_file = $1, cfi = $2, status = $3, last_read_at = $4, updated_at = $5 WHERE id = $6',
      [chapter, cfi || '', 'reading', now, now, numericBookId]
    );

    return NextResponse.json({
      success: true,
      bookId: numericBookId,
      chapter,
    });
  } catch (error) {
    console.error('Error saving reading progress:', error);
    return NextResponse.json(
      { error: 'Failed to save reading progress' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  let auth;
  try {
    auth = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { bookId, status } = body;

    if (!bookId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: bookId, status' },
        { status: 400 }
      );
    }

    if (!['unread', 'reading', 'completed'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: unread, reading, or completed' },
        { status: 400 }
      );
    }

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

    // Update book status directly
    await query(
      'UPDATE books SET status = $1, last_read_at = $2, updated_at = $3 WHERE id = $4',
      [status, now, now, numericBookId]
    );

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error('Error updating reading status:', error);
    return NextResponse.json(
      { error: 'Failed to update reading status' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const bookId = searchParams.get('bookId');
    // Optional parameters to update progress while getting
    const chapter = searchParams.get('chapter');
    const cfi = searchParams.get('cfi');

    if (!bookId) {
      return NextResponse.json(
        { error: 'Missing required parameter: bookId' },
        { status: 400 }
      );
    }

    // Parse bookId as numeric ID
    const numericBookId = parseInt(bookId, 10);
    if (isNaN(numericBookId)) {
      return NextResponse.json({ error: 'Invalid book ID' }, { status: 400 });
    }

    // Check if book exists
    const bookResult = await query('SELECT id FROM books WHERE id = $1', [numericBookId]);
    if (bookResult.rows.length === 0) {
      return NextResponse.json({ htmlFile: null, cfi: null, status: 'unread' });
    }

    const now = Math.floor(Date.now());

    // If chapter and cfi are provided, update progress while getting
    if (chapter) {
      await query(
        'UPDATE books SET current_file = $1, cfi = $2, status = $3, last_read_at = $4, updated_at = $5 WHERE id = $6',
        [chapter, cfi || '', 'reading', now, now, numericBookId]
      );
    }

    // Get reading progress from books table
    const result = await query(
      'SELECT current_file, cfi, status FROM books WHERE id = $1',
      [numericBookId]
    );

    const book = result.rows[0];
    return NextResponse.json({
      htmlFile: book.current_file || null,
      cfi: book.cfi || null,
      status: book.status || 'unread',
    });
  } catch (error) {
    console.error('Error getting reading progress:', error);
    return NextResponse.json(
      { error: 'Failed to get reading progress' },
      { status: 500 }
    );
  }
}
