# SynchroLens — AI 同声传译助手

面向中文用户的桌面同声传译工具，实时将系统音频转写为文字并翻译，以悬浮字幕形式叠加在视频上方，同时自动生成 Markdown 笔记，支持收藏、改进翻译、三层词典增强等进阶功能。

## 功能特性

### 同声传译核心
- **系统音频捕获**：通过 ffmpeg dshow 采集 Windows 立体声混音，不需要额外驱动
- **实时 STT**：讯飞 WebSocket 实时转写（支持中/英/日/韩），wpgs 流式部分结果 + 累积文本
- **流式翻译**：DeepSeek 流式 API（温度 0，max_tokens 256），极简 system prompt 直译模式
- **自动笔记**：每句翻译确认后写入 Markdown，按 `YYYY-MM-DD/HH-mm.md` 组织
- **智能总结**：会话结束可选 LLM 生成摘要（主要议题 + 关键结论）
- **结构化日志**：全局 createLogger 封装，带模块名和时间戳

### 三窗口架构
- **主窗口**（1200×800）：三栏布局 — 侧边导航 + 内容区 + 摘要面板
- **字幕悬浮窗**（800×120）：透明置顶、鼠标穿透、歌词式双语渲染
- **控制悬浮窗**（320×48）：极简控制条，开始/停止 + 字幕开关 + 最小化 + 退出确认

### 笔记系统
- **文件夹树**：侧边栏常驻，按日期分组，支持展开/折叠 + 手动刷新按钮
- **笔记阅读**：点击历史笔记 → Markdown 渲染（react-markdown + remark-gfm）→ 右键菜单（复制/收藏/改进）
- **改进翻译**：选中译文 → 输入改进版 + 理由 → 存入个人词典（带向量 embedding）

### 收藏系统
- 阅读笔记中任意选中文本 → 右键收藏
- 卡片列表展示（文本 + 来源笔记名），点击笔记名跳转到原文位置
- 搜索高亮 + 管理模式（全选/批量删除/导出为 .md）

### 三层词典
| 词典 | 存储位置 | 录入方式 | 数据格式 |
|------|---------|---------|---------|
| 语言词典 | 导入的文件 (.json/.csv/.txt) | 手动选择文件导入 | `{source, target}` 键值对 |
| 领域词典 | 导入的文件 (.json/.csv/.txt) | 手动选择文件导入 | `{source, target}` 键值对 |
| 个人词典 | `%AppData%/SynchroLens/personal-dict.json` | 笔记中"改进翻译"自动收录 | `{source, target, improvement, embedding}` |

## 环境配置

在项目根目录创建 `.env` 文件（或通过设置界面配置）：

```bash
XFYUN_APP_ID=你的讯飞AppID
XFYUN_API_KEY=你的讯飞APIKey
XFYUN_API_SECRET=你的讯飞APISecret
DEEPSEEK_API_KEY=你的DeepSeekAPIKey
```

配置会持久化到 `%AppData%/synchrolens/SynchroLens/settings.json`。

### 外部依赖
- **ffmpeg**：用于系统音频采集（dshow 回环），需安装到本地并确保在 PATH 中
- **sox**：不需要（本项目使用 ffmpeg 替代）

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron 28 |
| 前端 | React 18 + TypeScript 5 + TailwindCSS 3 |
| 图标 | lucide-react |
| Markdown 渲染 | react-markdown + remark-gfm |
| 构建 | Vite 5 + electron-vite 2 |
| 语音转写 | 讯飞 WebSocket 实时转写 API (iat) |
| 机器翻译 | DeepSeek 流式 Chat Completions API |
| 向量化 | 豆包 Embedding API（个人词典语义检索） |
| 日志 | winston + winston-daily-rotate-file |
| 测试 | Jest + @testing-library/react |
| 打包 | electron-builder |

## 快速开始

### 环境要求
- Node.js >= 18
- npm >= 9
- ffmpeg（Windows 下需安装到本地）

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run dev
```

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
│   │   ├── mainEntry.ts             # 窗口创建 + 系统托盘 + IPC 注册 + 依赖初始化
│   │   ├── modules/
│   │   │   ├── audio/
│   │   │   │   └── AudioCapture.ts         # ffmpeg dshow 系统音频采集
│   │   │   ├── stt/
│   │   │   │   └── STTClient.ts            # 讯飞 WebSocket 实时转写 + 断连重连
│   │   │   ├── translate/
│   │   │   │   └── Translator.ts           # DeepSeek 流式翻译 + 摘要生成
│   │   │   ├── session/
│   │   │   │   └── SessionManager.ts       # 会话管线编排 + 周期翻译触发
│   │   │   ├── note/
│   │   │   │   ├── NoteWriter.ts           # Markdown 笔记写入
│   │   │   │   └── NoteReader.ts           # 笔记目录扫描 + 内容读取
│   │   │   ├── correction/
│   │   │   │   └── CorrectionDetector.ts   # 翻译一致性纠正检测
│   │   │   ├── dictionary/
│   │   │   │   ├── DictStore.ts            # 语言/领域词典管理
│   │   │   │   └── PersonalDictStore.ts    # 个人词典（改进翻译积累）
│   │   │   ├── vector/
│   │   │   │   └── EmbeddingClient.ts      # 豆包 Embedding API 向量化
│   │   │   ├── favorite/
│   │   │   │   └── FavoriteStore.ts        # 收藏管理 + 搜索
│   │   │   └── config/
│   │   │       └── ConfigStore.ts          # 配置持久化读写
│   │   └── utils/
│   │       ├── logger.ts                   # 日志工厂
│   │       ├── audioResampler.ts           # 音频重采样工具
│   │       ├── vad.ts                      # 语音活动检测
│   │       └── markdownFormatter.ts        # Markdown 格式化
│   ├── renderer/                    # 渲染进程（多窗口入口）
│   │   ├── index.html / main.tsx          # 主窗口入口
│   │   ├── subtitle.html / subtitle.tsx   # 字幕窗入口
│   │   ├── control.html / control.tsx     # 控制窗入口
│   │   ├── windows/
│   │   │   ├── main/MainWindow.tsx        # 主窗口（三栏布局）
│   │   │   ├── subtitle/SubtitleWindow.tsx # 字幕悬浮窗
│   │   │   └── control/ControlWindow.tsx  # 控制悬浮窗
│   │   ├── components/
│   │   │   ├── common/                    # Toast / SplashScreen / Dialog / ErrorBoundary
│   │   │   ├── Sidebar/                   # 侧边栏（导航 + 文件夹树 + 刷新按钮）
│   │   │   ├── Notes/                     # 实时笔记阅读 + 改进翻译面板
│   │   │   ├── Favorites/                 # 收藏视图
│   │   │   ├── Dictionary/               # 词典视图（语言/领域/个人）
│   │   │   ├── SettingsPanel/             # 设置面板（STT/翻译/向量/笔记/音频）
│   │   │   ├── ControlBar/               # 控制条
│   │   │   ├── SubtitleOverlay/          # 字幕渲染（双语 + 光标闪烁）
│   │   │   ├── NoteViewer/               # 笔记查看器
│   │   │   └── SummaryViewer/            # 摘要查看器
│   │   ├── hooks/                         # useSession / useIPC
│   │   └── styles/global.css              # TailwindCSS 全局样式
│   ├── shared/                      # 主进程/渲染进程共享
│   │   ├── types.ts                       # 全部跨进程类型定义
│   │   ├── ipcChannels.ts                 # IPC 通道常量
│   │   └── constants.ts                   # 通用常量
│   └── preload/
│       └── index.ts                       # Preload API（28 个安全桥接方法）
├── Test/                            # Jest 测试（21 个测试文件，镜像 src/ 结构）
├── resources/                       # 打包资源（图标等）
└── electron.vite.config.ts          # 构建配置
```

## IPC 通道速查

| 通道 | 方向 | 用途 |
|------|------|------|
| `stt:partial` | M→R | 语音识别片段（含 isFinal 标记） |
| `translate:partial` | M→R | 流式翻译片段（含 original 原文） |
| `translate:final` | M→R | 翻译最终结果（含 original + translation） |
| `translate:correct` | M→R | 翻译纠正通知 |
| `note:saved` | M→R | 笔记文件路径通知 |
| `note:summary` | M→R | 摘要生成通知 |
| `session:start/stop/pause/resume` | R→M | 会话控制 |
| `session:state-change` | M→R | 会话状态变更 |
| `config:update` | R→M | 配置更新 |
| `summary:trigger` | R→M | 触发摘要生成 |
| `window:prepare-record/exit-control/toggle-subtitle` | R→M | 窗口控制 |
| `favorite:*`（6 条） | R↔M | 收藏 CRUD + 搜索 + 导出 |
| `improve:submit` | R→M | 改进翻译提交（写入个人词典） |
| `personal-dict:status` | R→M | 个人词典状态查询 |
| `dictionary:*`（5 条） | R↔M | 词典文件加载/移除/启用 + 条目管理 |
| `notes:list/read/export-all` | R→M | 笔记目录/内容 + 导出 |
| `data:clear` | R→M | 清除数据 |

> 完整通道定义见 `src/shared/ipcChannels.ts`

## License

MIT

---

演示视频【七牛云-实时翻译软件介绍-哔哩哔哩】 https://b23.tv/4A5947j
