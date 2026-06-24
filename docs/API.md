# SynchroLens API 契约

本文档描述当前实现中的 IPC 契约、Preload 暴露 API，以及主进程内部本地 adapter 接口。

## 1. Main -> Renderer

| Channel | Payload | 用途 |
|---|---|---|
| `stt:partial` | `{ sentenceId, text, isFinal: false, timestamp }` | STT 中间结果 |
| `stt:sentence` | `{ sentenceId, text, isFinal: true, timestamp }` | STT 最终句子 |
| `translate:partial` | `{ sentenceId, original, translation, constraints? }` | 实时翻译中间结果 |
| `translate:final` | `{ sentenceId, original, translation, corrections, constraints?, error? }` | 最终翻译结果 |
| `note:saved` | `{ filePath }` | 会话笔记已创建或已更新 |
| `note:summary` | `{ summary }` | summary 已生成 |
| `enhancement:status` | `{ kind, state, sessionId, ... }` | 摘要 / 纠错 / 推荐增强状态 |
| `session:state-change` | `{ state }` | 会话状态变更 |

注：当前实现中 `translate:correct` 仍保留在共享常量中，但主链增强状态主要通过 `enhancement:status` 对外广播。

## 2. Renderer -> Main

### 会话控制

| Channel | Payload | 返回 |
|---|---|---|
| `session:start` | `{ audioSource }` | `void` |
| `session:stop` | - | `void` |
| `session:pause` | - | `void` |
| `session:resume` | - | `void` |
| `summary:trigger` | - | `void` |
| `config:update` | `Partial<AppConfig>` | `void` |

### 窗口控制

| Channel | Payload | 返回 |
|---|---|---|
| `window:prepare-record` | - | `void` |
| `window:exit-control` | `{ action }` | `void` |
| `window:toggle-subtitle` | `{ visible }` | `void` |

### 配置

| Channel | Payload | 返回 |
|---|---|---|
| `config:load` | - | `AppConfig` |
| `config:save` | `AppConfig` | `void` |

### 收藏 / 词典 / 笔记 / 数据

| Channel | Payload | 返回 |
|---|---|---|
| `favorite:*` | 见实现 | 收藏 CRUD / 搜索 / 导出 |
| `improve:submit` | `{ original, improved, reason, context }` | `void` |
| `personal-dict:status` | - | `{ available, hasEntries, embeddingReady }` |
| `dictionary:files:list` | `{ dictType }` | `DictionaryFileInfo[]` |
| `dictionary:file:*` | 见实现 | 词典文件管理 |
| `dictionary:entries:get` | `{ dictType }` | `DictEntry[]` |
| `dictionary:entry:remove` | `{ dictType, entryId }` | `void` |
| `notes:list` | `{ dirPath? }` | `NoteTreeItem[]` |
| `notes:read` | `{ filePath }` | `string` |
| `notes:export-all` | `{ savePath }` | `void` |
| `data:clear` | `{ types }` | `void` |
| `dialog:select-file` | `{ filters? }` | `string \| null` |
| `dialog:select-directory` | - | `string \| null` |

## 3. Preload 暴露 API

`window.synchrolens` 当前暴露的主要能力：

- `on/off/once`
- `startSession/stopSession/pauseSession/resumeSession`
- `updateConfig/loadConfig/saveConfig`
- `triggerSummary`
- `prepareRecord/exitControl/toggleSubtitle`
- `addFavorite/removeFavorite/removeFavorites/getFavorites/searchFavorites/exportFavorites`
- `submitImprovement/getPersonalDictStatus`
- `listDictionaryFiles/loadDictionaryFile/removeDictionaryFile/toggleDictionaryFile`
- `getDictionaryEntries/removeDictionaryEntry`
- `listNotes/readNote/exportAllNotes`
- `selectDirectory/selectFile`
- `clearData`
- `log`

以 [index.ts](</E:/Trae/worktrees/SynchroLens/pr-backport-optimizations/src/preload/index.ts>) 为准。

## 4. 本地 Tencent TMT Adapter

当前主链默认使用本地 adapter：

- Base URL: `http://127.0.0.1:8765`
- `GET /health`
- `POST /translate`

### `GET /health`

成功返回：

```json
{
  "ok": true,
  "provider": "tencent-tmt",
  "configured": true,
  "secretKeySaved": true
}
```

未配置返回：

```json
{
  "ok": false,
  "provider": "tencent-tmt",
  "configured": false,
  "error": {
    "code": "TMT_CONFIG_MISSING",
    "message": "..."
  }
}
```

### `POST /translate`

请求体示例：

```json
{
  "text": "hello world",
  "targetLanguage": "zh-CN",
  "model": "tencent-tmt",
  "context": [],
  "constraints": []
}
```

## 5. 当前架构约定

- 实时翻译主链不再假定为 DeepSeek 直连。
- `translation.*` 用于实时 NMT / TMT 主链。
- `llm.*` 用于摘要、推荐、纠错建议等增强侧链。
- `enhancement:status` 是增强能力的主要状态广播通道。

## 6. 参考实现

- IPC 常量：[ipcChannels.ts](</E:/Trae/worktrees/SynchroLens/pr-backport-optimizations/src/shared/ipcChannels.ts>)
- Preload API：[index.ts](</E:/Trae/worktrees/SynchroLens/pr-backport-optimizations/src/preload/index.ts>)
- Main 入口：[mainEntry.ts](</E:/Trae/worktrees/SynchroLens/pr-backport-optimizations/src/main/mainEntry.ts>)
