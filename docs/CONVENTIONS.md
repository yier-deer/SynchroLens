# SynchroLens 开发约定

> 本文档定义 SynchroLens 项目的代码风格、文件组织、Git 提交、PR、测试等开发规范。
> 所有贡献者必须遵循本文档，确保代码库一致性和可维护性。

---

## 1. 代码风格

### 1.1 TypeScript 严格模式

- 启用 `strict: true`，禁止隐式 `any`、禁止隐式返回、严格空值检查
- 禁止使用 `@ts-ignore`，如确需绕过类型检查须使用 `@ts-expect-error` 并附注释说明原因
- 优先使用 `interface` 定义对象形状，仅当需要联合类型或交叉类型时使用 `type`
- 优先使用 `unknown` 而非 `any`，必须做类型收窄后再使用
- 禁止非空断言 `!`，使用可选链 `?.` 或空值合并 `??` 替代
- 枚举必须使用 `const enum` 或字符串字面量联合类型，避免运行时枚举开销

### 1.2 命名规范

| 类别 | 规范 | 示例 |
|------|------|------|
| 文件名（组件） | PascalCase | `SubtitleWindow.tsx` |
| 文件名（非组件） | camelCase | `audioCapture.ts`、`sttClient.ts` |
| 文件名（类型/接口） | PascalCase，以类型名命名 | `SessionConfig.ts` |
| 文件名（常量） | camelCase | `appConstants.ts` |
| 文件名（工具函数） | camelCase | `formatTimestamp.ts` |
| 测试文件 | 与源文件同名，加 `.test` 后缀 | `audioCapture.test.ts` |
| React 组件名 | PascalCase | `SubtitleOverlay` |
| 函数名 | camelCase，动词开头 | `captureAudio()`、`translateText()` |
| 布尔函数名 | camelCase，`is`/`has`/`should` 开头 | `isSessionActive()`、`hasCorrection()` |
| 事件处理函数 | camelCase，`handle` 开头 | `handleMicToggle()` |
| 类名 | PascalCase | `SessionManager`、`CorrectionDetector` |
| 接口名 | PascalCase，不加 `I` 前缀 | `SessionConfig`（而非 `ISessionConfig`） |
| 类型别名 | PascalCase | `TranslationResult` |
| 泛型参数 | PascalCase，单字母或简短大写 | `T`、`TResult`、`TInput` |
| 常量（模块级） | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`、`DEFAULT_LANGUAGE` |
| 常量（组件内） | camelCase | `const defaultFontSize = 16` |
| 枚举值 | PascalCase | `enum SessionState { Active, Paused, Stopped }` |
| CSS 类名 | kebab-case（Tailwind 除外） | `subtitle-container` |
| 环境变量 | UPPER_SNAKE_CASE，`ECHO_` 前缀 | `ECHO_API_KEY`、`ECHO_STT_PROVIDER` |

### 1.3 import 顺序

按以下分组排列，组间空一行，组内按字母序排列：

```typescript
// 1. Node.js 内置模块
import { EventEmitter } from 'events';

// 2. 第三方库
import { ipcMain } from 'electron';
import React from 'react';

// 3. 项目内部模块（@shared 别名优先）
import { SessionState } from '@shared/types';
import { MAX_RETRY_COUNT } from '@shared/constants';

// 4. 相对路径模块
import { captureAudio } from './audioCapture';
import { SubtitleOverlay } from './components/SubtitleOverlay';
```

### 1.4 注释规范

- 所有函数、方法、类必须添加中文 JSDoc 注释
- 注释须说明用途、参数含义、返回值，必要时补充副作用说明

```typescript
/**
 * 捕获系统音频流并转换为 PCM 数据
 * @param deviceId - 音频输入设备 ID，空字符串使用默认设备
 * @param sampleRate - 采样率，默认 16000Hz
 * @returns PCM 音频数据 Buffer，捕获失败返回 null
 */
function captureAudio(deviceId: string, sampleRate: number = 16000): Buffer | null {
  // ...
}
```

### 1.5 其他风格规则

- 缩进：2 空格，禁止 Tab
- 字符串：优先单引号，模板字符串用反引号
- 行宽：不超过 120 字符
- 末尾分号：必须
- 尾随逗号：多行时必须
- 组件导出：使用命名导出，禁止默认导出

---

## 2. 文件组织规范

### 2.1 目录结构

```
SynchroLens/
├── src/
│   ├── main/                    # 主进程
│   │   ├── audioCapture.ts      # 音频捕获
│   │   ├── sttClient.ts         # 语音识别客户端
│   │   ├── translator.ts        # 翻译模块
│   │   ├── noteWriter.ts        # 笔记记录
│   │   ├── correctionDetector.ts # 纠错检测
│   │   ├── sessionManager.ts    # 会话管理
│   │   └── index.ts             # 主进程入口
│   ├── renderer/                # 渲染进程
│   │   ├── mainWindow/          # 主窗口
│   │   ├── subtitleWindow/      # 字幕窗口
│   │   ├── controlWindow/       # 控制窗口
│   │   └── shared/              # 渲染进程共享组件
│   ├── shared/                  # 主进程与渲染进程共享
│   │   ├── types/               # 共享类型定义
│   │   │   └── index.ts
│   │   └── constants/           # 共享常量
│   │       └── index.ts
│   └── preload/                 # preload 脚本
│       └── index.ts
├── Test/                        # 测试目录（镜像 src/ 结构）
│   ├── main/
│   ├── renderer/
│   └── shared/
├── resources/                   # 静态资源（图标等）
├── CONVENTIONS.md
└── package.json
```

### 2.2 文件职责原则

- **一个文件一个职责**：每个文件只做一件事，文件名即体现职责
- **主进程模块**：每个模块（如 `audioCapture.ts`）导出一个类或一组相关函数
- **渲染进程窗口**：每个窗口目录包含该窗口的入口组件、子组件和样式
- **共享类型**：所有跨进程通信的类型必须定义在 `src/shared/types/` 下
- **共享常量**：所有跨进程使用的常量必须定义在 `src/shared/constants/` 下
- **禁止循环依赖**：`shared` 不依赖 `main` 或 `renderer`；`renderer` 不依赖 `main`

### 2.3 IPC 通信规范

- 通道名称定义在 `src/shared/constants/` 中，格式：`模块:动作`，如 `session:start`、`audio:toggle`
- 通道名称使用 camelCase
- IPC 请求/响应的类型必须定义在 `src/shared/types/` 中
- 主进程使用 `ipcMain.handle`（请求-响应模式），`ipcMain.on`（单向推送）
- 渲染进程通过 preload 暴露的 API 调用，禁止直接使用 `ipcRenderer`

---

## 3. Git 提交规范

### 3.1 Conventional Commits

提交消息格式：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**type（必填）**：

| type | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(stt): 接入 Whisper 实时语音识别` |
| `fix` | 修复 bug | `fix(audio): 修复音频捕获设备切换后静音问题` |
| `refactor` | 重构（不改变行为） | `refactor(translator): 抽离翻译策略为可插拔接口` |
| `docs` | 文档变更 | `docs: 补充音频捕获模块接口说明` |
| `test` | 新增或修改测试 | `test(session): 补充会话管理状态流转测试` |
| `chore` | 构建/工具/依赖变更 | `chore: 升级 Electron 至 v28` |
| `style` | 代码格式（不影响逻辑） | `style: 统一缩进为 2 空格` |
| `perf` | 性能优化 | `perf(subtitle): 减少字幕渲染重绘次数` |

**scope（必填）**：对应模块名，取值范围：

- `audio` — 音频捕获
- `stt` — 语音识别
- `translate` — 翻译
- `note` — 笔记
- `correction` — 纠错
- `session` — 会话管理
- `subtitle` — 字幕窗口
- `control` — 控制窗口
- `main` — 主窗口
- `ipc` — 进程间通信
- `shared` — 共享类型/常量
- `preload` — preload 脚本
- `build` — 构建配置
- 无范围时省略 scope 和括号

**subject（必填）**：
- 中文撰写，简明扼要描述变更内容
- 不超过 50 字符
- 不加句号
- 使用祈使句（"修复"而非"修复了"）

**body（可选）**：
- 中文撰写，说明变更原因和影响
- 每行不超过 72 字符

**footer（可选）**：
- 关联 issue：`Closes #12`
- 破坏性变更：`BREAKING CHANGE: 描述`

### 3.2 提交粒度

- 每次提交只做一件事，原子化提交
- 禁止混合不同 type 的变更（如功能+重构放在同一提交）
- 禁止提交未通过编译或测试的代码

### 3.3 提交示例

```
feat(stt): 接入 Whisper 实时语音识别

使用 WebSocket 连接 Whisper 服务端，实现流式语音转文字。
支持断线自动重连，最大重试次数 3 次。

Closes #5
```

```
fix(audio): 修复音频捕获设备切换后静音问题

切换设备时未正确关闭旧流导致新设备无法采集。
现改为先停止旧流再启动新流，并增加设备可用性检查。
```

---

## 4. PR 规范

### 4.1 核心原则

**每个 PR 只做一件事。** 一个 PR 只解决一个功能、一个 bug、一次重构。如有多个独立变更，拆分为多个 PR。

### 4.2 PR 标题格式

与提交消息格式一致：

```
<type>(<scope>): <subject>
```

示例：
- `feat(translate): 接入 DeepL 翻译 API`
- `fix(subtitle): 修复字幕窗口在多显示器下位置偏移`
- `refactor(session): 将会话状态管理迁移到状态机模式`

### 4.3 PR 描述模板

每个 PR 必须包含以下内容：

```markdown
## 功能描述
<!-- 简述本 PR 实现了什么功能 / 修复了什么问题 -->

## 实现思路
<!-- 说明技术方案和关键设计决策，便于审查者理解 -->

## 测试方式
<!-- 列出验证步骤，确保审查者可以复现验证 -->

## 关联 Issue
<!-- Closes #xxx 或 Relates #xxx -->

## 截图/录屏（如适用）
<!-- UI 变更必须附截图 -->
```

**填写示例**：

```markdown
## 功能描述
接入 DeepL 翻译 API，支持中英日韩四种语言互译，替代原有的本地翻译方案。

## 实现思路
- 在 `translator.ts` 中新增 `DeepLTranslator` 类，实现 `ITranslator` 接口
- 通过环境变量 `ECHO_DEEPL_API_KEY` 读取 API 密钥
- 翻译请求增加速率限制（10 QPS），超限自动排队
- 保留原有本地翻译作为 fallback，API 调用失败时自动降级

## 测试方式
1. 设置环境变量 `ECHO_DEEPL_API_KEY`
2. 启动应用，选择翻译源语言和目标语言
3. 播放测试音频，验证字幕翻译结果
4. 断开网络，验证 fallback 到本地翻译
5. 运行 `npm test` 确认所有测试通过

## 关联 Issue
Closes #8
```

### 4.4 PR 检查清单

提交 PR 前须确认：

- [ ] PR 只做一件事
- [ ] 标题和描述清晰完整
- [ ] 代码通过 `npm run lint` 无报错
- [ ] 代码通过 `npm run typecheck` 无类型错误
- [ ] 所有测试通过 `npm test`
- [ ] 新功能有对应测试覆盖
- [ ] 无硬编码密钥或敏感信息
- [ ] 涉及 IPC 变更时，类型已同步更新到 `src/shared/types/`

---

## 5. 测试规范

### 5.1 目录结构

测试文件放在 `Test/` 目录下，镜像 `src/` 的目录结构：

```
Test/
├── main/
│   ├── audioCapture.test.ts
│   ├── sttClient.test.ts
│   ├── translator.test.ts
│   ├── noteWriter.test.ts
│   ├── correctionDetector.test.ts
│   └── sessionManager.test.ts
├── renderer/
│   ├── subtitleWindow.test.tsx
│   └── controlWindow.test.tsx
└── shared/
    └── types.test.ts
```

### 5.2 命名规范

- 测试文件：`<模块名>.test.ts`（或 `.test.tsx`）
- describe 块：使用被测模块/函数名，中文描述测试场景
- it 块：使用中文描述预期行为，格式 `应该 <预期行为>`

```typescript
describe('audioCapture', () => {
  describe('captureAudio', () => {
    it('应该在指定设备上成功捕获音频流', () => {
      // ...
    });

    it('应该在设备不可用时返回 null', () => {
      // ...
    });
  });
});
```

### 5.3 测试原则

- **新功能必须有测试**：每个新功能/模块至少覆盖正常路径和主要异常路径
- **测试独立性**：每个测试用例独立运行，不依赖其他用例的副作用
- **Mock 边界**：只 mock 外部依赖（网络、文件系统、Electron API），被测模块内部逻辑不 mock
- **不测试实现细节**：测试行为而非实现，避免因重构导致测试大面积失败
- **AAA 模式**：Arrange（准备）→ Act（执行）→ Assert（断言），结构清晰

```typescript
it('应该在翻译失败时返回原始文本', () => {
  // Arrange
  const translator = new DeepLTranslator({ apiKey: 'invalid' });
  const input = '你好世界';

  // Act
  const result = translator.translate(input, 'zh', 'en');

  // Assert
  expect(result).toBe('你好世界');
});
```

### 5.4 覆盖率要求

- 核心模块（`audioCapture`、`sttClient`、`translator`、`sessionManager`）行覆盖率 ≥ 80%
- 工具模块（`noteWriter`、`correctionDetector`）行覆盖率 ≥ 70%
- 渲染进程组件：至少覆盖渲染和用户交互

---

## 6. 目录结构约定

### 6.1 文件放置规则

| 文件类型 | 放置位置 | 说明 |
|----------|----------|------|
| 主进程模块 | `src/main/` | 每个模块一个文件 |
| 渲染进程窗口 | `src/renderer/<windowName>/` | 窗口入口 + 子组件 + 样式 |
| 渲染进程共享组件 | `src/renderer/shared/` | 跨窗口复用的 UI 组件 |
| 共享类型 | `src/shared/types/` | 所有跨进程类型定义 |
| 共享常量 | `src/shared/constants/` | 所有跨进程常量定义 |
| Preload 脚本 | `src/preload/` | IPC 桥接层 |
| 测试文件 | `Test/` | 镜像 src/ 结构 |
| 静态资源 | `resources/` | 图标、字体等 |
| 构建配置 | 项目根目录 | `vite.config.ts`、`electron-builder.yml` 等 |

### 6.2 禁止事项

- 禁止在 `src/renderer/` 中直接 import `src/main/` 的模块
- 禁止在 `src/shared/` 中 import `src/main/` 或 `src/renderer/` 的模块
- 禁止在 `src/preload/` 中包含业务逻辑，仅做 IPC 桥接
- 禁止在测试文件中硬编码密钥或外部服务地址
- 禁止提交 `dist/`、`node_modules/`、`.env` 等生成文件

### 6.3 新增文件检查清单

新增文件时须确认：

- 文件名符合命名规范
- 文件放置在正确的目录
- 如涉及跨进程通信，类型已添加到 `src/shared/types/`
- 如涉及新常量，已添加到 `src/shared/constants/`
- 对应测试文件已创建在 `Test/` 下

---

*本文档随项目演进持续更新，重大变更需团队确认。*
