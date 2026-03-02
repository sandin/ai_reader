import { NextRequest, NextResponse } from 'next/server';
import { streamChat, parseUserMessage, classifyIntent, INTENT_PROMPTS, Intent } from '../agent';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// Get chat history from database
async function getChatHistory(sessionId: number): Promise<{ role: string; content: string }[]> {
  const messagesResult = await query(
    'SELECT role, message_content FROM chat_messages WHERE session_id = $1 ORDER BY id',
    [sessionId]
  );

  return messagesResult.rows.map((m: { role: string; message_content: string }) => ({
    role: m.role,
    content: m.message_content,
  }));
}

// Save user message to database
async function saveUserMessage(sessionId: number, content: string): Promise<number> {
  const now = Math.floor(Date.now());
  const result = await query(
    'INSERT INTO chat_messages (session_id, role, message_content, message_timestamp) VALUES ($1, $2, $3, $4) RETURNING id',
    [sessionId, 'user', content, now]
  );
  return result.rows[0].id;
}

// Save assistant message to database
async function saveAssistantMessage(sessionId: number, content: string): Promise<number> {
  const now = Math.floor(Date.now());
  const result = await query(
    'INSERT INTO chat_messages (session_id, role, message_content, message_timestamp) VALUES ($1, $2, $3, $4) RETURNING id',
    [sessionId, 'assistant', content, now]
  );
  return result.rows[0].id;
}

// Update session timestamp
async function updateSessionTimestamp(sessionId: number) {
  const now = Math.floor(Date.now());
  await query(
    'UPDATE chat_sessions SET updated_at = $1 WHERE id = $2',
    [now, sessionId]
  );
}

export async function POST(req: NextRequest) {
  let auth;
  try {
    auth = await requireAuth(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { sessionId, message, selectedText } = await req.json();

    if (!sessionId || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, message' },
        { status: 400 }
      );
    }

    const numericSessionId = parseInt(sessionId);
    if (isNaN(numericSessionId)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    const modelName = process.env.LLM_MODEL || 'deepseek-chat';

    if (!apiKey) {
      return NextResponse.json(
        { error: 'DEEPSEEK_API_KEY is not configured' },
        { status: 500 }
      );
    }

    // 从数据库获取历史消息（必须在保存当前消息之前）
    const history = await getChatHistory(numericSessionId);

    // 保存用户消息到数据库
    const userContent = selectedText
      ? `选中文本：\n${selectedText}\n\n用户输入：${message}`
      : message;
    await saveUserMessage(numericSessionId, userContent);
    await updateSessionTimestamp(numericSessionId);

    // 分类用户意图
    const intent: Intent = await classifyIntent(message, apiKey, modelName);

    // 根据意图选择 system prompt
    const systemPrompt = INTENT_PROMPTS[intent];

    // 使用流式响应
    const encoder = new TextEncoder();
    let fullAssistantContent = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 流式输出
          for await (const chunk of streamChat({
            message: userContent,
            history,
            apiKey,
            modelName,
            systemPrompt,
          })) {
            if (chunk.content) {
              fullAssistantContent += chunk.content;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk.content })}\n\n`));
            }
          }

          // 流式结束后保存AI消息到数据库
          if (fullAssistantContent) {
            await saveAssistantMessage(numericSessionId, fullAssistantContent);
            await updateSessionTimestamp(numericSessionId);
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Error in stream:', error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error calling LLM:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Failed to get response from LLM', details: errorMessage },
      { status: 500 }
    );
  }
}
