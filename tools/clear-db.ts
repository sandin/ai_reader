import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * 清空数据库工具
 * 功能：
 * 1. 删除所有用户的 schema (user_*) 及其所有表
 * 2. 清空 users 表中的所有用户
 */

async function clearDatabase() {
  const client = await pool.connect();
  try {
    console.log('开始清空数据库...\n');

    // 1. 获取所有 user schema
    const schemasResult = await client.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name LIKE 'user_%'
      AND schema_name ~ '^user_[0-9]+$'
    `);

    const schemas = schemasResult.rows.map(row => row.schema_name);
    console.log(`找到 ${schemas.length} 个用户 schema`);

    // 2. 删除每个用户 schema
    for (const schema of schemas) {
      console.log(`删除 schema: ${schema}`);
      // CASCADE 会删除 schema 中的所有对象
      await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    }

    // 3. 清空 users 表
    console.log('\n清空 users 表...');
    await client.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');

    console.log('\n✓ 数据库清空完成!');
    console.log(`  - 删除了 ${schemas.length} 个用户 schema`);
    console.log('  - 清空了 users 表');

  } catch (error) {
    console.error('清空数据库失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// 运行
clearDatabase()
  .then(() => {
    console.log('\n操作完成');
    process.exit(0);
  })
  .catch((err) => {
    console.error('错误:', err);
    process.exit(1);
  });
