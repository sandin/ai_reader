# EPUB CFI (Canonical Fragment Identifier) 文档

## 1. 什么是 EPUB CFI？

**EPUB CFI (EPUB Canonical Fragment Identifier)** 是 EPUB 规范中用于定位 EPUB 文档内特定位置的引用机制。它可以精确定位到：

- 某个章节（Chapter）
- 某个段落（Paragraph）
- 某个句子或字符（Character）
- 某个选区（Selection/Range）

### CFI 的优势

| 特性 | 说明 |
|------|------|
| **位置稳定性** | 即使 EPUB 内容重新分页或渲染，CFI 仍然指向相同的文本内容 |
| **跨平台兼容** | 相同的 CFI 在不同阅读器/设备上指向相同位置 |
| **精确度高** | 可以定位到字符级别 |
| **选区支持** | 可以表示一个文本选区（起始位置到结束位置） |

---

## 2. CFI 格式详解

### 2.1 基本格式

```
epubcfi(/chapter-index/paragraph-index!/CSS-selector/character-offset)
```

### 2.2 选区 CFI 格式

当需要表示一个文本选区时，格式如下：

```
epubcfi(/起始位置,/结束位置)
```

### 2.3 本项目中的 CFI 示例

从 [part0003.json](notes/论生命之短暂/part0003.json) 中提取的实际数据：

```json
{
  "cfiRange": "epubcfi(/6/12!/4[2RHM0-17699cd5cd3b4c8eb9bb7ae77d26c57c]/6,/1:0,/3:598)"
}
```

**结构解析：**

| 组件 | 含义 |
|------|------|
| `epubcfi(` | CFI 协议前缀 |
| `/6/12` | 第6个spine项 / 第12个段落 |
| `!/4[2RHM0-17699cd5cd3b4c8eb9bb7ae77d26c57c]/6` | CSS选择器路径（用于精确匹配） |
| `,/1:0` | 起始位置：第1个位置，偏移0 |
| `,/3:598` | 结束位置：第3个位置，字符偏移598 |

---

## 3. 在本项目中的数据流与控制流

### 3.1 数据流概览

```
用户选择文本
    ↓
epubjs 监听 'selected' 事件
    ↓
获取 cfiRange
    ↓
保存到 Block 对象
    ↓
通过 API 保存到 JSON 文件
    ↓
加载笔记时从 JSON 读取 cfiRange
```

### 3.2 控制流详解

#### 步骤 1: 监听文本选择事件

在 [page.tsx:410-413](src/app/reader/[id]/page.tsx#L410-L413) 中：

```typescript
// 监听 epubjs 的 selected 事件获取 CFI
renditionInstance.on('selected', (cfiRange: string) => {
  setCurrentCfiRange(cfiRange);
});
```

**控制流说明：**
1. 用户在阅读器中选择文本
2. epubjs 触发 `selected` 事件
3. 回调函数接收 `cfiRange` 参数
4. 更新 React 状态 `currentCfiRange`

#### 步骤 2: 创建笔记时附加 CFI

在 [page.tsx:556-592](src/app/reader/[id]/page.tsx#L556-L592) 中：

```typescript
const handleAddToAssistant = async () => {
  if (currentSelection && rendition) {
    const blockId = Date.now().toString();

    // 创建 Block 对象，包含 cfiRange
    const newBlock: Block = {
      id: blockId,
      content: currentSelection,
      timestamp: Date.now(),
      cfiRange: currentCfiRange,  // ← CFI 被保存
    };

    setSelectedBlocks(prev => [...prev, newBlock]);

    // 通过 API 保存到后端
    await fetch('/api/note', {
      method: 'POST',
      body: JSON.stringify({
        bookId,
        htmlFile,
        content: currentSelection,
        timestamp: Date.now(),
        cfiRange: currentCfiRange,  // ← CFI 被发送到服务器
      }),
    });
  }
};
```

#### 步骤 3: 后端存储 CFI

在 [route.ts:67-74](src/app/api/note/route.ts#L67-L74) 中：

```typescript
const newNote = {
  id: Date.now().toString(),
  content,
  timestamp: timestamp || Date.now(),
  cfiRange: body.cfiRange || '',  // ← CFI 被保存到 JSON
  htmlFile: htmlFileName,
};
notes.push(newNote);

// 写入文件系统
fs.writeFileSync(jsonFilePath, JSON.stringify(notes, null, 2), 'utf-8');
```

#### 步骤 4: 加载笔记时读取 CFI

在 [page.tsx:517-546](src/app/reader/[id]/page.tsx#L517-L546) 中：

```typescript
const loadNotesForChapter = useCallback(async (chapterHref: string) => {
  const res = await fetch(`/api/note/${bookId}/${encodedHtmlFile}`);
  if (res.ok) {
    const data = await res.json();
    if (data.notes && data.notes.length > 0) {
      // 从 JSON 读取笔记时，包含 cfiRange
      const blocksFromNotes: Block[] = data.notes.map((note: any) => ({
        id: note.id,
        content: note.content,
        timestamp: note.timestamp,
        cfiRange: note.cfiRange || '',  // ← CFI 被读取
      }));
      setSelectedBlocks(blocksFromNotes);
    }
  }
}, [bookId]);
```

---

## 4. 核心数据结构

### 4.1 Block 接口

在 [page.tsx:14-19](src/app/reader/[id]/page.tsx#L14-L19) 中定义：

```typescript
interface Block {
  id: string;
  content: string;
  cfiRange?: string;  // ← 可选的 CFI 选区
  timestamp: number;
}
```

### 4.2 笔记 JSON 存储格式

```json
{
  "id": "1772000965341",
  "content": "选中的文本内容...",
  "timestamp": 1772000965275,
  "cfiRange": "epubcfi(/6/12!/4[...]/6,/1:0,/3:598)",
  "htmlFile": "part0003.html"
}
```

---

## 5. CFI 在前端的状态管理

### 5.1 状态变量

在 [page.tsx:68](src/app/reader/[id]/page.tsx#L68) 中：

```typescript
const [currentCfiRange, setCurrentCfiRange] = useState('');
```

### 5.2 状态更新流程

```
┌─────────────────┐
│  用户选择文本   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ epubjs 'selected' 事件  │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ setCurrentCfiRange(cfiRange)   │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ currentCfiRange 状态更新       │
│ (用于创建笔记或高亮显示)        │
└─────────────────────────────────┘
```

---

## 6. 实际使用场景

### 6.1 创建带 CFI 的笔记

```typescript
// 用户选择文本后点击"添加到助手"
handleAddToAssistant();

// 此时会：
// 1. 获取 currentSelection (选中的文本)
// 2. 获取 currentCfiRange (CFI 位置信息)
// 3. 创建 Block 对象并保存到状态
// 4. 发送 POST 请求保存到后端
```

### 6.2 加载章节笔记

```typescript
// 切换章节时自动加载
useEffect(() => {
  if (currentChapter && isContentReady) {
    loadNotesForChapter(currentChapter);
  }
}, [currentChapter, isContentReady, loadNotesForChapter]);

// loadNotesForChapter 会：
// 1. 根据当前章节 href 调用 API
// 2. 获取该章节的所有笔记（包括 cfiRange）
// 3. 转换为 Block 数组并设置到状态
```

---

## 7. CFI 的潜在应用（扩展功能）

### 7.1 高亮显示笔记对应的原文

```typescript
// 使用 CFI 高亮显示笔记对应的文本位置
if (block.cfiRange && rendition) {
  rendition.annotations.highlight(
    block.cfiRange,
    {},
    () => console.log('highlight clicked')
  );
}
```

### 7.2 点击笔记跳转到原文位置

```typescript
// 点击笔记时导航到 CFI 位置
const navigateToCfi = (cfiRange: string) => {
  if (rendition) {
    rendition.display(cfiRange);
  }
};
```

---

## 8. 总结

| 阶段 | 操作 | 关键代码 |
|------|------|----------|
| **选择文本** | epubjs 触发 selected 事件 | `rendition.on('selected', (cfiRange) => {...})` |
| **保存笔记** | 将 cfiRange 保存到 Block | `cfiRange: currentCfiRange` |
| **后端存储** | JSON 文件持久化 | `cfiRange: body.cfiRange \|\| ''` |
| **加载笔记** | 读取并恢复 cfiRange | `cfiRange: note.cfiRange \|\| ''` |

EPUB CFI 为本项目提供了**精确的文本定位能力**，使得：
- 笔记可以关联到原文的精确位置
- 未来可以实现点击笔记跳转、高亮显示等功能
- 数据在不同阅读器/会话间保持一致性
