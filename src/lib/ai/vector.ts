import { OpenAIEmbeddings } from '@langchain/openai';
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { getEmbeddingsConfig } from './config';

// 搜索结果类型
export interface SearchResult {
  content: string;
  type: 'session' | 'comment';
  session_id?: number;
  message_id?: number;
  comment_id?: number;
  book_id: number;
  chapter_file: string;
}

/**
 * 创建 embeddings 模型
 */
export function createEmbeddingsModel(): OpenAIEmbeddings | null {
  const embeddingsConfig = getEmbeddingsConfig();
  if (!embeddingsConfig) {
    return null;
  }

  return new OpenAIEmbeddings({
    model: embeddingsConfig.modelName,
    configuration: {
      baseURL: embeddingsConfig.baseURL,
    },
    apiKey: embeddingsConfig.appKey,
    encodingFormat: 'float',
  });
}

/**
 * 获取向量数据库实例
 */
export async function getVectorStore(): Promise<Chroma | null> {
  const embeddings = createEmbeddingsModel();
  if (!embeddings) {
    console.error('[getVectorStore] Failed to create embeddings model');
    return null;
  }

  // 从环境变量获取 Chroma URL
  const chromaUrl = process.env.CHROMA_URL || 'http://localhost:8000';

  // 创建新的 Chroma 向量存储
  const vectorStore = new Chroma(embeddings, {
    collectionName: 'ai-reader',
    url: chromaUrl,
  });
  console.log('[getVectorStore] Chroma vectorStore created:', chromaUrl);

  return vectorStore;
}

/**
 * 添加文本到向量数据库
 * @param texts 文本数组
 * @param metadata 元数据数组（可选）
 */
export async function addTextsToVectorStore(
  texts: string[],
  metadata?: Record<string, unknown>[]
): Promise<void> {
  const vectorStore = await getVectorStore();
  if (!vectorStore) {
    throw new Error('Failed to create vector store');
  }

  // 转换文本为 Document 对象
  const documents = texts.map((text, index) => {
    return new Document({
      pageContent: text,
      metadata: metadata?.[index] || {},
    });
  });

  // 添加到向量存储
  console.log('[addTextsToVectorStore] Adding', documents.length, 'documents');
  await vectorStore.addDocuments(documents);
  console.log('[addTextsToVectorStore] Documents added successfully');
}

/**
 * 从向量数据库查询相似文本
 * @param query 查询文本
 * @param k 返回结果数量
 */
export async function similaritySearch(
  query: string,
  k: number = 3
): Promise<string[]> {
  const vectorStore = await getVectorStore();
  if (!vectorStore) {
    throw new Error('Failed to create vector store');
  }

  const results = await vectorStore.similaritySearch(query, k);
  return results.map((doc) => doc.pageContent);
}

/**
 * 切分文本为块
 * @param text 要切分的文本
 * @param chunkSize 块大小（字符数）
 * @param chunkOverlap 重叠字符数
 */
export function splitText(
  text: string,
  chunkSize: number = 300,
  chunkOverlap: number = 50
): Promise<string[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
    lengthFunction: (text: string) => text.length,
    separators: ['\n\n', '\n', '。', '！', '？', '；', ' ', ''],
  });

  return splitter.splitText(text);
}

/**
 * 同步聊天消息到向量数据库
 * @param sessionId 会话 ID
 * @param messageId 消息 ID
 * @param content 消息内容
 * @param userId 用户 ID
 * @param bookId 书籍 ID
 * @param chapterFile 章节文件
 */
export async function syncMessageToVectorStore(
  _sessionId: number,
  _messageId: number,
  content: string,
  _userId: number,
  bookId: number,
  chapterFile: string
): Promise<void> {
  if (!content || !content.trim()) {
    return;
  }

  const vectorStore = await getVectorStore();
  if (!vectorStore) {
    console.error('Failed to create vector store');
    return;
  }

  // 切分文本
  const chunks = await splitText(content);

  // 为每个 chunk 创建 metadata
  const documents = chunks.map((chunk) => {
    return new Document({
      pageContent: chunk,
      metadata: {
        type: 'session',
        session_id: _sessionId,
        message_id: _messageId,
        book_id: bookId,
        chapter_file: chapterFile,
      },
    });
  });

  // 添加到向量数据库
  await vectorStore.addDocuments(documents);
}

/**
 * 删除聊天消息从向量数据库
 * 注意：MemoryVectorStore 不支持删除，通过清除缓存实现
 * @param sessionId 会话 ID
 * @param messageId 消息 ID
 * @param userId 用户 ID
 */
export async function deleteMessageFromVectorStore(
  sessionId: number,
  messageId: number,
  _userId: number
): Promise<void> {
  const vectorStore = await getVectorStore();
  if (!vectorStore) {
    console.error('Failed to create vector store');
    return;
  }

  // 根据 session_id 和 message_id 删除匹配的文档
  await vectorStore.delete({
    filter: {
      type: 'session',
      session_id: sessionId,
      message_id: messageId,
    },
  });
  console.log('[deleteMessageFromVectorStore] Deleted documents for session:', sessionId, 'message:', messageId);
}

/**
 * 同步评论到向量数据库
 * @param commentId 评论 ID
 * @param content 评论内容
 * @param selectedText 选中文本
 * @param userId 用户 ID
 * @param bookId 书籍 ID
 * @param chapterFile 章节文件
 */
export async function syncCommentToVectorStore(
  commentId: number,
  content: string,
  selectedText: string,
  userId: number,
  bookId: number,
  chapterFile: string
): Promise<void> {
  if (!content || !content.trim()) {
    return;
  }

  const vectorStore = await getVectorStore();
  if (!vectorStore) {
    console.error('Failed to create vector store');
    return;
  }

  // 将评论内容和选中文本合并
  const text = selectedText ? `${selectedText}\n\n${content}` : content;

  // 切分文本
  const chunks = await splitText(text);

  // 为每个 chunk 创建 metadata
  const documents = chunks.map((chunk) => {
    return new Document({
      pageContent: chunk,
      metadata: {
        type: 'comment',
        comment_id: commentId,
        book_id: bookId,
        chapter_file: chapterFile,
      },
    });
  });

  // 添加到向量数据库
  await vectorStore.addDocuments(documents);
}

/**
 * 删除评论从向量数据库
 * @param commentId 评论 ID
 * @param userId 用户 ID
 */
export async function deleteCommentFromVectorStore(
  commentId: number,
  _userId: number
): Promise<void> {
  const vectorStore = await getVectorStore();
  if (!vectorStore) {
    console.error('Failed to create vector store');
    return;
  }

  // 根据 comment_id 删除匹配的文档
  await vectorStore.delete({
    filter: {
      type: 'comment',
      comment_id: commentId,
    },
  });
  console.log('[deleteCommentFromVectorStore] Deleted documents for comment:', commentId);
}

/**
 * 搜索向量数据库
 * @param query 搜索查询
 * @param userId 用户 ID
 * @param k 返回结果数量
 * @param filterType 过滤类型: 'session' | 'comment' | undefined
 */
export async function searchVectorStore(
  query: string,
  userId: number,
  k: number = 10,
  filterType?: 'session' | 'comment'
): Promise<SearchResult[]> {
  const vectorStore = await getVectorStore();
  if (!vectorStore) {
    return [];
  }

  // 构建过滤条件 - 使用 Chroma 正确的 Where 格式
  let filter: { $eq: Record<string, string> } | undefined;
  if (filterType) {
    filter = { $eq: { type: filterType } };
  }

  const results = await vectorStore.similaritySearch(query, k, filter as any);

  return results.map((doc) => ({
    content: doc.pageContent,
    type: doc.metadata.type as 'session' | 'comment',
    session_id: doc.metadata.session_id,
    message_id: doc.metadata.message_id,
    comment_id: doc.metadata.comment_id,
    book_id: doc.metadata.book_id,
    chapter_file: doc.metadata.chapter_file,
  }));
}
