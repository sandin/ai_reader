import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';

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

    // Parse bookId as numeric ID
    const numericBookId = parseInt(bookId, 10);
    if (isNaN(numericBookId)) {
      return NextResponse.json({ error: 'Invalid book ID' }, { status: 400 });
    }

    // Get index_data from database
    const result = await query('SELECT index_data FROM books WHERE id = $1', [numericBookId]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    const indexData = result.rows[0].index_data;
    if (!indexData) {
      return NextResponse.json({ tree: [], htmlOrder: [] });
    }

    return NextResponse.json(indexData);
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

    // Parse bookId as numeric ID
    const numericBookId = parseInt(bookId, 10);
    if (isNaN(numericBookId)) {
      return NextResponse.json({ error: 'Invalid book ID' }, { status: 400 });
    }

    // Build index object
    const indexData = {
      tree,
      htmlOrder: htmlOrder || [],
    };

    // Save to database
    await query(
      'UPDATE books SET index_data = $1 WHERE id = $2',
      [JSON.stringify(indexData), numericBookId]
    );

    return NextResponse.json({
      success: true,
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
