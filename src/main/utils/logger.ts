/**
 * Main 进程日志模块
 * 基于 winston 的结构化日志，文件按天轮转 + 终端输出
 */

import path from 'path';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { LOG_CONSTANTS } from '@shared/constants';
import type { LogLevel } from '@shared/logTypes';

const LOG_DIR = path.resolve(process.cwd(), LOG_CONSTANTS.LOG_DIR);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, module, message, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}]${module ? ` [${module}]` : ''} ${message}${metaStr}`;
  }),
);

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, module, message, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}]${module ? ` [${module}]` : ''} ${message}${metaStr}`;
  }),
);

const level = process.env.LOG_LEVEL || LOG_CONSTANTS.DEFAULT_LEVEL;

const mainLogger = winston.createLogger({
  level,
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: `${LOG_CONSTANTS.FILE_PREFIX}-%DATE%.log`,
      datePattern: LOG_CONSTANTS.DATE_PATTERN,
      maxSize: `${LOG_CONSTANTS.MAX_FILE_SIZE_MB}m`,
      maxFiles: `${LOG_CONSTANTS.RETENTION_DAYS}d`,
      format: fileFormat,
    }),
  ],
});

/**
 * 为指定模块创建日志记录器
 * @param moduleName - 模块名（如 'AudioCapture', 'STTClient'）
 */
export function createLogger(moduleName: string) {
  return {
    error(message: string, data?: unknown) {
      mainLogger.log('error', message, { module: moduleName, ...(data ? { data } : {}) });
    },
    warn(message: string, data?: unknown) {
      mainLogger.log('warn', message, { module: moduleName, ...(data ? { data } : {}) });
    },
    info(message: string, data?: unknown) {
      mainLogger.log('info', message, { module: moduleName, ...(data ? { data } : {}) });
    },
    debug(message: string, data?: unknown) {
      mainLogger.log('debug', message, { module: moduleName, ...(data ? { data } : {}) });
    },
  };
}

/**
 * 从外部写入日志条目（供 IPC handler 使用）
 */
export function writeLogEntry(entry: { level: LogLevel; module: string; message: string; data?: unknown }) {
  mainLogger.log(entry.level, entry.message, {
    module: entry.module,
    ...(entry.data ? { data: entry.data } : {}),
  });
}

/**
 * 动态调整日志级别
 */
export function setLogLevel(level: LogLevel) {
  mainLogger.level = level;
}

/** 默认导出根 logger */
export default createLogger('App');
