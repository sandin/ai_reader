import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import fs from 'fs';
import path from 'path';

// Helper to decode bookId
function decodeBookId(bookId: string): string {
  const standardBase64 = bookId.replace(/-/g, '+').replace(/_/g, '/');
  const padded = standardBase64 + '=='.slice(0, (4 - standardBase64.length % 4) % 4);
  const decodedBookId = Buffer.from(padded, 'base64').toString('utf-8');
  return decodedBookId.replace(/\.epub$/, '');
}

/**
 * 根据聊天历史生成对话标题
 */
export async function POST(req: NextRequest) {
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

    // 从服务端读取会话数据
    const bookName = decodeBookId(bookId);
    const htmlFileName = path.basename(htmlFile);
    const bookNotesDir = path.join(process.cwd(), 'notes', bookName);
    const jsonFileName = htmlFileName.replace(/\.[^/.]+$/, '') + '.json';
    const jsonFilePath = path.join(bookNotesDir, jsonFileName);

    if (!fs.existsSync(jsonFilePath)) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const content = fs.readFileSync(jsonFilePath, 'utf-8');
    const data = JSON.parse(content);
    const session = data.sessions?.find((s: { id: string }) => s.id === sessionId);

    if (!session || !session.messages || session.messages.length === 0) {
      return NextResponse.json(
        { error: 'No messages in this session' },
        { status: 400 }
      );
    }

    // 只提取第一条用户消息用于生成标题
    const firstUserMessage = session.messages.find((msg: { role: string }) => msg.role === 'user');
    const conversationHistory = firstUserMessage
      ? firstUserMessage.blocks.map((b: { content: string }) => b.content).join('\n\n')
      : '';

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
