import * as fs from 'fs';
import * as path from 'path';
import type { AIModelConfig, ModelsConfig } from './types';

// 缓存模型配置
let cachedModelsConfig: ModelsConfig | null = null;

/**
 * 加载模型配置
 */
export function loadModelsConfig(): ModelsConfig {
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
  for (const provider of config.chat_models) {
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
 * 获取 embeddings 模型配置
 */
export function getEmbeddingsConfig(): AIModelConfig | null {
  const config = loadModelsConfig();
  if (config.embeddings_models && config.embeddings_models.length > 0) {
    return config.embeddings_models[0];
  }
  return null;
}
