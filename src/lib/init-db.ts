import pool from './db';

const schemaSQL = `
-- Create user schema if not exists
CREATE SCHEMA IF NOT EXISTS user_1;

-- Users table (public schema)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create default user if not exists (admin/admin)
INSERT INTO users (username, password)
VALUES ('lds', (SELECT password FROM users WHERE username = 'lds' LIMIT 1))
ON CONFLICT (username) DO NOTHING;

-- Update password for user 'lds'
UPDATE users SET password = 'Hb882jmyJyP5uVGZxakQ' WHERE username = 'lds';

-- Set password (in real app, use bcrypt hash)
UPDATE users SET password = '$2a$10$rVK5K8p5v5K8p5v5K8p5vO5K8p5v5K8p5v5K8p5v5K8p5v5K8p5' WHERE username = 'lds';
`;

const booksSQL = `
-- Books table
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
);

CREATE INDEX IF NOT EXISTS idx_books_key ON books(book_key);
CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);
`;

const chaptersSQL = `
-- Chapters table
CREATE TABLE IF NOT EXISTS chapters (
    id SERIAL PRIMARY KEY,
    book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
    chapter_id VARCHAR(100),
    chapter_name VARCHAR(500),
    href VARCHAR(500),
    parent_id INTEGER REFERENCES chapters(id),
    sort_order INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_chapters_book ON chapters(book_id);
CREATE INDEX IF NOT EXISTS idx_chapters_parent ON chapters(parent_id);
`;

const progressSQL = `
-- Reading progress table
CREATE TABLE IF NOT EXISTS reading_progress (
    id SERIAL PRIMARY KEY,
    book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
    current_file VARCHAR(255),
    cfi VARCHAR(255),
    status VARCHAR(20) DEFAULT 'unread',
    last_read_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    UNIQUE(book_id)
);

CREATE INDEX IF NOT EXISTS idx_reading_progress_book ON reading_progress(book_id);
`;

const chatSessionsSQL = `
-- Chat sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
    id SERIAL PRIMARY KEY,
    book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
    chapter_file VARCHAR(255),
    session_title VARCHAR(255),
    created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    updated_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_book ON chat_sessions(book_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_chapter ON chat_sessions(chapter_file);

-- Selected blocks table
CREATE TABLE IF NOT EXISTS selected_blocks (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES chat_sessions(id) ON DELETE CASCADE,
    block_content TEXT NOT NULL,
    cfi_range VARCHAR(255),
    block_timestamp BIGINT
);

CREATE INDEX IF NOT EXISTS idx_selected_blocks_session ON selected_blocks(session_id);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    message_content TEXT,
    message_timestamp BIGINT
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
`;

const commentsSQL = `
-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
    chapter_file VARCHAR(255),
    comment_content TEXT NOT NULL,
    selected_text TEXT,
    cfi_range VARCHAR(255),
    comment_timestamp BIGINT
);

CREATE INDEX IF NOT EXISTS idx_comments_book ON comments(book_id);
CREATE INDEX IF NOT EXISTS idx_comments_chapter ON comments(chapter_file);
`;

export async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Initialize users table in public schema
    await client.query(schemaSQL);
    console.log('Users table initialized');

    // Initialize tables in user schema
    await client.query(`SET search_path TO user_1`);
    await client.query(booksSQL);
    await client.query(chaptersSQL);
    await client.query(progressSQL);
    await client.query(chatSessionsSQL);
    await client.query(commentsSQL);
    console.log('User schema tables initialized');

    console.log('Database initialization complete');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
