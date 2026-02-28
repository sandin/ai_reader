import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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
    const body = await request.json();
    const { bookId, tree, htmlOrder } = body;

    if (!bookId || !tree || !Array.isArray(tree)) {
      return NextResponse.json(
        { error: 'Missing required fields: bookId, tree (array)' },
        { status: 400 }
      );
    }

    // Decode bookId from URL-safe base64 to original book name
    const standardBase64 = bookId.replace(/-/g, '+').replace(/_/g, '/');
    const padded = standardBase64 + '=='.slice(0, (4 - standardBase64.length % 4) % 4);
    const decodedBookId = Buffer.from(padded, 'base64').toString('utf-8');
    const bookName = decodedBookId.replace(/\.epub$/, '');

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
