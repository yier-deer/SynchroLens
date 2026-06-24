# SynchroLens 架构说明

## 1. 当前主链

当前实现的实时主链为：

```text
AudioCapture
  -> AudioFrameBuffer
  -> STT client (RTASR by default, IAT fallback)
  -> SentenceAssembler
  -> SessionManager
  -> TranslationGateway
  -> NMTTranslator / Tencent TMT adapter
  -> renderer subtitle events
  -> NoteRepository
```

增强侧链为：

```text
SessionManager
  -> EnhancementOrchestrator
    -> summary
    -> correction status
    -> recommendation status
```

## 2. 关键模块分工

### Main process

- `mainEntry.ts`
  - 组装主进程依赖
  - 创建三窗口
  - 初始化 IPC
  - 连接 STT / NMT / TMT / LLM / vector / notes

- `SessionManager`
  - 会话生命周期
  - STT partial/final 流转
  - 翻译排队与中断控制
  - partial translation / final translation 分流
  - 笔记落盘
  - 增强侧链调度

- `TranslationGateway`
  - 包装实时翻译主链
  - 管理上下文窗口
  - 应用术语约束
  - 处理失败降级

- `NMTTranslator`
  - 调用 `/translate`
  - 管理 model / targetLanguage / endpoint

- `TencentTMTAdapterServer`
  - 在本地提供 `/health` 与 `/translate`
  - 将 Tencent Cloud SDK 适配为统一 NMT 接口

### STT 层

- `STTClientFactory`
  - 根据 `stt.provider` 选择 RTASR / IAT
- `XfyunRtasrClient`
  - 默认实时 STT provider
- `XfyunIatClient`
  - fallback STT provider
- `SentenceAssembler`
  - 负责 partial/final 句子组装

### 知识与增强

- `DictStore`
- `PersonalDictStore`
- `TerminologyResolver`
- `KnowledgeRetriever`
- `PersonalizationResolver`
- `EnhancementOrchestrator`

### Note 层

- `NoteRepository`
  - 创建会话笔记
  - 追加最终句子
  - 追加 summary
- `NoteReader`
  - 笔记树与内容读取

## 3. 配置架构

当前配置模型已经拆成：

- `stt.*`
- `translation.*`
- `llm.*`
- `vector.*`
- `enhancement.*`
- `note.*`
- `audio.*`

### 关键原则

- `translation.*`：实时翻译主链
- `llm.*`：增强侧链
- `vector.*`：embedding 能力
- Tencent `secretKey` 不直接保存在普通配置 JSON 中

## 4. Renderer 架构

三个窗口：

- Main Window
- Subtitle Window
- Control Window

其中：

- `SettingsPanel` 管理主配置
- `SubtitleOverlay` 负责字幕流式展示
- `useSession` 消费主进程事件
- `useIPC` 封装 preload API

## 5. IPC 设计

主进程通过 `sendToAllWindows` 广播关键事件：

- `stt:partial`
- `stt:sentence`
- `translate:partial`
- `translate:final`
- `note:saved`
- `note:summary`
- `enhancement:status`
- `session:state-change`

## 6. 当前默认运行模式

- STT：`xfyun-rtasr`
- Realtime translation：`tencent-tmt`
- Tencent TMT adapter：`http://127.0.0.1:8765`
- LLM enhancement：DeepSeek
- Embedding：Doubao

## 7. 与旧架构的差异

当前实现不再等同于早期的：

- 单一 `STTClient` + IAT
- `Translator` 直接作为实时翻译主链
- `translation.*` 与 `llm.*` 混用
- 单纯 `noteWriter` 直接负责所有笔记写入

而是演进为：

- provider-aware STT
- `TranslationGateway` + `NMTTranslator` 主链
- `Translator` 主要负责 LLM 增强能力
- `NoteRepository` 负责笔记持久化
- `EnhancementOrchestrator` 负责增强侧链
