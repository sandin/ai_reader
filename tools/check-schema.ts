import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkSchema() {
  const client = await pool.connect();
  try {
    await client.query('SET search_path TO user_1');

    console.log('=== chat_sessions 表结构 ===');
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'chat_sessions'
    `);
    console.log(result.rows);

    console.log('\n=== 所有表 ===');
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'user_1'
    `);
    console.log(tables.rows);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkSchema();
