import { NextRequest, NextResponse } from 'next/server';
import { generateTitle } from '@/lib/ai';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * 根据聊天历史生成对话标题
 * 使用 fastModel 生成标题
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { bookId, htmlFile, sessionId, fastModelId } = await req.json();

    if (!bookId || !htmlFile || !sessionId || !fastModelId) {
      return NextResponse.json(
        { error: 'Missing required parameters: bookId, htmlFile, sessionId, fastModelId' },
        { status: 400 }
      );
    }

    // Parse sessionId as numeric ID
    const numericSessionId = parseInt(sessionId, 10);
    if (isNaN(numericSessionId)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    // Get messages from database
    const messagesResult = await query(
      'SELECT role, message_content FROM chat_messages WHERE session_id = $1 ORDER BY id',
      [numericSessionId]
    );

    if (messagesResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'No messages in this session' },
        { status: 400 }
      );
    }

    // Find first user message
    const firstUserMessage = messagesResult.rows.find((msg: { role: string }) => msg.role === 'user');
    const conversationHistory = firstUserMessage?.message_content || '';

    if (!conversationHistory) {
      return NextResponse.json(
        { error: 'No user message found in this session' },
        { status: 400 }
      );
    }

    // 生成标题
    const title = await generateTitle(fastModelId, conversationHistory);

    return NextResponse.json({ title });
  } catch (error) {
    console.error('Error generating title:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Failed to generate title', details: errorMessage },
      { status: 500 }
    );
  }
}
