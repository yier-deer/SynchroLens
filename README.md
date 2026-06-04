# SynchroLens — AI 同声传译助手

面向中文用户的桌面同声传译工具，实时将系统音频或麦克风语音转写为文字并翻译，以悬浮字幕形式叠加在视频上方，同时自动生成带纠正标注的 Markdown 笔记。

## 功能特性

- **实时同传**：系统音频/麦克风 → 讯飞 STT → DeepSeek 翻译 → 字幕输出，全链路流式处理
- **当前句纠正**：句子未结束时，翻译随上下文变化实时调整，确保语义连贯
- **自动笔记**：每句确认后自动写入 Markdown 文件，纠正内容以脚注标注
- **智能总结**：会话结束可选生成摘要，快速回顾要点
- **悬浮字幕**：歌词式半透明置顶窗口，可叠加在视频上方
- **控制悬浮窗**：横条状迷你控制条，不遮挡主内容
- **三栏主窗口**：左侧功能面板 + 文件夹 | 中间笔记 | 右侧摘要，支持合并布局

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron |
| 前端 | React + TypeScript + TailwindCSS |
| 构建工具 | Vite |
| 语音转写 | 讯飞 WebSocket 实时转写 API |
| 机器翻译 | DeepSeek V4 Pro 流式 API |

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
npm install
```

### 开发模式运行

```bash
npm run dev
```

### 打包构建

```bash
npm run build
```

### 运行测试

```bash
npm run test
```

## 项目结构

```
SynchroLens/
├── src/
│   ├── main/                    # 主进程
│   │   ├── index.ts
│   │   ├── ipc/handlers.ts
│   │   ├── modules/
│   │   │   ├── AudioCapture.ts        # 音频采集
│   │   │   ├── STTClient.ts           # 讯飞 STT 客户端
│   │   │   ├── Translator.ts          # DeepSeek 翻译客户端
│   │   │   ├── NoteWriter.ts          # Markdown 笔记写入
│   │   │   ├── CorrectionDetector.ts  # 当前句纠正检测
│   │   │   └── SessionManager.ts      # 会话管理
│   │   └── utils/
│   │       ├── audioResampler.ts      # 音频重采样
│   │       ├── vad.ts                 # 语音活动检测
│   │       └── markdownFormatter.ts   # Markdown 格式化
│   ├── renderer/                # 渲染进程
│   │   ├── App.tsx
│   │   ├── windows/             # 多窗口组件
│   │   ├── components/          # 通用组件
│   │   ├── hooks/               # 自定义 Hooks
│   │   └── styles/              # 样式文件
│   ├── shared/                  # 主进程/渲染进程共享
│   │   ├── types.ts             # 类型定义
│   │   ├── ipcChannels.ts       # IPC 通道常量
│   │   └── constants.ts         # 通用常量
│   └── preload/
│       └── index.ts             # Preload 脚本
├── Test/                        # 测试文件
├── notes/                       # 笔记输出目录
├── assets/                      # 静态资源
└── docs/                        # 文档
```

## 依赖说明

| 依赖 | 用途 |
|------|------|
| electron | 桌面应用框架，提供主进程/渲染进程架构与原生窗口能力 |
| react | UI 组件库，构建渲染进程界面 |
| typescript | 类型安全的 JavaScript 超集 |
| tailwindcss | 原子化 CSS 框架，快速构建界面样式 |
| vite | 前端构建工具，提供快速的开发服务器与打包 |
| electron-vite | Electron + Vite 集成方案（如使用） |

> 完整依赖列表请查看 `package.json`

## Demo

[PENDING: 待录制后补充]

## License

MIT
