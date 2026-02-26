import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bookId, chapter, cfi } = body;

    if (!bookId || !chapter) {
      return NextResponse.json(
        { error: 'Missing required fields: bookId, chapter' },
        { status: 400 }
      );
    }

    // Decode bookId from URL-safe base64 to original book name
    const standardBase64 = bookId.replace(/-/g, '+').replace(/_/g, '/');
    const padded = standardBase64 + '=='.slice(0, (4 - standardBase64.length % 4) % 4);
    const decodedBookId = Buffer.from(padded, 'base64').toString('utf-8');
    const bookName = decodedBookId.replace(/\.epub$/, '');

    // Notes directory at project root
    const notesDir = path.join(process.cwd(), 'notes');

    // Create notes directory if it doesn't exist
    if (!fs.existsSync(notesDir)) {
      fs.mkdirSync(notesDir, { recursive: true });
    }

    // Book-specific directory
    const bookNotesDir = path.join(notesDir, bookName);
    if (!fs.existsSync(bookNotesDir)) {
      fs.mkdirSync(bookNotesDir, { recursive: true });
    }

    // Bookmark file path (per-book)
    const bookmarkFilePath = path.join(bookNotesDir, 'bookmark.json');

    // Save simplified bookmark data (chapter info is in index.json)
    const bookmarkData = {
      htmlFile: chapter, // Just save the HTML file name
      cfi: cfi || '',
      timestamp: Date.now(),
    };

    // Write to JSON file
    fs.writeFileSync(bookmarkFilePath, JSON.stringify(bookmarkData, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      bookName,
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bookId = searchParams.get('bookId');

    if (!bookId) {
      return NextResponse.json(
        { error: 'Missing required parameter: bookId' },
        { status: 400 }
      );
    }

    // Decode bookId from URL-safe base64 to original book name
    const standardBase64 = bookId.replace(/-/g, '+').replace(/_/g, '/');
    const padded = standardBase64 + '=='.slice(0, (4 - standardBase64.length % 4) % 4);
    const decodedBookId = Buffer.from(padded, 'base64').toString('utf-8');
    const bookName = decodedBookId.replace(/\.epub$/, '');

    // Bookmark file path (per-book)
    const bookmarkFilePath = path.join(process.cwd(), 'notes', bookName, 'bookmark.json');

    if (!fs.existsSync(bookmarkFilePath)) {
      return NextResponse.json({ htmlFile: null, cfi: null });
    }

    try {
      const content = fs.readFileSync(bookmarkFilePath, 'utf-8');
      const bookmarkData = JSON.parse(content);

      return NextResponse.json(bookmarkData);
    } catch (e) {
      return NextResponse.json({ htmlFile: null, cfi: null });
    }
  } catch (error) {
    console.error('Error getting reading progress:', error);
    return NextResponse.json(
      { error: 'Failed to get reading progress' },
      { status: 500 }
    );
  }
}
