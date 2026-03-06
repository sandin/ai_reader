# AI Reader

EPUB 电子书阅读器，集成 AI 智能对话功能。基于 Next.js 16、React 19 和 LangChain 构建。

## 功能特性

### 阅读功能
- **EPUB 阅读**：支持上传和阅读 EPUB 格式电子书
- **目录导航**：自动提取并显示书籍目录
- **阅读进度**：自动保存和恢复阅读位置
- **阅读状态**：标记在读/已读/未读状态
- **字体设置**：自定义字体大小、行高、背景色等
- **历史导航**：支持前进/后退阅读历史

### AI 对话功能
- **智能问答**：选中书中内容进行 AI 对话
- **意图识别**：自动识别总结、翻译、思维导图等意图
- **对话管理**：创建、编辑、删除聊天会话
- **标题生成**：自动生成对话标题
- **流式响应**：支持 AI 响应流式输出

### 评论功能
- **文本评论**：对选中的文本添加评论
- **评论管理**：编辑和删除评论
- **评论面板**：侧边栏显示当前章节评论

### 搜索功能
- **全文搜索**：基于向量数据库的语义搜索
- **分类过滤**：支持按对话/评论类型过滤
- **相似度排序**：按语义相似度显示结果

### MCP 服务器
- **外部集成**：支持通过 MCP (Model Context Protocol) 协议被 Claude Desktop 等 AI 客户端连接
- **搜索工具**：提供 `search_book` 工具用于搜索书籍中的评论和对话内容
- **协议**：Streamable HTTP
- **认证**：Bearer Token (JWT)

### Claude Desktop 连接配置

在 Claude Desktop 配置文件中添加：

```json
{
  "mcpServers": {
    "ai-reader": {
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer <your-jwt-token>"
      }
    }
  }
}
```

获取 JWT Token：登录后通过浏览器开发者工具查看 `token` cookie，或调用 `/api/auth/login` API 获取。

## 技术栈

- **框架**：Next.js 16 (App Router)
- **UI**：React 19, Tailwind CSS 4, react-resizable-panels
- **数据库**：PostgreSQL (多租户架构)
- **认证**：JWT + bcryptjs
- **AI**：LangChain + DeepSeek API
- **向量数据库**：Chroma
- **EPUB 解析**：epubjs

## 快速开始

### 环境要求
- Node.js 18+
- PostgreSQL 14+
- Chroma 向量数据库 (可选)

### 安装依赖

```bash
npm install
```

### 环境配置

复制 `.env.example` 文件并配置环境变量：

```env
# 数据库连接
DATABASE_URL=postgresql://user:password@localhost:5432/aireader

# JWT 密钥
JWT_SECRET=your-secret-key

# DeepSeek API
DEEPSEEK_API_KEY=sk-...

# LangSmith (可选，用于追踪)
LANGSMITH_API_KEY=...

# Chroma 向量数据库 (可选)
CHROMA_URL=http://localhost:8000
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

### 构建生产版本

```bash
npm run build
npm run start
```

## 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   │   ├── auth/          # 认证相关 API
│   │   ├── books/         # 书籍管理 API
│   │   ├── chat/          # AI 对话 API
│   │   ├── comment/       # 评论 API
│   │   ├── progress/      # 阅读进度 API
│   │   ├── search/        # 搜索 API
│   │   └── mcp/           # MCP 服务器
│   ├── login/             # 登录页面
│   ├── register/          # 注册页面
│   └── reader/[id]/       # 阅读器页面
├── components/            # React 组件
│   └── reader/            # 阅读器相关组件
└── lib/                   # 工具库
    ├── ai/                # AI 相关 (chat, vector, prompts)
    ├── auth.ts            # 认证工具
    ├── db.ts              # 数据库连接
    └── utils.ts           # 通用工具
```

## 数据库架构

采用**多租户架构**：
- **public schema**：存储用户账户信息
- **user_{userId} schema**：每个用户独立的 schema，包含：
  - `books` - 书籍信息
  - `chapters` - 章节导航
  - `reading_progress` - 阅读进度
  - `chat_sessions` - AI 对话会话
  - `chat_messages` - 对话消息
  - `comments` - 用户评论
  - `selected_blocks` - 选中文本

## API 文档

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/auth/login` | POST | 用户登录 |
| `/api/auth/register` | POST | 用户注册 |
| `/api/auth/logout` | POST | 用户登出 |
| `/api/books` | GET | 获取书籍列表 |
| `/api/books/upload` | POST | 上传 EPUB |
| `/api/books/[id]` | GET/PATCH/DELETE | 书籍操作 |
| `/api/book/[id]` | GET | 获取书籍内容 |
| `/api/progress` | GET/PATCH | 阅读进度 |
| `/api/chat` | GET | 获取会话列表 |
| `/api/chat/[bookId]/[htmlFile]` | GET/POST | 对话消息 |
| `/api/comment/[bookId]/[htmlFile]` | GET/POST | 章节评论 |
| `/api/search` | GET | 搜索对话和评论 |
| `/api/mcp` | POST | MCP 协议入口 |

## 许可证

MIT
