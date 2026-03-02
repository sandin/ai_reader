import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * 根据聊天历史生成对话标题
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { bookId, htmlFile, sessionId } = await req.json();

    const apiKey = process.env.DEEPSEEK_API_KEY;
    const modelName = process.env.LLM_MODEL || 'deepseek-chat';

    if (!apiKey) {
      return NextResponse.json(
        { error: 'DEEPSEEK_API_KEY is not configured' },
        { status: 500 }
      );
    }

    if (!bookId || !htmlFile || !sessionId) {
      return NextResponse.json(
        { error: 'Missing required parameters: bookId, htmlFile, sessionId' },
        { status: 400 }
      );
    }

    // Parse bookId as numeric ID
    const numericBookId = parseInt(bookId, 10);
    if (isNaN(numericBookId)) {
      return NextResponse.json({ error: 'Invalid book ID' }, { status: 400 });
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

    // 创建 LLM 实例
    const chat = new ChatOpenAI(modelName, {
      temperature: 0.3,
      maxTokens: 100,
      apiKey,
      configuration: {
        baseURL: 'https://api.deepseek.com',
      },
    });

    // 系统提示词
    const systemPrompt = `你是一个阅读助手。请根据用户的第一条提问，为这个对话生成一个简洁的中文标题（不超过20个字）。

要求：
1. 标题要能准确概括用户提问的主题
2. 使用简洁的中文
3. 不需要包含标点符号
4. 直接返回标题，不要有任何解释`;

    // 调用 LLM
    const result = await chat.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(`用户提问：\n\n${conversationHistory}`),
    ]);

    const title = result.content.toString().trim();

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
