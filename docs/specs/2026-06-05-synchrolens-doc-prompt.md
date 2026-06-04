# SynchroLens 文档生产提示词文档

> 阶段 1.1 产出 | 2026-06-05
> 本文档用于阶段 1.2 编排执行，按 Layer 顺序并行调度子 Agent 产出项目文档。

## 项目概述

**SynchroLens** — AI 同声传译桌面应用，面向中文用户，实时将外语音频翻译为中文字幕。

- 技术栈：Electron + React + TypeScript + TailwindCSS + Vite
- STT：讯飞 WebSocket 实时转写
- 翻译：DeepSeek V4 Pro 流式 API
- 72 小时比赛项目（七牛云 XEngineer AI Coding），需持续 PR 提交
- 核心功能：实时同传、当前句纠正、自动笔记(Markdown)、智能总结、悬浮字幕、控制悬浮窗

设计文档路径：`docs/specs/2026-06-05-synchrolens-design.md`

## 文档依赖拓扑

```
Layer 0（互不依赖，可并行）:
  ├── README.md
  ├── CONVENTIONS.md
  └── ROADMAP.md

Layer 1（依赖 Layer 0）:
  ├── PRD.md
  ├── INFRASTRUCTURE.md
  ├── CONTRIBUTING.md
  └── TESTING.md

Layer 2（依赖 Layer 0-1）:
  ├── ARCHITECTURE.md
  └── CHANGELOG.md

Layer 3（依赖 Layer 0-2）:
  ├── DATA_MODEL.md
  └── API.md

Layer 4（依赖 Layer 0-3）:
  └── docs/adr/
        ├── 001-pipeline-architecture.md
        ├── 002-stt-provider-selection.md
        ├── 003-llm-provider-selection.md
        └── 004-correction-strategy.md
```

---

## Agent 提示词

─────────────────────────────────────
[Layer 0] README.md Agent
─────────────────────────────────────
【目标】产出项目 README.md
【输入】
--- BEGIN SHARED CONTEXT ---
项目: SynchroLens — AI 同声传译助手
定位: 面向中文用户的桌面同声传译工具
技术栈: Electron + React + TypeScript + TailwindCSS + Vite
STT: 讯飞 WebSocket 实时转写
翻译: DeepSeek V4 Pro 流式 API
核心功能:
  - 实时同传（系统音频/麦克风 → STT → 翻译 → 字幕）
  - 当前句纠正（句子未结束时翻译随上下文调整）
  - 自动笔记（每句确认后写入 Markdown，纠正以脚注标注）
  - 智能总结（会话结束可选生成摘要）
  - 悬浮字幕（歌词式半透明置顶，叠加在视频上方）
  - 控制悬浮窗（横条状迷你控制）
  - 三栏主窗口（左侧功能+文件夹 | 中间笔记 | 右侧摘要，可合并）
比赛: 七牛云 XEngineer AI Coding 比赛，72小时限时开发
--- END SHARED CONTEXT ---
【输出】README.md 完整内容
【步骤】
1. 阅读共享上下文
2. 撰写 README，包含：项目标题、一句话描述、功能特性列表、技术栈、快速开始（安装/运行/打包）、项目结构概览、依赖说明（第三方库及用途）、Demo 视频占位、License
3. 快速开始部分需包含具体的 npm 命令
4. 依赖说明需列明所有第三方库及用途（比赛要求）
【约束】
- 不猜测，只写上下文中明确提到的
- Demo 视频链接用占位符 [PENDING: 待录制后补充]
- 保持简洁，这是 72 小时比赛项目，不需要过度文档化

─────────────────────────────────────
[Layer 0] CONVENTIONS.md Agent
─────────────────────────────────────
【目标】产出开发约定文档 CONVENTIONS.md
【输入】
--- BEGIN SHARED CONTEXT ---
项目: SynchroLens — AI 同声传译助手
技术栈: Electron + React + TypeScript + TailwindCSS + Vite
项目结构:
  src/main/ — 主进程（AudioCapture, STTClient, Translator, NoteWriter, CorrectionDetector, SessionManager）
  src/renderer/ — 渲染进程（MainWindow, SubtitleWindow, ControlWindow）
  src/shared/ — 共享类型和常量
  src/preload/ — preload 脚本
  Test/ — 测试目录
语言: TypeScript（严格模式）
测试: Jest
比赛要求: 每个 PR 只做一件事，PR 标题和描述需清晰完整
--- END SHARED CONTEXT ---
【输出】CONVENTIONS.md 完整内容
【步骤】
1. 阅读共享上下文
2. 撰写开发约定，包含：代码风格（TypeScript 严格模式、命名规范）、文件组织规范、Git 提交规范（Conventional Commits）、PR 规范、测试规范、目录结构约定
3. Git 提交规范需与比赛 PR 规范对齐
【约束】
- 约定需具体可执行，不要泛泛而谈
- 命名规范需覆盖：文件名、组件名、函数名、类型名、常量名
- PR 规范需包含：标题格式、描述模板（功能描述+实现思路+测试方式）

─────────────────────────────────────
[Layer 0] ROADMAP.md Agent
─────────────────────────────────────
【目标】产出功能路线图 ROADMAP.md
【输入】
--- BEGIN SHARED CONTEXT ---
项目: SynchroLens — AI 同声传译助手
MVP 功能（72h 内，P0/P1）:
  P0: 系统音频捕获、麦克风捕获、实时STT(讯飞)、流式翻译(DeepSeek)、字幕渲染、当前句纠正、悬浮字幕窗口、控制悬浮窗
  P1: 笔记自动写入(Markdown)、笔记纠正标注、自动总结
  P2: 本地文件音频
后续迭代:
  - 语音播报(TTS)
  - 日志查看器（阅读视图/编辑视图，右键改进对话框）
  - 用户词典学习（从用户纠正中学习偏好）
  - 领域偏好适配（记录用户常看领域，自动加载术语库）
--- END SHARED CONTEXT ---
【输出】ROADMAP.md 完整内容
【步骤】
1. 阅读共享上下文
2. 撰写路线图，按阶段划分：v0.1(MVP/72h)、v0.2(完善)、v1.0(正式版)
3. 每个功能标注优先级和预计阶段
【约束】
- MVP 阶段功能必须与设计文档一致
- 后续迭代功能保持开放，不承诺具体时间

─────────────────────────────────────
[Layer 1] PRD.md Agent
─────────────────────────────────────
【目标】产出产品需求文档 PRD.md
【输入】
--- BEGIN SHARED CONTEXT ---
[此处插入 Layer 0 已完成文档: README.md + CONVENTIONS.md + ROADMAP.md]
设计文档路径: docs/specs/2026-06-05-synchrolens-design.md
--- END SHARED CONTEXT ---
【输出】PRD.md 完整内容
【步骤】
1. 阅读共享上下文和设计文档
2. 撰写 PRD，包含：产品概述、目标用户、用户场景、功能需求（按优先级）、非功能需求（性能/安全/可用性）、竞品分析、成功指标
3. 功能需求需覆盖设计文档中 MVP 全部功能
4. 非功能需求需包含：字幕延迟 <3s、翻译准确率、断线重连、API Key 安全存储
【约束】
- 必须阅读设计文档后再撰写，不可凭空编写
- 功能需求需与设计文档 MVP 范围完全一致

─────────────────────────────────────
[Layer 1] INFRASTRUCTURE.md Agent
─────────────────────────────────────
【目标】产出基础设施声明文档 INFRASTRUCTURE.md
【输入】
--- BEGIN SHARED CONTEXT ---
[此处插入 Layer 0 已完成文档]
技术栈: Electron + React + TypeScript + TailwindCSS + Vite + electron-vite
STT: 讯飞 WebSocket 实时转写 API
翻译: DeepSeek V4 Pro 流式 API (OpenAI 兼容接口)
构建: Vite + electron-vite
打包: electron-builder
测试: Jest + @testing-library/react
笔记存储: 本地文件系统 (Markdown)
--- END SHARED CONTEXT ---
【输出】INFRASTRUCTURE.md 完整内容
【步骤】
1. 阅读共享上下文
2. 撰写基础设施声明，包含：开发环境要求、依赖清单及版本、构建流程、打包流程、外部服务依赖（讯飞/DeepSeek API）、环境变量配置、CI/CD（如有）
3. 依赖清单需包含所有 npm 包及用途
【约束】
- 版本号用具体版本或范围，不要模糊
- 环境变量需列出所有需要的 key（API Key 等）

─────────────────────────────────────
[Layer 1] CONTRIBUTING.md Agent
─────────────────────────────────────
【目标】产出贡献者契约 CONTRIBUTING.md
【输入】
--- BEGIN SHARED CONTEXT ---
[此处插入 Layer 0 已完成文档，特别是 CONVENTIONS.md]
比赛要求:
  - 每个 PR 只做一件事
  - PR 标题与描述需清晰完整，包含：标题(一句话)、功能描述、实现思路、测试方式
  - PR 合并后主分支需保持可运行
  - 全周期持续交付，严禁临尾突击提交
--- END SHARED CONTEXT ---
【输出】CONTRIBUTING.md 完整内容
【步骤】
1. 阅读共享上下文，特别是 CONVENTIONS.md
2. 撰写贡献指南，包含：开发环境搭建、开发流程、PR 提交规范、代码审查标准、测试要求
3. PR 规范需与比赛要求完全对齐
【约束】
- 不要与 CONVENTIONS.md 重复，引用即可
- 重点在流程和规范，不是代码风格

─────────────────────────────────────
[Layer 1] TESTING.md Agent
─────────────────────────────────────
【目标】产出测试策略文档 TESTING.md
【输入】
--- BEGIN SHARED CONTEXT ---
[此处插入 Layer 0 已完成文档]
测试框架: Jest + @testing-library/react
测试目录: Test/
测试层级:
  - 单元测试: PCM重采样、Markdown格式化、纠正检测、上下文窗口滑动
  - 集成测试: STT→翻译请求构建、翻译→笔记写入、IPC消息收发
  - E2E测试: 完整翻译流程
Mock策略:
  - 讯飞STT: mock WebSocket，模拟逐词流入+句结束信号
  - DeepSeek: mock SSE流式响应，模拟token逐个返回
  - 音频捕获: mock PCM数据流
--- END SHARED CONTEXT ---
【输出】TESTING.md 完整内容
【步骤】
1. 阅读共享上下文
2. 撰写测试策略，包含：测试层级说明、各模块测试用例清单、Mock 策略、测试命令、覆盖率要求
3. 测试用例清单需覆盖核心管道的每个模块
【约束】
- 测试用例需具体到函数名和预期行为
- Mock 策略需具体到如何模拟 API 响应

─────────────────────────────────────
[Layer 2] ARCHITECTURE.md Agent
─────────────────────────────────────
【目标】产出架构蓝图文档 ARCHITECTURE.md
【输入】
--- BEGIN SHARED CONTEXT ---
[此处插入 Layer 0-1 已完成文档]
设计文档路径: docs/specs/2026-06-05-synchrolens-design.md
--- END SHARED CONTEXT ---
【输出】ARCHITECTURE.md 完整内容
【步骤】
1. 阅读共享上下文和设计文档
2. 撰写架构文档，包含：系统架构图（管道式）、进程架构（Main/Renderer/Preload）、模块依赖拓扑、数据流图、IPC 通信协议、关键设计决策
3. 模块依赖拓扑需明确标注 Layer 分层
4. 数据流需覆盖完整管道：音频采集→STT→翻译→字幕→笔记→纠正检测
【约束】
- 必须阅读设计文档后再撰写
- 架构图用 Mermaid 语法
- 依赖拓扑需与项目目录结构对应

─────────────────────────────────────
[Layer 2] CHANGELOG.md Agent
─────────────────────────────────────
【目标】产出变更日志规范 CHANGELOG.md
【输入】
--- BEGIN SHARED CONTEXT ---
[此处插入 Layer 0-1 已完成文档]
项目刚启动，尚无版本发布
--- END SHARED CONTEXT ---
【输出】CHANGELOG.md 完整内容
【步骤】
1. 阅读共享上下文
2. 撰写变更日志，遵循 Keep a Changelog 格式
3. 当前版本为 Unreleased，列出 MVP 开发中的变更项
【约束】
- 格式遵循 Keep a Changelog
- 分类：Added / Changed / Fixed / Removed

─────────────────────────────────────
[Layer 3] DATA_MODEL.md Agent
─────────────────────────────────────
【目标】产出数据模型契约文档 DATA_MODEL.md
【输入】
--- BEGIN SHARED CONTEXT ---
[此处插入 Layer 0-2 已完成文档]
核心数据结构:
  STTResult { sentenceId, text, isFinal, timestamp }
  TranslationResult { sentenceId, original, translation, isFinal, corrections[] }
  Correction { from, to, reason, timestamp }
  Session { id, startTime, endTime?, audioSource, sentences[], notePath?, summary? }
笔记格式: Markdown，每会话一个文件，保存目录 YYYY-MM-DD/HH-mm.md
配置存储: electron-store (JSON)
--- END SHARED CONTEXT ---
【输出】DATA_MODEL.md 完整内容
【步骤】
1. 阅读共享上下文
2. 撰写数据模型文档，包含：核心类型定义（TypeScript 接口）、笔记 Markdown 格式规范、配置数据结构、文件系统布局
3. 类型定义需与设计文档完全一致
【约束】
- 类型定义必须是合法的 TypeScript
- 笔记格式需给出完整的示例

─────────────────────────────────────
[Layer 3] API.md Agent
─────────────────────────────────────
【目标】产出 IPC 接口契约文档 API.md
【输入】
--- BEGIN SHARED CONTEXT ---
[此处插入 Layer 0-2 已完成文档]
IPC 通道:
  Main → Renderer:
    stt:partial { sentenceId, text, isFinal }
    stt:sentence { sentenceId, text, timestamp }
    translate:partial { sentenceId, translation }
    translate:final { sentenceId, translation }
    translate:correct { sentenceId, oldTranslation, newTranslation, reason }
    note:saved { filePath }
    note:summary { summary }

  Renderer → Main:
    session:start { audioSource }
    session:stop {}
    session:pause {}
    config:update { sttKey?, llmKey?, ... }
    summary:trigger {}

外部 API:
  讯飞 WebSocket 实时转写 API
  DeepSeek Chat Completions API (OpenAI 兼容)
--- END SHARED CONTEXT ---
【输出】API.md 完整内容
【步骤】
1. 阅读共享上下文
2. 撰写 API 文档，包含：IPC 通道清单（含参数和返回值类型）、讯飞 WebSocket 协议要点、DeepSeek API 调用规范（含 System Prompt）
3. 每个通道需标注方向、参数类型、触发时机
【约束】
- IPC 通道需与设计文档完全一致
- 外部 API 只写调用要点，不重复官方文档

─────────────────────────────────────
[Layer 4] ADR Agent
─────────────────────────────────────
【目标】产出 4 份架构决策记录
【输入】
--- BEGIN SHARED CONTEXT ---
[此处插入 Layer 0-3 已完成文档]
设计文档路径: docs/specs/2026-06-05-synchrolens-design.md
--- END SHARED CONTEXT ---
【输出】4 份 ADR 文件
【步骤】
1. 阅读共享上下文和设计文档
2. 撰写以下 ADR：

ADR-001: 选择管道式架构而非事件驱动架构
  - 背景：三种架构方案对比（管道/事件驱动/中心调度）
  - 决策：管道式
  - 原因：模块解耦但不过度设计，回溯纠正天然适配，72h 最优解

ADR-002: 选择讯飞作为 STT 服务商
  - 背景：讯飞 vs 阿里云 vs 本地 Whisper
  - 决策：讯飞 WebSocket 实时转写
  - 原因：国内最成熟，流式输出，首帧延迟 <80ms，中英文混合识别好

ADR-003: 选择 DeepSeek 作为翻译 LLM
  - 背景：DeepSeek vs 智谱 GLM-5 vs 通义千问
  - 决策：DeepSeek V4 Pro
  - 原因：性价比极高（比 GPT-5.5 便宜约 12 倍），流式输出，API 简单（OpenAI 兼容）

ADR-004: 纠正策略——字幕只管当前句，笔记承载纠正
  - 背景：回溯纠正的呈现方式选择
  - 决策：字幕只纠正当前句（未冻结），已冻结句子的纠正写入笔记脚注
  - 原因：字幕回溯改已确认句是视觉灾难，笔记脚注既满足比赛"修正能力"要求又不影响体验

3. 每份 ADR 格式：标题、状态(已接受)、背景、决策、原因、后果
【约束】
- ADR 格式遵循 Michael Nygard 模板
- 决策原因需基于事实，不要主观臆断
