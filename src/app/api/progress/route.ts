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

// Get book key from numeric ID
async function getBookKey(bookId: number): Promise<string | null> {
  const result = await query('SELECT book_key FROM books WHERE id = $1', [bookId]);
  return result.rows[0]?.book_key || null;
}

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

    // Parse bookId (supports both numeric ID and base64 encoded)
    const bookIdNum = await parseBookId(bookId);

    if (!bookIdNum) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // Get book key for response
    const bookKey = await getBookKey(bookIdNum);

    const now = Math.floor(Date.now());

    // Upsert reading progress
    await query(
      `INSERT INTO reading_progress (book_id, current_file, cfi, status, last_read_at)
       VALUES ($1, $2, $3, 'reading', $4)
       ON CONFLICT (book_id) DO UPDATE SET
         current_file = EXCLUDED.current_file,
         cfi = EXCLUDED.cfi,
         status = 'reading',
         last_read_at = EXCLUDED.last_read_at`,
      [bookIdNum, chapter, cfi || '', now]
    );

    // Update book status to reading
    await query(
      'UPDATE books SET status = $1, updated_at = $2 WHERE id = $3',
      ['reading', now, bookIdNum]
    );

    return NextResponse.json({
      success: true,
      bookKey,
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

    const bookIdNum = await parseBookId(bookId);

    if (!bookIdNum) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    const now = Math.floor(Date.now());

    // Update reading progress status
    await query(
      `INSERT INTO reading_progress (book_id, status, last_read_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (book_id) DO UPDATE SET
         status = EXCLUDED.status,
         last_read_at = EXCLUDED.last_read_at`,
      [bookIdNum, status, now]
    );

    // Update book status
    await query(
      'UPDATE books SET status = $1, updated_at = $2 WHERE id = $3',
      [status, now, bookIdNum]
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
    const auth = await authenticateRequest(request);
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

    const bookIdNum = await parseBookId(bookId);

    if (!bookIdNum) {
      return NextResponse.json({ htmlFile: null, cfi: null, status: 'unread' });
    }

    const now = Math.floor(Date.now());

    // If chapter and cfi are provided, update progress while getting
    if (chapter) {
      await query(
        `INSERT INTO reading_progress (book_id, current_file, cfi, status, last_read_at)
         VALUES ($1, $2, $3, 'reading', $4)
         ON CONFLICT (book_id) DO UPDATE SET
           current_file = EXCLUDED.current_file,
           cfi = EXCLUDED.cfi,
           status = 'reading',
           last_read_at = EXCLUDED.last_read_at`,
        [bookIdNum, chapter, cfi || '', now]
      );

      // Update book status to reading
      await query(
        'UPDATE books SET status = $1, updated_at = $2 WHERE id = $3',
        ['reading', now, bookIdNum]
      );
    }

    const result = await query(
      'SELECT current_file, cfi, status FROM reading_progress WHERE book_id = $1',
      [bookIdNum]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ htmlFile: null, cfi: null, status: 'unread' });
    }

    const progress = result.rows[0];
    return NextResponse.json({
      htmlFile: progress.current_file,
      cfi: progress.cfi,
      status: progress.status,
    });
  } catch (error) {
    console.error('Error getting reading progress:', error);
    return NextResponse.json(
      { error: 'Failed to get reading progress' },
      { status: 500 }
    );
  }
}
