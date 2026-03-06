# MCP Server

AI Reader 提供 MCP (Model Context Protocol) 服务器，用于通过外部 AI 客户端（如 Claude Desktop）搜索书籍中的评论和对话内容。

## 服务器能力

- **协议**: Streamable HTTP
- **认证**: Bearer Token (JWT)
- **工具**:
  - `search_book` - 搜索书籍中的评论和对话内容

## search_book 工具

搜索书籍中的评论和对话，返回按书籍和章节分组的 Markdown 格式结果。

### 输入参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| keyword | string | 是 | 搜索关键词 |

### 返回格式

```markdown
# book name
book author

## chapter_name

### comment
> selected_text

comment content

### chat
message content

---
```

## 客户端连接配置

### Claude Desktop 配置

在 `claude_desktop_config.json` 或 MCP 客户端配置中添加：

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

### 获取 JWT Token

用户登录后，JWT token 会存储在浏览器的 cookie 中。可以通过以下方式获取：

1. 登录 AI Reader
2. 打开浏览器开发者工具 (F12)
3. 查看 Application/Storage > Cookies > localhost
4. 复制 `token` cookie 的值

或者通过 API 登录获取：

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your-username","password":"your-password"}'
```

响应中会返回 token（在 cookie 中）。

## 示例

使用 Claude Desktop 连接后，可以进行如下对话：

```
用户: 搜索一下关于"人工智能"的评论
Claude: [调用 search_book 工具]
```

## 错误码

| 错误码 | 描述 |
|--------|------|
| -32001 | Unauthorized - 认证失败 |
| -32603 | Internal error - 服务器内部错误 |
| -32700 | Parse error - 请求解析错误 |
