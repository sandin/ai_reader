// Shared SQL schema definitions for both public and user schemas

// Public schema - users table
export const publicSchemaSQL = {
  createUsersTable: `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
};

// User schema - tables created per user
export const userSchemaSQL = {
  createBooksTable: `
    CREATE TABLE IF NOT EXISTS books (
      id SERIAL PRIMARY KEY,
      book_key VARCHAR(255) NOT NULL,
      title VARCHAR(500),
      author VARCHAR(255),
      filename VARCHAR(255) NOT NULL,
      epub_path VARCHAR(500) NOT NULL,
      cover BYTEA,
      status VARCHAR(20) DEFAULT 'unread',
      index_data JSONB,
      current_file VARCHAR(255),
      cfi VARCHAR(255),
      last_read_at BIGINT,
      created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
      updated_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
      UNIQUE(book_key)
    )
  `,

  createBooksIndexes: [
    `CREATE INDEX IF NOT EXISTS idx_books_key ON books(book_key)`,
    `CREATE INDEX IF NOT EXISTS idx_books_status ON books(status)`,
  ],


  createChatSessionsTable: `
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id SERIAL PRIMARY KEY,
      book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
      chapter_file VARCHAR(255),
      session_title VARCHAR(255),
      created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
      updated_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
    )
  `,

  createChatSessionsIndexes: [
    `CREATE INDEX IF NOT EXISTS idx_chat_sessions_book ON chat_sessions(book_id)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_sessions_chapter ON chat_sessions(chapter_file)`,
  ],

  createSelectedBlocksTable: `
    CREATE TABLE IF NOT EXISTS selected_blocks (
      id SERIAL PRIMARY KEY,
      session_id INTEGER REFERENCES chat_sessions(id) ON DELETE CASCADE,
      block_content TEXT NOT NULL,
      cfi_range VARCHAR(255),
      block_timestamp BIGINT
    )
  `,

  createSelectedBlocksIndex: `CREATE INDEX IF NOT EXISTS idx_selected_blocks_session ON selected_blocks(session_id)`,

  createChatMessagesTable: `
    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      session_id INTEGER REFERENCES chat_sessions(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL,
      message_content TEXT,
      message_timestamp BIGINT
    )
  `,

  createChatMessagesIndex: `CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id)`,

  createCommentsTable: `
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
      chapter_file VARCHAR(255),
      comment_content TEXT NOT NULL,
      selected_text TEXT,
      cfi_range VARCHAR(255),
      comment_timestamp BIGINT
    )
  `,

  createCommentsIndexes: [
    `CREATE INDEX IF NOT EXISTS idx_comments_book ON comments(book_id)`,
    `CREATE INDEX IF NOT EXISTS idx_comments_chapter ON comments(chapter_file)`,
  ],
};

// Helper function to initialize user schema tables
export async function initializeUserSchema(client: any, schemaName: string) {
  await client.query(`SET search_path TO ${schemaName}`);

  // Create books table
  await client.query(userSchemaSQL.createBooksTable);
  for (const idx of userSchemaSQL.createBooksIndexes) {
    await client.query(idx);
  }

  // Create chat_sessions table
  await client.query(userSchemaSQL.createChatSessionsTable);
  for (const idx of userSchemaSQL.createChatSessionsIndexes) {
    await client.query(idx);
  }

  // Create selected_blocks table
  await client.query(userSchemaSQL.createSelectedBlocksTable);
  await client.query(userSchemaSQL.createSelectedBlocksIndex);

  // Create chat_messages table
  await client.query(userSchemaSQL.createChatMessagesTable);
  await client.query(userSchemaSQL.createChatMessagesIndex);

  // Create comments table
  await client.query(userSchemaSQL.createCommentsTable);
  for (const idx of userSchemaSQL.createCommentsIndexes) {
    await client.query(idx);
  }
}
