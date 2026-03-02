import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { query } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';

// Helper to decode bookId (base64 encoded book key)
function decodeBookId(bookId: string): string {
  const standardBase64 = bookId.replace(/-/g, '+').replace(/_/g, '/');
  const padded = standardBase64 + '=='.slice(0, (4 - standardBase64.length % 4) % 4);
  const decodedBookId = Buffer.from(padded, 'base64').toString('utf-8');
  return decodedBookId.replace(/\.epub$/, '');
}

// Get book - supports both numeric ID and base64 encoded book key
async function getBook(idOrKey: string): Promise<any> {
  const numericId = parseInt(idOrKey);
  if (!isNaN(numericId)) {
    // Query by numeric ID
    const result = await query('SELECT * FROM books WHERE id = $1', [numericId]);
    return result.rows[0] || null;
  }
  // Query by book_key (base64 encoded)
  const bookKey = decodeBookId(idOrKey);
  const result = await query('SELECT * FROM books WHERE book_key = $1', [bookKey]);
  return result.rows[0] || null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get book by ID or book_key
    const book = await getBook(id);

    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }
    const filepath = path.join(process.cwd(), 'data', book.epub_path);

    if (!fs.existsSync(filepath)) {
      return NextResponse.json({ error: 'Book file not found' }, { status: 404 });
    }

    const bookBuffer = fs.readFileSync(filepath);
    const bookBase64 = bookBuffer.toString('base64');

    // Generate legacy ID for backward compatibility
    const legacyId = Buffer.from(book.book_key).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return NextResponse.json({
      id: book.id,
      legacyId,
      filename: book.filename,
      title: book.title,
      content: bookBase64,
    });
  } catch (error) {
    console.error('Error reading book:', error);
    return NextResponse.json({ error: 'Failed to read book' }, { status: 500 });
  }
}
