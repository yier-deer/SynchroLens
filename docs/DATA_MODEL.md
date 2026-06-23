# SynchroLens 数据模型

本文档以 [types.ts](</E:/Trae/worktrees/SynchroLens/pr-backport-optimizations/src/shared/types.ts>) 为准。

## 1. 核心模型

### `STTResult`

```ts
{
  sentenceId: string;
  text: string;
  isFinal: boolean;
  timestamp: number;
}
```

### `TranslationResult`

```ts
{
  sentenceId: string;
  original: string;
  translation: string;
  isFinal: boolean;
  corrections: Correction[];
  constraints?: TranslationConstraint[];
  error?: string;
}
```

### `Session`

```ts
{
  id: string;
  startTime: number;
  endTime?: number;
  audioSource: 'system' | 'microphone' | 'file';
  sentences: TranslationResult[];
  notePath?: string;
  summary?: string;
}
```

## 2. 配置模型

当前 `AppConfig` 包含：

```ts
{
  general: GeneralConfig;
  stt: STTConfig;
  translation: TranslationConfig;
  llm: LLMConfig;
  vector: VectorConfig;
  note: NoteConfig;
  enhancement: EnhancementConfig;
  audio: AudioConfig;
}
```

### `STTConfig`

- `provider`: `xfyun-rtasr | xfyun-iat | whisper-local | whisper-api`
- `language`
- `appId/apiKey/apiSecret/apiEndpoint`

### `TranslationConfig`

- `provider`: `nmt | deepseek | openai | local | tencent-tmt`
- `targetLanguage`
- `apiKey/apiEndpoint/model`
- `contextCorrection`
- `contextWindowSize`
- `tencent: TencentTMTConfig`

### `LLMConfig`

- `provider`: `deepseek | openai | local`
- `apiEndpoint`
- `apiKey`
- `model`

### `VectorConfig`

- `apiEndpoint`
- `apiKey`
- `model`

### `EnhancementConfig`

- `enabled`
- `summaryEnabled`
- `correctionEnabled`
- `recommendationEnabled`

注：字段拼写与实现保持一致，最终以代码为准。

## 3. 腾讯 TMT 结构

### `TencentTMTConfig`

```ts
{
  enabled: boolean;
  secretId?: string;
  secretKey?: string;
  secretKeySaved?: boolean;
  region: string;
  projectId: number;
  sourceLanguage: 'auto' | 'zh' | 'en' | 'ja' | 'ko';
}
```

## 4. 词典与知识

### `DictType`

```ts
'language' | 'domain' | 'personal'
```

### `TranslationConstraint`

```ts
{
  source: string;
  target: string;
  sourceType: DictType;
  priority: number;
  matchType: 'exact' | 'similar';
  enforceMode: 'term' | 'sentence';
  entryId?: string;
  filePath?: string;
  score?: number;
}
```

### `KnowledgeHit`

用于知识检索与增强侧链：

- `source`
- `target`
- `sourceType`
- `matchType`
- `priority`
- `consumers`

## 5. IPC 载荷

### `TranslatePartialPayload`

```ts
{
  sentenceId: string;
  original: string;
  translation: string;
}
```

### `TranslateFinalPayload`

```ts
{
  sentenceId: string;
  original: string;
  translation: string;
  corrections: Correction[];
  error?: string;
}
```

### `EnhancementStatusPayload`

```ts
{
  kind: 'summary' | 'correction' | 'recommendation';
  state: 'idle' | 'running' | 'completed' | 'failed';
  sessionId: string;
  summary?: string;
  corrections?: Correction[];
  recommendations?: string[];
  error?: string;
}
```

## 6. 会话状态

当前 `SessionState`：

```ts
'idle'
| 'running'
| 'listening'
| 'recognizing'
| 'reconnecting'
| 'paused'
| 'stopped'
| 'error'
```

## 7. 笔记存储

`NoteRepository` 当前按会话写入 Markdown：

- 创建会话文件
- 追加最终句子
- 追加 summary block

每条最终句子按时间戳写入，翻译失败时可记录失败占位文本。
