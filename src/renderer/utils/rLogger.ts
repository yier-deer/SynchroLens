/**
 * Renderer 进程日志模块
 * 通过 IPC 将日志发送到 Main 进程统一写入
 */

import { LOG_CHANNELS } from '../../shared/logIpcChannels';
import type { LogLevel } from '../../shared/logTypes';

type LogSender = (channel: string, entry: { level: LogLevel; module: string; message: string; data?: unknown }) => void;

let logSender: LogSender | null = null;

/**
 * 设置日志发送器（在 preload 桥接后调用）
 */
export function setLogSender(sender: LogSender) {
  logSender = sender;
}

function sendLog(level: LogLevel, module: string, message: string, data?: unknown) {
  if (logSender) {
    try {
      logSender(LOG_CHANNELS.LOG_SEND, { level, module, message, data });
    } catch {
      console.log(`[${level.toUpperCase()}] [${module}] ${message}`, data ?? '');
    }
  } else {
    console.log(`[${level.toUpperCase()}] [${module}] ${message}`, data ?? '');
  }
}

/**
 * 为渲染进程模块创建日志记录器
 */
export function createRendererLogger(module: string) {
  return {
    error(message: string, data?: unknown) { sendLog('error', module, message, data); },
    warn(message: string, data?: unknown) { sendLog('warn', module, message, data); },
    info(message: string, data?: unknown) { sendLog('info', module, message, data); },
    debug(message: string, data?: unknown) { sendLog('debug', module, message, data); },
  };
}
