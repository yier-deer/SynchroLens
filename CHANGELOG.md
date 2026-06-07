# 更新日志

本项目的所有重要变更均会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [0.1.0] - 2026-06-07

### Added — P0 核心功能

- 系统音频捕获：通过 ffmpeg dshow 采集 Windows 立体声混音
- 实时语音识别（STT）：接入讯飞 WebSocket 实时转写 API，支持中/英/日/韩
- 流式翻译：接入 DeepSeek 流式 Chat Completions API，极简直译模式
- 字幕渲染：双语字幕（原文+译文），支持实时滚动显示和光标闪烁动画
- 悬浮字幕窗口：透明置顶、鼠标穿透，在其他应用上方显示字幕
- 控制悬浮窗：迷你控制面板，支持开始/停止/字幕开关/最小化/退出
- SessionManager 周期翻译：每 1.5s 扫描累积文本，跨 STT 断连保持，结束前 flush

### Added — P1 增强功能

- 笔记自动写入（Markdown）：识别+翻译结果自动整理为 Markdown，按 `YYYY-MM-DD/HH-mm.md` 组织
- 笔记阅读：react-markdown + remark-gfm 渲染，右键菜单（复制/收藏/改进）
- 自动总结：会话结束后 LLM 生成摘要（主要议题 + 关键结论）
- 笔记历史刷新：侧边栏手动刷新按钮 + 停止后自动刷新

### Added — P2 扩展功能

- 收藏系统：右键收藏 → 卡片展示 → 搜索高亮 → 批量管理 → 导出 Markdown
- 三层词典：
  - 语言词典：导入 .json/.csv/.txt 术语表文件
  - 领域词典：导入行业文档
  - 个人词典：笔记中"改进翻译"自动收录，附带向量 embedding
- 设置面板：STT/翻译/向量/笔记/音频 五大类配置，持久化到本地 JSON
- 向量化检索：豆包 Embedding API，个人词典余弦相似度搜索

### Added — 工程基础设施

- Electron 28 + React 18 + TypeScript 5 + TailwindCSS 3 + Vite 5 脚手架
- 多窗口架构：主窗口 + 字幕窗 + 控制窗，三窗口独立渲染进程
- IPC 通信层：30+ 条通道，涵盖会话/翻译/笔记/收藏/词典/配置
- 预加载脚本：28 个安全桥接 API 方法
- 结构化日志：winston + daily-rotate-file，全局 createLogger 封装
- 21 个 Jest 测试文件，镜像 src/ 目录结构
- .env 配置 + settings.json 持久化双通道
- electron-builder 打包配置
