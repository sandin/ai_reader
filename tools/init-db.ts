import { Pool } from 'pg';
import { publicSchemaSQL } from '@/lib/schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initDatabase() {
  const client = await pool.connect();
  try {
    console.log('Initializing database...');

    // Create users table in public schema
    await client.query(publicSchemaSQL.createUsersTable);
    console.log('✓ Created users table in public schema');

    console.log('\nDatabase initialization complete!');
    console.log('Note: User schema tables will be created automatically when users register.');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

initDatabase();
