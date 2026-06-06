# SynchroLens 基础设施声明

> 本文档定义 SynchroLens 项目的开发环境、依赖、构建、打包及外部服务配置。

---

## 1. 开发环境要求

| 项目 | 最低版本 | 推荐版本 |
|------|----------|----------|
| Node.js | 18.17.0 | 20.x LTS |
| npm | 9.0.0 | 10.x |
| 操作系统 | Windows 10 / macOS 11 / Ubuntu 20.04 | Windows 11 / macOS 14 / Ubuntu 22.04 |
| Git | 2.30.0 | 2.43+ |

```bash
node -v   # >= 18.17.0
npm -v    # >= 9.0.0
```

---

## 2. 项目依赖

### 生产依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| electron | ^28.0.0 | 桌面应用框架 |
| react + react-dom | ^18.2.0 | UI 组件库 |
| lucide-react | ^0.462.0 | MIT 开源图标库，替代 emoji 用于 UI |
| react-markdown + remark-gfm | ^9 / ^4 | Markdown 渲染，用于笔记阅读模式 |
| winston | ^3.19.0 | 结构化日志 |
| winston-daily-rotate-file | ^5.0.0 | 日志文件轮转 |
| ws | ^8.16.0 | WebSocket 客户端（讯飞 STT） |
| openai | ^4.24.0 | DeepSeek API（OpenAI 兼容）调用 |

### 开发依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| typescript | ^5.7.3 | 类型安全 |
| @vitejs/plugin-react | ^4.2.0 | Vite React 插件 |
| electron-vite | ^2.0.0 | Electron + Vite 集成 |
| tailwindcss + postcss + autoprefixer | ^3.4 / ^8.4 / ^10.4 | 原子化 CSS |
| electron-builder | ^24.9.0 | 应用打包 |
| jest + ts-jest + @testing-library/react | ^29.7 / ^29.2 / ^14.1 | 测试框架 |
| eslint + prettier | ^8.56 / ^3.1 | 代码规范 |
| @types/ws + @types/react + @types/jest | — | 类型声明 |

> 完整依赖树见 `package.json`

---

## 3. 外部服务配置

### 讯飞 STT
- WebSocket 端点：`iat-api.xfyun.cn/v2/iat`
- 鉴权方式：HMAC-SHA256 签名
- 音频格式：PCM 16kHz 16bit 单声道
- 配置字段：AppID + API Key + API Secret

### DeepSeek 翻译
- API 端点：`https://api.deepseek.com/v1/chat/completions`
- 鉴权方式：Bearer Token（API Key）
- 模型：`deepseek-chat`（默认，可在设置中配置）

### DeepSeek Embedding（个人词典向量化）
- API 端点：`https://api.deepseek.com/v1/embeddings`
- 模型：`deepseek-chat`（默认）
- 用途：用户改进翻译的语义检索

---

## 4. 构建系统

| 命令 | 用途 |
|------|------|
| `npm run dev` | 开发模式（electron-vite dev） |
| `npm run build` | 生产构建（三窗口 HTML 入口） |
| `npm test` | Jest 测试 |
| `npm run typecheck` | TypeScript 类型检查 |

### 构建输出结构
```
out/
├── main/index.js           # 主进程
├── preload/index.js        # Preload 脚本
└── renderer/
    ├── index.html          # 主窗口
    ├── subtitle.html       # 字幕窗
    ├── control.html        # 控制窗
    └── assets/             # CSS + JS
```

---

## 5. 选择理由

- **electron-vite**：三入口构建（主进程/预加载/渲染进程），开发热更新，生产优化
- **TailwindCSS**：原子化 CSS，配合自定义三色体系（primary/accent/surface）实现暗色主题
- **lucide-react**：轻量级图标库，替代 emoji 提供一致的 UI 风格
- **react-markdown**：笔记阅读模式的核心依赖，支持 GFM 表格和任务列表
- **winston**：全链路日志，支持文件轮转，开发/生产均保留
- **electron-builder**：自动生成 Windows/macOS 安装包
