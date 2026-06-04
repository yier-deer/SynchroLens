# SynchroLens 前端开发指导文档

> 本文档供前端开发 Agent 集群使用，覆盖项目背景和布局约束，不规定视觉风格和交互细节。

## 1. 项目背景

**SynchroLens** 是一个 AI 同声传译桌面应用，参加七牛云 XEngineer AI Coding 比赛（72 小时限时开发）。

核心功能：实时将外语音频翻译为中文字幕，叠加显示在视频上方，同时自动生成笔记和摘要。

技术栈：**Electron + React + TypeScript + TailwindCSS**，构建工具 **Vite + electron-vite**。

## 2. 三个窗口

本应用有 3 个独立的 Electron BrowserWindow，各自有独立的渲染进程：

### 2.1 主窗口（MainWindow）

日常管理界面，三栏布局。

### 2.2 悬浮字幕窗口（SubtitleWindow）

歌词式半透明置顶窗口，叠加在视频上方显示实时翻译字幕。

### 2.3 控制悬浮窗（ControlWindow）

横条状迷你控制窗口，始终置顶，用于控制翻译会话。

## 3. 主窗口布局约束

```
┌──────────┬──────────────────────────────────┬────────────────────┐
│  左侧 20% │          中间 60%                │    右侧 20%        │
│          │                                  │                    │
│  功能按钮 │        内容区                     │    摘要区           │
│  (竖向)   │  (根据按钮切换)                   │  (可合并到中间)     │
│          │                                  │                    │
│  文件夹树 │                                  │                    │
│          │                                  │                    │
└──────────┴──────────────────────────────────┴────────────────────┘
```

### 3.1 左侧栏（20%，固定不变）

**上方区域（~30%）**：功能按钮，竖向堆叠

| 按钮 | 功能 | MVP 状态 |
|------|------|---------|
| 📝 笔记 | 切换到笔记+摘要三栏视图 | 可用 |
| 📖 词典 | 切换到词典界面（右侧80%） | 灰色占位，提示"后续版本" |
| 🧠 记忆 | 切换到记忆界面（右侧80%） | 灰色占位，提示"后续版本" |
| ⚙ 设置 | 切换到设置界面（右侧80%） | 可用 |
| 🔴 录制 | 唤出控制悬浮窗+字幕窗口，主窗口最小化 | 可用 |

按钮之间用分隔线将"录制"与其他功能按钮隔开。

**下方区域（~70%）**：文件夹树

- 根目录为笔记保存路径
- 按日期自动创建子文件夹（YYYY-MM-DD）
- 每个翻译会话一个 .md 文件，文件名为开始时间（HH-mm）
- 用户可自行在文件系统中管理，软件自动识别
- 点击文件 → 中间区域显示对应笔记内容

### 3.2 中间区域（60%，默认为笔记视图）

显示当前选中笔记的完整内容，Markdown 渲染。

### 3.3 右侧区域（20%，默认为摘要视图）

显示当前笔记对应的摘要内容。

**面板合并机制**：
- 右侧摘要栏顶部有两个按钮："隐藏摘要栏" 和 "隐藏笔记栏"
- 隐藏摘要栏 → 笔记扩展为 80%，摘要收起
- 隐藏笔记栏 → 摘要扩展为 80%，笔记收起
- 合并/展开需有平滑动画（约 300ms）
- 默认状态：笔记 60% + 摘要 20%

### 3.4 功能按钮切换逻辑

| 点击按钮 | 左侧 20% | 右侧 80% |
|---------|----------|---------|
| 📝 笔记 | 文件夹树 | 笔记 60% + 摘要 20%（可合并） |
| 📖 词典 | 文件夹树 | 词典界面 80%（灰色占位） |
| 🧠 记忆 | 文件夹树 | 记忆界面 80%（灰色占位） |
| ⚙ 设置 | 文件夹树 | 设置界面 80% |
| 🔴 录制 | — | 唤出控制窗+字幕窗，主窗口最小化 |

## 4. 悬浮字幕窗口约束

- **纯字幕显示**，其余区域完全透明
- **位置**：屏幕下方约 20% 处，可拖拽调整
- **大小**：可拖拽调整宽高
- **双语显示**：原文（小字灰色）在上方，译文（正常白色）在下方
- **当前句**：流式输出，带光标闪烁效果
- **已确认句**：向上滚动，最多保留 5-8 句
- **当前句纠正**：内容替换时需有视觉反馈动画
- **鼠标穿透**：透明区域不拦截鼠标事件（可配置开关）
- **始终置顶**
- **无边框**

## 5. 控制悬浮窗约束

- **横条状**，始终置顶，可拖拽
- **无边框**
- 布局：左侧标题，右侧控制按钮横排

| 控件 | 说明 |
|------|------|
| ▶ 开始 / ⏹ 停止 | 开始后按钮变为停止，停止后变回开始 |
| 字幕: 开/关 | 切换悬浮字幕窗口显示 |
| 笔记: 开/关 | 切换主窗口显示 |
| — 最小化 | 最小化到系统托盘 |
| × 退出 | 弹出询问对话框 |

**× 退出询问对话框**：
- 选项 1：最小化到系统托盘（翻译继续运行）
- 选项 2：关闭控制窗口（停止翻译+保存笔记+关闭字幕窗+恢复主窗口）
- 取消

## 6. 设置面板内容

设置面板在右侧 80% 区域展示，包含以下分组：

- **语音识别**：服务商选择、API Key、API Secret
- **翻译服务**：服务商选择、API Key、模型选择
- **字幕显示**：字体大小、译文颜色、原文颜色、背景透明度、显示原文开关、鼠标穿透开关
- **笔记**：保存目录、自动保存开关、自动总结开关
- **音频源**：默认源选择（系统音频/麦克风）、降噪开关
- **快捷键**：开始/暂停、字幕显隐、笔记显隐
- **数据**：导出全部笔记、清除历史数据

## 7. IPC 数据接口

前端通过 preload 脚本暴露的 API 与主进程通信。以下是前端需要监听和发送的事件：

### 7.1 监听事件（Main → Renderer）

```typescript
// STT 逐词结果
on('stt:partial', (data: { sentenceId: string; text: string; isFinal: boolean }) => {})

// STT 句子确认
on('stt:sentence', (data: { sentenceId: string; text: string; timestamp: number }) => {})

// 翻译流式结果
on('translate:partial', (data: { sentenceId: string; translation: string }) => {})

// 翻译确认
on('translate:final', (data: { sentenceId: string; translation: string }) => {})

// 翻译纠正
on('translate:correct', (data: { sentenceId: string; oldTranslation: string; newTranslation: string; reason: string }) => {})

// 笔记已保存
on('note:saved', (data: { filePath: string }) => {})

// 总结完成
on('note:summary', (data: { summary: string }) => {})
```

### 7.2 发送事件（Renderer → Main）

```typescript
// 开始翻译会话
invoke('session:start', { audioSource: 'system' | 'microphone' })

// 停止翻译会话
invoke('session:stop')

// 暂停翻译
invoke('session:pause')

// 更新配置
invoke('config:update', { sttKey?: string; llmKey?: string; ... })

// 手动触发总结
invoke('summary:trigger')
```

## 8. 共享类型定义

```typescript
/** STT 识别结果 */
interface STTResult {
  sentenceId: string;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

/** 翻译结果 */
interface TranslationResult {
  sentenceId: string;
  original: string;
  translation: string;
  isFinal: boolean;
  corrections: Correction[];
}

/** 纠正记录 */
interface Correction {
  from: string;
  to: string;
  reason: string;
  timestamp: number;
}

/** 翻译会话 */
interface Session {
  id: string;
  startTime: number;
  endTime?: number;
  audioSource: 'system' | 'microphone' | 'file';
  sentences: TranslationResult[];
  notePath?: string;
  summary?: string;
}
```

## 9. 笔记 Markdown 格式参考

前端 NoteViewer 组件需要渲染以下格式的 Markdown：

```markdown
# 2026-06-05 14:30 翻译会话

> 音频源: 系统音频 | 时长: 12分35秒 | 句子数: 47

---

14:30:15 | The bank was closed today.
          | 银行今天关门了。
          | > ~~河岸~~ → 银行（后文确认金融语境）

14:30:22 | We need to deposit the check.
          | 我们需要存入这张支票。

---

## 📊 摘要

**主题**: 金融业务场景

**关键要点**:
- 银行因故关闭，需要处理支票存款

**生词/术语**:
- deposit: 存入
- check: 支票（非"检查"）

**纠正记录**:
- bank: 河岸 → 银行（后文确认金融语境）
```

## 10. 项目目录结构（前端相关）

```
src/renderer/
├── App.tsx
├── windows/
│   ├── MainWindow.tsx        # 主窗口入口
│   ├── SubtitleWindow.tsx    # 悬浮字幕窗口入口
│   └── ControlWindow.tsx     # 控制悬浮窗入口
├── components/
│   ├── Sidebar/              # 左侧栏（功能按钮+文件夹树）
│   ├── NoteViewer/           # 笔记阅读视图
│   ├── SummaryViewer/        # 摘要视图
│   ├── SettingsPanel/        # 设置面板
│   ├── SubtitleOverlay/      # 字幕渲染（流式+动画）
│   └── ControlBar/           # 控制栏组件
├── hooks/
│   ├── useIPC.ts             # IPC 通信 hook
│   └── useSession.ts         # 会话状态管理
└── styles/
    ├── global.css
    └── themes/
```

## 11. 自由发挥空间

以下方面**不做规定**，由开发团队自主决定：

- 配色方案和视觉风格
- 字体选择（除字幕默认大小外）
- 动画细节（除面板合并 300ms 和字幕纠正动画外）
- 组件内部实现方式
- 状态管理方案（Context/Zustand/Jotai 等）
- Markdown 渲染库选择
- 文件夹树的交互细节（展开/折叠/右键菜单等）
- 设置面板的布局细节
- 灰色占位页面的设计
- 图标库选择
