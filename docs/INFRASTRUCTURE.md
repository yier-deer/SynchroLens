# SynchroLens 基础设施声明

> 本文档定义 SynchroLens 项目的开发环境、依赖、构建、打包及外部服务配置。
> 所有版本号基于项目初始化时的稳定版本，后续升级需同步更新本文档。

---

## 1. 开发环境要求

| 项目 | 最低版本 | 推荐版本 | 说明 |
|------|----------|----------|------|
| Node.js | 18.17.0 | 20.x LTS | Electron 28+ 需要 Node.js ≥ 18.17 |
| npm | 9.0.0 | 10.x | 随 Node.js 20 LTS 附带 |
| 操作系统 | Windows 10 / macOS 11 / Ubuntu 20.04 | Windows 11 / macOS 14 / Ubuntu 22.04 | 需支持音频采集硬件 |
| Git | 2.30.0 | 2.43+ | 版本控制 |

### 环境检查命令

```bash
node -v   # 应输出 v20.x.x
npm -v    # 应输出 10.x.x
git --version
```

---

## 2. 依赖清单及版本

### 2.1 生产依赖（dependencies）

| 包名 | 版本范围 | 用途 |
|------|----------|------|
| `electron` | ^28.0.0 | 桌面应用框架，提供主进程/渲染进程架构 |
| `react` | ^18.2.0 | UI 组件库，渲染进程界面构建 |
| `react-dom` | ^18.2.0 | React DOM 渲染器 |
| `electron-vite` | ^2.0.0 | Electron + Vite 集成构建工具 |
| `ws` | ^8.16.0 | WebSocket 客户端，用于讯飞实时转写 API 通信 |
| `openai` | ^4.24.0 | OpenAI 兼容 SDK，用于 DeepSeek V4 Pro 翻译 API 调用 |

### 2.2 开发依赖（devDependencies）

| 包名 | 版本范围 | 用途 |
|------|----------|------|
| `typescript` | ^5.3.0 | 类型安全，编译时类型检查 |
| `vite` | ^5.0.0 | 前端构建工具，HMR 及生产打包 |
| `tailwindcss` | ^3.4.0 | 原子化 CSS 框架 |
| `postcss` | ^8.4.32 | CSS 处理管线，TailwindCSS 依赖 |
| `autoprefixer` | ^10.4.16 | 自动添加 CSS 前缀 |
| `electron-builder` | ^24.9.0 | Electron 应用打包与分发 |
| `@types/react` | ^18.2.0 | React 类型定义 |
| `@types/react-dom` | ^18.2.0 | ReactDOM 类型定义 |
| `@types/ws` | ^8.5.10 | ws 类型定义 |
| `@vitejs/plugin-react` | ^4.2.0 | Vite React 插件（JSX 转换） |
| `jest` | ^29.7.0 | 测试框架 |
| `@testing-library/react` | ^14.1.0 | React 组件测试工具 |
| `@testing-library/jest-dom` | ^6.1.0 | Jest DOM 断言扩展 |
| `ts-jest` | ^29.1.0 | Jest TypeScript 支持 |
| `eslint` | ^8.56.0 | 代码质量检查 |
| `@typescript-eslint/eslint-plugin` | ^6.15.0 | TypeScript ESLint 规则 |
| `@typescript-eslint/parser` | ^6.15.0 | TypeScript ESLint 解析器 |
| `prettier` | ^3.1.0 | 代码格式化 |

### 2.3 Electron 内置依赖说明

| 模块 | 用途 |
|------|------|
| `electron.BrowserWindow` | 创建渲染进程窗口 |
| `electron.ipcMain` / `electron.ipcRenderer` | 主进程与渲染进程通信 |
| `electron.contextBridge` | preload 脚本安全暴露 API |
| `electron.dialog` | 原生文件选择对话框（笔记保存） |
| `electron.app` | 应用生命周期管理 |

---

## 3. 构建流程

### 3.1 项目初始化

```bash
# 克隆仓库后安装依赖
npm install
```

### 3.2 开发模式

```bash
# 启动开发服务器（含 HMR + Electron 热重载）
npm run dev
```

底层执行：`electron-vite dev`

- Vite 开发服务器启动渲染进程 HMR
- electron-vite 自动编译主进程和 preload 脚本
- Electron 窗口自动打开，代码变更后热更新

### 3.3 生产构建

```bash
# 构建生产代码
npm run build
```

底层执行：`electron-vite build`

- 主进程代码编译至 `out/main/`
- preload 脚本编译至 `out/preload/`
- 渲染进程代码编译至 `out/renderer/`
- TypeScript 编译 + Vite 生产优化（tree-shaking、代码分割、压缩）

### 3.4 测试

```bash
# 运行全部测试
npm run test

# 运行测试并输出覆盖率
npm run test:coverage

# 监听模式（开发时使用）
npm run test:watch
```

底层执行：`jest --config jest.config.ts`

- 测试文件位于 `Test/` 目录
- 使用 `ts-jest` 处理 TypeScript
- `@testing-library/react` 用于组件测试

### 3.5 代码质量

```bash
# ESLint 检查
npm run lint

# Prettier 格式化
npm run format

# TypeScript 类型检查
npm run typecheck
```

### 3.6 electron-vite 配置要点

配置文件：`electron.vite.config.ts`

```typescript
// 关键配置结构示意
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]  // 主进程依赖不打包
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve('src/renderer'),
        '@shared': resolve('src/shared')
      }
    }
  }
})
```

---

## 4. 打包流程

### 4.1 打包命令

```bash
# 打包当前平台安装包
npm run package

# 打包并生成安装程序
npm run make
```

底层执行：`electron-vite build && electron-builder`

### 4.2 electron-builder 配置要点

配置位于 `package.json` 的 `build` 字段或 `electron-builder.yml`：

```yaml
appId: com.synchrolens.app
productName: SynchroLens
copyright: Copyright © 2024 SynchroLens

directories:
  output: dist          # 打包输出目录
  buildResources: resources  # 资源目录（图标等）

files:
  - out/**/*            # electron-vite 构建产物
  - "!node_modules/**/*" # 排除源 node_modules

win:
  target:
    - target: nsis
      arch:
        - x64
  icon: resources/icon.ico

mac:
  target:
    - target: dmg
      arch:
        - x64
        - arm64
  icon: resources/icon.icns
  category: public.app-category.productivity

linux:
  target:
    - target: AppImage
      arch:
        - x64
  icon: resources/icon.png
  category: Utility

nsis:
  oneClick: false        # 非一键安装，允许选择目录
  perMachine: false      # 默认用户级安装
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: SynchroLens
```

### 4.3 打包产物

| 平台 | 格式 | 输出路径 |
|------|------|----------|
| Windows | `.exe` (NSIS 安装包) | `dist/SynchroLens Setup {version}.exe` |
| macOS | `.dmg` | `dist/SynchroLens-{version}.dmg` |
| Linux | `.AppImage` | `dist/SynchroLens-{version}.AppImage` |

### 4.4 注意事项

- 打包前必须先执行 `npm run build`（`npm run make` 会自动执行）
- Windows 平台需安装 Visual Studio Build Tools（node-gyp 依赖）
- macOS 平台需安装 Xcode Command Line Tools
- 图标资源需提前准备：`.ico`（Windows）、`.icns`（macOS）、`.png`（Linux，256x256+）

---

## 5. 外部服务依赖

### 5.1 讯飞 WebSocket 实时转写 API

| 项目 | 说明 |
|------|------|
| **服务名称** | 讯飞语音听写（流式版）WebSocket API |
| **协议** | WebSocket（`wss://`） |
| **接入地址** | `wss://iat-api.xfyun.cn/v2/iat` |
| **鉴权方式** | URL 参数签名（APIKey + APISecret + 时间戳 + HMAC-SHA256） |
| **调用流程** | 1. 客户端生成鉴权签名 → 2. 建立 WebSocket 连接 → 3. 分帧发送音频数据 → 4. 接收实时转写结果 → 5. 发送结束帧 → 6. 关闭连接 |
| **音频格式** | PCM 16bit 单声道，采样率 16000Hz |
| **数据帧大小** | 建议 40ms/帧（640 字节） |
| **超时** | 连接超时 10s，单次会话最长 60s（需自动重连续传） |
| **代码位置** | `src/main/stt/STTClient.ts` |

**鉴权签名生成要点：**

```
signature = HMAC-SHA256(APISecret, "host: iat-api.xfyun.cn\ndate: {RFC1123日期}\nGET /v2/iat HTTP/1.1")
authorization = base64(`api_key="{APIKey}", algorithm="hmac-sha256", headers="host date request-line", signature="{signature}"`)
ws_url = wss://iat-api.xfyun.cn/v2/iat?authorization={authorization}&date={url_encode(date)}&host=iat-api.xfyun.cn
```

### 5.2 DeepSeek V4 Pro 翻译 API

| 项目 | 说明 |
|------|------|
| **服务名称** | DeepSeek Chat API（OpenAI 兼容接口） |
| **协议** | HTTPS（REST），流式响应使用 SSE |
| **接入地址** | `https://api.deepseek.com/v1/chat/completions` |
| **鉴权方式** | Bearer Token（`Authorization: Bearer {API_KEY}`） |
| **调用方式** | 使用 OpenAI SDK 兼容模式 |
| **模型标识** | `deepseek-chat`（V4 Pro） |
| **流式输出** | `stream: true`，逐 token 返回翻译结果 |
| **超时** | 连接超时 10s，读取超时 30s |
| **代码位置** | `src/main/translation/Translator.ts` |

**SDK 调用示例：**

```typescript
import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1'
})

const stream = await client.chat.completions.create({
  model: 'deepseek-chat',
  messages: [{ role: 'user', content: '翻译为英文：...' }],
  stream: true
})
```

### 5.3 服务可用性要求

| 服务 | 最低要求 | 降级策略 |
|------|----------|----------|
| 讯飞 WebSocket | 稳定网络连接，延迟 < 500ms | 断线自动重连（指数退避，最多 5 次），重连期间缓存音频数据 |
| DeepSeek API | HTTPS 可达，响应 < 3s | 流式超时后重试（最多 2 次），最终失败显示原文并标记翻译失败 |

---

## 6. 环境变量配置

### 6.1 环境变量清单

| 变量名 | 必需 | 说明 | 示例值 |
|--------|------|------|--------|
| `XFYUN_APP_ID` | ✅ | 讯飞应用 AppID | `5a8bxxxx` |
| `XFYUN_API_KEY` | ✅ | 讯飞 API Key | `a1b2c3d4e5f6...` |
| `XFYUN_API_SECRET` | ✅ | 讯飞 API Secret（用于签名） | `x1y2z3w4v5u6...` |
| `DEEPSEEK_API_KEY` | ✅ | DeepSeek API Key | `sk-xxxxxxxxxxxxxxxx` |
| `DEEPSEEK_BASE_URL` | ❌ | DeepSeek API 自定义地址（默认 `https://api.deepseek.com/v1`） | `https://api.deepseek.com/v1` |
| `DEEPSEEK_MODEL` | ❌ | DeepSeek 模型标识（默认 `deepseek-chat`） | `deepseek-chat` |

### 6.2 环境变量文件

项目使用 `.env` 文件管理环境变量，**不提交至版本控制**：

```bash
# .env（主进程加载，不提交至 Git）
XFYUN_APP_ID=你的讯飞AppID
XFYUN_API_KEY=你的讯飞APIKey
XFYUN_API_SECRET=你的讯飞APISecret
DEEPSEEK_API_KEY=你的DeepSeekAPIKey
# DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
# DEEPSEEK_MODEL=deepseek-chat
```

### 6.3 加载方式

- **主进程**：通过 `electron-vite` 内置的 `env` 配置加载 `.env` 文件，使用 `process.env.XXX` 访问
- **渲染进程**：不直接访问环境变量，通过 IPC 从主进程获取必要配置
- **preload 脚本**：通过 `contextBridge` 暴露安全的 API 给渲染进程

### 6.4 安全要求

- `.env` 文件必须加入 `.gitignore`
- API Key 不得硬编码在源码中
- 不得通过 IPC 将 API Secret 传递给渲染进程
- 打包后的应用运行时，由用户在设置界面输入 API Key，存储于 `electron-store` 加密存储

---

## 7. CI/CD

### 7.1 当前状态

本项目为比赛项目，暂不配置复杂 CI/CD 流水线。采用本地开发 + 手动打包发布的模式。

### 7.2 推荐的最简 CI（GitHub Actions）

如后续需要，可配置以下基础流水线：

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test
```

### 7.3 发布流程（手动）

```bash
# 1. 确认代码质量
npm run typecheck && npm run lint && npm run test

# 2. 构建生产代码
npm run build

# 3. 打包安装程序
npm run make

# 4. 产物位于 dist/ 目录，手动分发
```

---

## 附录：关键文件路径速查

| 文件 | 用途 |
|------|------|
| `electron.vite.config.ts` | electron-vite 构建配置 |
| `tsconfig.json` | TypeScript 根配置 |
| `tsconfig.node.json` | Node.js（主进程）TypeScript 配置 |
| `tsconfig.web.json` | 浏览器（渲染进程）TypeScript 配置 |
| `tailwind.config.ts` | TailwindCSS 配置 |
| `postcss.config.js` | PostCSS 配置 |
| `jest.config.ts` | Jest 测试配置 |
| `.eslintrc.cjs` | ESLint 配置 |
| `.prettierrc` | Prettier 配置 |
| `.env` | 环境变量（不提交） |
| `.env.example` | 环境变量模板（提交至 Git） |
| `.gitignore` | Git 忽略规则 |
| `electron-builder.yml` | electron-builder 打包配置 |
| `resources/icon.ico` | Windows 应用图标 |
| `resources/icon.icns` | macOS 应用图标 |
| `resources/icon.png` | Linux 应用图标 |
