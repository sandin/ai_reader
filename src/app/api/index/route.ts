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

// Get book name from bookId - supports both numeric ID and base64 encoded book key
async function getBookName(bookId: string): Promise<string | null> {
  const numericId = parseInt(bookId);
  if (!isNaN(numericId)) {
    // Query by numeric ID to get book_key
    const result = await query('SELECT book_key FROM books WHERE id = $1', [numericId]);
    if (result.rows.length === 0) return null;
    return result.rows[0].book_key;
  }
  // It's already a base64 encoded book key
  return decodeBookId(bookId);
}

interface TreeNode {
  chapter_id: string;
  chapter_name: string;
  contents: string[];
  children: TreeNode[];
}

interface ChapterIndex {
  tree: TreeNode[];
  htmlOrder: string[];
}

// GET: 获取书籍的章节索引
export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const bookId = searchParams.get('bookId');

    if (!bookId) {
      return NextResponse.json(
        { error: 'Missing required parameter: bookId' },
        { status: 400 }
      );
    }

    // Get book name from bookId (supports both numeric ID and base64 encoded)
    const bookName = await getBookName(bookId);
    if (!bookName) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // Index file path
    const notesDir = path.join(process.cwd(), 'data', 'notes', bookName);
    const indexFilePath = path.join(notesDir, 'index.json');

    if (!fs.existsSync(indexFilePath)) {
      return NextResponse.json({ tree: [], htmlOrder: [] });
    }

    try {
      const content = fs.readFileSync(indexFilePath, 'utf-8');
      const indexData = JSON.parse(content);
      return NextResponse.json(indexData);
    } catch (e) {
      return NextResponse.json({ tree: [], htmlOrder: [] });
    }
  } catch (error) {
    console.error('Error getting book index:', error);
    return NextResponse.json(
      { error: 'Failed to get book index' },
      { status: 500 }
    );
  }
}

// POST: 创建或更新书籍的章节索引
export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { bookId, tree, htmlOrder } = body;

    if (!bookId || !tree || !Array.isArray(tree)) {
      return NextResponse.json(
        { error: 'Missing required fields: bookId, tree (array)' },
        { status: 400 }
      );
    }

    // Get book name from bookId (supports both numeric ID and base64 encoded)
    const bookName = await getBookName(bookId);
    if (!bookName) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // Notes directory
    const notesDir = path.join(process.cwd(), 'data', 'notes', bookName);

    // Create directory if it doesn't exist
    if (!fs.existsSync(notesDir)) {
      fs.mkdirSync(notesDir, { recursive: true });
    }

    // Build index with tree structure and html order
    const index: ChapterIndex = {
      tree,
      htmlOrder: htmlOrder || [],
    };

    // Write index to file
    const indexFilePath = path.join(notesDir, 'index.json');
    fs.writeFileSync(indexFilePath, JSON.stringify(index, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      bookName,
      treeSize: tree.length,
      htmlOrderSize: htmlOrder?.length || 0,
    });
  } catch (error) {
    console.error('Error saving book index:', error);
    return NextResponse.json(
      { error: 'Failed to save book index' },
      { status: 500 }
    );
  }
}
