import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, BaseMessage, SystemMessage } from '@langchain/core/messages';
import * as fs from 'fs';
import * as path from 'path';

// 动态导入 LangChainTracer
let LangChainTracer: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-require
  LangChainTracer = require('@langchain/core/tracers').LangChainTracer;
} catch (e) {
  console.warn('LangChainTracer not available:', e);
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  message: string;
  history?: ChatMessage[];
  apiKey: string;
  modelName: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface StreamChunk {
  content?: string;
  error?: string;
}

// 意图类型
export type Intent = 'summarize' | 'translate' | 'mindmap' | 'other';

// 意图对应的 system prompts
export const INTENT_PROMPTS: Record<Intent, string> = {
  summarize: `总结用户提供的文本的内容。

首先将文章按照语义拆分为更小的段落(subject)，每个段落有1个主要中心思想/观点/故事。

每个subject按照下面的格式展示：
观点：一句话总结
详细：展开一段话总结
论证：

因为A，所以B
因为B，所以C
因此得证观点：XXX 或者用文中的例子进行论证。`,
  translate: `请将用户提供的文本内容进行中英文对照翻译，并严格遵循以下要求：

逐句处理：以句号、问号、感叹号等完整句子分隔符为单位，将原文拆分为独立句子进行翻译。
对照格式：每句话按"英文原文 换行 中文翻译"的格式呈现，确保双语对齐清晰。
保留原意：翻译需准确传达原文语义，避免过度意译或漏译，专业术语需统一。

特殊处理：
若原文为中英文混合内容，仅翻译非母语部分（如中文原文中的英文词汇保留不译）
保留数字、符号、专有名词（如人名、品牌名）原格式

输出示例：
The weather is lovely today.
今天天气真好。

How can I help you?
需要我帮忙吗？

响应规则
若输入为文档，请直接输出对照翻译结果
若输入仅含单语内容，按句子分段翻译
若输入格式混乱，先进行句子规范化再翻译
请确认要求后，回复"请提供需要翻译的内容"以开始流程。`,
  mindmap: `根据用户的要求，使用 mermaid 生成 mindmap.

要求：
* 中文内容使用双引号包裹，例如: "中文内容"
* 内容中不能使用的符号: ( )
* 只返回 mermaid 的内容(markdown格式), 不要返回其他AI回答的文字内容`
,
  other: `你是一个阅读助手，专门帮助用户理解和分析电子书中的内容，回答用户的问题。`,
};

// 意图对应的 temperature 值
// ref: https://api-docs.deepseek.com/zh-cn/quick_start/parameter_settings
// temperature 参数默认为 1.0。
// 场景	温度
// 代码生成/数学解题   	0.0
// 数据抽取/分析	1.0
// 通用对话	1.3
// 翻译	1.3
// 创意类写作/诗歌创作	1.5
export const INTENT_TEMPERATURES: Record<Intent, number> = {
  summarize: 1.0,
  translate: 1.3,
  mindmap: 1.3,
  other: 1.3,
};

// 生成对话标题的 prompt
export const TITLE_PROMPT = `你是一个阅读助手。请根据用户的第一条提问，为这个对话生成一个简洁的中文标题（不超过20个字）。

要求：
1. 标题要能准确概括用户提问的主题
2. 使用简洁的中文
3. 不需要包含标点符号
4. 直接返回标题，不要有任何解释`;

// 压缩文本的 prompt 模板
export function buildCompressPrompt(content: string, highlights?: string[]): string {
  const highlightText = highlights && highlights.length > 0
    ? `\n\n用户重点关注的内容：\n${highlights.join('\n')}`
    : '';

  return `请对以下文本进行压缩精简，缩短篇幅，保留核心内容。重点关注用户选中的相关内容。${highlightText}

原文：
${content}

请直接输出压缩后的内容，不需要任何额外说明或格式。`;
}

// 模型配置接口
interface AIModelConfig {
  modelName: string;
  maxTokens: number;
  baseURL: string;
  appKey: string;
}

// 获取任务对应的 temperature，使用 INTENT_TEMPERATURES 配置
function getTemperature(taskType: 'default' | 'summarize' | 'translate' | 'mindmap' | 'title' | 'compress'): number {
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

interface AIProvider {
  name: string;
  providerType: string;
  models: AIModelConfig[];
}

interface ModelsConfig {
  providers: AIProvider[];
}

// 缓存模型配置
let cachedModelsConfig: ModelsConfig | null = null;

/**
 * 加载模型配置
 */
function loadModelsConfig(): ModelsConfig {
  if (cachedModelsConfig) {
    return cachedModelsConfig;
  }

  const configPath = path.join(process.cwd(), 'models.json');
  const configData = fs.readFileSync(configPath, 'utf-8');
  cachedModelsConfig = JSON.parse(configData);
  return cachedModelsConfig!;
}

/**
 * 根据 model id (Provider/ModelName 格式) 获取模型配置
 * 支持两种格式：
 * 1. "Provider/ModelName" (如 "deepseek/deepseek-chat")
 * 2. "Provider/SubProvider/ModelName" (如 "ZenMux/openai/gpt-5.2-pro")
 * 第一个 / 前面是 providerName，后面都是 modelName
 */
export function getModelConfigById(modelId: string): AIModelConfig | null {
  // 解析 model id: 第一个 / 前面是 providerName，后面都是 modelName
  const slashIndex = modelId.indexOf('/');
  if (slashIndex === -1) {
    return null;
  }
  const providerName = modelId.substring(0, slashIndex);
  const modelName = modelId.substring(slashIndex + 1);

  const config = loadModelsConfig();
  for (const provider of config.providers) {
    if (provider.name === providerName) {
      for (const model of provider.models) {
        if (model.modelName === modelName) {
          return model;
        }
      }
    }
  }
  return null;
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
