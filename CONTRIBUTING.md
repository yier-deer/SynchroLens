# SynchroLens 贡献指南

> 欢迎为 SynchroLens — AI 同声传译助手 贡献代码！
> 本文档定义开发环境搭建、开发流程、PR 规范、代码审查标准和测试要求。
> 代码风格、命名规范、提交格式等详见 [CONVENTIONS.md](./CONVENTIONS.md)。

---

## 1. 开发环境搭建

### 1.1 系统要求

| 依赖 | 最低版本 | 说明 |
|------|----------|------|
| Node.js | 18.x LTS | 推荐 20.x LTS |
| npm | 9.x+ | 随 Node.js 安装 |
| Git | 2.30+ | 支持稀疏检出 |
| 操作系统 | Windows 10+ / macOS 12+ / Ubuntu 20.04+ | Electron 跨平台支持 |

### 1.2 初始化步骤

```bash
# 1. 克隆仓库
git clone <repo-url> SynchroLens
cd SynchroLens

# 2. 安装依赖
npm install

# 3. 启动开发服务器（热重载）
npm run dev

# 4. 验证构建
npm run build

# 5. 运行测试
npm run test
```

### 1.3 常用命令速查

| 命令 | 用途 |
|------|------|
| `npm run dev` | 启动开发模式（Electron + Vite 热重载） |
| `npm run build` | 生产构建 |
| `npm run test` | 运行全部测试 |
| `npm run lint` | 代码风格检查 |
| `npm run typecheck` | TypeScript 类型检查 |

### 1.4 环境变量

如需使用外部 API（翻译、语音识别等），在项目根目录创建 `.env` 文件：

```bash
ECHO_API_KEY=your_api_key_here
ECHO_STT_PROVIDER=whisper
ECHO_DEEPL_API_KEY=your_deepl_key
```

**禁止将 `.env` 文件提交到版本控制。** 项目 `.gitignore` 已包含此规则。

---

## 2. 开发流程

### 2.1 分支策略

```
main          ← 稳定可发布分支，始终保持可运行状态
  │
  ├── feat/xxx    ← 功能开发分支
  ├── fix/xxx     ← 缺陷修复分支
  ├── refactor/xxx ← 重构分支
  └── chore/xxx   ← 工具/依赖变更分支
```

**规则**：

- `main` 分支受保护，禁止直接推送，所有变更通过 PR 合入
- 功能分支从 `main` 检出，命名格式：`<type>/<scope>-<简述>`
  - 示例：`feat/stt-whisper-integration`、`fix/audio-device-switch`
- 分支粒度：一个分支只做一件事，与 PR 一一对应
- 分支生命周期：短命，完成后尽快合并，避免长期存活的远端分支

### 2.2 开发步骤

```
1. 认领任务          ← 在 Issue 中评论认领，或自行创建 Issue
2. 创建分支          ← 从最新 main 检出功能分支
3. 本地开发          ← 编码 + 编写测试 + 本地验证
4. 提交前检查        ← 执行提交前检查清单（见 2.3）
5. 推送并创建 PR     ← 填写完整的 PR 描述
6. 代码审查          ← 等待审查反馈并处理
7. 合并              ← 审查通过后合并，删除功能分支
```

### 2.3 提交前检查清单

每次提交和创建 PR 前必须确认：

- [ ] `npm run lint` 无报错
- [ ] `npm run typecheck` 无类型错误
- [ ] `npm run test` 全部通过
- [ ] 无硬编码密钥或敏感信息
- [ ] 涉及 IPC 变更时，类型已同步更新到 `src/shared/types/`

> 代码风格和命名规范详见 [CONVENTIONS.md 第 1 节](./CONVENTIONS.md#1-代码风格)。
> 提交消息格式详见 [CONVENTIONS.md 第 3 节](./CONVENTIONS.md#3-git-提交规范)。

### 2.4 保持分支同步

开发过程中，如 `main` 有新提交，及时 rebase：

```bash
git fetch origin
git rebase origin/main
```

如遇冲突，在本地解决后再推送。避免使用 merge 产生不必要的合并提交。

---

## 3. PR 提交规范

### 3.1 核心原则

> **每个 PR 只做一件事。** 一个 PR 只解决一个功能、一个 bug、一次重构。
> 如有多个独立变更，拆分为多个 PR。

**比赛要求对齐**：此原则与比赛规则完全一致，严禁在一个 PR 中混合多个不相关变更。

### 3.2 PR 标题格式

与提交消息格式一致（详见 [CONVENTIONS.md 第 3.1 节](./CONVENTIONS.md#31-conventional-commits)）：

```
<type>(<scope>): <subject>
```

**示例**：
- `feat(translate): 接入 DeepL 翻译 API`
- `fix(subtitle): 修复字幕窗口在多显示器下位置偏移`
- `refactor(session): 将会话状态管理迁移到状态机模式`

### 3.3 PR 描述模板

每个 PR 必须包含以下四项内容（与比赛要求完全对齐）：

```markdown
## 功能描述
<!-- 一句话说明本 PR 实现了什么功能 / 修复了什么问题 -->

## 实现思路
<!-- 说明技术方案和关键设计决策，便于审查者理解 -->

## 测试方式
<!-- 列出验证步骤，确保审查者可以复现验证 -->

## 关联 Issue
<!-- Closes #xxx 或 Relates #xxx -->

## 截图/录屏（如适用）
<!-- UI 变更必须附截图 -->
```

> 完整填写示例详见 [CONVENTIONS.md 第 4.3 节](./CONVENTIONS.md#43-pr-描述模板)。

### 3.4 PR 检查清单

提交 PR 前须确认（详见 [CONVENTIONS.md 第 4.4 节](./CONVENTIONS.md#44-pr-检查清单)）：

- [ ] PR 只做一件事
- [ ] 标题和描述清晰完整
- [ ] 代码通过 `npm run lint` 无报错
- [ ] 代码通过 `npm run typecheck` 无类型错误
- [ ] 所有测试通过 `npm test`
- [ ] 新功能有对应测试覆盖
- [ ] 无硬编码密钥或敏感信息
- [ ] 涉及 IPC 变更时，类型已同步更新到 `src/shared/types/`

### 3.5 PR 合并后要求

> **比赛要求对齐**：PR 合并后 `main` 分支必须保持可运行状态。

合并前须确认：
- `npm run build` 构建成功
- `npm run test` 全部通过
- `npm run dev` 可正常启动应用

如合并后 `main` 出现构建或运行失败，须立即修复，优先级高于一切其他工作。

### 3.6 持续交付要求

> **比赛要求对齐**：全周期持续交付，严禁临尾突击提交。

- 每个功能完成后立即提交 PR，不要积攒到比赛截止前集中提交
- 建议每个功能模块完成后 24 小时内提交 PR
- 长时间无提交记录将影响比赛评审

---

## 4. 代码审查标准

### 4.1 审查流程

```
PR 提交 → 自动检查（lint/typecheck/test）→ 人工审查 → 反馈/批准 → 合并
```

- 自动检查未通过的 PR，审查者有权直接要求修复，不进行代码审查
- 人工审查至少需要 1 人批准后方可合并

### 4.2 审查维度

| 维度 | 关注点 |
|------|--------|
| **正确性** | 逻辑是否正确，边界条件是否处理，异常路径是否覆盖 |
| **一致性** | 是否符合 [CONVENTIONS.md](./CONVENTIONS.md) 中的规范 |
| **可维护性** | 代码是否清晰易懂，职责是否单一，是否存在过度抽象 |
| **安全性** | 是否存在硬编码密钥、注入风险、敏感信息泄露 |
| **测试覆盖** | 新功能是否有测试，测试是否有效验证了预期行为 |
| **性能** | 是否引入不必要的性能问题（如频繁渲染、内存泄漏） |

### 4.3 审查反馈分级

| 级别 | 含义 | 处理方式 |
|------|------|----------|
| 🔴 **阻塞** | 必须修复才能合并 | 逻辑错误、安全漏洞、测试缺失 |
| 🟡 **建议** | 建议修改但不阻塞 | 代码可读性、命名优化、性能改进 |
| 🟢 **认可** | 认可当前实现 | 无需修改 |

### 4.4 审查者职责

- 在 24 小时内完成审查
- 反馈须具体、可操作，说明原因和改进方向
- 对 🔴 阻塞项须明确标注，对 🟡 建议项须标注为非阻塞

### 4.5 提交者职责

- 对审查反馈逐条回应：修复、说明理由或标记讨论
- 修复后推送新提交，不要 force push（审查者需要看到变更历史）
- 对 🟡 建议项如不采纳，须说明理由

---

## 5. 测试要求

### 5.1 测试框架与目录

- 框架：Jest
- 测试目录：`Test/`，镜像 `src/` 结构
- 命名规范和编写原则详见 [CONVENTIONS.md 第 5 节](./CONVENTIONS.md#5-测试规范)

### 5.2 覆盖率要求

| 模块类别 | 最低行覆盖率 | 示例 |
|----------|-------------|------|
| 核心模块 | ≥ 80% | `audioCapture`、`sttClient`、`translator`、`sessionManager` |
| 工具模块 | ≥ 70% | `noteWriter`、`correctionDetector` |
| 渲染进程组件 | 覆盖渲染 + 主要交互 | `SubtitleOverlay`、`ControlPanel` |

> 覆盖率要求详见 [CONVENTIONS.md 第 5.4 节](./CONVENTIONS.md#54-覆盖率要求)。

### 5.3 测试编写规则

- **新功能必须有测试**：每个新功能至少覆盖正常路径和主要异常路径
- **测试独立性**：每个用例独立运行，不依赖其他用例的副作用
- **Mock 边界**：只 mock 外部依赖（网络、文件系统、Electron API），被测模块内部逻辑不 mock
- **AAA 模式**：Arrange → Act → Assert，结构清晰

### 5.4 运行测试

```bash
# 运行全部测试
npm run test

# 运行指定模块测试
npx jest Test/main/translator.test.ts

# 查看覆盖率报告
npx jest --coverage
```

### 5.5 测试失败处理

- 测试失败时禁止跳过（`skip`/`todo`），必须修复或删除无效测试
- CI 中测试失败视为构建失败，PR 不可合并
- 修复测试失败应优先于新功能开发

---

## 快速参考

| 场景 | 操作 |
|------|------|
| 开始新功能 | 从 `main` 检出 `feat/<scope>-<desc>` 分支 |
| 修复 bug | 从 `main` 检出 `fix/<scope>-<desc>` 分支 |
| 提交前检查 | lint → typecheck → test → 无硬编码密钥 → IPC 类型同步 |
| 创建 PR | 标题格式 `<type>(<scope>): <subject>`，描述含功能描述+实现思路+测试方式+关联Issue |
| 审查反馈 | 🔴 阻塞必须修，🟡 建议可讨论，逐条回应 |
| 合并后 | 确认 `main` 可构建、可运行、测试通过 |

---

*本文档随项目演进持续更新，重大变更需团队确认。*
