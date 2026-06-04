# SynchroLens 代码开发提示词文档

> 阶段 2.1 产出 | 2026-06-05
> 本文档用于阶段 2.2 编排执行，按 Layer 顺序并行调度子 Agent 开发模块代码。

## 项目概述

**SynchroLens** — AI 同声传译桌面应用，面向中文用户，实时将外语音频翻译为中文字幕。

- 技术栈：Electron + React + TypeScript + TailwindCSS + Vite + electron-vite
- STT：讯飞 WebSocket 实时转写 API
- 翻译：DeepSeek V4 Pro 流式 API（OpenAI 兼容接口）
- 72 小时比赛项目（七牛云 XEngineer AI Coding），需持续 PR 提交
- 核心功能：实时同传、当前句纠正、自动笔记(Markdown)、智能总结、悬浮字幕、控制悬浮窗

**项目目录**：`E:\Trae\Project\七牛云\SynchroLens`

**核心文档路径**：
- 设计文档：`docs/specs/2026-06-05-synchrolens-design.md`
- 架构文档：`ARCHITECTURE.md`
- 数据模型：`DATA_MODEL.md`
- API 契约：`API.md`
- 开发约定：`CONVENTIONS.md`
- 基础设施：`INFRASTRUCTURE.md`
- 测试策略：`TESTING.md`
- 前端指导：`docs/specs/2026-06-05-synchrolens-frontend-guide.md`

---

## 模块依赖拓扑

```
Layer 0 — 共享层（无依赖，3 Agent 并行）
  ├── shared/types        核心类型定义
  ├── shared/ipcChannels  IPC 通道常量
  └── shared/constants    业务常量

Layer 1 — 基础设施层（依赖 L0，4 Agent 并行）
  ├── build               构建配置 + 项目脚手架
  ├── preload             contextBridge 安全暴露
  ├── ipc                 IPC 通道注册与分发
  └── utils               工具函数（重采样/VAD/Markdown格式化）

Layer 2 — 领域层（依赖 L0-L1，5 Agent 并行）
  ├── audio               音频采集模块
  ├── stt                 讯飞 STT 客户端
  ├── translate           DeepSeek 翻译客户端
  ├── note                Markdown 笔记写入
  └── correction          纠正检测模块

Layer 3 — 应用层（依赖 L0-L2，2 Agent 并行）
  ├── session             会话管理 + 主进程入口
  └── hooks               React Hooks

Layer 4 — 表现层（依赖 L0-L3，3 Agent 并行）
  ├── subtitle-window     悬浮字幕窗口
  ├── main-window         主窗口（三栏布局）
  └── control-window      控制悬浮窗

Final — 演示层（依赖全部）
  └── demo                端到端演示
```

**依赖规则**：
- L0 → 无依赖，纯类型和常量
- L1 → 仅依赖 L0
- L2 → 依赖 L0 + L1
- L3 → 依赖 L0 + L1 + L2
- L4 → 依赖 L0 + L1 + L2 + L3
- Final → 依赖全部

**同层并行**：同一 Layer 内的所有 Agent 互不依赖，可并行调度。

**缓存优化**：同一 Layer 内所有 Agent 的共享上下文前缀必须完全相同，结构为：
```
[系统指令] + [项目文档摘要] + [已完成模块代码] + --- END SHARED CONTEXT --- + ### MODULE INSTRUCTIONS ### + [模块专属指令]
```

---

## Agent 提示词

### ═══════════════════════════════════════════
### Layer 0 — 共享层
### ═══════════════════════════════════════════

─────────────────────────────────────
[Layer 0] shared/types Agent
─────────────────────────────────────

【目标】
开发 `src/shared/types.ts`，定义项目全部核心类型，被所有模块引用。

完成后通过该模块的全部单元测试。

【输入 - 共享上下文】
--- BEGIN SHARED CONTEXT ---
项目: SynchroLens — AI 同声传译助手
技术栈: Electron + React + TypeScript + TailwindCSS + Vite
--- END SHARED CONTEXT ---

【输入 - 模块指令】
### MODULE INSTRUCTIONS ###

一、需要定义的类型清单

1. **STTResult** — STT 识别结果
   ```typescript
   interface STTResult {
     sentenceId: string;   // 句子唯一标识
     text: string;         // 识别文本内容
     isFinal: boolean;     // 是否为最终确认结果（false 表示中间片段）
     timestamp: number;    // 时间戳（毫秒，epoch time）
   }
   ```

2. **TranslationResult** — 翻译结果
   ```typescript
   interface TranslationResult {
     sentenceId: string;           // 对应的句子唯一标识
     original: string;            // 原文文本
     translation: string;         // 译文文本
     isFinal: boolean;            // 是否为最终确认结果
     corrections: Correction[];   // 纠正记录列表
   }
   ```

3. **Correction** — 纠正记录
   ```typescript
   interface Correction {
     from: string;         // 纠正前的文本
     to: string;           // 纠正后的文本
     reason: string;       // 纠正原因说明
     timestamp: number;    // 纠正发生的时间戳（毫秒，epoch time）
   }
   ```

4. **Session** — 翻译会话
   ```typescript
   interface Session {
     id: string;                   // 会话唯一标识
     startTime: number;            // 会话开始时间（毫秒，epoch time）
     endTime?: number;             // 会话结束时间（毫秒，epoch time），进行中为 undefined
     audioSource: 'system' | 'microphone' | 'file'; // 音频来源类型
     sentences: TranslationResult[]; // 会话中的翻译结果列表
     notePath?: string;            // 关联的笔记文件路径
     summary?: string;             // 会话摘要
   }
   ```

5. **AppConfig** — 应用配置（含子配置）
   ```typescript
   interface AppConfig {
     general: GeneralConfig;
     stt: STTConfig;
     translation: TranslationConfig;
     note: NoteConfig;
     audio: AudioConfig;
   }

   interface GeneralConfig {
     language: 'zh-CN' | 'en-US';
     theme: 'light' | 'dark' | 'system';
     minimizeToTray: boolean;
     autoStart: boolean;
   }

   interface STTConfig {
     provider: 'xfyun' | 'whisper-local' | 'whisper-api';
     language: string;
     apiKey?: string;
     apiSecret?: string;
     appId?: string;
     apiEndpoint?: string;
   }

   interface TranslationConfig {
     provider: 'deepseek' | 'openai' | 'local';
     targetLanguage: string;
     apiKey?: string;
     apiEndpoint?: string;
     model?: string;
     contextCorrection: boolean;
     contextWindowSize: number;
   }

   interface NoteConfig {
     saveDir: string;
     autoSave: boolean;
     autoSaveInterval: number;
     autoSummary: boolean;
     summaryThreshold: number;
   }

   interface AudioConfig {
     source: 'system' | 'microphone' | 'file';
     systemAudioBackend: 'wasapi' | 'pulseaudio' | 'coreaudio';
     microphoneDeviceId?: string;
     sampleRate: number;
     noiseReduction: boolean;
   }
   ```

6. **IPC 事件载荷类型**
   ```typescript
   // Main → Renderer
   interface STTPartialPayload { sentenceId: string; text: string; isFinal: false; }
   interface STTSentencePayload { sentenceId: string; text: string; timestamp: number; }
   interface TranslatePartialPayload { sentenceId: string; translation: string; }
   interface TranslateFinalPayload { sentenceId: string; original: string; translation: string; corrections: Correction[]; }
   interface TranslateCorrectPayload { sentenceId: string; oldTranslation: string; newTranslation: string; reason: string; }
   interface NoteSavedPayload { filePath: string; }
   interface NoteSummaryPayload { summary: string; }

   // Renderer → Main
   interface SessionStartPayload { audioSource: 'system' | 'microphone'; }
   interface ConfigUpdatePayload { [key: string]: unknown; }
   ```

7. **会话状态枚举**
   ```typescript
   type SessionState = 'idle' | 'running' | 'paused' | 'stopped';
   ```

8. **设备信息**
   ```typescript
   interface DeviceInfo {
     deviceId: string;
     label: string;
   }
   ```

二、测试要求
- 测试框架：Jest
- 测试文件位置：`Test/shared/types.test.ts`
- 覆盖率目标：≥ 70%
- 必须测试的场景：
  - 各接口的类型守卫函数（isSTTResult, isTranslationResult 等）能正确判断合法/非法输入
  - SessionState 类型联合的值约束
  - AppConfig 的默认值常量导出正确

三、约束
- 只在 `src/shared/types.ts` 和 `Test/shared/types.test.ts` 中创建/修改文件
- 所有接口使用 `export` 导出
- 不引入任何第三方依赖
- 中文 JSDoc 注释

【输出】
- `src/shared/types.ts` 完整源代码
- `Test/shared/types.test.ts` 测试代码
- 测试通过的证据

【步骤】
1. 阅读 --- BEGIN SHARED CONTEXT --- 到 --- END SHARED CONTEXT --- 之间的全部内容
2. 在 `src/shared/types.ts` 中定义所有类型
3. 为每个接口编写类型守卫函数
4. 导出 AppConfig 的默认值常量 `DEFAULT_CONFIG`
5. 编写单元测试
6. 运行测试，确保全部通过
7. 输出测试结果作为完成证据

【约束】
- 禁止修改共享上下文中已有的代码
- 只在 `src/shared/` 和 `Test/shared/` 目录下创建/修改文件
- 遵循 CONVENTIONS.md 中的命名规范和编码风格
- 如有疑问，在代码中以 TODO 注释标记，不要猜测

─────────────────────────────────────
[Layer 0] shared/ipcChannels Agent
─────────────────────────────────────

【目标】
开发 `src/shared/ipcChannels.ts`，定义全部 IPC 通道名称常量，被主进程和渲染进程共同引用。

完成后通过该模块的全部单元测试。

【输入 - 共享上下文】
--- BEGIN SHARED CONTEXT ---
项目: SynchroLens — AI 同声传译助手
IPC 通道清单:
  Main → Renderer:
    stt:partial, stt:sentence, translate:partial, translate:final,
    translate:correct, note:saved, note:summary
  Renderer → Main:
    session:start, session:stop, session:pause, config:update, summary:trigger
--- END SHARED CONTEXT ---

【输入 - 模块指令】
### MODULE INSTRUCTIONS ###

一、需要实现的常量

```typescript
/** IPC 通道名称常量 */
export const IPC_CHANNELS = {
  // Main → Renderer
  STT_PARTIAL: 'stt:partial',
  STT_SENTENCE: 'stt:sentence',
  TRANSLATE_PARTIAL: 'translate:partial',
  TRANSLATE_FINAL: 'translate:final',
  TRANSLATE_CORRECT: 'translate:correct',
  NOTE_SAVED: 'note:saved',
  NOTE_SUMMARY: 'note:summary',

  // Renderer → Main
  SESSION_START: 'session:start',
  SESSION_STOP: 'session:stop',
  SESSION_PAUSE: 'session:pause',
  CONFIG_UPDATE: 'config:update',
  SUMMARY_TRIGGER: 'summary:trigger',
} as const;

/** IPC 通道名称类型 */
export type IPCChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];

/** Main → Renderer 通道类型 */
export type MainToRendererChannel =
  | 'stt:partial'
  | 'stt:sentence'
  | 'translate:partial'
  | 'translate:final'
  | 'translate:correct'
  | 'note:saved'
  | 'note:summary';

/** Renderer → Main 通道类型 */
export type RendererToMainChannel =
  | 'session:start'
  | 'session:stop'
  | 'session:pause'
  | 'config:update'
  | 'summary:trigger';
```

二、测试要求
- 测试框架：Jest
- 测试文件位置：`Test/shared/ipcChannels.test.ts`
- 覆盖率目标：≥ 90%
- 必须测试的场景：
  - IPC_CHANNELS 对象包含所有通道名
  - 通道值与通道名字符串一致
  - IPCChannel 类型联合包含所有值
  - 不存在重复的通道值

三、约束
- 只在 `src/shared/ipcChannels.ts` 和 `Test/shared/ipcChannels.test.ts` 中创建/修改文件
- 使用 `as const` 确保类型推断为字面量类型
- 不引入任何第三方依赖

【输出】
- `src/shared/ipcChannels.ts` 完整源代码
- `Test/shared/ipcChannels.test.ts` 测试代码
- 测试通过的证据

【步骤】
1. 阅读共享上下文
2. 定义 IPC_CHANNELS 常量和相关类型
3. 编写单元测试
4. 运行测试，确保全部通过
5. 输出测试结果

【约束】
- 禁止修改共享上下文中已有的代码
- 只在 `src/shared/` 和 `Test/shared/` 目录下创建/修改文件
- 遵循 CONVENTIONS.md 中的命名规范

─────────────────────────────────────
[Layer 0] shared/constants Agent
─────────────────────────────────────

【目标】
开发 `src/shared/constants.ts`，定义全部业务常量，被各模块引用。

完成后通过该模块的全部单元测试。

【输入 - 共享上下文】
--- BEGIN SHARED CONTEXT ---
项目: SynchroLens — AI 同声传译助手
业务常量分类:
  音频: 采样率 16000Hz, 帧大小 640 bytes, 帧间隔 40ms
  STT: 最大重连 3 次, 重连间隔 2000ms, 连接超时 10000ms, 单次会话最长 60000ms
  翻译: 上下文窗口 5 句, 翻译超时 10000ms, 最大重试 3 次, 初始重试间隔 1000ms, 退避因子 2, 最大间隔 8000ms
  笔记: 默认保存目录 ~/SynchroLens/Notes, 自动保存间隔 5000ms, 纠正批量大小 5 句, 笔记写入重试 3 次, 写入重试间隔 1000ms
  UI: 最大可见句子数 8, 字幕背景透明度 0.7, 面板合并动画 300ms, 纠正动画 300ms
  快捷键: 开始/停止 Ctrl+Shift+S, 暂停/恢复 Ctrl+Shift+P
--- END SHARED CONTEXT ---

【输入 - 模块指令】
### MODULE INSTRUCTIONS ###

一、需要定义的常量分组

```typescript
/** 音频相关常量 */
export const AUDIO_CONSTANTS = {
  SAMPLE_RATE: 16000,
  FRAME_SIZE: 640,          // 16000 * 0.04 * 2 (16bit)
  FRAME_INTERVAL_MS: 40,
  INPUT_SAMPLE_RATE: 48000, // 系统音频默认采样率
} as const;

/** STT 相关常量 */
export const STT_CONSTANTS = {
  MAX_RETRY_COUNT: 3,
  RETRY_INTERVAL_MS: 2000,
  CONNECTION_TIMEOUT_MS: 10000,
  MAX_SESSION_DURATION_MS: 60000,
  WS_URL: 'wss://iat-api.xfyun.cn/v2/iat',
} as const;

/** 翻译相关常量 */
export const TRANSLATE_CONSTANTS = {
  CONTEXT_WINDOW_SIZE: 5,
  TRANSLATION_TIMEOUT_MS: 10000,
  MAX_RETRY_COUNT: 3,
  INITIAL_RETRY_INTERVAL_MS: 1000,
  RETRY_BACKOFF_FACTOR: 2,
  MAX_RETRY_INTERVAL_MS: 8000,
  API_BASE_URL: 'https://api.deepseek.com/v1',
  MODEL: 'deepseek-chat',
  TEMPERATURE: 0.3,
} as const;

/** 笔记相关常量 */
export const NOTE_CONSTANTS = {
  DEFAULT_SAVE_DIR: 'SynchroLens/Notes',
  AUTO_SAVE_INTERVAL_MS: 5000,
  CORRECTION_BATCH_SIZE: 5,
  WRITE_RETRY_COUNT: 3,
  WRITE_RETRY_INTERVAL_MS: 1000,
} as const;

/** UI 相关常量 */
export const UI_CONSTANTS = {
  MAX_VISIBLE_SENTENCES: 8,
  SUBTITLE_BG_OPACITY: 0.7,
  PANEL_MERGE_DURATION_MS: 300,
  CORRECTION_ANIMATION_MS: 300,
} as const;

/** 快捷键常量 */
export const SHORTCUT_CONSTANTS = {
  START_STOP: 'Ctrl+Shift+S',
  PAUSE_RESUME: 'Ctrl+Shift+P',
} as const;
```

二、测试要求
- 测试框架：Jest
- 测试文件位置：`Test/shared/constants.test.ts`
- 覆盖率目标：≥ 90%
- 必须测试的场景：
  - 各常量组的值不可修改（as const 冻结）
  - 帧大小计算正确（SAMPLE_RATE * FRAME_INTERVAL_MS / 1000 * 2）
  - 退避策略的间隔序列正确（1s → 2s → 4s → 8s）

三、约束
- 只在 `src/shared/constants.ts` 和 `Test/shared/constants.test.ts` 中创建/修改文件
- 所有常量组使用 `as const` 冻结
- 不引入任何第三方依赖

【输出】
- `src/shared/constants.ts` 完整源代码
- `Test/shared/constants.test.ts` 测试代码
- 测试通过的证据

【步骤】
1. 阅读共享上下文
2. 定义所有常量组
3. 编写单元测试
4. 运行测试，确保全部通过
5. 输出测试结果

【约束】
- 禁止修改共享上下文中已有的代码
- 只在 `src/shared/` 和 `Test/shared/` 目录下创建/修改文件
- 遵循 CONVENTIONS.md 中的命名规范

---

### ═══════════════════════════════════════════
### Layer 1 — 基础设施层
### ═══════════════════════════════════════════

─────────────────────────────────────
[Layer 1] build Agent
─────────────────────────────────────

【目标】
搭建项目脚手架和全部构建配置，确保 `npm install && npm run dev` 可正常启动 Electron 开发服务器。

完成后通过 `npm run typecheck` 和 `npm run lint`。

【输入 - 共享上下文】
--- BEGIN SHARED CONTEXT ---
[Layer 0 已完成模块代码: src/shared/types.ts, src/shared/ipcChannels.ts, src/shared/constants.ts]
--- END SHARED CONTEXT ---

【输入 - 模块指令】
### MODULE INSTRUCTIONS ###

一、需要创建的文件清单

1. **package.json** — 项目配置
   - name: synchrolens
   - version: 0.1.0
   - main: out/main/index.js
   - scripts: dev, build, test, test:coverage, test:watch, lint, format, typecheck, package, make
   - dependencies: electron, react, react-dom, ws, openai
   - devDependencies: typescript, vite, tailwindcss, postcss, autoprefixer, electron-vite, electron-builder, @types/react, @types/react-dom, @types/ws, @vitejs/plugin-react, jest, @testing-library/react, @testing-library/jest-dom, ts-jest, eslint, @typescript-eslint/eslint-plugin, @typescript-eslint/parser, prettier

2. **electron.vite.config.ts** — electron-vite 构建配置
   - main: externalizeDepsPlugin()
   - preload: externalizeDepsPlugin()
   - renderer: react() 插件 + 路径别名（@ → src/renderer, @shared → src/shared）

3. **tsconfig.json** — TypeScript 根配置（references 指向 node 和 web）
4. **tsconfig.node.json** — 主进程 TypeScript 配置（module: commonjs, target: es2020）
5. **tsconfig.web.json** — 渲染进程 TypeScript 配置（jsx: react-jsx, module: esnext）
6. **tailwind.config.ts** — TailwindCSS 配置（content 扫描 src/renderer/）
7. **postcss.config.js** — PostCSS 配置（tailwindcss + autoprefixer）
8. **jest.config.ts** — Jest 配置（roots: Test/, moduleNameMapper 映射 @ 和 @shared）
9. **.eslintrc.cjs** — ESLint 配置
10. **.prettierrc** — Prettier 配置（singleQuote: true, semi: true, tabWidth: 2, trailingComma: all, printWidth: 120）
11. **electron-builder.yml** — 打包配置（appId, productName, directories, files, win/mac/linux targets）
12. **.env.example** — 环境变量模板
13. **.gitignore** — Git 忽略规则（node_modules, dist, out, .env, *.log）
14. **src/renderer/styles/global.css** — 全局样式（TailwindCSS 指令）

二、关键配置要点

- electron-vite 的 renderer 配置中必须设置路径别名：
  ```typescript
  resolve: {
    alias: {
      '@': resolve('src/renderer'),
      '@shared': resolve('src/shared'),
    },
  },
  ```

- Jest 的 moduleNameMapper 必须与路径别名一致：
  ```typescript
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/renderer/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
  },
  ```

- TypeScript 配置中需设置 paths 别名：
  ```json
  "paths": {
    "@/*": ["./src/renderer/*"],
    "@shared/*": ["./src/shared/*"]
  }
  ```

三、约束
- 只在项目根目录和 `src/renderer/styles/` 中创建/修改文件
- 不创建任何业务逻辑代码
- 依赖版本参考 INFRASTRUCTURE.md
- 确保 `npm install` 后无依赖冲突

【输出】
- 全部配置文件
- `npm run typecheck` 通过的证据
- `npm run lint` 通过的证据

【步骤】
1. 阅读共享上下文中的 Layer 0 代码
2. 创建 package.json
3. 创建 electron.vite.config.ts
4. 创建 TypeScript 配置文件
5. 创建 TailwindCSS/PostCSS 配置
6. 创建 Jest 配置
7. 创建 ESLint/Prettier 配置
8. 创建 electron-builder 配置
9. 创建 .env.example 和 .gitignore
10. 创建全局样式文件
11. 运行 `npm install`
12. 运行 `npm run typecheck` 验证
13. 运行 `npm run lint` 验证
14. 输出验证结果

【约束】
- 禁止修改共享上下文中已有的代码
- 依赖版本必须与 INFRASTRUCTURE.md 一致
- 如有疑问，在代码中以 TODO 注释标记

─────────────────────────────────────
[Layer 1] preload Agent
─────────────────────────────────────

【目标】
开发 `src/preload/index.ts`，通过 contextBridge 安全暴露 IPC API 给渲染进程。

完成后通过该模块的全部单元测试。

【输入 - 共享上下文】
--- BEGIN SHARED CONTEXT ---
[Layer 0 已完成模块代码]
--- END SHARED CONTEXT ---

【输入 - 模块指令】
### MODULE INSTRUCTIONS ###

一、需要实现的 API

```typescript
/** SynchroLens 渲染进程 API */
interface SynchroLensAPI {
  // 事件监听（Main → Renderer）
  on(channel: string, callback: (data: any) => void): () => void;  // 返回取消监听函数
  off(channel: string, callback: (data: any) => void): void;
  once(channel: string, callback: (data: any) => void): void;

  // 操作请求（Renderer → Main）
  startSession(audioSource: 'system' | 'microphone'): Promise<void>;
  stopSession(): Promise<void>;
  pauseSession(): Promise<void>;
  updateConfig(config: Record<string, unknown>): Promise<void>;
  triggerSummary(): Promise<void>;
}
```

二、实现要点

- 使用 `contextBridge.exposeInMainWorld('synchroLens', api)` 暴露 API
- `on` 方法内部调用 `ipcRenderer.on`，返回的取消函数调用 `ipcRenderer.removeListener`
- `off` 方法调用 `ipcRenderer.removeListener`
- `once` 方法调用 `ipcRenderer.once`
- 请求方法使用 `ipcRenderer.invoke`
- 通道名称从 `@shared/ipcChannels` 导入

三、测试要求
- 测试框架：Jest
- 测试文件位置：`Test/preload/index.test.ts`
- 覆盖率目标：≥ 80%
- 必须测试的场景：
  - exposeInMainWorld 被调用且 key 为 'synchroLens'
  - on 方法正确注册监听并返回取消函数
  - off 方法正确移除监听
  - once 方法只触发一次
  - startSession/stopSession/pauseSession 调用 ipcRenderer.invoke
  - updateConfig 传递配置对象
  - triggerSummary 调用正确通道

四、约束
- 只在 `src/preload/index.ts` 和 `Test/preload/index.test.ts` 中创建/修改文件
- 不包含任何业务逻辑，仅做 IPC 桥接
- 必须导入 @shared/ipcChannels 中的通道常量

【输出】
- `src/preload/index.ts` 完整源代码
- `Test/preload/index.test.ts` 测试代码
- 测试通过的证据

─────────────────────────────────────
[Layer 1] ipc Agent
─────────────────────────────────────

【目标】
开发 `src/main/ipc/handlers.ts`，注册全部 IPC 通道处理器，分发渲染进程请求到对应模块。

完成后通过该模块的全部单元测试。

【输入 - 共享上下文】
--- BEGIN SHARED CONTEXT ---
[Layer 0 已完成模块代码]
--- END SHARED CONTEXT ---

【输入 - 模块指令】
### MODULE INSTRUCTIONS ###

一、需要实现的函数

```typescript
/**
 * 注册全部 IPC 通道处理器
 * @param modules - 各业务模块实例的集合
 */
export function registerIPCHandlers(modules: ModuleRegistry): void;

/** 业务模块注册表接口 */
interface ModuleRegistry {
  audioCapture: AudioCapture;
  sttClient: STTClient;
  translator: Translator;
  noteWriter: NoteWriter;
  correctionDetector: CorrectionDetector;
  sessionManager: SessionManager;
}
```

二、注册的通道处理器

| 通道 | 类型 | 处理逻辑 |
|------|------|----------|
| `session:start` | ipcMain.handle | 调用 sessionManager.startSession(payload) |
| `session:stop` | ipcMain.handle | 调用 sessionManager.stopSession() |
| `session:pause` | ipcMain.handle | 调用 sessionManager.pauseSession() |
| `config:update` | ipcMain.handle | 调用 sessionManager.updateConfig(payload) |
| `summary:trigger` | ipcMain.handle | 调用 sessionManager.triggerSummary() |

三、事件推送辅助函数

```typescript
/**
 * 向所有渲染进程窗口推送事件
 * @param windows - BrowserWindow 实例列表
 * @param channel - IPC 通道名
 * @param data - 推送数据
 */
export function sendToAllWindows(windows: BrowserWindow[], channel: string, data: unknown): void;
```

四、测试要求
- 测试框架：Jest
- 测试文件位置：`Test/main/ipc/handlers.test.ts`
- 覆盖率目标：≥ 80%
- 必须测试的场景：
  - registerIPCHandlers 注册了所有通道
  - session:start 传递参数到 sessionManager
  - session:stop 调用 sessionManager.stopSession
  - session:pause 调用 sessionManager.pauseSession
  - config:update 传递配置到 sessionManager
  - summary:trigger 调用 sessionManager.triggerSummary
  - sendToAllWindows 向所有窗口推送数据

五、约束
- 只在 `src/main/ipc/handlers.ts` 和 `Test/main/ipc/handlers.test.ts` 中创建/修改文件
- ModuleRegistry 中的模块类型暂用 interface 占位，具体实现在 Layer 2-3
- 必须导入 @shared/ipcChannels 中的通道常量

【输出】
- `src/main/ipc/handlers.ts` 完整源代码
- `Test/main/ipc/handlers.test.ts` 测试代码
- 测试通过的证据

─────────────────────────────────────
[Layer 1] utils Agent
─────────────────────────────────────

【目标】
开发 `src/main/utils/` 目录下的三个工具模块：audioResampler、vad、markdownFormatter。

完成后通过全部单元测试。

【输入 - 共享上下文】
--- BEGIN SHARED CONTEXT ---
[Layer 0 已完成模块代码]
--- END SHARED CONTEXT ---

【输入 - 模块指令】
### MODULE INSTRUCTIONS ###

一、需要实现的函数清单

### 1. audioResampler.ts

```typescript
/**
 * 音频重采样：将输入 PCM 数据从输入采样率转换为输出采样率
 * @param inputBuffer - 输入 PCM 数据（Float32 格式）
 * @param inputSampleRate - 输入采样率
 * @param outputSampleRate - 输出采样率
 * @returns 重采样后的 PCM 数据（Int16 格式）
 */
export function resample(inputBuffer: Float32Array, inputSampleRate: number, outputSampleRate: number): Int16Array;
```

### 2. vad.ts

```typescript
/**
 * 语音活动检测：判断 PCM 缓冲区是否包含语音
 * @param pcmBuffer - PCM 音频数据（Int16 格式）
 * @param threshold - 能量阈值，默认 500
 * @returns 是否检测到语音活动
 */
export function detectVoiceActivity(pcmBuffer: Int16Array, threshold?: number): boolean;

/**
 * 计算 PCM 缓冲区的 RMS 能量值
 * @param pcmBuffer - PCM 音频数据
 * @returns RMS 能量值
 */
export function computeEnergy(pcmBuffer: Int16Array): number;
```

### 3. markdownFormatter.ts

```typescript
/**
 * 格式化会话头部信息
 * @param session - 会话信息
 * @returns Markdown 格式的会话头部
 */
export function formatSessionHeader(session: { startTime: number; audioSource: string; sentenceCount: number; duration: string }): string;

/**
 * 格式化单条翻译条目
 * @param original - 原文
 * @param translated - 译文
 * @param timestamp - 时间戳（毫秒）
 * @returns Markdown 格式的翻译条目
 */
export function formatTranslationEntry(original: string, translated: string, timestamp: number): string;

/**
 * 格式化纠正条目
 * @param correction - 纠正信息
 * @returns Markdown 格式的纠正脚注
 */
export function formatCorrectionEntry(correction: { from: string; to: string; reason: string }): string;

/**
 * 组装完整的 Markdown 文档
 * @param header - 会话头部
 * @param entries - 翻译条目列表
 * @param summary - 摘要内容（可选）
 * @returns 完整的 Markdown 文档
 */
export function buildMarkdownDocument(header: string, entries: string[], summary?: string): string;
```

二、测试要求
- 测试框架：Jest
- 测试文件位置：
  - `Test/main/utils/audioResampler.test.ts`
  - `Test/main/utils/vad.test.ts`
  - `Test/main/utils/markdownFormatter.test.ts`
- 覆盖率目标：≥ 75%
- 必须测试的场景（参考 TESTING.md 第 2.1-2.3 节）：
  - audioResampler: 48kHz→16kHz 正确重采样、空输入、相同采样率、静音段、幅度范围
  - vad: 有语音/静音/全零/阈值边界、RMS 能量计算
  - markdownFormatter: 会话头部、翻译条目、纠正条目、完整文档、空条目列表

三、约束
- 只在 `src/main/utils/` 和 `Test/main/utils/` 目录下创建/修改文件
- 不引入任何第三方依赖
- 遵循 CONVENTIONS.md 中的命名规范

【输出】
- `src/main/utils/audioResampler.ts` 完整源代码
- `src/main/utils/vad.ts` 完整源代码
- `src/main/utils/markdownFormatter.ts` 完整源代码
- 对应测试文件
- 测试通过的证据

---

### ═══════════════════════════════════════════
### Layer 2 — 领域层
### ═══════════════════════════════════════════

─────────────────────────────────────
[Layer 2] audio Agent
─────────────────────────────────────

【目标】
开发 `src/main/modules/audio/AudioCapture.ts`，实现系统音频和麦克风的 PCM 数据采集。

完成后通过该模块的全部单元测试。

【输入 - 共享上下文】
--- BEGIN SHARED CONTEXT ---
[Layer 0-1 已完成模块代码]
--- END SHARED CONTEXT ---

【输入 - 模块指令】
### MODULE INSTRUCTIONS ###

一、需要实现的类

```typescript
/**
 * 音频采集模块
 * 负责从系统音频或麦克风采集 PCM 16bit 16kHz 音频数据
 */
export class AudioCapture {
  /**
   * 启动音频采集
   * @param source - 音频来源类型
   * @param deviceId - 音频设备 ID（麦克风时有效）
   */
  start(source: 'system' | 'microphone', deviceId?: string): void;

  /** 停止音频采集并释放设备 */
  stop(): void;

  /**
   * 注册音频数据回调
   * @param callback - PCM 数据回调函数，参数为 Int16Array（16bit 16kHz 单声道）
   * @returns 取消注册函数
   */
  onData(callback: (pcmBuffer: Int16Array) => void): () => void;

  /**
   * 获取可用的音频输入设备列表
   * @returns 设备信息数组
   */
  getAvailableDevices(): DeviceInfo[];
}
```

二、实现要点

- 系统音频采集：使用 Electron 的 `desktopCapturer.getSources()` 获取系统音频流，通过 `AudioContext` + `ScriptProcessorNode` 或 `AudioWorkletNode` 处理为 PCM
- 麦克风采集：使用 `navigator.mediaDevices.getUserMedia()` 获取麦克风流
- 音频处理流程：原始音频 → AudioContext 解码 → Float32 → audioResampler 重采样为 16kHz → Int16Array
- 采集到的 PCM 数据通过 `onData` 回调输出，每 40ms 输出一帧（640 bytes）
- 切换音源时需先停止当前采集再启动新采集

三、依赖模块的公开 API
- `@shared/types` — DeviceInfo 接口
- `@shared/constants` — AUDIO_CONSTANTS
- `../utils/audioResampler` — resample 函数
- `../utils/vad` — detectVoiceActivity 函数（静音段不发送）

四、测试要求
- 测试框架：Jest
- 测试文件位置：`Test/main/modules/AudioCapture.test.ts`
- 覆盖率目标：≥ 80%
- 必须测试的场景（参考 TESTING.md 第 2.7 节）：
  - start 启动采集并输出 PCM 数据
  - stop 停止采集并释放设备
  - onData 回调在采集到数据时触发
  - getAvailableDevices 返回设备列表
  - 切换音源时先停止旧采集
  - 采集失败时触发错误回调

五、约束
- 只在 `src/main/modules/audio/` 和 `Test/main/modules/` 目录下创建/修改文件
- 使用 Electron desktopCapturer API 时需注意主进程/渲染进程的调用限制
- Mock desktopCapturer 和 getUserMedia 进行测试

【输出】
- `src/main/modules/audio/AudioCapture.ts` 完整源代码
- `Test/main/modules/AudioCapture.test.ts` 测试代码
- 测试通过的证据

─────────────────────────────────────
[Layer 2] stt Agent
─────────────────────────────────────

【目标】
开发 `src/main/modules/stt/STTClient.ts`，实现讯飞 WebSocket 实时转写客户端。

完成后通过该模块的全部单元测试。

【输入 - 共享上下文】
--- BEGIN SHARED CONTEXT ---
[Layer 0-1 已完成模块代码]
--- END SHARED CONTEXT ---

【输入 - 模块指令】
### MODULE INSTRUCTIONS ###

一、需要实现的类

```typescript
/**
 * 讯飞 WebSocket 实时转写客户端
 * 负责与讯飞 STT 服务建立 WebSocket 连接，发送音频数据，接收转写结果
 */
export class STTClient {
  /**
   * 建立 WebSocket 连接
   * @param config - 讯飞 API 配置（appId, apiKey, apiSecret）
   */
  connect(config: { appId: string; apiKey: string; apiSecret: string }): void;

  /**
   * 发送 PCM 音频数据
   * @param pcmChunk - PCM 音频数据（Int16 格式，16kHz 单声道）
   */
  sendAudio(pcmChunk: Int16Array): void;

  /** 发送结束帧并关闭 WebSocket 连接 */
  disconnect(): void;

  /**
   * 注册转写结果回调
   * @param callback - 结果回调，参数为识别文本和是否为最终结果
   */
  onResult(callback: (text: string, isFinal: boolean, sentenceId: string) => void): void;

  /**
   * 注册错误回调
   * @param callback - 错误回调
   */
  onError(callback: (error: Error) => void): void;

  /**
   * 注册连接关闭回调
   * @param callback - 关闭回调
   */
  onClose(callback: () => void): void;

  /** 手动触发重连 */
  reconnect(): void;
}
```

二、实现要点

- 鉴权签名：使用 HMAC-SHA256 生成签名，拼接 authorization 参数（详见 API.md 第 2.2 节）
- 首帧携带业务参数（common + business + data），后续帧仅携带 data
- 帧间隔 40ms，每帧 640 bytes
- 最后一帧 data.status = 2
- 响应解析：`pgs=apd` 为追加结果，`pgs=rpl` 为替换结果（纠正场景）
- 断线重连：自动重连 3 次，间隔 2s
- 单次会话最长 60s，超时后需重新建立连接

三、依赖模块的公开 API
- `@shared/types` — STTResult 接口
- `@shared/constants` — STT_CONSTANTS
- `@shared/ipcChannels` — IPC_CHANNELS.STT_PARTIAL, IPC_CHANNELS.STT_SENTENCE
- `ws` — WebSocket 客户端库

四、测试要求
- 测试框架：Jest
- 测试文件位置：`Test/main/modules/STTClient.test.ts`
- 覆盖率目标：≥ 80%
- 必须测试的场景（参考 TESTING.md 第 2.6 节）：
  - connect 建立 WebSocket 连接并发送鉴权帧
  - sendAudio 将 PCM 数据分帧发送
  - disconnect 发送结束帧并关闭连接
  - onResult 在收到中间结果时以 isFinal=false 回调
  - onResult 在收到句结束信号时以 isFinal=true 回调
  - onError 在连接异常时触发错误回调
  - reconnect 在连接断开后自动重连（最多 3 次）
- Mock 策略：使用 TESTGING.md 中的 mockXfyunWS

五、约束
- 只在 `src/main/modules/stt/` 和 `Test/main/modules/` 目录下创建/修改文件
- 鉴权签名实现需严格遵循 API.md 第 2.2 节
- WebSocket 使用 `ws` 库

【输出】
- `src/main/modules/stt/STTClient.ts` 完整源代码
- `Test/main/modules/STTClient.test.ts` 测试代码
- 测试通过的证据

─────────────────────────────────────
[Layer 2] translate Agent
─────────────────────────────────────

【目标】
开发 `src/main/modules/translate/Translator.ts`，实现 DeepSeek V4 Pro 流式翻译客户端。

完成后通过该模块的全部单元测试。

【输入 - 共享上下文】
--- BEGIN SHARED CONTEXT ---
[Layer 0-1 已完成模块代码]
--- END SHARED CONTEXT ---

【输入 - 模块指令】
### MODULE INSTRUCTIONS ###

一、需要实现的类

```typescript
/**
 * DeepSeek 流式翻译客户端
 * 负责调用 DeepSeek V4 Pro API 进行实时翻译，支持上下文窗口和纠正
 */
export class Translator {
  /**
   * 流式翻译文本
   * @param text - 待翻译的原文
   * @param context - 上下文翻译对（最近 N 句）
   * @yields 翻译 token 片段
   */
  async *translate(text: string, context: TranslationPair[]): AsyncGenerator<string>;

  /**
   * 构建上下文窗口字符串
   * @param recentTranslations - 最近的翻译对列表
   * @param maxCount - 最大保留句数
   * @returns 格式化的上下文字符串
   */
  buildContextWindow(recentTranslations: TranslationPair[], maxCount: number): string;

  /**
   * 翻译完整句子（非流式，用于纠正检测）
   * @param text - 待翻译的原文
   * @param context - 上下文
   * @returns 完整翻译结果
   */
  async translateFull(text: string, context: TranslationPair[]): Promise<string>;

  /**
   * 生成会话摘要
   * @param sentences - 会话中的翻译句子列表
   * @returns 摘要文本
   */
  async generateSummary(sentences: TranslationResult[]): Promise<string>;
}

/** 翻译对（原文+译文） */
interface TranslationPair {
  original: string;
  translation: string;
}
```

二、实现要点

- 使用 OpenAI SDK 兼容模式调用 DeepSeek API
- 流式翻译：`stream: true`，逐 token 返回，每个 token 通过 AsyncGenerator yield
- 上下文窗口：维护最近 5 句原文+译文作为翻译上下文（滑动窗口）
- System Prompt 设计（详见 API.md 第 3.2 节）：
  ```
  你是一个专业的实时翻译助手。你的任务是将用户提供的英文语音识别文本翻译成自然流畅的中文。
  规则：
  1. 保持原文语义，不增删信息
  2. 译文需符合中文表达习惯，避免直译
  3. 每次只翻译当前提供的句子，不要重复之前的翻译
  4. 对于专业术语，采用通用译法
  ```
- 翻译超时 10s，超时后跳过当前句
- 限流降级：上下文窗口从 5 句缩减为 1 句
- 摘要生成：非流式调用，temperature 0.5

三、依赖模块的公开 API
- `@shared/types` — TranslationResult, Correction
- `@shared/constants` — TRANSLATE_CONSTANTS
- `openai` — OpenAI SDK

四、测试要求
- 测试框架：Jest
- 测试文件位置：`Test/main/modules/Translator.test.ts`
- 覆盖率目标：≥ 85%
- 必须测试的场景（参考 TESTING.md 第 2.5 节）：
  - translate 流式返回翻译结果（逐 token）
  - translate 将最近 5 句翻译作为上下文传入请求
  - translate 在上下文超过 5 句时只保留最近 5 句（滑动窗口）
  - translate 在 API 返回错误时抛出可处理的异常
  - buildContextWindow 从翻译对列表构建上下文字符串
  - buildContextWindow 在翻译对数量不足时使用全部可用翻译
  - buildContextWindow 在翻译对为空时返回空字符串
  - translateFull 返回完整翻译结果
  - generateSummary 返回摘要文本
- Mock 策略：使用 TESTING.md 中的 mockDeepSeekSSE

五、约束
- 只在 `src/main/modules/translate/` 和 `Test/main/modules/` 目录下创建/修改文件
- 使用 OpenAI SDK 兼容模式
- API Key 通过构造函数传入，不硬编码

【输出】
- `src/main/modules/translate/Translator.ts` 完整源代码
- `Test/main/modules/Translator.test.ts` 测试代码
- 测试通过的证据

─────────────────────────────────────
[Layer 2] note Agent
─────────────────────────────────────

【目标】
开发 `src/main/modules/note/NoteWriter.ts`，实现 Markdown 笔记自动写入。

完成后通过该模块的全部单元测试。

【输入 - 共享上下文】
--- BEGIN SHARED CONTEXT ---
[Layer 0-1 已完成模块代码]
--- END SHARED CONTEXT ---

【输入 - 模块指令】
### MODULE INSTRUCTIONS ###

一、需要实现的类

```typescript
/**
 * Markdown 笔记写入模块
 * 负责将翻译结果实时写入 Markdown 文件，支持纠正脚注和摘要
 */
export class NoteWriter {
  /**
   * 创建新会话的笔记文件
   * @param session - 会话信息
   * @returns 笔记文件路径
   */
  createNoteFile(session: Session): string;

  /**
   * 追加翻译条目到笔记文件
   * @param filePath - 笔记文件路径
   * @param original - 原文
   * @param translation - 译文
   * @param timestamp - 时间戳
   * @param corrections - 纠正记录（可选）
   */
  appendEntry(filePath: string, original: string, translation: string, timestamp: number, corrections?: Correction[]): Promise<void>;

  /**
   * 追加纠正脚注到笔记文件
   * @param filePath - 笔记文件路径
   * @param correction - 纠正信息
   */
  appendCorrectionFootnote(filePath: string, correction: Correction): Promise<void>;

  /**
   * 追加摘要到笔记文件
   * @param filePath - 笔记文件路径
   * @param summary - 摘要内容
   */
  appendSummary(filePath: string, summary: string): Promise<void>;

  /**
   * 根据会话信息生成文件名
   * @param session - 会话信息
   * @returns 格式化的文件路径（YYYY-MM-DD/HH-mm.md）
   */
  generateFilePath(session: Session): string;
}
```

二、实现要点

- 笔记格式严格遵循 DATA_MODEL.md 第 2 节
- 文件保存目录：`{note.saveDir}/YYYY-MM-DD/HH-mm.md`
- 追加写入模式：每句确认后追加一条，不重写整个文件
- 写入失败重试 3 次，间隔 1s
- 目录不存在时自动创建
- 使用 markdownFormatter 工具函数格式化内容

三、依赖模块的公开 API
- `@shared/types` — Session, Correction
- `@shared/constants` — NOTE_CONSTANTS
- `../utils/markdownFormatter` — formatSessionHeader, formatTranslationEntry, formatCorrectionEntry, buildMarkdownDocument

四、测试要求
- 测试框架：Jest
- 测试文件位置：`Test/main/modules/NoteWriter.test.ts`
- 覆盖率目标：≥ 80%
- 必须测试的场景（参考 TESTING.md 第 2.8 节）：
  - createNoteFile 创建笔记文件并返回路径
  - appendEntry 向已有文件追加翻译条目
  - appendEntry 在文件不存在时创建新文件
  - appendCorrectionFootnote 追加纠正脚注
  - appendSummary 追加摘要
  - generateFilePath 根据会话信息生成正确路径
  - 写入失败时自动重试
- Mock 策略：Mock fs/promises 模块

五、约束
- 只在 `src/main/modules/note/` 和 `Test/main/modules/` 目录下创建/修改文件
- 使用 Node.js fs/promises 模块进行文件操作
- 笔记格式必须与 DATA_MODEL.md 一致

【输出】
- `src/main/modules/note/NoteWriter.ts` 完整源代码
- `Test/main/modules/NoteWriter.test.ts` 测试代码
- 测试通过的证据

─────────────────────────────────────
[Layer 2] correction Agent
─────────────────────────────────────

【目标】
开发 `src/main/modules/correction/CorrectionDetector.ts`，实现翻译一致性纠正检测。

完成后通过该模块的全部单元测试。

【输入 - 共享上下文】
--- BEGIN SHARED CONTEXT ---
[Layer 0-1 已完成模块代码]
--- END SHARED CONTEXT ---

【输入 - 模块指令】
### MODULE INSTRUCTIONS ###

一、需要实现的类

```typescript
/**
 * 翻译一致性纠正检测模块
 * 每 N 句已确认翻译做一次批量检查，检测翻译不一致并生成纠正
 */
export class CorrectionDetector {
  /**
   * 检查翻译一致性
   * @param translations - 最近 N 句翻译对
   * @returns 检测到的纠正结果列表
   */
  async checkConsistency(translations: TranslationPair[]): Promise<CorrectionResult[]>;

  /**
   * 将纠正结果应用到翻译对列表
   * @param translations - 原始翻译对列表
   * @param corrections - 纠正结果列表
   * @returns 应用纠正后的翻译对列表
   */
  applyCorrections(translations: TranslationPair[], corrections: CorrectionResult[]): TranslationPair[];

  /**
   * 判断是否需要触发批量检查
   * @param sentenceCount - 自上次检查以来的句子数
   * @returns 是否需要检查
   */
  shouldCheck(sentenceCount: number): boolean;
}

/** 翻译对 */
interface TranslationPair {
  sentenceId: string;
  original: string;
  translation: string;
}

/** 纠正结果 */
interface CorrectionResult {
  sentenceId: string;
  from: string;
  to: string;
  reason: string;
}
```

二、实现要点

- 每 5 句触发一次批量检查（CORRECTION_BATCH_SIZE）
- 检查方式：将最近 5 句原文+译文发给 LLM，请求检测翻译不一致
- LLM Prompt：要求检查同一术语是否有不同译法、是否有明显翻译错误
- 纠正结果仅写入笔记脚注，不回改字幕（ADR-004）
- shouldCheck 基于句子计数判断

三、依赖模块的公开 API
- `@shared/types` — Correction
- `@shared/constants` — NOTE_CONSTANTS.CORRECTION_BATCH_SIZE
- `../translate/Translator` — Translator.translateFull（用于纠正检测的 LLM 调用）

四、测试要求
- 测试框架：Jest
- 测试文件位置：`Test/main/modules/CorrectionDetector.test.ts`
- 覆盖率目标：≥ 85%
- 必须测试的场景（参考 TESTING.md 第 2.4 节）：
  - checkConsistency 在连续翻译中出现同一术语不同译法时检测到不一致
  - checkConsistency 在翻译完全一致时返回空数组
  - checkConsistency 在翻译数量不足 5 句时不触发批量检查
  - checkConsistency 在累积满 5 句时触发一次批量检查
  - applyCorrections 将纠正结果应用到翻译对列表
  - applyCorrections 在纠正列表为空时返回原列表不变
  - shouldCheck 在句子数达到阈值时返回 true

五、约束
- 只在 `src/main/modules/correction/` 和 `Test/main/modules/` 目录下创建/修改文件
- 纠正策略遵循 ADR-004：字幕只管当前句，笔记承载纠正
- Mock Translator 进行测试

【输出】
- `src/main/modules/correction/CorrectionDetector.ts` 完整源代码
- `Test/main/modules/CorrectionDetector.test.ts` 测试代码
- 测试通过的证据

---

### ═══════════════════════════════════════════
### Layer 3 — 应用层
### ═══════════════════════════════════════════

─────────────────────────────────────
[Layer 3] session Agent
─────────────────────────────────────

【目标】
开发 `src/main/modules/session/SessionManager.ts` 和 `src/main/index.ts`，实现会话生命周期管理和主进程入口。

完成后通过该模块的全部单元测试。

【输入 - 共享上下文】
--- BEGIN SHARED CONTEXT ---
[Layer 0-2 已完成模块代码]
--- END SHARED CONTEXT ---

【输入 - 模块指令】
### MODULE INSTRUCTIONS ###

一、需要实现的类

```typescript
/**
 * 会话生命周期管理器
 * 负责创建/启动/暂停/停止翻译会话，编排各管道模块的协作
 */
export class SessionManager {
  /** 创建新会话 */
  createSession(config: { audioSource: 'system' | 'microphone' }): Session;

  /** 启动指定会话 */
  startSession(sessionId: string): void;

  /** 暂停会话 */
  pauseSession(sessionId: string): void;

  /** 恢复会话 */
  resumeSession(sessionId: string): void;

  /** 结束会话（停止所有模块、触发纠正检测、写入最终笔记、清理资源） */
  async endSession(sessionId: string): Promise<void>;

  /** 获取会话状态 */
  getSessionState(sessionId: string): SessionState;

  /** 更新配置 */
  updateConfig(config: Partial<AppConfig>): void;

  /** 触发摘要生成 */
  async triggerSummary(): Promise<void>;
}
```

二、管道编排逻辑

startSession 时按以下顺序初始化：
1. 创建 Session 对象
2. 启动 AudioCapture
3. AudioCapture.onData → STTClient.sendAudio
4. STTClient.onResult(isFinal=false) → 通过 IPC 推送 stt:partial
5. STTClient.onResult(isFinal=true) → 通过 IPC 推送 stt:sentence → 触发 Translator.translate
6. Translator.translate (流式) → 通过 IPC 推送 translate:partial
7. Translator.translate (完成) → 通过 IPC 推送 translate:final → NoteWriter.appendEntry
8. 每 5 句 → CorrectionDetector.checkConsistency → NoteWriter.appendCorrectionFootnote

endSession 时按以下顺序清理：
1. 停止 AudioCapture
2. 断开 STTClient
3. 触发 CorrectionDetector 最终检查
4. NoteWriter 写入最终笔记
5. 清理资源

三、主进程入口 `src/main/index.ts`

```typescript
/**
 * 主进程入口
 * 创建 BrowserWindow 实例，注册 IPC 处理器，管理应用生命周期
 */
// 需要创建的窗口：
// 1. 主窗口 - 标准窗口，三栏布局
// 2. 悬浮字幕窗口 - alwaysOnTop, transparent, frame: false
// 3. 控制悬浮窗 - alwaysOnTop, 小尺寸, frame: false
// 注册 IPC 处理器
// 管理应用生命周期（ready, window-all-closed, activate）
```

四、依赖模块的公开 API
- `@shared/types` — Session, SessionState, AppConfig
- `@shared/constants` — UI_CONSTANTS
- `@shared/ipcChannels` — IPC_CHANNELS
- `../audio/AudioCapture` — AudioCapture
- `../stt/STTClient` — STTClient
- `../translate/Translator` — Translator
- `../note/NoteWriter` — NoteWriter
- `../correction/CorrectionDetector` — CorrectionDetector
- `../ipc/handlers` — registerIPCHandlers, sendToAllWindows

五、测试要求
- 测试框架：Jest
- 测试文件位置：
  - `Test/main/modules/SessionManager.test.ts`
  - `Test/main/index.test.ts`
- 覆盖率目标：≥ 80%
- 必须测试的场景（参考 TESTING.md 第 2.9 节）：
  - createSession 创建新会话并初始化所有管道模块
  - startSession 启动音频采集和 STT
  - pauseSession 暂停音频采集但保持 STT 连接
  - resumeSession 恢复音频采集
  - endSession 停止所有模块、触发纠正检测、写入最终笔记
  - endSession 在会话结束时触发 CorrectionDetector 的最终检查
  - getSessionState 返回当前会话状态
  - 管道数据流正确衔接（Audio → STT → Translate → Note）

六、约束
- 只在 `src/main/modules/session/`、`src/main/index.ts` 和 `Test/main/` 目录下创建/修改文件
- SessionManager 是管道的编排者，不包含具体业务逻辑
- 所有模块通过构造函数注入，便于测试

【输出】
- `src/main/modules/session/SessionManager.ts` 完整源代码
- `src/main/index.ts` 完整源代码
- `Test/main/modules/SessionManager.test.ts` 测试代码
- `Test/main/index.test.ts` 测试代码
- 测试通过的证据

─────────────────────────────────────
[Layer 3] hooks Agent
─────────────────────────────────────

【目标】
开发 `src/renderer/hooks/` 目录下的 React Hooks：useIPC 和 useSession。

完成后通过该模块的全部单元测试。

【输入 - 共享上下文】
--- BEGIN SHARED CONTEXT ---
[Layer 0-2 已完成模块代码]
--- END SHARED CONTEXT ---

【输入 - 模块指令】
### MODULE INSTRUCTIONS ###

一、需要实现的 Hooks

### 1. useIPC.ts

```typescript
/**
 * IPC 通信 Hook
 * 封装 preload 暴露的 API，提供类型安全的事件监听和操作请求
 */
export function useIPC(): {
  /** 监听 IPC 事件 */
  on: <T>(channel: string, callback: (data: T) => void) => void;
  /** 取消监听 */
  off: (channel: string, callback: (data: unknown) => void) => void;
  /** 开始翻译会话 */
  startSession: (audioSource: 'system' | 'microphone') => Promise<void>;
  /** 停止翻译会话 */
  stopSession: () => Promise<void>;
  /** 暂停翻译会话 */
  pauseSession: () => Promise<void>;
  /** 更新配置 */
  updateConfig: (config: Record<string, unknown>) => Promise<void>;
  /** 触发摘要生成 */
  triggerSummary: () => Promise<void>;
};
```

### 2. useSession.ts

```typescript
/**
 * 会话状态管理 Hook
 * 管理翻译会话的完整状态，包括 STT 结果、翻译结果、纠正记录
 */
export function useSession(): {
  /** 当前会话状态 */
  sessionState: SessionState;
  /** STT 中间结果列表 */
  sttPartials: STTResult[];
  /** 当前翻译中的句子 */
  currentTranslation: TranslationResult | null;
  /** 已确认的翻译结果列表 */
  confirmedTranslations: TranslationResult[];
  /** 纠正记录 */
  corrections: Correction[];
  /** 笔记文件路径 */
  notePath: string | null;
  /** 摘要内容 */
  summary: string | null;
  /** 开始会话 */
  startSession: (audioSource: 'system' | 'microphone') => void;
  /** 停止会话 */
  stopSession: () => void;
  /** 暂停会话 */
  pauseSession: () => void;
  /** 手动纠正当前句翻译 */
  correctTranslation: (newTranslation: string) => void;
};
```

二、实现要点

- useIPC：通过 `window.synchroLens` 访问 preload 暴露的 API
- useSession：内部使用 useIPC 监听所有 IPC 事件，维护会话状态
- useSession 在组件挂载时注册监听，卸载时取消监听
- 纠正功能：当前句（未冻结）的翻译可通过 correctTranslation 修改
- 状态更新使用 React.setState 或 useReducer

三、依赖模块的公开 API
- `@shared/types` — STTResult, TranslationResult, Correction, SessionState
- `@shared/ipcChannels` — IPC_CHANNELS
- preload 暴露的 `window.synchroLens` API

四、测试要求
- 测试框架：Jest + @testing-library/react
- 测试文件位置：
  - `Test/renderer/hooks/useIPC.test.ts`
  - `Test/renderer/hooks/useSession.test.ts`
- 覆盖率目标：≥ 80%
- 必须测试的场景：
  - useIPC: on 注册监听、off 取消监听、startSession/stopSession/pauseSession 调用
  - useSession: 初始状态正确、startSession 更新状态、STT partial 更新状态、翻译 final 更新状态、纠正功能、stopSession 重置状态
- Mock 策略：Mock window.synchroLens API

五、约束
- 只在 `src/renderer/hooks/` 和 `Test/renderer/hooks/` 目录下创建/修改文件
- 不直接使用 ipcRenderer，通过 preload API
- Hooks 必须正确处理组件卸载时的清理

【输出】
- `src/renderer/hooks/useIPC.ts` 完整源代码
- `src/renderer/hooks/useSession.ts` 完整源代码
- 对应测试文件
- 测试通过的证据

---

### ═══════════════════════════════════════════
### Layer 4 — 表现层
### ═══════════════════════════════════════════

─────────────────────────────────────
[Layer 4] subtitle-window Agent
─────────────────────────────────────

【目标】
开发悬浮字幕窗口，包含窗口入口 `SubtitleWindow.tsx` 和字幕渲染组件 `SubtitleOverlay.tsx`。

完成后通过该模块的全部单元测试。

【输入 - 共享上下文】
--- BEGIN SHARED CONTEXT ---
[Layer 0-3 已完成模块代码]
--- END SHARED CONTEXT ---

【输入 - 模块指令】
### MODULE INSTRUCTIONS ###

一、需要实现的组件

### 1. SubtitleWindow.tsx — 窗口入口

```typescript
/**
 * 悬浮字幕窗口入口组件
 * 纯字幕显示，其余区域完全透明
 */
export function SubtitleWindow(): JSX.Element;
```

### 2. SubtitleOverlay.tsx — 字幕渲染组件

```typescript
/**
 * 字幕渲染组件
 * 歌词式双语字幕，支持流式显示和纠正动画
 */
export function SubtitleOverlay(): JSX.Element;
```

二、UI 约束（参考前端指导文档）

- **窗口属性**：alwaysOnTop, transparent, frame: false
- **位置**：屏幕下方约 20%，可拖拽调整
- **双语显示**：原文（小字灰色）在上方，译文（正常白色）在下方
- **当前句**：流式输出，带光标闪烁效果
- **已确认句**：向上滚动，最多保留 5-8 句
- **当前句纠正**：旧文字淡出 + 新文字淡入，动画 300ms
- **鼠标穿透**：透明区域不拦截鼠标事件（可配置开关）
- **背景**：半透明黑色，透明度 70%

三、实现要点

- 使用 useSession Hook 获取翻译数据
- 当前句（isFinal=false）显示在底部，带闪烁光标
- 已确认句（isFinal=true）向上滚动
- 超过 MAX_VISIBLE_SENTENCES 时最早的句子淡出
- 纠正动画使用 CSS transition（300ms）
- 鼠标穿透通过 CSS `pointer-events: none` 实现（可配置）

四、依赖模块的公开 API
- `@shared/types` — TranslationResult, Correction
- `@shared/constants` — UI_CONSTANTS
- `@renderer/hooks/useSession` — useSession Hook

五、测试要求
- 测试框架：Jest + @testing-library/react
- 测试文件位置：`Test/renderer/windows/subtitle/SubtitleWindow.test.tsx`
- 覆盖率目标：≥ 70%（渲染 + 主要交互）
- 必须测试的场景：
  - 渲染当前句流式文本
  - 渲染已确认句列表
  - 超过最大句子数时最早句子消失
  - 纠正动画触发
  - 空状态显示

六、约束
- 只在 `src/renderer/windows/subtitle/`、`src/renderer/components/SubtitleOverlay/` 和 `Test/renderer/windows/subtitle/` 目录下创建/修改文件
- 使用 TailwindCSS 进行样式开发
- 遵循前端指导文档的布局约束

【输出】
- `src/renderer/windows/subtitle/SubtitleWindow.tsx` 完整源代码
- `src/renderer/components/SubtitleOverlay/SubtitleOverlay.tsx` 完整源代码
- 对应测试文件
- 测试通过的证据

─────────────────────────────────────
[Layer 4] main-window Agent
─────────────────────────────────────

【目标】
开发主窗口，包含窗口入口、App.tsx、侧边栏、笔记查看器、摘要查看器和设置面板。

完成后通过该模块的全部单元测试。

【输入 - 共享上下文】
--- BEGIN SHARED CONTEXT ---
[Layer 0-3 已完成模块代码]
--- END SHARED CONTEXT ---

【输入 - 模块指令】
### MODULE INSTRUCTIONS ###

一、需要实现的组件

### 1. App.tsx — 渲染进程入口

```typescript
/**
 * 渲染进程入口组件
 * 根据窗口类型渲染不同的窗口组件
 */
export function App(): JSX.Element;
```

### 2. MainWindow.tsx — 主窗口入口

```typescript
/**
 * 主窗口入口组件
 * 三栏布局：左侧功能栏 | 中间笔记 | 右侧摘要
 */
export function MainWindow(): JSX.Element;
```

### 3. Sidebar.tsx — 左侧栏

```typescript
/**
 * 左侧栏组件
 * 上方：功能按钮竖向堆叠（笔记/词典/记忆/设置/录制）
 * 下方：文件夹树
 */
export function Sidebar(): JSX.Element;
```

### 4. NoteViewer.tsx — 笔记查看器

```typescript
/**
 * 笔记查看器组件
 * Markdown 渲染显示笔记内容
 */
export function NoteViewer(): JSX.Element;
```

### 5. SummaryViewer.tsx — 摘要查看器

```typescript
/**
 * 摘要查看器组件
 * 显示当前笔记的摘要内容
 */
export function SummaryViewer(): JSX.Element;
```

### 6. SettingsPanel.tsx — 设置面板

```typescript
/**
 * 设置面板组件
 * 包含语音识别、翻译服务、字幕显示、笔记、音频源、快捷键、数据等设置分组
 */
export function SettingsPanel(): JSX.Element;
```

二、UI 约束（参考前端指导文档）

- **三栏布局**：左侧 20% | 中间 60% | 右侧 20%
- **左侧栏上方**：功能按钮竖向堆叠，录制按钮用分隔线隔开
- **左侧栏下方**：文件夹树（按日期分组）
- **面板合并**：右侧摘要栏顶部有"隐藏摘要栏"和"隐藏笔记栏"按钮
  - 隐藏摘要栏 → 笔记扩展为 80%
  - 隐藏笔记栏 → 摘要扩展为 80%
  - 合并动画 300ms
- **功能按钮切换**：
  - 笔记 → 三栏视图
  - 词典/记忆 → 灰色占位，提示"后续版本"
  - 设置 → 右侧 80% 展示设置面板
  - 录制 → 唤出控制窗+字幕窗，主窗口最小化

三、设置面板内容分组

- 语音识别：服务商选择、API Key、API Secret、AppID
- 翻译服务：服务商选择、API Key、模型选择
- 字幕显示：字体大小、译文颜色、原文颜色、背景透明度、显示原文开关、鼠标穿透开关
- 笔记：保存目录、自动保存开关、自动总结开关
- 音频源：默认源选择、降噪开关
- 快捷键：开始/暂停、字幕显隐
- 数据：导出全部笔记、清除历史数据

四、依赖模块的公开 API
- `@shared/types` — AppConfig, Session
- `@shared/constants` — UI_CONSTANTS, SHORTCUT_CONSTANTS
- `@renderer/hooks/useIPC` — useIPC Hook
- `@renderer/hooks/useSession` — useSession Hook

五、测试要求
- 测试框架：Jest + @testing-library/react
- 测试文件位置：`Test/renderer/windows/main/MainWindow.test.tsx`
- 覆盖率目标：≥ 70%（渲染 + 主要交互）
- 必须测试的场景：
  - 三栏布局正确渲染
  - 功能按钮切换视图
  - 面板合并/展开动画
  - 文件夹树显示笔记列表
  - 设置面板各分组渲染
  - 词典/记忆按钮灰色不可点

六、约束
- 只在 `src/renderer/` 和 `Test/renderer/` 目录下创建/修改文件
- 使用 TailwindCSS 进行样式开发
- Markdown 渲染库自行选择（如 react-markdown）
- 遵循前端指导文档的布局约束

【输出】
- `src/renderer/App.tsx` 完整源代码
- `src/renderer/windows/main/MainWindow.tsx` 完整源代码
- `src/renderer/components/Sidebar/Sidebar.tsx` 完整源代码
- `src/renderer/components/NoteViewer/NoteViewer.tsx` 完整源代码
- `src/renderer/components/SummaryViewer/SummaryViewer.tsx` 完整源代码
- `src/renderer/components/SettingsPanel/SettingsPanel.tsx` 完整源代码
- 对应测试文件
- 测试通过的证据

─────────────────────────────────────
[Layer 4] control-window Agent
─────────────────────────────────────

【目标】
开发控制悬浮窗，包含窗口入口 `ControlWindow.tsx` 和控制栏组件 `ControlBar.tsx`。

完成后通过该模块的全部单元测试。

【输入 - 共享上下文】
--- BEGIN SHARED CONTEXT ---
[Layer 0-3 已完成模块代码]
--- END SHARED CONTEXT ---

【输入 - 模块指令】
### MODULE INSTRUCTIONS ###

一、需要实现的组件

### 1. ControlWindow.tsx — 窗口入口

```typescript
/**
 * 控制悬浮窗入口组件
 * 横条状，始终置顶，可拖拽
 */
export function ControlWindow(): JSX.Element;
```

### 2. ControlBar.tsx — 控制栏组件

```typescript
/**
 * 控制栏组件
 * 包含开始/停止、字幕开关、笔记开关、最小化、退出按钮
 */
export function ControlBar(): JSX.Element;
```

二、UI 约束（参考前端指导文档）

- **窗口属性**：alwaysOnTop, frame: false, 小尺寸
- **布局**：左侧标题，右侧控制按钮横排
- **控制按钮**：
  | 控件 | 说明 |
  |------|------|
  | ▶ 开始 / ⏹ 停止 | 开始后按钮变为停止，停止后变回开始 |
  | 字幕: 开/关 | 切换悬浮字幕窗口显示 |
  | 笔记: 开/关 | 切换主窗口显示 |
  | — 最小化 | 最小化到系统托盘 |
  | × 退出 | 弹出询问对话框 |
- **退出询问对话框**：
  - 选项 1：最小化到系统托盘（翻译继续运行）
  - 选项 2：关闭控制窗口（停止翻译+保存笔记+关闭字幕窗+恢复主窗口）
  - 取消

三、实现要点

- 使用 useSession Hook 获取会话状态
- 使用 useIPC Hook 发送控制命令
- 开始/停止按钮根据 sessionState 切换显示
- 字幕开关通过 IPC 控制字幕窗口的显示/隐藏
- 最小化通过 IPC 通知主进程
- 退出对话框使用自定义弹窗（非 alert/confirm）

四、依赖模块的公开 API
- `@shared/types` — SessionState
- `@shared/ipcChannels` — IPC_CHANNELS
- `@renderer/hooks/useIPC` — useIPC Hook
- `@renderer/hooks/useSession` — useSession Hook

五、测试要求
- 测试框架：Jest + @testing-library/react
- 测试文件位置：`Test/renderer/windows/control/ControlWindow.test.tsx`
- 覆盖率目标：≥ 70%（渲染 + 主要交互）
- 必须测试的场景：
  - 渲染所有控制按钮
  - 开始/停止按钮状态切换
  - 字幕开关切换
  - 退出按钮弹出询问对话框
  - 最小化按钮触发 IPC

六、约束
- 只在 `src/renderer/windows/control/`、`src/renderer/components/ControlBar/` 和 `Test/renderer/windows/control/` 目录下创建/修改文件
- 使用 TailwindCSS 进行样式开发
- 不使用 alert/confirm/prompt

【输出】
- `src/renderer/windows/control/ControlWindow.tsx` 完整源代码
- `src/renderer/components/ControlBar/ControlBar.tsx` 完整源代码
- 对应测试文件
- 测试通过的证据

---

### ═══════════════════════════════════════════
### Final — 演示层
### ═══════════════════════════════════════════

═══════════════════════════════════════════
模块：端到端演示
层级：Final
依赖：全部模块
═══════════════════════════════════════════

【目标】
创建端到端演示，验证全部模块可正常协作，覆盖核心业务流程。

【输入 - 共享上下文】
--- BEGIN SHARED CONTEXT ---
[全部已完成模块代码]
--- END SHARED CONTEXT ---

【输入 - 模块指令】
### MODULE INSTRUCTIONS ###

一、演示流程

完整端到端流程，覆盖以下步骤：

1. **应用启动**
   - 启动 Electron 应用
   - 验证主窗口、控制悬浮窗正常显示
   - 验证设置面板可正常访问

2. **开始录制**
   - 在主窗口点击录制按钮
   - 验证控制悬浮窗和悬浮字幕窗口出现
   - 在控制悬浮窗点击"开始"
   - 验证会话状态变为 running

3. **实时翻译**
   - 播放一段英文测试音频（模拟）
   - 验证 STT 逐词识别结果通过 IPC 推送到字幕窗口
   - 验证翻译流式结果在字幕窗口实时显示
   - 验证句子确认后字幕冻结并滚动

4. **当前句纠正**
   - 在字幕窗口对当前句翻译进行手动纠正
   - 验证纠正动画（旧文字淡出 + 新文字淡入）
   - 验证纠正记录通过 IPC 推送

5. **批量纠正检测**
   - 累积 5 句已确认翻译
   - 验证 CorrectionDetector 触发批量检查
   - 验证纠正脚注写入笔记

6. **笔记生成**
   - 验证每句确认后笔记文件实时更新
   - 验证笔记格式符合 DATA_MODEL.md 规范
   - 验证纠正脚注正确标注

7. **智能总结**
   - 点击"生成摘要"
   - 验证摘要内容包含主题、关键要点、生词/术语、纠正记录
   - 验证摘要追加到笔记末尾

8. **停止录制**
   - 点击停止按钮
   - 验证所有模块资源释放
   - 验证笔记文件完整保存
   - 验证主窗口恢复显示

二、演示实现方式

创建 `Test/e2e/full-pipeline.test.ts`，使用 Mock 的音频数据流和 Mock API，但管道内部模块真实运行：

```typescript
/**
 * 端到端演示测试
 * 验证完整翻译流程：音频采集 → STT → 翻译 → 纠正 → 笔记
 */
describe('端到端演示', () => {
  // 使用 mock 音频 + mock STT/翻译 API
  // 但 SessionManager、NoteWriter、CorrectionDetector 真实运行
  // 验证最终输出（笔记文件内容）符合预期
});
```

三、必须验证的检查点

| 步骤 | 验证内容 |
|------|----------|
| 应用启动 | 主窗口渲染、控制窗渲染 |
| 开始录制 | 会话状态为 running、音频采集启动 |
| 实时翻译 | stt:partial 和 translate:partial 事件推送 |
| 句子确认 | translate:final 事件、笔记文件追加 |
| 当前句纠正 | 纠正动画、translate:correct 事件 |
| 批量纠正 | 5 句后触发检查、脚注写入 |
| 智能总结 | 摘要生成、追加到笔记 |
| 停止录制 | 资源释放、笔记完整 |

四、约束
- 演示必须使用 Mock 外部 API（讯飞/DeepSeek），但管道内部模块真实运行
- 如发现集成问题，以 TODO 注释标记，不自行修改其他模块代码
- 输出必须包含：每个步骤的执行结果 + 最终成功/失败状态
- 笔记文件内容必须与 DATA_MODEL.md 格式一致

【输出】
- `Test/e2e/full-pipeline.test.ts` 完整源代码
- 测试运行输出（端到端通过的证据）

【步骤】
1. 阅读完整项目代码
2. 识别核心业务流程
3. 编写端到端测试，覆盖上述 8 个步骤
4. 运行测试，确保端到端通过
5. 输出运行结果

【约束】
- 禁止修改其他模块的代码
- 只在 `Test/e2e/` 目录下创建/修改文件
- 如发现集成问题，记录问题清单但不自行修复

---

## 编排执行指南

### 执行顺序

```
Layer 0（3 Agent 并行）→ 验收 →
Layer 1（4 Agent 并行）→ 验收 →
Layer 2（5 Agent 并行）→ 验收 →
Layer 3（2 Agent 并行）→ 验收 →
Layer 4（3 Agent 并行）→ 验收 →
Final（1 Agent）→ 验收
```

### 每层验收标准

1. **规格合规审查**：代码是否符合提示词中的功能要求
2. **代码质量审查**：是否符合 CONVENTIONS.md、是否有明显问题
3. **测试验证**：运行测试命令，确认全部通过
4. **类型检查**：运行 `npm run typecheck`，确认无错误
5. **Lint 检查**：运行 `npm run lint`，确认无报错

### 验收不通过处理

- 给出修复指令，重新派发该 Agent
- 修复后重新审查，不可跳过

### 缓存优化

同一 Layer 内并行调度的 Agent，共享前缀结构为：
```
[系统指令] + [项目文档摘要] + [已完成模块代码] + --- END SHARED CONTEXT --- + ### MODULE INSTRUCTIONS ### + [模块专属指令]
```

确保：
- 静态内容严格前置
- 显式分隔符 `--- END SHARED CONTEXT ---`
- 模块指令标记 `### MODULE INSTRUCTIONS ###`
- 同 Layer 所有 Agent 的共享前缀完全相同

---

*文档版本: 1.0*
*最后更新: 2026-06-05*
