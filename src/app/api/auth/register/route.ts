import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Create users table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
      [username, hashedPassword]
    );

    const user = newUser.rows[0];

    // Create user schema
    const schemaName = `user_${user.id}`;
    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);

    // Initialize tables in the new schema
    await initializeUserSchema(schemaName);

    return NextResponse.json({
      success: true,
      user: { id: user.id, username: user.username }
    }, { status: 201 });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
}

async function initializeUserSchema(schemaName: string) {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO ${schemaName}`);

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
