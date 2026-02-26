# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Reader is a Next.js 16 application that provides an EPUB reader with integrated AI chat functionality. Users can read EPUB books, select text, and ask an AI assistant (powered by DeepSeek) for explanations, summaries, or analysis of selected content.

## Commands

```bash
# Development
npm run dev          # Start development server at http://localhost:3000

# Production
npm run build        # Build for production
npm run start        # Start production server

# Linting
npm run lint         # Run ESLint
```

## Architecture

### Tech Stack
- **Framework**: Next.js 16 with App Router
- **UI**: React 19, Tailwind CSS 4
- **EPUB Parsing**: epubjs
- **AI Integration**: LangChain with ChatOpenAI (DeepSeek API)
- **Markdown Rendering**: react-markdown
- **UI Components**: react-resizable-panels

### Key Directories
- `book/` - EPUB files directory (place .epub files here)
- `notes/` - Auto-created directory for saved notes (JSON files per chapter)
- `src/app/` - Next.js App Router pages and API routes

### API Routes
- `GET /api/books` - List all books with pagination
- `GET /api/book/[id]` - Get book content by ID (base64 encoded)
- `POST /api/chat` - AI chat endpoint (streaming response)
- `POST /api/note` - Save note for a specific book chapter

### Environment Variables
Create a `.env.local` file with:
```
DEEPSEEK_API_KEY=your_api_key          # Required for AI chat
LLM_MODEL=deepseek-chat                 # Optional, defaults to deepseek-chat
LANGSMITH_API_KEY=your_key              # Optional, for LangChain tracing
LANGCHAIN_PROJECT=ai-reader             # Optional
```

## Key Implementation Details

### Book ID Encoding
Book IDs use URL-safe base64 encoding. When decoding:
1. Replace `-` with `+` and `_` with `/`
2. Add padding if needed (`==`)
3. Decode from base64 to get original filename

### Chat API
- Uses server-sent events (SSE) for streaming responses
- Supports conversation history via `history` array in request body
- System prompt instructs the AI to be a reading assistant

### Notes Storage
Notes are saved as JSON files in `notes/{book_name}/{chapter}.json`.
