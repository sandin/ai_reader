import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { query } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';

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

    // Parse id as numeric ID
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid book ID' }, { status: 400 });
    }

    // Get book by numeric ID
    const result = await query('SELECT * FROM books WHERE id = $1', [numericId]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    const book = result.rows[0];
    const filepath = path.join(process.cwd(), 'data', book.epub_path);

    if (!fs.existsSync(filepath)) {
      return NextResponse.json({ error: 'Book file not found' }, { status: 404 });
    }

    const bookBuffer = fs.readFileSync(filepath);
    const bookBase64 = bookBuffer.toString('base64');

    return NextResponse.json({
      id: book.id,
      filename: book.filename,
      title: book.title,
      content: bookBase64,
    });
  } catch (error) {
    console.error('Error reading book:', error);
    return NextResponse.json({ error: 'Failed to read book' }, { status: 500 });
  }
}
