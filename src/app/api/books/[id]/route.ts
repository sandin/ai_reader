import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { query } from '@/lib/db';
import { authenticateRequest, requireAuth } from '@/lib/auth';

// Decode URL-safe base64 to get original filename
function decodeBookId(id: string): string {
  let base64 = id.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let auth;
  try {
    auth = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { username } = auth;
  const { id } = await params;

  try {
    // Decode book key from URL-safe base64
    const bookKey = decodeBookId(id).replace('.epub', '');

    // Get book from database
    const result = await query(
      'SELECT * FROM books WHERE book_key = $1',
      [bookKey]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    const book = result.rows[0];

    // Delete the epub file
    const filePath = path.join(process.cwd(), 'data', book.epub_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete notes directory
    const notesDir = path.join(process.cwd(), 'data', username, 'notes', bookKey);
    if (fs.existsSync(notesDir)) {
      fs.rmSync(notesDir, { recursive: true, force: true });
    }

    // Delete from database (cascade will handle related records)
    await query('DELETE FROM books WHERE id = $1', [book.id]);

    return NextResponse.json({
      success: true,
      message: 'Book deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting book:', error);
    return NextResponse.json({ error: 'Failed to delete book' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let auth;
  try {
    auth = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { username } = auth;
  const { id } = await params;

  try {
    const body = await request.json();
    const newName = body.name?.trim();

    if (!newName) {
      return NextResponse.json({ error: 'New name is required' }, { status: 400 });
    }

    // Decode book key from URL-safe base64
    const oldBookKey = decodeBookId(id).replace('.epub', '');
    const newFilename = newName.endsWith('.epub') ? newName : `${newName}.epub`;
    const newBookKey = newName.endsWith('.epub') ? newName.replace('.epub', '') : newName;

    // Get book from database
    const result = await query(
      'SELECT * FROM books WHERE book_key = $1',
      [oldBookKey]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    const book = result.rows[0];

    // Check if new book key already exists
    const existingBook = await query(
      'SELECT id FROM books WHERE book_key = $1',
      [newBookKey]
    );

    if (existingBook.rows.length > 0) {
      return NextResponse.json({ error: 'A book with this name already exists' }, { status: 409 });
    }

    // Rename the epub file
    const oldFilePath = path.join(process.cwd(), 'data', book.epub_path);
    const newFilePath = path.join(process.cwd(), 'data', `${username}/books/${newFilename}`);

    if (fs.existsSync(oldFilePath)) {
      fs.renameSync(oldFilePath, newFilePath);
    }

    // Rename notes directory
    const oldNotesDir = path.join(process.cwd(), 'data', username, 'notes', oldBookKey);
    const newNotesDir = path.join(process.cwd(), 'data', username, 'notes', newBookKey);
    if (fs.existsSync(oldNotesDir)) {
      fs.renameSync(oldNotesDir, newNotesDir);
    }

    // Update database
    const newEpubPath = `${username}/books/${newFilename}`;
    const now = Math.floor(Date.now());

    await query(
      `UPDATE books SET book_key = $1, title = $2, filename = $3, epub_path = $4, updated_at = $5 WHERE id = $6`,
      [newBookKey, newBookKey, newFilename, newEpubPath, now, book.id]
    );

    // Generate new ID
    const newId = Buffer.from(newFilename).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return NextResponse.json({
      success: true,
      message: 'Book renamed successfully',
      newId,
      newFilename,
      newTitle: newBookKey
    });
  } catch (error) {
    console.error('Error renaming book:', error);
    return NextResponse.json({ error: 'Failed to rename book' }, { status: 500 });
  }
}
