# SynchroLens API 接口契约文档

> 本文档定义 SynchroLens 项目所有 IPC 通道的接口契约，与 `src/shared/ipcChannels.ts` 保持同步。

---

## 1. Main → Renderer（主进程推送）

| 通道名 | 载荷类型 | 触发时机 |
|--------|----------|----------|
| `stt:partial` | `{ sentenceId, text, isFinal: false }` | 讯飞返回中间识别结果 |
| `stt:sentence` | `{ sentenceId, text, timestamp }` | 讯飞返回完整句子 |
| `translate:partial` | `{ sentenceId, translation }` | DeepSeek 流式翻译片段 |
| `translate:final` | `{ sentenceId, original, translation, isFinal, corrections[] }` | 句子翻译完成 |
| `translate:correct` | `{ sentenceId, oldTranslation, newTranslation, reason }` | 上下文纠正触发的译文修正 |
| `note:saved` | `{ filePath }` | 笔记文件写入磁盘后 |
| `note:summary` | `{ summary }` | LLM 摘要生成完成 |
| `session:state-change` | `{ state: 'idle' \| 'running' \| 'paused' \| 'stopped' }` | 会话状态变更时 |

---

## 2. Renderer → Main（渲染进程请求）

### 会话控制

| 通道名 | 载荷 | 返回值 | 用途 |
|--------|------|--------|------|
| `session:start` | `{ audioSource }` | `void` | 启动翻译会话 |
| `session:stop` | — | `void` | 停止会话，触发笔记保存+摘要 |
| `session:pause` | — | `void` | 暂停会话 |
| `session:resume` | — | `void` | 恢复暂停的会话 |
| `config:update` | `Record<string, unknown>` | `void` | 更新应用配置 |
| `summary:trigger` | — | `void` | 手动触发摘要生成 |

### 窗口控制

| 通道名 | 载荷 | 返回值 | 用途 |
|--------|------|--------|------|
| `window:prepare-record` | — | `void` | 创建字幕窗+控制窗 + 最小化主窗 |
| `window:exit-control` | `{ action: 'minimize' \| 'stop' }` | `void` | 隐藏或关闭控制窗（stop 会同时关字幕窗） |
| `window:toggle-subtitle` | `{ visible: boolean }` | `void` | 字幕窗 show/hide（不销毁实例） |

### 收藏

| 通道名 | 载荷 | 返回值 | 用途 |
|--------|------|--------|------|
| `favorite:add` | `{ text, noteFileName, noteFilePath }` | `void` | 添加收藏条目 |
| `favorite:remove` | `{ id }` | `void` | 删除单条收藏 |
| `favorite:remove-batch` | `{ ids[] }` | `void` | 批量删除收藏 |
| `favorite:get` | — | `Favorite[]` | 获取所有收藏 |
| `favorite:search` | `{ query }` | `Favorite[]` | 按关键词搜索收藏 |
| `favorite:export` | `{ ids[], savePath }` | `void` | 导出选中收藏为 .md |

### 改进与个人词典

| 通道名 | 载荷 | 返回值 | 用途 |
|--------|------|--------|------|
| `improve:submit` | `{ original, improved, reason, context }` | `void` | 提交用户改进翻译 |
| `personal-dict:status` | — | `boolean` | 查询个人词典是否开启 |

### 词典管理

| 通道名 | 载荷 | 返回值 | 用途 |
|--------|------|--------|------|
| `dictionary:entries:get` | `{ dictType }` | `DictEntry[]` | 获取词典条目列表 |
| `dictionary:entry:remove` | `{ dictType, entryId }` | `void` | 删除词典条目 |
| `dictionary:file:load` | `{ dictType, filePath }` | `void` | 加载词典文件（CSV/JSON/TXT） |
| `dictionary:file:remove` | `{ dictType, filePath }` | `void` | 移除词典文件 |
| `dictionary:file:toggle` | `{ dictType, filePath, enabled }` | `void` | 启用/禁用词典文件 |

### 笔记读取

| 通道名 | 载荷 | 返回值 | 用途 |
|--------|------|--------|------|
| `notes:list` | `{ dirPath? }` | `NoteTreeItem[]` | 获取笔记文件树 |
| `notes:read` | `{ filePath }` | `string` | 读取笔记文件内容 |

### 数据管理

| 通道名 | 载荷 | 返回值 | 用途 |
|--------|------|--------|------|
| `notes:export-all` | `{ savePath }` | `void` | 导出全部笔记为 .zip |
| `data:clear` | `{ types: ('notes'\|'favorites'\|'personalDict')[] }` | `void` | 清除历史数据 |

### 日志

| 通道名 | 载荷 | 返回值 | 用途 |
|--------|------|--------|------|
| `log:send` | `{ level, module, message, data? }` | 无（send） | 渲染进程日志上报到主进程 |

---

## 3. 核心数据类型

### Favorite
```typescript
interface Favorite {
  id: string;
  text: string;
  noteFileName: string;
  noteFilePath: string;
  createdAt: string;
}
```

### NoteTreeItem
```typescript
interface NoteTreeItem {
  name: string;
  path: string;
  type: 'directory' | 'file';
  children?: NoteTreeItem[];
  modifiedAt?: number;
}
```

### DictEntry
```typescript
interface DictEntry {
  id: string;
  source: string;
  target: string;
  improvement: string;
  sourceNote: string;
  createdAt: string;
}
```

### ImprovementPayload
```typescript
interface ImprovementPayload {
  original: string;
  improved: string;
  reason: string;
  context: string;
}
```

> 完整类型定义见 `src/shared/types.ts`
