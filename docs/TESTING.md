# SynchroLens 测试说明

## 1. 当前验证基线

当前整包回迁版本已通过：

```bash
npm.cmd run typecheck
npm.cmd test -- --runInBand
npm.cmd run build
```

结果：

- 47 test suites passed
- 373 tests passed

## 2. 测试层次

### Main / domain / pipeline

覆盖以下核心模块：

- `SessionManager`
- `AudioCapture`
- `AudioFrameBuffer`
- `XfyunIatClient`
- `XfyunRtasrClient`
- `STTClientFactory`
- `SentenceAssembler`
- `TranslationGateway`
- `NMTTranslator`
- `TencentTMTClient`
- `TencentTMTAdapterServer`
- `TerminologyResolver`
- `KnowledgeRetriever`
- `EnhancementOrchestrator`
- `NoteRepository`
- `ConfigStore`
- `TencentTMTSecretStore`
- `EmbeddingClient`

### Renderer / hooks / windows

覆盖以下前端层能力：

- `SettingsPanel`
- `DictionaryView`
- `NotesView`
- `MainWindow`
- `SubtitleOverlay`
- `useSession`
- `useIPC`
- streaming subtitle diff helpers

### E2E-style pipeline

- `Test/e2e/full-pipeline.test.ts`

验证：

- 会话创建
- STT -> 翻译主链
- 增强侧链状态
- 停止会话
- summary
- 全流程完整性

## 3. Mock 原则

- 外部网络服务通过 mock 替代
- 主链内部编排保持真实模块协作
- Audio / STT / NMT / renderer 通常使用定向 stub 或 fake process
- `AudioCapture` 测试优先使用注入 seam，而不是依赖真实硬件

## 4. 关键回归点

当前测试已经显式覆盖：

- RTASR 为默认实时 STT provider
- IAT 作为 fallback provider
- Tencent TMT 本地 adapter `/health` 与 `/translate`
- `ConfigStore` 对旧配置和 Tencent 凭据的归一化
- `TranslationGateway` 的降级与 partial/final 行为
- `EmbeddingClient` 对 OpenAI 风格数组与 Doubao 对象返回的兼容
- subtitle streaming diff 与 renderer 展示状态

## 5. 推荐验证顺序

若后续继续改动该主链，推荐使用：

```bash
npm.cmd run typecheck
npm.cmd test -- --runInBand
npm.cmd run build
```

针对局部模块可先跑对应测试文件，再回到全量验证。
