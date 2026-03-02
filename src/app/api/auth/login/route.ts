import { NextResponse } from 'next/server';
import { findUserByUsername, verifyPassword, generateToken, setTokenCookie, getSchemaForUser } from '@/lib/auth';
import pool from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Find user
    const user = await findUserByUsername(username);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Create JWT token
    const token = generateToken(user.id, user.username);

    // Create user schema if not exists
    const schemaName = getSchemaForUser(user.id);
    const schemaCheck = await pool.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
      [schemaName]
    );

    if (schemaCheck.rows.length === 0) {
      await pool.query(`CREATE SCHEMA ${schemaName}`);
      // Initialize tables in the new schema
      await initializeUserSchema(schemaName);
    }

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, username: user.username }
    });

    // Set token cookie
    response.headers.set('Set-Cookie', setTokenCookie(token));

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}

async function initializeUserSchema(schemaName: string) {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO ${schemaName}`);

    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS books (
        id SERIAL PRIMARY KEY,
        book_key VARCHAR(255) NOT NULL,
        title VARCHAR(500),
        author VARCHAR(255),
        filename VARCHAR(255) NOT NULL,
        epub_path VARCHAR(500) NOT NULL,
        cover BYTEA,
        status VARCHAR(20) DEFAULT 'unread',
        created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
        updated_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
        UNIQUE(book_key)
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_books_key ON books(book_key)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_books_status ON books(status)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS chapters (
        id SERIAL PRIMARY KEY,
        book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
        chapter_id VARCHAR(100),
        chapter_name VARCHAR(500),
        href VARCHAR(500),
        parent_id INTEGER REFERENCES chapters(id),
        sort_order INTEGER DEFAULT 0
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_chapters_book ON chapters(book_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_chapters_parent ON chapters(parent_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS reading_progress (
        id SERIAL PRIMARY KEY,
        book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
        current_file VARCHAR(255),
        cfi VARCHAR(255),
        status VARCHAR(20) DEFAULT 'unread',
        last_read_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
        UNIQUE(book_id)
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_reading_progress_book ON reading_progress(book_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id SERIAL PRIMARY KEY,
        book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
        session_title VARCHAR(255),
        created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
        updated_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_chat_sessions_book ON chat_sessions(book_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS selected_blocks (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES chat_sessions(id) ON DELETE CASCADE,
        block_content TEXT NOT NULL,
        cfi_range VARCHAR(255),
        block_timestamp BIGINT
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_selected_blocks_session ON selected_blocks(session_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES chat_sessions(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL,
        message_content TEXT,
        message_timestamp BIGINT
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
        chapter_file VARCHAR(255),
        comment_content TEXT NOT NULL,
        selected_text TEXT,
        cfi_range VARCHAR(255),
        comment_timestamp BIGINT
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_comments_book ON comments(book_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_comments_chapter ON comments(chapter_file)`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
        chapter_file VARCHAR(255),
        note_content TEXT NOT NULL,
        cfi_range VARCHAR(255),
        note_timestamp BIGINT
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_notes_book ON notes(book_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_notes_chapter ON notes(chapter_file)`);

  } finally {
    client.release();
  }
}
