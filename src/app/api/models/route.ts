import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

interface AIModelConfig {
  modelName: string;
  maxTokens: number;
  baseURL: string;
  appKey: string;
}

interface AIProvider {
  name: string;
  providerType: string;
  models: AIModelConfig[];
}

interface ModelsConfig {
  chat_models: AIProvider[];
  embeddings_models?: AIModelConfig[];
}

let cachedConfig: ModelsConfig | null = null;

function loadModelsConfig(): ModelsConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = path.join(process.cwd(), 'models.json');
  const configData = fs.readFileSync(configPath, 'utf-8');
  const parsed = JSON.parse(configData) as ModelsConfig;
  cachedConfig = parsed;
  return parsed;
}

// GET: 获取模型列表
export async function GET() {
  const config = loadModelsConfig();

  // 返回简化模型列表格式：Provider/ModelName
  const models = config.chat_models.flatMap((provider: AIProvider) =>
    provider.models.map((model: AIModelConfig) => ({
      id: `${provider.name}/${model.modelName}`,
      name: `${provider.name}/${model.modelName}`,
    }))
  );

  return NextResponse.json({ models });
}
