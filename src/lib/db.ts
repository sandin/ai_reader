import { Pool, PoolClient } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Simple context storage for request-scoped data
// In Next.js, each request runs in its own context
let currentUserId: number | null = null;

export function setCurrentUser(userId: number | null) {
  currentUserId = userId;
}

export function getCurrentUser(): number | null {
  return currentUserId;
}

// Clear current user context (call after each request)
export function clearCurrentUser() {
  currentUserId = null;
}

// Get the current user schema based on authenticated user
export function getSchema(): string {
  const userId = getCurrentUser();
  if (!userId) {
    throw new Error('User not authenticated');
  }
  return `user_${userId}`;
}

// Execute query with schema context
export async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    const userId = getCurrentUser();
    // If user is authenticated, use their schema; otherwise use public
    const schema = userId ? getSchema() : 'public';
    // Set search_path to user schema
    await client.query(`SET search_path TO ${schema}`);
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

// Execute query with custom schema
export async function queryWithSchema(schema: string, text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO ${schema}`);
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

// Get a client with schema set
export async function getClient() {
  const client = await pool.connect();
  const userId = getCurrentUser();
  const schema = userId ? getSchema() : 'public';
  await client.query(`SET search_path TO ${schema}`);
  return client;
}

// Get a client with custom schema
export async function getClientWithSchema(schema: string): Promise<PoolClient> {
  const client = await pool.connect();
  await client.query(`SET search_path TO ${schema}`);
  return client;
}

export default pool;
