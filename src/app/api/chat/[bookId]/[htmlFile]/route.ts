import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authenticateRequest, requireAuth } from '@/lib/auth';
import { syncMessageToVectorStore, deleteMessageFromVectorStore } from '@/app/api/agent';

// GET: 获取会话（按章节过滤）
export async function GET(
  request: Request,
  { params }: { params: Promise<{ bookId: string; htmlFile: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized', sessions: [] }, { status: 401 });
    }

    const { bookId, htmlFile } = await params;
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!bookId || !htmlFile) {
      return NextResponse.json(
        { error: 'Missing required parameters: bookId, htmlFile', sessions: [] },
        { status: 400 }
      );
    }

    const chapterFile = htmlFile.split('/').pop() || htmlFile;

    // Parse bookId as numeric ID
    const numericBookId = parseInt(bookId, 10);
    if (isNaN(numericBookId)) {
      return NextResponse.json({ error: 'Invalid book ID', sessions: [] }, { status: 400 });
    }

    // Check if book exists
    const bookResult = await query('SELECT id FROM books WHERE id = $1', [numericBookId]);
    if (bookResult.rows.length === 0) {
      return NextResponse.json({ sessions: [] });
    }

    // Get chat sessions filtered by chapter_file
    let sessionsQuery = `SELECT id, chapter_file, session_title, created_at, updated_at
       FROM chat_sessions
       WHERE book_id = $1 AND chapter_file = $2`;
    const queryParams: any[] = [numericBookId, chapterFile];

    if (sessionId) {
      const numericSessionId = parseInt(sessionId);
      if (!isNaN(numericSessionId)) {
        sessionsQuery += ` AND id = $3`;
        queryParams.push(numericSessionId);
      }
    }

    sessionsQuery += ` ORDER BY created_at DESC`;

    const sessionsResult = await query(sessionsQuery, queryParams);

    const sessions = await Promise.all(
      sessionsResult.rows.map(async (session: { id: number; session_title: string; created_at: number; updated_at: number }) => {
        // Get selected blocks
        const blocksResult = await query(
          'SELECT id, block_content, cfi_range, block_timestamp FROM selected_blocks WHERE session_id = $1 ORDER BY id',
          [session.id]
        );

        // Get messages
        const messagesResult = await query(
          'SELECT id, role, message_content, message_timestamp FROM chat_messages WHERE session_id = $1 ORDER BY id',
          [session.id]
        );

        return {
          id: session.id,
          title: session.session_title || '对话',
          selectedBlocks: blocksResult.rows.map((b: { id: number; block_content: string; cfi_range: string; block_timestamp: number }) => ({
            id: b.id,
            content: b.block_content,
            cfiRange: b.cfi_range,
            timestamp: b.block_timestamp,
          })),
          messages: messagesResult.rows.map((m: { id: number; role: string; message_content: string; message_timestamp: number }) => ({
            id: m.id,
            role: m.role,
            content: m.message_content || '',
            timestamp: m.message_timestamp,
          })),
          timestamp: session.updated_at,
          created_at: session.created_at,
        };
      })
    );

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Error getting sessions:', error);
    return NextResponse.json({ sessions: [] });
  }
}

// DELETE: 删除会话或删除消息
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ bookId: string; htmlFile: string }> }
) {
  let auth: { userId: number; username: string; schema: string };
  try {
    auth = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { bookId } = await params;

    // Support both query params and JSON body for DELETE
    let sessionId: string | null = null;
    let messageId: string | null = null;

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const body = await request.json();
        sessionId = body.sessionId?.toString() || null;
        messageId = body.messageId?.toString() || null;
      } catch {
        // Ignore parse errors, fall back to query params
      }
    }

    if (!sessionId && !messageId) {
      const { searchParams } = new URL(request.url);
      sessionId = searchParams.get('sessionId');
      messageId = searchParams.get('messageId');
    }

    if (!bookId) {
      return NextResponse.json({ error: 'Missing required parameter: bookId' }, { status: 400 });
    }

    // Parse bookId as numeric ID
    const numericBookId = parseInt(bookId, 10);
    if (isNaN(numericBookId)) {
      return NextResponse.json({ error: 'Invalid book ID' }, { status: 400 });
    }

    // Check if book exists
    const bookResult = await query('SELECT id FROM books WHERE id = $1', [numericBookId]);
    if (bookResult.rows.length === 0) {
      return NextResponse.json({ success: true });
    }

    // Delete single message
    if (messageId) {
      const numericMessageId = parseInt(messageId, 10);
      if (!isNaN(numericMessageId)) {
        // Get session_id before deleting
        const msgResult = await query('SELECT session_id FROM chat_messages WHERE id = $1', [numericMessageId]);
        const sessionIdVal = msgResult.rows[0]?.session_id;

        await query('DELETE FROM chat_messages WHERE id = $1', [numericMessageId]);

        // Delete from vector store
        if (sessionIdVal) {
          try {
            await deleteMessageFromVectorStore(sessionIdVal, numericMessageId, auth.userId);
          } catch (e) {
            console.error('Failed to delete message from vector store:', e);
          }
        }
      }
      return NextResponse.json({ success: true });
    }

    // Delete session
    if (sessionId) {
      const numericSessionId = parseInt(sessionId);
      if (!isNaN(numericSessionId)) {
        // Delete all messages from vector store first
        try {
          const msgResult = await query('SELECT id FROM chat_messages WHERE session_id = $1', [numericSessionId]);
          for (const msg of msgResult.rows) {
            await deleteMessageFromVectorStore(numericSessionId, msg.id, auth.userId);
          }
        } catch (e) {
          console.error('Failed to delete messages from vector store:', e);
        }

        await query('DELETE FROM chat_sessions WHERE id = $1', [numericSessionId]);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting session:', error);
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
}

// POST: 创建或更新会话
export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookId: string; htmlFile: string }> }
) {
  let auth: { userId: number; username: string; schema: string };
  try {
    auth = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { bookId, htmlFile } = await params;
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Failed to parse JSON body:', parseError);
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { action, sessionId, title, selectedBlocks, messages } = body;

    if (!bookId || !htmlFile) {
      return NextResponse.json({ error: 'Missing required parameters: bookId, htmlFile' }, { status: 400 });
    }

    const chapterFile = htmlFile.split('/').pop() || htmlFile;

    // Parse bookId as numeric ID
    const numericBookId = parseInt(bookId, 10);
    if (isNaN(numericBookId)) {
      return NextResponse.json({ error: 'Invalid book ID' }, { status: 400 });
    }

    // Check if book exists
    const bookResult = await query('SELECT id FROM books WHERE id = $1', [numericBookId]);
    if (bookResult.rows.length === 0) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // 创建新会话
    if (action === 'create') {
      const now = Math.floor(Date.now());
      const newSession = await query(
        'INSERT INTO chat_sessions (book_id, chapter_file, session_title, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [numericBookId, chapterFile, title || `对话`, now, now]
      );
      const newSessionId = newSession.rows[0].id;

      // 如果有初始选中的blocks，保存它们
      if (selectedBlocks && Array.isArray(selectedBlocks)) {
        for (const block of selectedBlocks) {
          await query(
            'INSERT INTO selected_blocks (session_id, block_content, cfi_range, block_timestamp) VALUES ($1, $2, $3, $4)',
            [newSessionId, block.content, block.cfiRange || '', block.timestamp || now]
          );
        }
      }

      // 获取完整的新会话信息
      const blocksResult = await query(
        'SELECT id, block_content, cfi_range, block_timestamp FROM selected_blocks WHERE session_id = $1 ORDER BY id',
        [newSessionId]
      );

      return NextResponse.json({
        session: {
          id: newSessionId,
          title: title || `对话`,
          selectedBlocks: blocksResult.rows.map((b: { id: number; block_content: string; cfi_range: string; block_timestamp: number }) => ({
            id: b.id,
            content: b.block_content,
            cfiRange: b.cfi_range,
            timestamp: b.block_timestamp,
          })),
          messages: [],
          timestamp: now,
          created_at: now,
        }
      });
    }

    const now = Math.floor(Date.now());
    let dbSessionId: number | null = null;

    // Handle session - only if there's session data
    const hasSessionData = sessionId || (selectedBlocks && selectedBlocks.length > 0) || (messages && messages.length > 0);

    if (sessionId) {
      const numericSessionId = parseInt(sessionId);
      if (isNaN(numericSessionId)) {
        return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
      }

      let existingSession;
      try {
        existingSession = await query('SELECT id FROM chat_sessions WHERE id = $1', [numericSessionId]);
      } catch (dbError) {
        console.error('Database error checking session:', dbError);
        return NextResponse.json({ error: 'Database error: ' + String(dbError) }, { status: 500 });
      }

      if (existingSession.rows.length > 0) {
        dbSessionId = numericSessionId;
        await query(
          'UPDATE chat_sessions SET session_title = $1, updated_at = $2 WHERE id = $3',
          [title || '对话', now, dbSessionId]
        );

        await query('DELETE FROM selected_blocks WHERE session_id = $1', [dbSessionId]);
        await query('DELETE FROM chat_messages WHERE session_id = $1', [dbSessionId]);
      } else {
        const newSession = await query(
          'INSERT INTO chat_sessions (book_id, chapter_file, session_title, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) RETURNING id',
          [numericBookId, chapterFile, title || `对话`, now, now]
        );
        dbSessionId = newSession.rows[0].id;
      }
    } else if (hasSessionData) {
      const newSession = await query(
        'INSERT INTO chat_sessions (book_id, chapter_file, session_title, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [numericBookId, chapterFile, title || `对话`, now, now]
      );
      dbSessionId = newSession.rows[0].id;
    }

    // Insert selected blocks
    if (dbSessionId && selectedBlocks && Array.isArray(selectedBlocks)) {
      for (const block of selectedBlocks) {
        await query(
          'INSERT INTO selected_blocks (session_id, block_content, cfi_range, block_timestamp) VALUES ($1, $2, $3, $4)',
          [dbSessionId, block.content, block.cfiRange || '', block.timestamp || now]
        );
      }
    }

    // Insert messages
    if (dbSessionId && messages && Array.isArray(messages)) {
      for (const msg of messages) {
        const result = await query(
          'INSERT INTO chat_messages (session_id, role, message_content, message_timestamp) VALUES ($1, $2, $3, $4) RETURNING id',
          [dbSessionId, msg.role, msg.content || '', msg.timestamp || now]
        );
        const messageId = result.rows[0].id;

        // 同步到向量数据库
        if (msg.content && msg.role === 'assistant') {
          try {
            await syncMessageToVectorStore(
              dbSessionId,
              messageId,
              msg.content,
              auth.userId,
              numericBookId,
              chapterFile
            );
          } catch (e) {
            console.error('Failed to sync message to vector store:', e);
          }
        }
      }
    }

    return NextResponse.json({ success: true, sessionId: dbSessionId });
  } catch (error) {
    console.error('Error saving session:', error);
    return NextResponse.json({ error: 'Failed to save session' }, { status: 500 });
  }
}

// PUT: 更新消息内容
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ bookId: string; htmlFile: string }> }
) {
  try {
    await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { bookId } = await params;
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { messageId, content } = body;

    if (!bookId) {
      return NextResponse.json({ error: 'Missing required parameter: bookId' }, { status: 400 });
    }

    if (!messageId) {
      return NextResponse.json({ error: 'Missing required parameter: messageId' }, { status: 400 });
    }

    // Parse IDs as numeric
    const numericBookId = parseInt(bookId, 10);
    if (isNaN(numericBookId)) {
      return NextResponse.json({ error: 'Invalid book ID' }, { status: 400 });
    }

    const numericMessageId = parseInt(messageId, 10);
    if (isNaN(numericMessageId)) {
      return NextResponse.json({ error: 'Invalid message ID' }, { status: 400 });
    }

    // Check if book exists
    const bookResult = await query('SELECT id FROM books WHERE id = $1', [numericBookId]);
    if (bookResult.rows.length === 0) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    // Update message
    await query(
      'UPDATE chat_messages SET message_content = $1 WHERE id = $2',
      [content || '', numericMessageId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating message:', error);
    return NextResponse.json({ error: 'Failed to update message' }, { status: 500 });
  }
}
