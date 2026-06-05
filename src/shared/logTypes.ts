/**
 * 日志系统类型定义
 * 统一 Main 和 Renderer 进程的日志接口
 */

/** 日志级别 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/** 日志条目（IPC 传输格式） */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: unknown;
}
