import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, BaseMessage, SystemMessage } from '@langchain/core/messages';
import type { ChatOptions, StreamChunk, Intent, ChatMessage } from './types';
import { INTENT_TEMPERATURES, TITLE_PROMPT, buildCompressPrompt } from './prompts';
import { getModelConfigById } from './config';

// 动态导入 LangChainTracer
let LangChainTracer: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-require
  LangChainTracer = require('@langchain/core/tracers/tracer_langchain').LangChainTracer;
} catch (e) {
  console.warn('LangChainTracer not available:', e);
}

/**
 * 获取任务对应的 temperature，使用 INTENT_TEMPERATURES 配置
 */
export function getTemperature(taskType: 'default' | 'summarize' | 'translate' | 'mindmap' | 'title' | 'compress'): number {
  // title 和 compress 使用默认的 0.7
  if (taskType === 'title' || taskType === 'compress') {
    return 0.7;
  }
  // default 使用 1.3 (通用的对话温度)
  if (taskType === 'default') {
    return INTENT_TEMPERATURES.other;
  }
  // summarize, translate, mindmap 使用 INTENT_TEMPERATURES
  return INTENT_TEMPERATURES[taskType] ?? 0.7;
}

/**
 * 创建 LangChain tracer 用于 LangSmith 追踪
 */
function createTracer() {
  if (LangChainTracer && process.env.LANGSMITH_API_KEY) {
    return new LangChainTracer({
      projectName: process.env.LANGCHAIN_PROJECT || 'ai-reader',
    });
  }
  return null;
}

/**
 * 构建系统提示词
 */
function buildSystemPrompt(): string {
  return `你是一个阅读助手，专门帮助用户理解和分析电子书中的内容。请根据用户提供的选中文本回答问题。

用户可能会：
1. 询问关于选中文本的理解
2. 让您解释某个概念
3. 让您总结某些内容
4. 提出与文本相关的问题

请根据提供的文本内容给出准确、有帮助的回答。`;
}

/**
 * 构建消息数组
 */
function buildMessages(history?: ChatMessage[], userMessage?: string, systemPrompt?: string): BaseMessage[] {
  const messages: BaseMessage[] = [
    new SystemMessage(systemPrompt || buildSystemPrompt()),
  ];

  // 添加历史消息
  if (history && history.length > 0) {
    history.forEach((msg) => {
      if (msg.role === 'user') {
        messages.push(new HumanMessage(msg.content));
      } else if (msg.role === 'assistant') {
        messages.push(new AIMessage(msg.content));
      }
    });
  }

  // 添加当前用户消息
  if (userMessage) {
    messages.push(new HumanMessage(userMessage));
  }

  return messages;
}

/**
 * 创建 ChatOpenAI 实例
 * @param apiKey API 密钥
 * @param modelId 模型 ID (格式: Provider/ModelName)
 * @param temperature 温度参数
 * @param maxTokens 最大 token 数
 */
function createChatModel(apiKey: string, modelId: string, temperature?: number, maxTokens?: number): ChatOpenAI {
  // 必须提供模型 ID
  if (!modelId) {
    throw new Error('Model ID is required');
  }

  // 根据 modelId 获取模型配置
  const modelConfig = getModelConfigById(modelId);
  if (!modelConfig) {
    throw new Error(`Model ${modelId} not found in configuration`);
  }

  // 构建选项
  const options: {
    temperature: number;
    maxTokens?: number;
    apiKey: string;
    configuration: {
      baseURL: string;
    };
  } = {
    temperature: temperature ?? 0.7,
    apiKey,
    configuration: {
      baseURL: modelConfig.baseURL,
    },
  };

  // 如果 maxTokens 为 0 或未设置，使用配置中的值（仅当 maxTokens 参数未传递时）
  if (maxTokens !== undefined) {
    // 如果显式传递了 maxTokens，使用传递的值（0 也是有效值，表示不限制）
    if (maxTokens > 0) {
      options.maxTokens = maxTokens;
    }
  } else if (modelConfig.maxTokens > 0) {
    // 如果没有传递 maxTokens 但配置中有值，使用配置值
    options.maxTokens = modelConfig.maxTokens;
  }

  // 使用 modelName 而不是 modelId 来创建模型
  return new ChatOpenAI(modelConfig.modelName, options);
}

/**
 * 解析用户消息，提取选中文本和用户输入
 */
export function parseUserMessage(rawMessage: string): { selectedText: string | null; input: string } {
  const selectedTextPrefix = '选中文本：';
  const userInputPrefix = '用户输入：';

  if (rawMessage.startsWith(selectedTextPrefix)) {
    const userInputStart = rawMessage.indexOf(userInputPrefix);
    if (userInputStart !== -1) {
      const selectedText = rawMessage.substring(selectedTextPrefix.length, userInputStart).trim();
      const input = rawMessage.substring(userInputStart + userInputPrefix.length).trim();
      return { selectedText, input };
    }
  }

  return { selectedText: null, input: rawMessage };
}

/**
 * 分类用户意图 - 使用 JSON 模式
 * 使用 fastModel 进行意图分类
 */
export async function classifyIntent(input: string, apiKey: string, fastModel: string): Promise<Intent> {
  // 使用 fastModel 进行意图分类
  const jsonChat = createChatModel(apiKey, fastModel, 0.3, 100);

  // 构造提示词，要求返回 JSON
  const prompt = `Analyze the user's intent and return JSON.
Rules:
- If user wants to summarize, summarize, or extract core ideas, return "summarize"
- If user wants to translate to another language, return "translate"
- If user wants to create a mind map, mindmap, or generate mind map, return "mindmap"
- For all other cases, return "other"

Only return JSON in this format: {"intent": "summarize|translate|mindmap|other"}`;

  const response = await jsonChat.invoke([
    new SystemMessage(prompt),
    new HumanMessage(input),
  ], {
    response_format: { type: 'json_object' },
  });

  // 解析 JSON 响应
  try {
    const content = response.content as string;
    const parsed = JSON.parse(content);
    const intent = parsed.intent;
    if (intent === 'summarize' || intent === 'translate' || intent === 'mindmap' || intent === 'other') {
      return intent;
    }
    return 'other';
  } catch {
    // 解析失败，默认返回 other
    return 'other';
  }
}

/**
 * 根据选中文本和用户输入构建消息内容
 */
export function buildUserContent(selectedText: string | null, input: string): string {
  if (selectedText) {
    return `选中文本：\n${selectedText}\n\n用户输入：${input}`;
  }
  return input;
}

/**
 * 流式调用 LLM 并返回可迭代对象
 */
export async function* streamChat(options: ChatOptions): AsyncGenerator<StreamChunk> {
  const { message, history, apiKey, modelName, temperature, maxTokens, systemPrompt } = options;

  // 创建 tracer
  const callbacks = [];
  const tracer = createTracer();
  if (tracer) {
    callbacks.push(tracer);
  }

  // 创建聊天模型
  const chat = createChatModel(apiKey, modelName, temperature, maxTokens);

  // 构建消息
  const messages = buildMessages(history, message, systemPrompt);

  // 流式输出
  const streamIterable = await chat.stream(messages, { callbacks });

  for await (const chunk of streamIterable) {
    const content = chunk.content;
    if (content && typeof content === 'string') {
      yield { content };
    }
  }
}

/**
 * 非流式调用 LLM
 */
export async function chat(options: ChatOptions): Promise<string> {
  const { message, history, apiKey, modelName, temperature, maxTokens, systemPrompt } = options;

  // 创建 tracer
  const callbacks = [];
  const tracer = createTracer();
  if (tracer) {
    callbacks.push(tracer);
  }

  // 创建聊天模型
  const chat = createChatModel(apiKey, modelName, temperature, maxTokens);

  // 构建消息
  const messages = buildMessages(history, message, systemPrompt);

  // 调用 LLM
  const response = await chat.invoke(messages, { callbacks });

  return response.content as string;
}

/**
 * 流式压缩文本
 * @param modelId 模型 ID (格式: Provider/ModelName)
 * @param content 要压缩的文本
 * @param highlights 用户重点关注的内容
 */
export async function* streamCompress(modelId: string, content: string, highlights?: string[]): AsyncGenerator<StreamChunk> {
  // 从模型配置中获取 API key 和配置
  const modelConfig = getModelConfigById(modelId);
  if (!modelConfig) {
    yield { error: `Model ${modelId} not found in configuration` };
    return;
  }

  const apiKey = modelConfig.appKey;
  if (!apiKey) {
    yield { error: 'API key not configured for this model' };
    return;
  }

  // 构建压缩提示词
  const prompt = buildCompressPrompt(content, highlights);

  // 流式输出，使用模型配置中的 maxTokens 和 temperature
  for await (const chunk of streamChat({
    message: prompt,
    apiKey,
    modelName: modelId,
    temperature: getTemperature('compress'),
    maxTokens: modelConfig.maxTokens || undefined,
  })) {
    yield chunk;
  }
}

/**
 * 生成对话标题
 * @param modelId 模型 ID (格式: Provider/ModelName)
 * @param conversationHistory 对话历史（用户的第一条消息）
 */
export async function generateTitle(modelId: string, conversationHistory: string): Promise<string> {
  // 从模型配置中获取 API key 和配置
  const modelConfig = getModelConfigById(modelId);
  if (!modelConfig) {
    throw new Error(`Model ${modelId} not found in configuration`);
  }

  const apiKey = modelConfig.appKey;
  if (!apiKey) {
    throw new Error('API key not configured for this model');
  }

  // 创建聊天模型，使用模型配置中的 temperature
  const chat = createChatModel(apiKey, modelId, getTemperature('title'), 100);

  // 调用 LLM
  const response = await chat.invoke([
    new SystemMessage(TITLE_PROMPT),
    new HumanMessage(`用户提问：\n\n${conversationHistory}`),
  ]);

  return response.content as string;
}
