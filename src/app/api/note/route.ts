import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bookId, htmlFile, content, timestamp } = body;

    if (!bookId || !htmlFile || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: bookId, htmlFile, content' },
        { status: 400 }
      );
    }

    // Decode bookId from URL-safe base64 to original book name
    // Handle URL-safe base64: replace - with + and _ with /
    const standardBase64 = bookId.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    const padded = standardBase64 + '=='.slice(0, (4 - standardBase64.length % 4) % 4);
    const decodedBookId = Buffer.from(padded, 'base64').toString('utf-8');
    // Remove .epub extension if present
    const bookName = decodedBookId.replace(/\.epub$/, '');

    // Extract just the filename from htmlFile (remove path prefix like "OEBPS/")
    const htmlFileName = path.basename(htmlFile);

    // Notes directory at project root (same level as 'book')
    const notesDir = path.join(process.cwd(), 'notes');

    // Create notes directory if it doesn't exist
    if (!fs.existsSync(notesDir)) {
      fs.mkdirSync(notesDir, { recursive: true });
    }

    // Create book-specific directory inside notes
    const bookNotesDir = path.join(notesDir, bookName);
    if (!fs.existsSync(bookNotesDir)) {
      fs.mkdirSync(bookNotesDir, { recursive: true });
    }

    // JSON file path based on HTML file name
    const jsonFileName = htmlFileName.replace(/\.[^/.]+$/, '') + '.json';
    const jsonFilePath = path.join(bookNotesDir, jsonFileName);

    let notes: Array<{
      id: string;
      content: string;
      timestamp: number;
      cfiRange?: string;
      htmlFile: string;
    }> = [];

    // Read existing notes if file exists
    if (fs.existsSync(jsonFilePath)) {
      try {
        const existingContent = fs.readFileSync(jsonFilePath, 'utf-8');
        notes = JSON.parse(existingContent);
      } catch (e) {
        // If parse fails, start with empty array
        notes = [];
      }
    }

    // Add new note
    const newNote = {
      id: Date.now().toString(),
      content,
      timestamp: timestamp || Date.now(),
      cfiRange: body.cfiRange || '',
      htmlFile: htmlFileName,
    };
    notes.push(newNote);

    // Write to JSON file
    fs.writeFileSync(jsonFilePath, JSON.stringify(notes, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      noteId: newNote.id,
      filePath: jsonFilePath,
    });
  } catch (error) {
    console.error('Error saving note:', error);
    return NextResponse.json(
      { error: 'Failed to save note' },
      { status: 500 }
    );
  }
}
