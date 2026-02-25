import { NextRequest, NextResponse } from 'next/server';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, BaseMessage, SystemMessage } from '@langchain/core/messages';

// 动态导入 LangChainTracer
let LangChainTracer: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-require
  LangChainTracer = require('@langchain/core/tracers').LangChainTracer;
} catch (e) {
  console.warn('LangChainTracer not available:', e);
}

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

    // 构建系统提示词
    const systemPrompt = `你是一个阅读助手，专门帮助用户理解和分析电子书中的内容。请根据用户提供的选中文本回答问题。

用户可能会：
1. 询问关于选中文本的理解
2. 让您解释某个概念
3. 让您总结某些内容
4. 提出与文本相关的问题

请根据提供的文本内容给出准确、有帮助的回答。`;

    // 用户消息已经包含选中的文字（在前端处理）
    const userContent = message;

    // 创建 LangChain tracer 用于 LangSmith 追踪
    const callbacks: any[] = [];

    if (LangChainTracer && process.env.LANGSMITH_API_KEY) {
      const tracer = new LangChainTracer({
        projectName: process.env.LANGCHAIN_PROJECT || 'ai-reader',
      });
      callbacks.push(tracer);
    }

    // 使用 langchain 调用 LLM
    const chat = new ChatOpenAI(modelName, {
      temperature: 0.7,
      maxTokens: 2000,
      apiKey: apiKey,
      configuration: {
        baseURL: 'https://api.deepseek.com',
      },
    });

    // 构建消息数组 - 使用 LangChain 消息类
    const messages: BaseMessage[] = [
      new SystemMessage(systemPrompt),
    ];

    // 添加历史消息（按顺序：user -> assistant -> user -> assistant...）
    if (history && history.length > 0) {
      history.forEach((msg: { role: string; content: string }) => {
        if (msg.role === 'user') {
          messages.push(new HumanMessage(msg.content));
        } else if (msg.role === 'assistant') {
          messages.push(new AIMessage(msg.content));
        }
      });
    }

    // 添加当前用户消息
    messages.push(new HumanMessage(userContent));

    // 使用流式响应
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 使用 stream 方法进行流式输出
          const streamIterable = await chat.stream(messages, { callbacks });

          for await (const chunk of streamIterable) {
            const content = chunk.content;
            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
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
