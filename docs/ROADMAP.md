# SynchroLens 功能路线图

> **SynchroLens** — AI 同声传译助手

---

## 当前进度总览

| 阶段 | PR 范围 | 状态 |
|------|---------|------|
| 核心链路（P0） | #1-#19 | ✅ 已完成 |
| 基础设施 | #20-#23 | ✅ 已完成（打包/启动/UI修正/日志） |
| 前端 UI 迁移 | #24-#32 | ✅ 已完成（9 个 PR） |
| 后端补齐 | #33-#41 | 🔲 待执行 |
| 词典向量化 + 托盘完善 | V0.2 预留 | 📋 规划中 |

---

## ✅ 已完成 — 核心链路

| 功能 | 说明 |
|------|------|
| 系统/麦克风音频采集 | AudioCapture 模块，支持 WASAPI |
| 讯飞 WebSocket STT | 实时语音转写，HMAC-SHA256 鉴权 |
| DeepSeek 流式翻译 | OpenAI 兼容 API，上下文窗口感知 |
| 翻译纠正检测 | 词级别一致性检查，每 5 句批量触发 |
| Markdown 笔记写入 | NoteWriter，按日期分组保存 |
| LLM 摘要生成 | 主要议题 + 关键结论 + 待办事项 |

---

## ✅ 已完成 — 三窗口架构 + 全功能前端

| 功能 | 说明 |
|------|------|
| 系统托盘 | 右键菜单：显示控制窗 / 退出 |
| 字幕悬浮窗 | 800×120 透明置顶，鼠标穿透，最多 8 句堆叠 |
| 控制悬浮窗 | 320×48，开始/停止 + 字幕开关 + 最小化 + 退出三选 |
| 启动画面 | SplashScreen 品牌动画 + 进度条 |
| 侧边栏 | 导航按钮（笔记/收藏/词典/设置/准备录制）+ 文件夹树 |
| 笔记阅读模式 | react-markdown 渲染 + 右键菜单（复制/收藏/改进） |
| 改进翻译 | 底部升起面板 → 确认 → 俏皮弹窗 |
| 收藏视图 | 卡片列表 + 搜索高亮 + 管理模式批量操作 |
| 词典视图 | 左侧竖排导航（语言/领域/个人），文件卡片+表格 |
| 设置面板 | 8 分组 17+ 字段（部分字段已实现） |
| 退出确认 | 控制窗 X → 三选对话框（托盘/关闭/取消） |
| 多窗口构建 | 3 个独立 HTML 入口 + 各自 React 组件 |

---

## 🔲 待执行 — 后端补齐（PR-33 ~ PR-41）

| PR | 任务 | 说明 |
|----|------|------|
| #33 | ipc-wiring | 接通 `ipc/handlers.ts` 的 registerIPCHandlers |
| #34 | session-wiring | 创建 SessionManager 实例 + 注入全部模块依赖 |
| #35 | event-broadcast | 确保 translate 事件正确推送到渲染进程 |
| #36 | favorite-store | 实现收藏 JSON 持久化（6 个 handler） |
| #37 | note-reader | 实现笔记目录扫描 + 文件读取（2 个 handler） |
| #38 | dict-store | 实现词典文件解析 CSV/JSON/TXT（5 个 handler） |
| #39 | improve-handler | 实现改进提交 + 个人词典状态（2 个 handler） |
| #40 | export-clear | 实现笔记导出 ZIP + 数据清除（2 个 handler） |
| #41 | settings-panel | 设置面板补齐 8 分组 + 修正错位字段 |

---

## 📋 V0.2 预留

| 功能 | 说明 |
|------|------|
| 词典文件向量化 | 语言/领域词典 embedding + 向量检索介入翻译管道 |
| 个人词典 embedding | 用户改进记录向量化，DeepSeek Embedding API |
| 全局快捷键注册 | Ctrl+Shift+S 开始/停止等 |
| 笔记目录大纲导航 | 阅读模式右侧 Markdown heading 提取 |
| 系统托盘图标资源 | 补充 `resources/icon.png` |

---

> 详细任务步骤见 `.trae/specs/v0.1-complete-pass/tasks.md`
