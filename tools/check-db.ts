import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkDatabase() {
  const client = await pool.connect();
  try {
    console.log('=== 检查 users 表 ===');
    const usersResult = await client.query('SELECT id, username, password FROM users');
    console.log(usersResult.rows);

    console.log('\n=== 检查所有 schema ===');
    const schemasResult = await client.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name LIKE 'user_%'
    `);
    console.log(schemasResult.rows);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkDatabase();
