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
  // ===== Main → Renderer（主进程推送） =====

  /** 语音识别实时部分结果 */
  STT_PARTIAL: 'stt:partial',
  /** 语音识别完整句子结果 */
  STT_SENTENCE: 'stt:sentence',
  /** 翻译实时部分结果 */
  TRANSLATE_PARTIAL: 'translate:partial',
  /** 翻译最终完整结果 */
  TRANSLATE_FINAL: 'translate:final',
  /** 翻译纠错结果 */
  TRANSLATE_CORRECT: 'translate:correct',
  /** 笔记已保存通知 */
  NOTE_SAVED: 'note:saved',
  /** 笔记摘要结果 */
  NOTE_SUMMARY: 'note:summary',

  // ===== Renderer → Main（渲染进程请求） =====

  /** 启动同传会话 */
  SESSION_START: 'session:start',
  /** 停止同传会话 */
  SESSION_STOP: 'session:stop',
  /** 暂停/恢复同传会话 */
  SESSION_PAUSE: 'session:pause',
  /** 更新配置 */
  CONFIG_UPDATE: 'config:update',
  /** 触发摘要生成 */
  SUMMARY_TRIGGER: 'summary:trigger',
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
