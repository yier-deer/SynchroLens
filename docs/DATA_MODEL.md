# SynchroLens 数据模型契约

> 本文档定义 SynchroLens 项目的核心数据结构、笔记格式、配置模型与文件系统布局。
> 类型定义与设计文档保持完全一致，任何变更需同步更新本文档。

---

## 1. 核心类型定义

### 1.1 STT 识别结果

```typescript
/** STT 识别结果 */
interface STTResult {
  /** 句子唯一标识 */
  sentenceId: string;
  /** 识别文本内容 */
  text: string;
  /** 是否为最终确认结果（false 表示中间片段） */
  isFinal: boolean;
  /** 时间戳（毫秒，epoch time） */
  timestamp: number;
}
```

### 1.2 翻译结果

```typescript
/** 翻译结果 */
interface TranslationResult {
  /** 对应的句子唯一标识 */
  sentenceId: string;
  /** 原文文本 */
  original: string;
  /** 译文文本 */
  translation: string;
  /** 是否为最终确认结果 */
  isFinal: boolean;
  /** 纠正记录列表 */
  corrections: Correction[];
}
```

### 1.3 纠正记录

```typescript
/** 纠正记录 */
interface Correction {
  /** 纠正前的文本 */
  from: string;
  /** 纠正后的文本 */
  to: string;
  /** 纠正原因说明 */
  reason: string;
  /** 纠正发生的时间戳（毫秒，epoch time） */
  timestamp: number;
}
```

### 1.4 翻译会话

```typescript
/** 翻译会话 */
interface Session {
  /** 会话唯一标识 */
  id: string;
  /** 会话开始时间（毫秒，epoch time） */
  startTime: number;
  /** 会话结束时间（毫秒，epoch time），进行中为 undefined */
  endTime?: number;
  /** 音频来源类型 */
  audioSource: 'system' | 'microphone' | 'file';
  /** 会话中的翻译结果列表 */
  sentences: TranslationResult[];
  /** 关联的笔记文件路径 */
  notePath?: string;
  /** 会话摘要 */
  summary?: string;
}
```

---

## 2. 笔记 Markdown 格式规范

### 2.1 格式结构

每会话生成一个 Markdown 笔记文件，结构如下：

```
标题行          → # {日期} {时间} 翻译会话
元信息块        → > 音频源: {来源} | 时长: {时长} | 句子数: {数量}
分隔线          → ---
句子段落（重复） → {时间} | {原文}
                    | {译文}
                    | > ~~{纠正前}~~ → {纠正后}（{原因}）  [仅存在纠正时]
分隔线          → ---
摘要块          → ## 📊 摘要
                    **主题**: {主题}
                    **关键要点**: {要点列表}
                    **生词/术语**: {术语列表}
                    **纠正记录**: {纠正汇总}
```

### 2.2 完整示例

```markdown
# 2026-06-05 14:30 翻译会话

> 音频源: 系统音频 | 时长: 12分35秒 | 句子数: 47

---

14:30:15 | The bank was closed today.
          | 银行今天关门了。
          | > ~~河岸~~ → 银行（后文确认金融语境）

14:30:22 | We need to deposit the check.
          | 我们需要存入这张支票。

---

## 📊 摘要

**主题**: 金融业务场景

**关键要点**:
- 银行因故关闭，需要处理支票存款

**生词/术语**:
- deposit: 存入
- check: 支票（非"检查"）

**纠正记录**:
- bank: 河岸 → 银行（后文确认金融语境）
```

### 2.3 格式细节说明

| 元素 | 规则 |
|------|------|
| 标题 | `# YYYY-MM-DD HH:mm 翻译会话`，日期和时间取会话开始时刻 |
| 元信息 | 放在引用块 `>` 中，三项以 `|` 分隔 |
| 时间戳 | `HH:mm:ss` 格式，取句子在会话中的相对时间 |
| 原文/译文 | 各占一行，译文行与原文行左对齐（时间戳后用空格补齐） |
| 纠正行 | 以 `> ~~旧词~~ → 新词（原因）` 格式附加，仅在有纠正时出现 |
| 段落分隔 | 句子段落之间无需额外空行；不同时间段或主题段落间用 `---` 分隔 |
| 摘要 | 固定标题 `## 📊 摘要`，包含主题、关键要点、生词/术语、纠正记录四个子项 |
| 生词/术语 | 格式为 `- 术语: 释义（歧义提示）`，歧义提示可选 |
| 纠正记录汇总 | 格式为 `- 旧词: 旧译 → 新译（原因）` |

---

## 3. 配置数据结构

配置通过 `electron-store` 持久化存储，底层为 JSON 文件。

### 3.1 完整配置类型

```typescript
/** 应用配置 */
interface AppConfig {
  /** 通用设置 */
  general: GeneralConfig;
  /** STT 语音识别设置 */
  stt: STTConfig;
  /** 翻译设置 */
  translation: TranslationConfig;
  /** 笔记设置 */
  note: NoteConfig;
  /** 音频设置 */
  audio: AudioConfig;
}

/** 通用设置 */
interface GeneralConfig {
  /** 界面语言 */
  language: 'zh-CN' | 'en-US';
  /** 主题 */
  theme: 'light' | 'dark' | 'system';
  /** 最小化到系统托盘 */
  minimizeToTray: boolean;
  /** 开机自启 */
  autoStart: boolean;
}

/** STT 语音识别设置 */
interface STTConfig {
  /** 语音识别服务提供商 */
  provider: 'whisper-local' | 'whisper-api' | 'azure' | 'google';
  /** 识别语言（自动检测时为 'auto'） */
  language: string;
  /** 本地模型路径（provider 为 whisper-local 时有效） */
  localModelPath?: string;
  /** API 密钥（云端服务时有效，加密存储） */
  apiKey?: string;
  /** API 端点（自定义端点时有效） */
  apiEndpoint?: string;
}

/** 翻译设置 */
interface TranslationConfig {
  /** 翻译服务提供商 */
  provider: 'openai' | 'deepseek' | 'google' | 'local';
  /** 目标语言 */
  targetLanguage: string;
  /** API 密钥（加密存储） */
  apiKey?: string;
  /** API 端点 */
  apiEndpoint?: string;
  /** 翻译模型名称 */
  model?: string;
  /** 是否启用上下文感知纠正 */
  contextCorrection: boolean;
  /** 上下文窗口大小（句子数） */
  contextWindowSize: number;
}

/** 笔记设置 */
interface NoteConfig {
  /** 笔记保存根目录 */
  saveDir: string;
  /** 是否自动保存 */
  autoSave: boolean;
  /** 自动保存间隔（毫秒） */
  autoSaveInterval: number;
  /** 是否自动生成摘要 */
  autoSummary: boolean;
  /** 摘要触发阈值（句子数） */
  summaryThreshold: number;
}

/** 音频设置 */
interface AudioConfig {
  /** 音频来源 */
  source: 'system' | 'microphone' | 'file';
  /** 系统音频捕获方式 */
  systemAudioBackend: 'wasapi' | 'pulseaudio' | 'coreaudio';
  /** 麦克风设备 ID */
  microphoneDeviceId?: string;
  /** 采样率 */
  sampleRate: number;
  /** 是否降噪 */
  noiseReduction: boolean;
}
```

### 3.2 默认配置值

```typescript
const DEFAULT_CONFIG: AppConfig = {
  general: {
    language: 'zh-CN',
    theme: 'system',
    minimizeToTray: true,
    autoStart: false,
  },
  stt: {
    provider: 'whisper-local',
    language: 'auto',
  },
  translation: {
    provider: 'openai',
    targetLanguage: 'zh-CN',
    contextCorrection: true,
    contextWindowSize: 10,
  },
  note: {
    saveDir: '', // 运行时默认为 ~/SynchroLens/Notes
    autoSave: true,
    autoSaveInterval: 5000,
    autoSummary: true,
    summaryThreshold: 20,
  },
  audio: {
    source: 'system',
    systemAudioBackend: 'wasapi',
    sampleRate: 16000,
    noiseReduction: false,
  },
};
```

### 3.3 electron-store 存储键

| 键路径 | 类型 | 说明 |
|--------|------|------|
| `general` | `GeneralConfig` | 通用设置 |
| `stt` | `STTConfig` | 语音识别设置 |
| `translation` | `TranslationConfig` | 翻译设置 |
| `note` | `NoteConfig` | 笔记设置 |
| `audio` | `AudioConfig` | 音频设置 |

存储文件位置：`%APPDATA%/SynchroLens/config.json`（Windows）、`~/Library/Application Support/SynchroLens/config.json`（macOS）、`~/.config/SynchroLens/config.json`（Linux）。

---

## 4. 文件系统布局

### 4.1 笔记目录结构

```
{note.saveDir}/                   ← 笔记保存根目录（默认 ~/SynchroLens/Notes）
├── 2026-06-05/                   ← 日期目录（YYYY-MM-DD）
│   ├── 14-30.md                  ← 会话笔记（HH-mm.md）
│   └── 16-45.md
├── 2026-06-06/
│   ├── 09-15.md
│   └── 10-30.md
└── ...
```

### 4.2 应用数据目录

```
%APPDATA%/SynchroLens/               ← 应用数据根目录（Windows）
├── config.json                   ← electron-store 配置文件
├── sessions/                     ← 会话元数据（可选，用于历史检索）
│   ├── {sessionId}.json          ← 单个会话的 Session 对象序列化
│   └── ...
└── cache/                        ← 运行时缓存
    ├── audio/                    ← 音频缓存（临时文件）
    └── models/                   ← 本地模型缓存
```

### 4.3 文件命名规则

| 项目 | 格式 | 示例 |
|------|------|------|
| 日期目录 | `YYYY-MM-DD` | `2026-06-05` |
| 笔记文件 | `HH-mm.md` | `14-30.md` |
| 会话元数据 | `{sessionId}.json` | `a1b2c3d4-e5f6-7890-abcd-ef1234567890.json` |

### 4.4 文件读写约定

- **笔记文件**：由 Main 进程通过 Node.js `fs` 模块读写，Renderer 进程通过 IPC 通道 `note:saved` 获知保存结果。
- **配置文件**：由 `electron-store` 管理，Renderer 通过 `config:update` 通道发起变更，Main 进程执行写入。
- **会话元数据**：会话结束时由 Main 进程序列化 `Session` 对象为 JSON 写入 `sessions/` 目录。
- **并发安全**：同一笔记文件同一时刻仅由一个会话写入，不存在并发写入冲突。

---

## 5. IPC 通道数据载荷

### 5.1 Main → Renderer

| 通道 | 载荷类型 | 说明 |
|------|----------|------|
| `stt:partial` | `STTResult` | STT 中间识别片段（`isFinal: false`） |
| `stt:sentence` | `STTResult` | STT 最终确认句子（`isFinal: true`） |
| `translate:partial` | `TranslationResult` | 翻译中间结果（`isFinal: false`） |
| `translate:final` | `TranslationResult` | 翻译最终结果（`isFinal: true`） |
| `translate:correct` | `TranslationResult` | 上下文纠正后的翻译结果（含 `corrections`） |
| `note:saved` | `{ path: string }` | 笔记保存成功，返回文件路径 |
| `note:summary` | `{ summary: string }` | 摘要生成完成 |

### 5.2 Renderer → Main

| 通道 | 载荷类型 | 说明 |
|------|----------|------|
| `session:start` | `{ audioSource: Session['audioSource'] }` | 启动翻译会话 |
| `session:stop` | `void` | 停止当前会话 |
| `session:pause` | `void` | 暂停当前会话 |
| `config:update` | `Partial<AppConfig>` | 更新配置（支持部分更新） |
| `summary:trigger` | `void` | 手动触发摘要生成 |
