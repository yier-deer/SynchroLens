# SynchroLens 贡献指南

> 欢迎为 SynchroLens — AI 同声传译助手 贡献代码！

---

## 1. 开发环境搭建

### 1.1 系统要求

| 依赖 | 最低版本 | 说明 |
|------|----------|------|
| Node.js | 18.x LTS | 推荐 20.x LTS |
| npm | 9.x+ | 随 Node.js 安装 |
| ffmpeg | 5.x+ | 系统音频采集（Windows 需安装到本地 PATH） |
| Git | 2.30+ | 版本控制 |
| 操作系统 | Windows 10+ / macOS 12+ / Ubuntu 20.04+ | Electron 跨平台支持 |

### 1.2 初始化步骤

```bash
# 1. 克隆仓库
git clone <repo-url> SynchroLens
cd SynchroLens

# 2. 创建 .env 文件
cp .env.example .env
# 编辑 .env 填入 API 密钥

# 3. 安装依赖
npm install

# 4. 启动开发服务器（热重载）
npm run dev

# 5. 验证构建
npm run build
```

### 1.3 常用命令速查

| 命令 | 用途 |
|------|------|
| `npm run dev` | 启动开发模式（Electron + Vite 热重载） |
| `npm run build` | 生产构建 |
| `npm test` | 运行全部测试 |
| `npm run test:coverage` | 测试 + 覆盖率报告 |
| `npm run lint` | ESLint 代码检查 |
| `npm run typecheck` | TypeScript 类型检查（node + web） |
| `npm run format` | Prettier 代码格式化 |

### 1.4 环境变量

在项目根目录创建 `.env` 文件：

```bash
XFYUN_APP_ID=你的讯飞AppID
XFYUN_API_KEY=你的讯飞APIKey
XFYUN_API_SECRET=你的讯飞APISecret
DEEPSEEK_API_KEY=你的DeepSeekAPIKey
```

配置会在应用启动时从 `.env` 加载，并通过设置面板持久化到 `settings.json`。

**禁止将 `.env` 文件提交到版本控制。**

---

## 2. 开发流程

### 2.1 分支策略

```
main          ← 稳定可发布分支，始终保持可运行状态
  │
  ├── feat/xxx    ← 功能开发分支
  ├── fix/xxx     ← 缺陷修复分支
  └── refactor/xxx ← 重构分支
```

命名格式：`<type>/<scope>-<简述>`，示例：`feat/stt-language-switch`、`fix/audio-pipe-blocking`。

### 2.2 开发步骤

```
1. 创建分支          ← 从最新 main 检出功能分支
2. 本地开发          ← 编码 + 编写测试 + 本地验证
3. 提交前检查        ← lint + typecheck + test 全部通过
4. 推送并创建 PR     ← 填写完整的 PR 描述
5. 代码审查          ← 等待审查反馈并处理
6. 合并              ← 审查通过后合并，删除功能分支
```

### 2.3 提交前检查清单

- [ ] `npm run lint` 无报错
- [ ] `npm run typecheck` 无类型错误
- [ ] `npm test` 全部通过
- [ ] 无硬编码密钥或敏感信息
- [ ] 涉及 IPC 变更时，类型已同步到 `src/shared/`

---

## 3. PR 提交规范

### 3.1 PR 标题格式

```
<type>(<scope>): <subject>
```

示例：
- `feat(translate): 极简翻译模式 — 关掉思考链`
- `fix(session): 跨STT断连保持累积文本`
- `refactor(audio): ffmpeg pipe 消费改为 on('data')`

### 3.2 PR 描述模板

```markdown
## 功能描述
<!-- 一句话说明本 PR 实现了什么功能 / 修复了什么问题 -->

## 实现思路
<!-- 说明技术方案和关键设计决策 -->

## 测试方式
<!-- 列出验证步骤 -->

## 关联 Issue
<!-- Closes #xxx 或 Relates #xxx -->
```

---

## 4. 代码风格参考

### 4.1 命名规范
- 文件：PascalCase（`SessionManager.ts`、`SubtitleOverlay.tsx`）
- 函数/变量：camelCase（`startSession`、`audioFrameCount`）
- 常量：UPPER_SNAKE_CASE（`MAX_RETRY_COUNT`）
- 私有字段：`private fieldName`

### 4.2 模块结构
- 主进程模块放在 `src/main/modules/<domain>/`，每个模块一个文件
- 渲染进程组件放在 `src/renderer/components/<ComponentName>/`
- 共享类型在 `src/shared/types.ts`

### 4.3 Git 提交格式

```
<type>(<scope>): <subject>
```

type：`feat` | `fix` | `refactor` | `docs` | `test` | `chore`

示例：`fix(stt): wpgs模式下累积文本丢失`

---

## 5. 测试要求

### 5.1 测试框架
- 框架：Jest
- 测试目录：`Test/`，镜像 `src/` 结构
- 运行：`npm test`

### 5.2 测试覆盖
- 核心模块（AudioCapture / STTClient / Translator / SessionManager）：覆盖正常路径和异常路径
- 共享模块（types / ipcChannels / constants）：覆盖边界条件
- 渲染进程 hooks：覆盖状态变更逻辑

### 5.3 运行测试

```bash
# 运行全部测试
npm test

# 运行指定文件
npx jest Test/main/modules/Translator.test.ts

# 覆盖率报告
npm run test:coverage
```

---

## 快速参考

| 场景 | 操作 |
|------|------|
| 开始新功能 | 从 `main` 检出 `feat/<scope>-<desc>` 分支 |
| 修复 bug | 从 `main` 检出 `fix/<scope>-<desc>` 分支 |
| 提交前检查 | lint → typecheck → test → 无硬编码密钥 |
| 创建 PR | 标题格式 `<type>(<scope>): <subject>`，描述含功能+思路+测试 |
| 合并后 | 确认 `main` 可构建、可运行、测试通过 |

---

*本文档随项目演进持续更新。*
