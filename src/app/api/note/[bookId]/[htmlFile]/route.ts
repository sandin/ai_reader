import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface Session {
  id: string;
  title: string;
  selectedBlocks: Array<{
    id: string;
    content: string;
    timestamp: number;
    cfiRange?: string;
  }>;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    blocks: Array<{
      id: string;
      content: string;
      timestamp: number;
    }>;
    timestamp: number;
  }>;
  timestamp: number;
}

interface Comment {
  id: string;
  content: string;
  selectedText: string;
  cfiRange: string;
  chapter: string;
  timestamp: number;
}

interface NoteData {
  sessions: Session[];
  comments?: Comment[];
}

// Helper to decode bookId
function decodeBookId(bookId: string): string {
  const standardBase64 = bookId.replace(/-/g, '+').replace(/_/g, '/');
  const padded = standardBase64 + '=='.slice(0, (4 - standardBase64.length % 4) % 4);
  const decodedBookId = Buffer.from(padded, 'base64').toString('utf-8');
  return decodedBookId.replace(/\.epub$/, '');
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookId: string; htmlFile: string }> }
) {
  try {
    const { bookId, htmlFile } = await params;

    if (!bookId || !htmlFile) {
      return NextResponse.json(
        { error: 'Missing required parameters: bookId, htmlFile' },
        { status: 400 }
      );
    }

    const bookName = decodeBookId(bookId);
    const htmlFileName = path.basename(htmlFile);
    const bookNotesDir = path.join(process.cwd(), 'notes', bookName);
    const jsonFileName = htmlFileName.replace(/\.[^/.]+$/, '') + '.json';
    const jsonFilePath = path.join(bookNotesDir, jsonFileName);

    if (!fs.existsSync(jsonFilePath)) {
      return NextResponse.json({
        sessions: [],
        filePath: jsonFilePath,
      });
    }

    try {
      const content = fs.readFileSync(jsonFilePath, 'utf-8');
      // Check if it's old format (array) or new format (object with notes)
      let data: NoteData;
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          // Old format (array) - no sessions, convert to new format
          data = { sessions: [] };
        } else if (parsed.notes && parsed.sessions) {
          // Old format with both notes and sessions - extract notes to sessions
          const notes = parsed.notes || [];
          // Convert notes to a session if there are notes
          if (notes.length > 0 && (!parsed.sessions || parsed.sessions.length === 0)) {
            data = {
              sessions: [{
                id: 'default',
                title: '对话 1',
                selectedBlocks: notes.map((n: any) => ({
                  id: n.id,
                  content: n.content,
                  timestamp: n.timestamp,
                  cfiRange: n.cfiRange || '',
                })),
                messages: [],
                timestamp: Date.now(),
              }]
            };
          } else {
            data = { sessions: parsed.sessions || [] };
          }
        } else {
          data = parsed;
        }
      } catch {
        data = { sessions: [] };
      }
      return NextResponse.json({
        sessions: data.sessions || [],
        comments: data.comments || [],
        filePath: jsonFilePath,
      });
    } catch (e) {
      return NextResponse.json({
        sessions: [],
        comments: [],
        filePath: jsonFilePath,
      });
    }
  } catch (error) {
    console.error('Error getting notes:', error);
    return NextResponse.json(
      { error: 'Failed to get notes' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ bookId: string; htmlFile: string }> }
) {
  try {
    const { bookId, htmlFile } = await params;
    const { sessionId } = await request.json();

    if (!bookId || !htmlFile) {
      return NextResponse.json(
        { error: 'Missing required parameters: bookId, htmlFile' },
        { status: 400 }
      );
    }

    const bookName = decodeBookId(bookId);
    const htmlFileName = path.basename(htmlFile);
    const bookNotesDir = path.join(process.cwd(), 'notes', bookName);
    const jsonFileName = htmlFileName.replace(/\.[^/.]+$/, '') + '.json';
    const jsonFilePath = path.join(bookNotesDir, jsonFileName);

    if (!fs.existsSync(jsonFilePath)) {
      return NextResponse.json({ success: true });
    }

    try {
      const content = fs.readFileSync(jsonFilePath, 'utf-8');
      let data: NoteData;
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          data = { sessions: [] };
        } else {
          data = parsed;
        }
      } catch {
        data = { sessions: [] };
      }

      // Handle session deletion
      if (sessionId) {
        data.sessions = data.sessions.filter((session) => session.id !== sessionId);
      }

      fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2), 'utf-8');
      return NextResponse.json({ success: true });
    } catch (e) {
      return NextResponse.json(
        { error: 'Failed to process sessions' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error deleting session:', error);
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookId: string; htmlFile: string }> }
) {
  try {
    const { bookId, htmlFile } = await params;
    const body = await request.json();
    const { sessionId, title, selectedBlocks, messages, comments } = body;

    if (!bookId || !htmlFile) {
      return NextResponse.json(
        { error: 'Missing required parameters: bookId, htmlFile' },
        { status: 400 }
      );
    }

    const bookName = decodeBookId(bookId);
    const htmlFileName = path.basename(htmlFile);
    const bookNotesDir = path.join(process.cwd(), 'notes', bookName);

    // Create directory if it doesn't exist
    if (!fs.existsSync(bookNotesDir)) {
      fs.mkdirSync(bookNotesDir, { recursive: true });
    }

    const jsonFileName = htmlFileName.replace(/\.[^/.]+$/, '') + '.json';
    const jsonFilePath = path.join(bookNotesDir, jsonFileName);

    // Read existing data
    let data: NoteData = { sessions: [], comments: [] };
    if (fs.existsSync(jsonFilePath)) {
      try {
        const content = fs.readFileSync(jsonFilePath, 'utf-8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          data = { sessions: [], comments: [] };
        } else {
          data = parsed;
        }
      } catch {
        data = { sessions: [], comments: [] };
      }
    }

    // Initialize comments array if not present
    if (!data.comments) {
      data.comments = [];
    }

    // Update or create session
    if (sessionId) {
      const existingIndex = data.sessions.findIndex(s => s.id === sessionId);
      if (existingIndex >= 0) {
        // Update existing session
        data.sessions[existingIndex] = {
          ...data.sessions[existingIndex],
          selectedBlocks: selectedBlocks || data.sessions[existingIndex].selectedBlocks,
          messages: messages || data.sessions[existingIndex].messages,
          timestamp: Date.now(),
        };
      } else {
        // Create new session
        data.sessions.push({
          id: sessionId,
          title: title || `对话 ${data.sessions.length + 1}`,
          selectedBlocks: selectedBlocks || [],
          messages: messages || [],
          timestamp: Date.now(),
        });
      }
    }

    // Update comments if provided
    if (comments && Array.isArray(comments)) {
      data.comments = comments;
    }

    fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2), 'utf-8');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving session:', error);
    return NextResponse.json(
      { error: 'Failed to save session' },
      { status: 500 }
    );
  }
}
