import { NextRequest, NextResponse } from 'next/server';
import { streamChat } from '../agent';

export async function POST(req: NextRequest) {
  try {
    const { content, highlights } = await req.json();

    const apiKey = process.env.DEEPSEEK_API_KEY;
    const modelName = process.env.LLM_MODEL || 'deepseek-chat';

    if (!apiKey) {
      return NextResponse.json(
        { error: 'DEEPSEEK_API_KEY is not configured' },
        { status: 500 }
      );
    }

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    // 构建压缩提示词
    const highlightText = highlights && highlights.length > 0
      ? `\n\n用户重点关注的内容：\n${highlights.join('\n')}`
      : '';

    const prompt = `请对以下文本进行压缩精简，缩短篇幅，保留核心内容。重点关注用户选中的相关内容。${highlightText}

原文：
${content}

请直接输出压缩后的内容，不需要任何额外说明或格式。`;

    // 使用流式响应
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamChat({
            message: prompt,
            apiKey,
            modelName,
            temperature: 0.3,
            maxTokens: 4096,
          })) {
            if (chunk.content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk.content })}\n\n`));
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Error in compress stream:', error);
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
    console.error('Error compressing content:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Failed to compress content', details: errorMessage },
      { status: 500 }
    );
  }
}
