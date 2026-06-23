# SynchroLens - AI 同声传译助手

面向中文用户的桌面同传工具：采集系统音频或麦克风音频，进行实时语音识别、实时机器翻译，并通过独立字幕窗叠加显示；同时生成 Markdown 笔记，并提供术语约束、个人词典、LLM 增强、摘要与推荐等能力。

## 当前实现概览

- 实时 STT 主路径：讯飞 `RTASR`，`IAT` 作为短语音回退方案
- 实时翻译主路径：`NMTTranslator` + `TranslationGateway`
- Tencent TMT 适配：通过本地 `http://127.0.0.1:8765` adapter 暴露 `/health` 与 `/translate`
- LLM 增强侧链：独立 `llm` 配置，用于摘要、纠错建议、推荐等增强能力
- 向量能力：Doubao Embedding，用于个人词典语义检索
- 笔记能力：按会话自动生成 Markdown 笔记，可追加 summary 块

## 主要能力

### 实时同传主链

- 系统音频与麦克风采集：`AudioCapture` + `AudioFrameBuffer`
- STT provider 选择：`XfyunRtasrClient`（默认）/ `XfyunIatClient`（回退）
- 句子组装：`SentenceAssembler`
- 实时翻译：`TranslationGateway` 驱动 `NMTTranslator`
- Tencent TMT：支持本地 adapter 模式与自定义 NMT 服务模式
- 实时字幕：字幕窗支持流式展示与差分更新

### 知识与增强

- 语言词典 / 领域词典 / 个人词典
- `TerminologyResolver` 将词典结果转为翻译约束
- `PersonalizationResolver` / `KnowledgeRetriever` 支持个性化和知识命中
- `EnhancementOrchestrator` 统一调度摘要、纠错建议、推荐状态

### 笔记与会话

- `SessionManager` 负责会话编排、STT 部分结果、最终翻译、增强侧链
- `NoteRepository` 负责创建会话笔记、写入句子、追加 summary
- `NoteReader` 负责笔记目录浏览与读取

### 前端与窗口

- 主窗口：设置、笔记、词典、收藏、摘要等主界面
- 字幕窗：透明悬浮字幕显示
- 控制窗：开始/暂停/恢复/结束会话、字幕显隐
- 设置面板区分：
  - STT provider
  - Realtime translation provider
  - Tencent TMT 配置
  - LLM 增强服务
  - 向量模型
  - 增强能力开关

## 配置

应用运行时会优先读取 `.env`，并将用户配置持久化到 Electron `userData/SynchroLens/settings.json`。

### 典型环境变量

```bash
XFYUN_APP_ID=your_xfyun_app_id
XFYUN_API_KEY=your_xfyun_api_key
XFYUN_API_SECRET=your_xfyun_api_secret

NMT_API_ENDPOINT=http://127.0.0.1:8765
NMT_API_KEY=
NMT_MODEL=tencent-tmt

LLM_API_ENDPOINT=https://api.deepseek.com
LLM_API_KEY=your_llm_api_key
LLM_MODEL=deepseek-v4-flash
```

### 默认配置要点

- `stt.provider = xfyun-rtasr`
- `translation.provider = tencent-tmt`
- `translation.apiEndpoint = http://127.0.0.1:8765`
- `translation.model = tencent-tmt`
- `llm.provider = deepseek`
- `vector.apiEndpoint = https://ark.cn-beijing.volces.com/api/v3`
- `vector.model = doubao-embedding-vision-251215`

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Electron 28 |
| 前端 | React 18 + TypeScript 5 + TailwindCSS 3 |
| 构建 | Vite 5 + electron-vite 2 |
| STT | XFYun RTASR / IAT |
| 实时翻译 | 自定义 NMT 接口 / Tencent TMT adapter |
| LLM 增强 | DeepSeek/OpenAI 兼容接口 |
| 向量 | Doubao Embedding |
| 日志 | winston + winston-daily-rotate-file |
| 测试 | Jest + @testing-library/react |
| 打包 | electron-builder |

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 类型检查

```bash
npm run typecheck
```

### 运行测试

```bash
npm test -- --runInBand
```

### 生产构建

```bash
npm run build
```

## 项目结构

```text
src/
  main/
    mainEntry.ts
    ipc/
    modules/
      audio/
      config/
      correction/
      dictionary/
      enhancement/
      favorite/
      note/
      personalization/
      session/
      stt/
      tmt/
      translate/
      vector/
    utils/
  preload/
    index.ts
  renderer/
    components/
    hooks/
    windows/
  shared/
    constants.ts
    ipcChannels.ts
    types.ts
Test/
docs/
```

## 关键运行链路

```text
AudioCapture
  -> AudioFrameBuffer
  -> STT client (RTASR/IAT)
  -> SentenceAssembler
  -> SessionManager
  -> TranslationGateway
  -> NMTTranslator / Tencent TMT adapter
  -> subtitle + notes + enhancement sidecars
```

## 验证状态

当前这版回迁实现已通过：

- `npm.cmd run typecheck`
- `npm.cmd test -- --runInBand`
- `npm.cmd run build`

## 文档

- 架构：`docs/ARCHITECTURE.md`
- IPC/API：`docs/API.md`
- 数据模型：`docs/DATA_MODEL.md`
- 基础设施：`docs/INFRASTRUCTURE.md`
- 测试：`docs/TESTING.md`

## License

MIT
