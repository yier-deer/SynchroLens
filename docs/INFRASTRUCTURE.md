# SynchroLens 基础设施说明

## 1. 开发环境

| 项目 | 要求 |
|---|---|
| Node.js | >= 18 |
| npm | >= 9 |
| OS | Windows 优先，macOS / Linux 具备基础兼容 |

## 2. 关键依赖

| 依赖 | 用途 |
|---|---|
| `electron` | 桌面运行时 |
| `electron-vite` | Electron + Vite 构建 |
| `react` / `react-dom` | Renderer UI |
| `ws` | STT WebSocket |
| `openai` | LLM 兼容接口调用 |
| `tencentcloud-sdk-nodejs` | Tencent TMT 客户端 |
| `winston` | 日志 |
| `react-markdown` / `remark-gfm` | 笔记渲染 |

## 3. 外部服务

### STT

- 主 provider：XFYun RTASR
- 回退 provider：XFYun IAT
- 凭据：`XFYUN_APP_ID` / `XFYUN_API_KEY` / `XFYUN_API_SECRET`

### Realtime Translation

- 默认 provider：`tencent-tmt`
- 默认本地 adapter：`http://127.0.0.1:8765`
- 也支持自定义 `nmt` 服务

### LLM 增强

- 默认：DeepSeek OpenAI-compatible endpoint
- 典型用途：
  - summary
  - correction suggestion
  - recommendation sidecar

### Embedding

- 默认：Doubao Embedding
- 默认 endpoint：`https://ark.cn-beijing.volces.com/api/v3`

## 4. 配置持久化

- 配置文件：`userData/SynchroLens/settings.json`
- Tencent `secretKey` 不直接写入 JSON
- `secretKey` 由 `TencentTMTSecretStore` 管理
- `ConfigStore.load()` 会做配置归一化：
  - 旧 `xfyun` provider -> `xfyun-rtasr`
  - 发现 Tencent 凭据时，强制主链 provider 对齐到 `tencent-tmt`

## 5. 构建与验证命令

```bash
npm install
npm run typecheck
npm test -- --runInBand
npm run build
```

## 6. 产物

构建输出：

- `out/main`
- `out/preload`
- `out/renderer`

## 7. 本地运行角色分层

- Main process
  - 音频采集
  - STT / NMT / TMT / LLM / Note / Enhancement 编排
- Preload
  - 安全桥接 API
- Renderer
  - 主窗口 / 字幕窗 / 控制窗

## 8. 日志

- 使用 `winston` + daily rotate
- 主进程与渲染进程日志统一汇聚
- 关键链路模块均有独立 logger：
  - `SessionManager`
  - `NMTTranslator`
  - `STTClient` / `XfyunIatClient` / `XfyunRtasrClient`
  - `AudioCapture`
  - `EmbeddingClient`
