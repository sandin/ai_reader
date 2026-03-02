# 数据库设计

## 概述

AI Reader 使用 PostgreSQL 数据库，采用**每个用户独立 schema** 的设计模式。用户数据存储在以 `user_{user_id}` 命名的 schema 中，实现数据隔离。

## 全局表 (public schema)

### users

存储用户账户信息。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 主键 |
| username | VARCHAR(255) | 用户名，唯一 |
| password | VARCHAR(255) | bcrypt 加密后的密码 |
| created_at | TIMESTAMP | 创建时间 |

## 用户数据表 (user_{id} schema)

每个用户拥有独立的 schema，包含以下表：

### books

存储书籍元数据。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 主键，数字ID |
| book_key | VARCHAR(255) | 书籍唯一标识（文件名） |
| title | VARCHAR(500) | 书名 |
| author | VARCHAR(255) | 作者 |
| filename | VARCHAR(255) | 文件名 |
| epub_path | VARCHAR(500) | EPUB文件相对路径 |
| cover | BYTEA | 封面图片二进制数据 |
| status | VARCHAR(20) | 阅读状态：unread/reading/completed |
| created_at | BIGINT | 创建时间（毫秒时间戳） |
| updated_at | BIGINT | 更新时间（毫秒时间戳） |

### chapters

存储书籍章节结构。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 主键 |
| book_id | INTEGER | 关联 books(id) |
| chapter_id | VARCHAR(100) | 章节ID |
| chapter_name | VARCHAR(500) | 章节名称 |
| href | VARCHAR(500) | 章节链接 |
| parent_id | INTEGER | 父章节ID（用于嵌套目录） |
| sort_order | INTEGER | 排序顺序 |

### reading_progress

存储阅读进度。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 主键 |
| book_id | INTEGER | 关联 books(id) |
| current_file | VARCHAR(255) | 当前阅读的HTML文件 |
| cfi | VARCHAR(255) | CFI位置标识 |
| status | VARCHAR(20) | 阅读状态 |
| last_read_at | BIGINT | 最后阅读时间 |

### chat_sessions

存储AI对话会话。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 主键 |
| book_id | INTEGER | 关联 books(id) |
| chapter_file | VARCHAR(255) | 所属章节文件 |
| session_title | VARCHAR(255) | 会话标题 |
| created_at | BIGINT | 创建时间 |
| updated_at | BIGINT | 更新时间 |

### selected_blocks

存储用户选中的文本段落。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 主键 |
| session_id | INTEGER | 关联 chat_sessions(id) |
| block_content | TEXT | 选中的文本内容 |
| cfi_range | VARCHAR(255 | CFI范围 |
| block_timestamp | BIGINT | 时间戳 |

### chat_messages

存储AI对话消息。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 主键 |
| session_id | INTEGER | 关联 chat_sessions(id) |
| role | VARCHAR(20) | 角色：user/assistant |
| message_content | TEXT | 消息内容 |
| message_timestamp | BIGINT | 时间戳 |

### comments

存储书评/评论。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 主键 |
| book_id | INTEGER | 关联 books(id) |
| chapter_file | VARCHAR(255) | 所属章节文件 |
| comment_content | TEXT | 评论内容 |
| selected_text | TEXT | 评论文本 |
| cfi_range | VARCHAR(255) | CFI范围 |
| comment_timestamp | BIGINT | 时间戳 |

## 设计原则

1. **数据隔离**: 每个用户的数据存储在独立的 schema 中，通过 `search_path` 实现查询隔离
2. **数字ID为主**: 书籍使用数据库自增ID作为主标识，URL中使用数字ID
3. **时间戳统一**: 使用毫秒级时间戳（BIGINT）存储时间，便于前端处理
4. **级联删除**: 有关联关系的表使用 `ON DELETE CASCADE`，删除父记录时自动删除子记录
