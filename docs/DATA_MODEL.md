# SynchroLens 数据模型契约

> 本文档定义 SynchroLens 项目的核心数据结构、笔记格式、配置模型与文件系统布局。
> 类型定义与 `src/shared/types.ts` 保持同步，任何变更需同步更新本文档。

---

## 1. 核心类型定义

### 1.1 STT 识别结果

```typescript
interface STTResult {
  sentenceId: string;
  text: string;
  isFinal: boolean;
  timestamp: number;
}
```

### 1.2 翻译结果

```typescript
interface TranslationResult {
  sentenceId: string;
  original: string;
  translation: string;
  isFinal: boolean;
  corrections: Correction[];
}
```

### 1.3 纠正记录

```typescript
interface Correction {
  from: string;
  to: string;
  reason: string;
  timestamp: number;
}
```

### 1.4 收藏条目

```typescript
interface Favorite {
  id: string;
  text: string;
  noteFileName: string;
  noteFilePath: string;
  createdAt: string;
}
```

### 1.5 笔记文件树节点

```typescript
interface NoteTreeItem {
  name: string;
  path: string;
  type: 'directory' | 'file';
  children?: NoteTreeItem[];
  modifiedAt?: number;
}
```

### 1.6 个人词典条目

```typescript
interface DictEntry {
  id: string;
  source: string;         // 原文
  target: string;         // 改进后的译文
  improvement: string;    // 改进意见
  sourceNote: string;     // 来源笔记文件名
  createdAt: string;
}
```

### 1.7 改进提交载荷

```typescript
interface ImprovementPayload {
  original: string;       // 原始译文
  improved: string;       // 用户改进版
  reason: string;         // 改进意见
  context: string;        // 上下文（原文+前后句）
}
```

### 1.8 外部词典文件信息

```typescript
interface DictFile {
  name: string;
  path: string;
  count: number;          // 条目数
  enabled: boolean;
}
```

### 1.9 会话

```typescript
interface Session {
  id: string;
  startTime: number;
  endTime?: number;
  audioSource: 'system' | 'microphone' | 'file';
  sentences: TranslationResult[];
  notePath?: string;
  summary?: string;
}
```

---

## 2. 会话状态

```typescript
type SessionState = 'idle' | 'running' | 'paused' | 'stopped';
```

---

## 3. 应用配置

```typescript
interface AppConfig {
  general: GeneralConfig;         // 语言/主题/托盘/自启
  stt: STTConfig;                 // 讯飞 API 配置
  translation: TranslationConfig; // DeepSeek 翻译配置
  note: NoteConfig;               // 笔记保存配置
  audio: AudioConfig;             // 音频采集配置
}
```

---

## 4. 笔记格式

笔记按 `{笔记根目录}/YYYY-MM-DD/HH-mm.md` 路径组织。

### 文件内容格式

```markdown
# SynchroLens 同传笔记

**时间**: 2026-06-06 14:30
**时长**: 45 分钟
**音频来源**: 系统音频

---

> 原文句子1

译文句子1

*（时间戳）*

---

## 摘要

[LLM 生成的会话摘要]
```

---

## 5. 收藏存储格式

收藏数据存储在 `{userData}/favorites.json`：

```json
[
  {
    "id": "uuid-1",
    "text": "选中的文本内容",
    "noteFileName": "14-30.md",
    "noteFilePath": "/SynchroLens/Notes/2026-06-06/14-30.md",
    "createdAt": "2026-06-06T14:35:00.000Z"
  }
]
```

---

## 6. 词典文件格式

### CSV 术语表
```csv
term,translation
artificial intelligence,人工智能
large language model,大语言模型
```

### JSON 术语表
```json
{
  "artificial intelligence": "人工智能",
  "large language model": "大语言模型"
}
```

### TXT 术语表
```
artificial intelligence = 人工智能
large language model:大语言模型
machine learning	机器学习
```

---

> 完整类型定义见 `src/shared/types.ts`，IPC 载荷类型见 `docs/API.md`
