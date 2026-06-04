# SynchroLens — AI 同声传译助手 设计文档

> 日期: 2026-06-05
> 状态: 已确认

## 1. 项目概述

### 1.1 定位

面向中文用户的桌面同声传译工具，实时将外语音频翻译为中文字幕，支持当前句纠正、自动笔记与智能总结。

### 1.2 背景

参加七牛云 XEngineer 新工科计划 AI Coding 比赛，72 小时限时开发 MVP。评审维度：作品完整度与创新性(40%)、开发过程与质量(40%)、演示与表达(20%)。

### 1.3 核心价值主张

- **实时同传**：系统音频/麦克风 → STT → 翻译 → 字幕，端到端低延迟
- **当前句纠正**：句子未结束时，翻译随上下文实时调整，字幕动画更新
- **自动笔记**：每句确认后写入 Markdown，纠正以脚注标注
- **智能总结**：会话结束可选生成摘要（主题、要点、生词、纠正记录）
- **悬浮字幕**：歌词式半透明置顶，叠加在视频上方

## 2. 技术栈

| 层级 | 选型 | 理由 |
|------|------|------|
| 桌面框架 | Electron | 系统音频捕获、透明窗口、多窗口管理 |
| 前端 | React + TypeScript | 组件化开发，类型安全 |
| 构建 | Vite + electron-vite | 快速开发构建 |
| 样式 | TailwindCSS | 快速样式开发 |
| STT | 讯飞 WebSocket 实时转写 | 国内最成熟，流式输出，首帧延迟 <80ms |
| 翻译 | DeepSeek V4 Pro (流式 API) | 性价比极高，流式输出 |
| 测试 | Jest + @testing-library/react | 单元+集成测试 |

## 3. 架构设计

### 3.1 管道式架构

```
音频采集 → [STT 引擎] → 原文流(逐词) → [翻译引擎] → 当前句翻译(实时可纠正)
                                                              ↓
                                                        字幕渲染(当前句)
                                                              ↓ (STT 判定句结束)
                                                        句子确认(冻结，不可变)
                                                              ↓
                                                        笔记写入(Markdown)
                                                              ↓
                                                   纠正检测(每5句批量检查)
                                                              ↓
                                                   笔记纠正脚注(不改字幕)
```

### 3.2 进程架构

**Main Process（主进程）**：
- AudioCaptureModule — 系统音频/麦克风捕获，PCM 16bit 16kHz 输出
- STTClient — 讯飞 WebSocket 连接管理，逐词结果 + 句结束信号
- Translator — DeepSeek 流式翻译，上下文窗口管理（最近 5 句），当前句纠正
- NoteWriter — Markdown 文件生成，纠正脚注，自动总结
- CorrectionDetector — 每 5 句批量检查已冻结句子的翻译一致性
- SessionManager — 会话生命周期管理

**Renderer Process（渲染进程）**：
- 主窗口 — 三栏布局（左侧功能+文件夹 | 中间笔记 | 右侧摘要）
- 悬浮字幕窗口 — 歌词式半透明置顶
- 控制悬浮窗 — 横条状迷你控制

### 3.3 IPC 通信协议

```
Main → Renderer:
  stt:partial       { sentenceId, text, isFinal }
  stt:sentence      { sentenceId, text, timestamp }
  translate:partial { sentenceId, translation }
  translate:final   { sentenceId, translation }
  translate:correct { sentenceId, oldTranslation, newTranslation, reason }
  note:saved        { filePath }
  note:summary      { summary }

Renderer → Main:
  session:start     { audioSource }
  session:stop      {}
  session:pause     {}
  config:update     { sttKey, llmKey, ... }
  summary:trigger   {}
```

## 4. 核心数据结构

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

## 5. UI 设计

### 5.1 三个窗口

1. **主窗口**：三栏布局，日常管理笔记和设置
2. **悬浮字幕窗口**：歌词式，半透明置顶，屏幕下方 20% 位置，可拖拽
3. **控制悬浮窗**：横条状迷你控制，始终置顶

### 5.2 主窗口布局

- **左侧 20%**：功能按钮竖向堆叠（笔记/词典/记忆/设置/录制）+ 文件夹树
- **中间 60%**：笔记内容（默认视图）
- **右侧 20%**：摘要内容（默认视图，可合并）

面板合并机制：
- 右侧摘要栏顶部有"隐藏摘要栏"和"隐藏笔记栏"按钮
- 隐藏摘要栏 → 笔记扩展为 80%
- 隐藏笔记栏 → 摘要扩展为 80%
- 合并动画 300ms 平滑过渡

点击非笔记功能按钮（设置/词典/记忆）时，中间+右侧合体为 80% 展示对应界面。

### 5.3 悬浮字幕窗口

- 纯字幕，其余区域完全透明
- 双语显示：原文小字灰色上方，译文正常白色下方
- 当前句：流式输出 + 光标闪烁
- 已确认句：向上滚动，最多保留 5-8 句
- 当前句纠正：旧文字淡出 + 新文字淡入，动画 300ms
- 位置：屏幕下方约 20%，可拖拽调整
- 鼠标穿透：透明区域不拦截鼠标事件（可配置）

### 5.4 控制悬浮窗

- 横条状，始终置顶，可拖拽
- [▶ 开始/⏹ 停止] [字幕: 开/关] [笔记: 开/关] [— 最小化] [× 退出]
- 开始按钮点击后变为停止，再点击停止翻译
- × 退出弹出询问：最小化到系统托盘 / 关闭控制窗口

### 5.5 准备录制流程

1. 用户在主窗口左侧点击 [🔴 录制]
2. 唤出控制悬浮窗 + 悬浮字幕窗口
3. 主窗口最小化
4. 用户在控制悬浮窗点击 [▶ 开始] 才真正开始翻译
5. 点击 [× 退出] → 停止翻译 → 保存笔记 → 可选总结 → 关闭字幕窗+控制窗 → 恢复主窗口

### 5.6 左侧栏

```
功能按钮（竖向堆叠，上方 ~30%）:
  [📝 笔记]  ← 默认视图，右侧自带摘要
  [📖 词典]  ← 后续迭代，灰色不可点
  [🧠 记忆]  ← 后续迭代，灰色不可点
  [⚙ 设置]  ← 右侧 80% 展示设置面板
  ───────
  [🔴 录制]  ← 唤出控制窗+字幕窗，主窗口最小化
  ───────

文件夹树（下方 ~70%）:
  📁 笔记
  📂 06-05
   ├ 14:30
   └ 20:15
  📂 06-04
   └ 09:00
```

## 6. 核心管道实现

### 6.1 音频采集 → STT

- 系统音频: desktopCapturer → MediaStream → AudioContext → PCM 16bit 16kHz
- 麦克风: navigator.mediaDevices.getUserMedia → 同上
- 音频重采样: 48kHz → 16kHz
- VAD: 静音段不发送
- 讯飞 WebSocket: 每 40ms 发送一帧 (640 bytes)

### 6.2 STT → 翻译

- 翻译触发: STT 每流入一个意群（约 3-5 词）触发一次，句结束时触发最终翻译
- 上下文窗口: 最近 5 句已确认的原文+译文（滑动窗口）
- 当前句纠正: 句子未结束时翻译可调整，字幕动画更新

### 6.3 翻译 → 笔记

- 句子确认（isFinal=true）后写入 Markdown
- 纠正记录以脚注格式追加
- 会话结束时写入文件头和元数据

### 6.4 纠正检测

- 每 5 句已确认句做一次批量检查
- 把最近 5 句原文+译文发给 LLM，检测翻译一致性
- 检测到纠正 → 写入笔记脚注（不改字幕）
- 总结时使用纠正后版本

## 7. 笔记 Markdown 格式

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

## 8. 错误处理

| 场景 | 处理策略 | 用户感知 |
|------|---------|---------|
| 讯飞 WebSocket 断连 | 自动重连（3次，间隔2s），缓冲音频帧 | 字幕暂停，"重连中..." |
| 讯飞 API 额度耗尽 | 停止翻译，弹窗提示 | 翻译停止 |
| DeepSeek API 超时 | 当前句跳过，下一句恢复 | 字幕短暂空缺 |
| DeepSeek API 限流 | 缩短上下文窗口（5句→2句） | 翻译质量可能下降 |
| 音频捕获失败 | 检测权限，弹窗引导授权 | 无法开始 |
| 笔记写入失败 | 重试3次，失败提示换目录 | 弹窗提示 |
| 网络断开 | 暂停翻译，恢复后自动继续 | 字幕暂停 |

## 9. 测试策略

| 层级 | 内容 | 方式 |
|------|------|------|
| 单元测试 | 重采样、Markdown格式化、纠正检测、上下文窗口 | Jest |
| 集成测试 | STT→翻译请求、翻译→笔记、IPC收发 | Jest + mock |
| E2E测试 | 完整翻译流程 | Playwright |
| 手动测试 | 字幕动画、悬浮窗拖拽、面板合并 | 人工验收 |

## 10. 项目结构

```
SynchroLens/
├── src/
│   ├── main/                    # 主进程
│   │   ├── index.ts
│   │   ├── ipc/handlers.ts
│   │   ├── modules/
│   │   │   ├── AudioCapture.ts
│   │   │   ├── STTClient.ts
│   │   │   ├── Translator.ts
│   │   │   ├── NoteWriter.ts
│   │   │   ├── CorrectionDetector.ts
│   │   │   └── SessionManager.ts
│   │   └── utils/
│   │       ├── audioResampler.ts
│   │       ├── vad.ts
│   │       └── markdownFormatter.ts
│   ├── renderer/                # 渲染进程
│   │   ├── App.tsx
│   │   ├── windows/
│   │   │   ├── MainWindow.tsx
│   │   │   ├── SubtitleWindow.tsx
│   │   │   └── ControlWindow.tsx
│   │   ├── components/
│   │   │   ├── Sidebar/
│   │   │   ├── NoteViewer/
│   │   │   ├── SummaryViewer/
│   │   │   ├── SettingsPanel/
│   │   │   ├── SubtitleOverlay/
│   │   │   └── ControlBar/
│   │   ├── hooks/
│   │   └── styles/
│   ├── shared/
│   │   ├── types.ts
│   │   ├── ipcChannels.ts
│   │   └── constants.ts
│   └── preload/
│       └── index.ts
├── Test/
├── notes/
├── assets/
└── docs/
```

## 11. MVP 功能范围

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 系统音频捕获 | P0 | Electron desktopCapturer |
| 麦克风捕获 | P0 | 备选输入源 |
| 实时 STT | P0 | 讯飞 WebSocket 流式转写 |
| 流式翻译 | P0 | DeepSeek 流式输出 |
| 字幕渲染 | P0 | 当前句实时显示，确认后锁定 |
| 当前句纠正 | P0 | 句子未结束时翻译可调整 |
| 悬浮字幕窗口 | P0 | 歌词式半透明置顶 |
| 控制悬浮窗 | P0 | 横条状迷你控制 |
| 笔记自动写入 | P1 | 句子冻结后写入 Markdown |
| 笔记纠正标注 | P1 | 后续上下文暴露错误时在笔记中标注 |
| 自动总结 | P1 | 会话结束时可选生成摘要 |
| 本地文件音频 | P2 | 有时间再加 |

## 12. 后续迭代

| 功能 | 说明 |
|------|------|
| 语音播报 | TTS 输出翻译结果 |
| 日志查看器 | 阅读视图/编辑视图，右键改进对话框 |
| 用户词典学习 | 从用户纠正中学习偏好 |
| 领域偏好适配 | 记录用户常看领域，自动加载术语库 |
