/**
 * IPC 通道名称常量定义
 * 所有主进程与渲染进程之间的 IPC 通信通道名称集中管理于此
 *
 * 命名规范：`模块:动作`，使用 camelCase
 * 方向说明：
 *   Main → Renderer：主进程主动推送给渲染进程的消息
 *   Renderer → Main：渲染进程发送给主进程的请求/指令
 */

/**
 * IPC 通道名称常量对象
 * 包含所有主进程与渲染进程之间的通信通道名称
 */
export const IPC_CHANNELS = {
  // ===== Main → Renderer =====
  STT_PARTIAL: 'stt:partial',
  STT_SENTENCE: 'stt:sentence',
  TRANSLATE_PARTIAL: 'translate:partial',
  TRANSLATE_FINAL: 'translate:final',
  TRANSLATE_CORRECT: 'translate:correct',
  NOTE_SAVED: 'note:saved',
  NOTE_SUMMARY: 'note:summary',
  SESSION_STATE_CHANGE: 'session:state-change',

  // ===== Renderer → Main =====
  SESSION_START: 'session:start',
  SESSION_STOP: 'session:stop',
  SESSION_PAUSE: 'session:pause',
  SESSION_RESUME: 'session:resume',
  CONFIG_UPDATE: 'config:update',
  SUMMARY_TRIGGER: 'summary:trigger',
  WINDOW_PREPARE_RECORD: 'window:prepare-record',
  WINDOW_EXIT_CONTROL: 'window:exit-control',
  WINDOW_TOGGLE_SUBTITLE: 'window:toggle-subtitle',

  // ===== 收藏 =====
  FAVORITE_ADD: 'favorite:add',
  FAVORITE_REMOVE: 'favorite:remove',
  FAVORITE_REMOVE_BATCH: 'favorite:remove-batch',
  FAVORITE_GET: 'favorite:get',
  FAVORITE_SEARCH: 'favorite:search',
  FAVORITE_EXPORT: 'favorite:export',

  // ===== 改进 =====
  IMPROVE_SUBMIT: 'improve:submit',
  PERSONAL_DICT_STATUS: 'personal-dict:status',

  // ===== 词典 =====
  DICTIONARY_ENTRIES_GET: 'dictionary:entries:get',
  DICTIONARY_ENTRY_REMOVE: 'dictionary:entry:remove',
  DICTIONARY_FILE_LOAD: 'dictionary:file:load',
  DICTIONARY_FILE_REMOVE: 'dictionary:file:remove',
  DICTIONARY_FILE_TOGGLE: 'dictionary:file:toggle',

  // ===== 笔记 =====
  NOTES_LIST: 'notes:list',
  NOTES_READ: 'notes:read',
  NOTES_EXPORT_ALL: 'notes:export-all',

  // ===== 数据管理 =====
  DATA_CLEAR: 'data:clear',
  SELECT_DIRECTORY: 'dialog:select-directory',

  // ===== 配置持久化 =====
  CONFIG_LOAD: 'config:load',
  CONFIG_SAVE: 'config:save',
} as const;

/**
 * IPC 通道名称联合类型
 * 包含所有通道名称的字面量类型
 */
export type IPCChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

/**
 * 主进程 → 渲染进程方向的通道类型
 * 主进程通过这些通道向渲染进程推送数据
 */
export type MainToRendererChannel =
  | 'stt:partial'
  | 'stt:sentence'
  | 'translate:partial'
  | 'translate:final'
  | 'translate:correct'
  | 'note:saved'
  | 'note:summary';

/**
 * 渲染进程 → 主进程方向的通道类型
 * 渲染进程通过这些通道向主进程发送请求
 */
export type RendererToMainChannel =
  | 'session:start'
  | 'session:stop'
  | 'session:pause'
  | 'config:update'
  | 'summary:trigger';
