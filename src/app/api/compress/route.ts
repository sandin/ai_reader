import { NextRequest, NextResponse } from 'next/server';
import { streamCompress } from '../agent';

export async function POST(req: NextRequest) {
  try {
    const { content, highlights, modelId } = await req.json();

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    if (!modelId) {
      return NextResponse.json(
        { error: 'Model ID is required' },
        { status: 400 }
      );
    }

    // 使用流式响应
    const encoder = new TextEncoder();
    let hasError = false;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamCompress(modelId, content, highlights)) {
            if (chunk.error) {
              hasError = true;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: chunk.error })}\n\n`));
            } else if (chunk.content) {
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
