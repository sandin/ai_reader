# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Reader is a Next.js 16 EPUB reader with AI-powered chat capabilities. Users can upload EPUB files, read them with a customized interface, and chat with AI about selected text content.

## Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Architecture

### Tech Stack
- **Framework**: Next.js 16 with App Router
- **UI**: React 19, Tailwind CSS 4, react-resizable-panels
- **Database**: PostgreSQL with connection pooling (pg)
- **Auth**: JWT tokens with bcryptjs
- **AI**: LangChain with DeepSeek API
- **EPUB**: epubjs library

### Database Schema (Multi-tenant)
The application uses a **per-user schema architecture**:
- **Public schema**: Contains `users` table (shared across all users)
- **User schemas**: Each user has a schema named `user_{userId}` containing their private data:
  - `books` - Uploaded EPUB books with metadata
  - `chapters` - Extracted chapter navigation
  - `reading_progress` - Last read position per book
  - `chat_sessions` - AI chat sessions
  - `chat_messages` - Chat message history
  - `selected_blocks` - Text selections from reading
  - `comments` - User comments on text

Schema is managed via `src/lib/db.ts` - queries automatically use the authenticated user's schema.

### Authentication Flow
1. User registers/logins via `/api/auth/register` and `/api/auth/login`
2. JWT token stored in `token` cookie (HttpOnly, 7-day expiry)
3. Middleware `authenticateRequest()` in `src/lib/auth.ts` validates token
4. User schema is set in connection context for all queries

### Key API Routes

| Route | Purpose |
|-------|---------|
| `/api/auth/login` | User login, returns JWT cookie |
| `/api/auth/register` | User registration |
| `/api/auth/logout` | Clear auth cookie |
| `/api/books` | List user's books (paginated) |
| `/api/books/upload` | Upload EPUB file, extracts metadata |
| `/api/books/[id]` | Get/update/delete single book |
| `/api/book/[id]` | Get book for reading (returns EPUB data) |
| `/api/progress` | Save/update reading progress |
| `/api/chat` | List chat sessions |
| `/api/chat/[bookId]/[htmlFile]` | Get/create chat messages for chapter |
| `/api/comment/[bookId]/[htmlFile]` | Comments for chapter |
| `/api/agent.ts` | AI chat integration with DeepSeek |

### File Storage
EPUB files stored in `data/{userId}/books/` directory. Books are served from this directory.

### AI Chat Features
- **Intent classification**: Automatically detects summarize, translate, or general问答
- **System prompts**: Different prompts based on detected intent
- **Streaming**: Supports streaming responses via LangChain
- **Selected text context**: Chat can reference currently selected text in reader

## Environment Variables

```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret
DEEPSEEK_API_KEY=sk-...
LANGSMITH_API_KEY=...  # Optional, for LangChain tracing
LLM_MODEL=deepseek-chat
```
