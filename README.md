# SynchroLens — AI 同声传译助手

面向中文用户的桌面同声传译工具，实时将系统音频或麦克风语音转写为文字并翻译，以悬浮字幕形式叠加在视频上方，同时自动生成 Markdown 笔记，支持收藏、改进翻译、三层词典增强等进阶功能。

## 功能特性

### 同声传译核心
- **实时同传**：系统音频/麦克风 → 讯飞 STT → DeepSeek 翻译 → 字幕输出，全链路流式处理
- **当前句纠正**：句子未结束时，翻译随上下文变化实时调整
- **自动笔记**：每句确认后自动写入 Markdown，按 `YYYY-MM-DD/HH-mm.md` 组织
- **智能总结**：会话结束可选 LLM 生成摘要（主要议题 + 关键结论 + 待办事项）
- **全链路日志**：winston 结构化日志，支持文件轮转

### 三窗口架构
- **主窗口**（1200×800）：三栏布局 — 侧边导航 + 内容区 + 摘要面板
- **字幕悬浮窗**（800×120）：透明置顶、鼠标穿透、歌词式渲染
- **控制悬浮窗**（320×48）：极简控制条，开始/停止 + 字幕开关 + 最小化 + 退出确认

### 笔记系统
- **文件夹树**：侧边栏常驻，按日期分组，支持展开/折叠
- **笔记阅读**：点击历史笔记 → Markdown 渲染（react-markdown）→ 右键菜单（复制/收藏/改进）
- **改进翻译**：选中译文 → 输入改进版 → 存入个人词典 → 俏皮确认弹窗

### 收藏系统
- 阅读笔记中任意选中文本 → 右键收藏
- 卡片列表展示（文本 + 来源笔记名），点击笔记名跳转到原文位置
- 搜索高亮 + 管理模式（全选/批量删除/导出为 .md）

### 三层词典
| 词典 | 作用 | 机制 |
|------|------|------|
| 语言词典 | 术语表 | 译后精确匹配替换 |
| 领域词典 | 行业文档 | 译前语义检索注入 System Prompt |
| 个人词典 | 用户改进记录 | 纠正环节介入，记住用户偏好 |

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron 28 |
| 前端 | React 18 + TypeScript 5 + TailwindCSS 3 |
| 图标 | lucide-react |
| Markdown 渲染 | react-markdown + remark-gfm |
| 构建 | Vite 5 + electron-vite 2 |
| 语音转写 | 讯飞 WebSocket 实时转写 API |
| 机器翻译 | DeepSeek V4 Pro (OpenAI 兼容) 流式 API |
| 日志 | winston + winston-daily-rotate-file |
| 测试 | Jest + @testing-library/react |
| 打包 | electron-builder |

## 快速开始

### 环境要求
- Node.js >= 18
- npm >= 9

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run dev
```
启动后依次出现：SplashScreen 启动画面 → 主窗口（三栏布局）→ 点击"准备录制"弹出控制窗和字幕窗。

### 生产构建
```bash
npm run build
```

### 运行测试
```bash
npm test
```

## 项目结构

```
SynchroLens/
├── src/
│   ├── main/                        # 主进程
│   │   ├── mainEntry.ts             # 窗口创建 + 系统托盘 + IPC 注册
│   │   ├── ipc/
│   │   │   └── handlers.ts          # 业务 IPC handler（session/config/summary）
│   │   ├── modules/
│   │   │   ├── audio/
│   │   │   │   └── AudioCapture.ts         # 系统/麦克风音频采集
│   │   │   ├── stt/
│   │   │   │   └── STTClient.ts            # 讯飞 WebSocket 实时转写
│   │   │   ├── translate/
│   │   │   │   └── Translator.ts           # DeepSeek 流式翻译 + 摘要生成
│   │   │   ├── note/
│   │   │   │   └── NoteWriter.ts           # Markdown 笔记写入
│   │   │   ├── correction/
│   │   │   │   └── CorrectionDetector.ts   # 翻译一致性纠正
│   │   │   └── session/
│   │   │       └── SessionManager.ts       # 会话管线编排
│   │   └── utils/
│   │       ├── logger.ts                   # winston 日志
│   │       ├── audioResampler.ts           # 音频重采样
│   │       ├── vad.ts                      # 语音活动检测
│   │       └── markdownFormatter.ts        # Markdown 格式化
│   ├── renderer/                    # 渲染进程（多窗口入口）
│   │   ├── index.html / main.tsx          # 主窗口入口
│   │   ├── subtitle.html / subtitle.tsx   # 字幕窗入口
│   │   ├── control.html / control.tsx     # 控制窗入口
│   │   ├── App.tsx                        # 路由分发
│   │   ├── windows/
│   │   │   ├── main/MainWindow.tsx        # 主窗口（三栏布局）
│   │   │   ├── subtitle/SubtitleWindow.tsx # 字幕悬浮窗
│   │   │   └── control/ControlWindow.tsx  # 控制悬浮窗
│   │   ├── components/
│   │   │   ├── common/                    # Toast / SplashScreen / Dialog / Tooltip / EmptyState / Badge
│   │   │   ├── Sidebar/                   # 侧边栏（导航 + 文件夹树）
│   │   │   ├── Notes/                     # 实时笔记 + 阅读模式
│   │   │   ├── Favorites/                 # 收藏视图
│   │   │   ├── Dictionary/               # 词典视图（语言/领域/个人）
│   │   │   ├── SettingsPanel/             # 设置面板
│   │   │   ├── ControlBar/               # 控制条
│   │   │   ├── SubtitleOverlay/          # 字幕渲染
│   │   │   ├── NoteViewer/               # 笔记查看器
│   │   │   └── SummaryViewer/            # 摘要查看器
│   │   ├── hooks/                         # useSession / useIPC
│   │   ├── styles/global.css              # TailwindCSS 全局样式
│   │   └── utils/rLogger.ts               # 渲染进程日志
│   ├── shared/                      # 主进程/渲染进程共享
│   │   ├── types.ts                       # 全部跨进程类型定义
│   │   ├── ipcChannels.ts                 # 40+ IPC 通道常量
│   │   ├── logIpcChannels.ts / logTypes.ts # 日志 IPC
│   │   └── constants.ts                   # 通用常量
│   └── preload/
│       └── index.ts                       # Preload API（28 个方法）
├── Test/                            # Jest 测试文件
├── .trae/
│   ├── documents/                         # 前端功能规格文档
│   └── specs/                             # Spec/任务/Checklist
├── docs/                            # 项目设计文档
├── resources/                       # 打包资源（图标等）
├── logs/                            # 日志输出目录
└── electron.vite.config.ts          # 构建配置
```

## 依赖说明

| 依赖 | 用途 |
|------|------|
| electron | 桌面应用框架，提供主进程/渲染进程架构与原生窗口能力 |
| react + react-dom | UI 组件库 |
| typescript | 类型安全的 JavaScript 超集 |
| tailwindcss + postcss + autoprefixer | 原子化 CSS 框架 |
| vite + electron-vite | 前端构建工具 + Electron 集成 |
| lucide-react | MIT 开源图标库，替代 emoji 用于 UI 图标 |
| react-markdown + remark-gfm | Markdown 渲染，用于笔记阅读模式 |
| winston + winston-daily-rotate-file | 全链路日志系统 |
| ws | 讯飞 WebSocket 通信 |
| openai | DeepSeek API（OpenAI 兼容）调用 |
| electron-builder | 桌面应用打包 |

> 完整依赖列表见 `package.json`

## IPC 通道速查

| 通道 | 方向 | 用途 |
|------|------|------|
| `stt:partial` | M→R | 语音识别中间片段 |
| `stt:sentence` | M→R | 语音识别完整句子 |
| `translate:partial` | M→R | 流式翻译片段 |
| `translate:final` | M→R | 翻译最终结果 |
| `translate:correct` | M→R | 翻译纠正 |
| `note:saved` | M→R | 笔记保存通知 |
| `note:summary` | M→R | 摘要生成通知 |
| `session:start/stop/pause/resume` | R→M | 会话控制 |
| `config:update` | R→M | 配置更新 |
| `summary:trigger` | R→M | 触发摘要 |
| `window:prepare-record/exit-control/toggle-subtitle` | R→M | 窗口控制 |
| `favorite:*`（6 条） | R→M | 收藏 CRUD + 搜索 + 导出 |
| `improve:submit / personal-dict:status` | R→M | 改进提交 + 词典状态 |
| `dictionary:*`（5 条） | R→M | 词典文件 + 条目管理 |
| `notes:list/read/export-all` | R→M | 笔记读取 + 导出 |
| `data:clear` | R→M | 清除数据 |
| `log:send` | R→M | 渲染进程日志 |

> 完整通道定义见 `src/shared/ipcChannels.ts`

## Demo

*[待录制]*

## License

MIT
