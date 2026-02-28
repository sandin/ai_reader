import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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
  const { id } = await params;
  const booksDir = path.join(process.cwd(), 'data', 'books');
  const notesDir = path.join(process.cwd(), 'data', 'notes');

  try {
    const filename = decodeBookId(id);
    const filePath = path.join(booksDir, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // Delete the epub file
    fs.unlinkSync(filePath);

    // Delete the notes directory for this book (if exists)
    const bookName = filename.replace('.epub', '');
    const bookNotesDir = path.join(notesDir, bookName);
    if (fs.existsSync(bookNotesDir)) {
      fs.rmSync(bookNotesDir, { recursive: true, force: true });
    }

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
  const { id } = await params;
  const booksDir = path.join(process.cwd(), 'data', 'books');
  const notesDir = path.join(process.cwd(), 'data', 'notes');

  try {
    const body = await request.json();
    const newName = body.name?.trim();

    if (!newName) {
      return NextResponse.json({ error: 'New name is required' }, { status: 400 });
    }

    const oldFilename = decodeBookId(id);
    const oldBookName = oldFilename.replace('.epub', '');
    const newFilename = newName.endsWith('.epub') ? newName : `${newName}.epub`;
    const newBookName = newName.endsWith('.epub') ? newName.replace('.epub', '') : newName;

    const oldFilePath = path.join(booksDir, oldFilename);
    const newFilePath = path.join(booksDir, newFilename);

    // Check if old file exists
    if (!fs.existsSync(oldFilePath)) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // Check if new filename already exists
    if (fs.existsSync(newFilePath)) {
      return NextResponse.json({ error: 'A book with this name already exists' }, { status: 409 });
    }

    // Rename the epub file
    fs.renameSync(oldFilePath, newFilePath);

    // Rename the notes directory (if exists)
    const oldNotesDir = path.join(notesDir, oldBookName);
    const newNotesDir = path.join(notesDir, newBookName);
    if (fs.existsSync(oldNotesDir)) {
      fs.renameSync(oldNotesDir, newNotesDir);
    }

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
      newTitle: newBookName
    });
  } catch (error) {
    console.error('Error renaming book:', error);
    return NextResponse.json({ error: 'Failed to rename book' }, { status: 500 });
  }
}
