/**
 * 同步向量数据库工具
 *
 * 功能：
 * 1. 清空向量数据库
 * 2. 从主数据库读取所有聊天消息和评论
 * 3. 将数据 embeddings 到向量数据库
 *
 * 使用方法：
 * npx tsx tools/sync-vector-db.ts
 */

// 加载环境变量
import 'dotenv/config';

import pool from '../src/lib/db';
import { getVectorStore, splitText } from '../src/lib/ai';
import { Document } from '@langchain/core/documents';

interface ChatMessage {
  id: number;
  session_id: number;
  book_id: number;
  chapter_file: string;
  message_content: string;
}

interface Comment {
  id: number;
  book_id: number;
  chapter_file: string;
  comment_content: string;
  selected_text: string;
}

// 获取所有用户 schema
async function getAllUserSchemas(): Promise<string[]> {
  const result = await pool.query(`
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name LIKE 'user_%'
    AND schema_name NOT LIKE 'pg_%'
    AND schema_name NOT LIKE 'information_schema'
  `);

  return result.rows.map((row: { schema_name: string }) => row.schema_name);
}

// 获取用户的 userId
function getUserIdFromSchema(schemaName: string): number {
  return parseInt(schemaName.replace('user_', ''), 10);
}

// 同步单个用户的向量数据
async function syncUserVectorData(schemaName: string): Promise<{
  messagesCount: number;
  commentsCount: number;
}> {
  const userId = getUserIdFromSchema(schemaName);
  console.log(`\n正在同步用户 ${userId} (schema: ${schemaName})...`);

  // 设置 search_path
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO ${schemaName}`);

    // 1. 获取所有聊天消息
    const messagesResult = await client.query(`
      SELECT
        cm.id,
        cm.session_id,
        cs.book_id,
        cs.chapter_file,
        cm.message_content
      FROM chat_messages cm
      JOIN chat_sessions cs ON cm.session_id = cs.id
      WHERE cm.message_content IS NOT NULL AND cm.message_content != ''
    `);

    const messages = messagesResult.rows as ChatMessage[];
    console.log(`  找到 ${messages.length} 条聊天消息`);

    // 2. 获取所有评论
    const commentsResult = await client.query(`
      SELECT id, book_id, chapter_file, comment_content, selected_text
      FROM comments
      WHERE comment_content IS NOT NULL AND comment_content != ''
    `);

    const comments = commentsResult.rows as Comment[];
    console.log(`  找到 ${comments.length} 条评论`);

    // 获取向量存储（使用远程 Chroma 服务器）
    const vectorStore = await getVectorStore();
    if (!vectorStore) {
      console.error(`  失败：无法创建向量存储`);
      return { messagesCount: 0, commentsCount: 0 };
    }

    // 分批添加文档的辅助函数（每次最多 10 个）
    const batchSize = 10;
    async function addDocumentsBatched(docs: Document[]): Promise<void> {
      if (!vectorStore) return;
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = docs.slice(i, i + batchSize);
        await vectorStore.addDocuments(batch);
      }
    }

    // 3. 处理聊天消息
    let totalChunks = 0;
    const allMessageDocs: Document[] = [];

    for (const msg of messages) {
      if (!msg.message_content || !msg.message_content.trim()) continue;

      const chunks = await splitText(msg.message_content);
      const documents = chunks.map((chunk) => {
        return new Document({
          pageContent: chunk,
          metadata: {
            type: 'session',
            session_id: msg.session_id,
            message_id: msg.id,
            book_id: msg.book_id,
            chapter_file: msg.chapter_file,
          },
        });
      });

      if (documents.length > 0) {
        allMessageDocs.push(...documents);
        totalChunks += documents.length;
      }
    }

    if (allMessageDocs.length > 0) {
      console.log(`  添加 ${allMessageDocs.length} 个聊天消息文档到向量存储`);
      await addDocumentsBatched(allMessageDocs);
    }

    console.log(`  聊天消息处理完成，共 ${totalChunks} 个 chunk`);

    // 4. 处理评论
    const allCommentDocs: Document[] = [];
    for (const comment of comments) {
      if (!comment.comment_content || !comment.comment_content.trim()) continue;

      // 合并评论内容和选中文本
      const text = comment.selected_text
        ? `${comment.selected_text}\n\n${comment.comment_content}`
        : comment.comment_content;

      const chunks = await splitText(text);
      const documents = chunks.map((chunk) => {
        return new Document({
          pageContent: chunk,
          metadata: {
            type: 'comment',
            comment_id: comment.id,
            book_id: comment.book_id,
            chapter_file: comment.chapter_file,
          },
        });
      });

      if (documents.length > 0) {
        allCommentDocs.push(...documents);
        totalChunks += documents.length;
      }
    }

    if (allCommentDocs.length > 0) {
      console.log(`  添加 ${allCommentDocs.length} 个评论文档到向量存储`);
      await addDocumentsBatched(allCommentDocs);
    }

    console.log(`  评论处理完成`);
    console.log(`  已添加 ${totalChunks} 个向量数据块`);
    return { messagesCount: messages.length, commentsCount: comments.length };
  } finally {
    client.release();
  }
}

// 主函数
async function main() {
  console.log('========================================');
  console.log('向量数据库同步工具');
  console.log('========================================\n');

  try {
    // 获取所有用户 schema
    const schemas = await getAllUserSchemas();

    if (schemas.length === 0) {
      console.log('未找到任何用户 schema');
      return;
    }

    console.log(`找到 ${schemas.length} 个用户 schema`);

    let totalMessages = 0;
    let totalComments = 0;

    // 同步每个用户的数据
    for (const schema of schemas) {
      const result = await syncUserVectorData(schema);
      totalMessages += result.messagesCount;
      totalComments += result.commentsCount;
    }

    console.log('\n========================================');
    console.log('同步完成！');
    console.log(`总计同步: ${totalMessages} 条消息, ${totalComments} 条评论`);
    console.log('========================================');
  } catch (error) {
    console.error('同步失败:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
