// 聊天消息类型
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// 聊天选项
export interface ChatOptions {
  message: string;
  history?: ChatMessage[];
  apiKey: string;
  modelName: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

// 流式响应块
export interface StreamChunk {
  content?: string;
  error?: string;
}

// 意图类型
export type Intent = 'summarize' | 'translate' | 'mindmap' | 'other';

// 模型配置接口
export interface AIModelConfig {
  modelName: string;
  maxTokens: number;
  baseURL: string;
  appKey: string;
}

// AI 提供商
export interface AIProvider {
  name: string;
  providerType: string;
  models: AIModelConfig[];
}

// 模型配置
export interface ModelsConfig {
  chat_models: AIProvider[];
  embeddings_models?: AIModelConfig[];
}
