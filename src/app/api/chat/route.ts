import { NextRequest, NextResponse } from 'next/server';
import { streamChat, parseUserMessage, classifyIntent, INTENT_PROMPTS, Intent } from '../agent';

export async function POST(req: NextRequest) {
  try {
    const { message, history } = await req.json();

    const apiKey = process.env.DEEPSEEK_API_KEY;
    const modelName = process.env.LLM_MODEL || 'deepseek-chat';

    if (!apiKey) {
      return NextResponse.json(
        { error: 'DEEPSEEK_API_KEY is not configured' },
        { status: 500 }
      );
    }

    // 解析用户消息
    const { selectedText, input } = parseUserMessage(message);

    // 分类用户意图
    const intent: Intent = await classifyIntent(input, apiKey, modelName);

    // 根据意图选择 system prompt
    const systemPrompt = INTENT_PROMPTS[intent];

    // 构建完整的消息内容
    const userContent = selectedText
      ? `选中文本：\n${selectedText}\n\n用户输入：${input}`
      : input;

    // 使用流式响应
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 使用 agent 模块进行流式输出，传入 systemPrompt
          for await (const chunk of streamChat({
            message: userContent,
            history,
            apiKey,
            modelName,
            systemPrompt,
          })) {
            if (chunk.content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk.content })}\n\n`));
            }
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
