/**
 * 日志系统 IPC 通道定义
 * Renderer → Main：将渲染进程日志发送到主进程统一写入
 */

export const LOG_CHANNELS = {
  /** 渲染进程 → 主进程：发送日志条目 */
  LOG_SEND: 'log:send',
} as const;
