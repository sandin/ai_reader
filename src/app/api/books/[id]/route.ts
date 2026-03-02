import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

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

  const { userId } = auth;
  const { id } = await params;

  try {
    // Parse id as numeric ID
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid book ID' }, { status: 400 });
    }

    // Get book from database
    const result = await query('SELECT * FROM books WHERE id = $1', [numericId]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    const book = result.rows[0];

    // Delete the epub file
    const filePath = path.join(process.cwd(), 'data', book.epub_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
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

  const { userId } = auth;
  const { id } = await params;

  try {
    const body = await request.json();
    const newName = body.name?.trim();

    if (!newName) {
      return NextResponse.json({ error: 'New name is required' }, { status: 400 });
    }

    // Parse id as numeric ID
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid book ID' }, { status: 400 });
    }

    // Get book from database
    const result = await query('SELECT * FROM books WHERE id = $1', [numericId]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    const book = result.rows[0];

    const newFilename = newName.endsWith('.epub') ? newName : `${newName}.epub`;
    const newBookKey = newName.endsWith('.epub') ? newName.replace('.epub', '') : newName;

    // Check if new book key already exists (excluding current book)
    const existingBook = await query(
      'SELECT id FROM books WHERE book_key = $1 AND id != $2',
      [newBookKey, numericId]
    );

    if (existingBook.rows.length > 0) {
      return NextResponse.json({ error: 'A book with this name already exists' }, { status: 409 });
    }

    // Rename the epub file
    const oldFilePath = path.join(process.cwd(), 'data', book.epub_path);
    const newFilePath = path.join(process.cwd(), 'data', `${userId}/books/${newFilename}`);

    if (fs.existsSync(oldFilePath)) {
      fs.renameSync(oldFilePath, newFilePath);
    }

    // Update database
    const newEpubPath = `${userId}/books/${newFilename}`;
    const now = Math.floor(Date.now());

    await query(
      `UPDATE books SET book_key = $1, title = $2, filename = $3, epub_path = $4, updated_at = $5 WHERE id = $6`,
      [newBookKey, newBookKey, newFilename, newEpubPath, now, book.id]
    );

    return NextResponse.json({
      success: true,
      message: 'Book renamed successfully',
      newId: numericId,
      newFilename,
      newTitle: newBookKey
    });
  } catch (error) {
    console.error('Error renaming book:', error);
    return NextResponse.json({ error: 'Failed to rename book' }, { status: 500 });
  }
}
