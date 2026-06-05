/**
 * IPC 通道处理器注册模块
 * 负责注册全部 IPC 通道的 handle/on 处理器，分发渲染进程请求到对应业务模块
 */

import { BrowserWindow, ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipcChannels';
import { LOG_CHANNELS } from '../../shared/logIpcChannels';
import { writeLogEntry } from '../utils/logger';
import type { LogLevel } from '../../shared/logTypes';

/**
 * 业务模块注册表接口
 * Layer 2-3 模块的具体类型在此占位
 */
export interface ModuleRegistry {
  audioCapture: {
    start(source: 'system' | 'microphone', deviceId?: string): void;
    stop(): void;
    onData(callback: (pcmBuffer: Int16Array) => void): () => void;
    getAvailableDevices(): { deviceId: string; label: string }[];
  };
  sttClient: {
    connect(config: { appId: string; apiKey: string; apiSecret: string }): void;
    sendAudio(pcmChunk: Int16Array): void;
    disconnect(): void;
    onResult(callback: (text: string, isFinal: boolean, sentenceId: string) => void): void;
    onError(callback: (error: Error) => void): void;
    onClose(callback: () => void): void;
    reconnect(): void;
  };
  translator: {
    translate(text: string, context: { original: string; translation: string }[]): AsyncGenerator<string>;
    translateFull(text: string, context: { original: string; translation: string }[]): Promise<string>;
    generateSummary(sentences: { sentenceId: string; original: string; translation: string }[]): Promise<string>;
  };
  noteWriter: {
    createNoteFile(session: { startTime: number; audioSource: string }): string;
    appendEntry(filePath: string, original: string, translation: string, timestamp: number, corrections?: { from: string; to: string; reason: string; timestamp: number }[]): Promise<void>;
    appendSummary(filePath: string, summary: string): Promise<void>;
  };
  correctionDetector: {
    checkConsistency(translations: { sentenceId: string; original: string; translation: string }[]): Promise<{ sentenceId: string; from: string; to: string; reason: string }[]>;
    shouldCheck(sentenceCount: number): boolean;
  };
  sessionManager: {
    createSession(config: { audioSource: 'system' | 'microphone' }): { id: string; startTime: number; audioSource: string; sentences: unknown[] };
    startSession(sessionId: string): void;
    pauseSession(sessionId: string): void;
    resumeSession(sessionId: string): void;
    endSession(sessionId: string): Promise<void>;
    getSessionState(sessionId: string): string;
    updateConfig(config: Record<string, unknown>): void;
    triggerSummary(): Promise<void>;
  };
}

/** 全局模块注册表引用 */
let registry: ModuleRegistry | null = null;

/** 全局窗口列表引用 */
let browserWindows: BrowserWindow[] = [];

/**
 * 设置模块注册表实例
 * @param modules - 业务模块实例集合
 */
export function setModuleRegistry(modules: ModuleRegistry): void {
  registry = modules;
}

/**
 * 设置 BrowserWindow 列表引用
 * @param windows - BrowserWindow 实例列表
 */
export function setBrowserWindows(windows: BrowserWindow[]): void {
  browserWindows = windows;
}

/**
 * 向所有渲染进程窗口推送事件
 * @param channel - IPC 通道名
 * @param data - 推送数据
 */
export function sendToAllWindows(channel: string, data: unknown): void {
  for (const win of browserWindows) {
    if (!win.isDestroyed()) {
      win.webContents.send('synchroLens:event', channel, data);
    }
  }
}

/**
 * 注册全部 IPC 通道处理器
 * 将渲染进程的 invoke 请求分发到对应的业务模块
 */
export function registerIPCHandlers(): void {
  // log:send — 渲染进程发送日志
  ipcMain.on(LOG_CHANNELS.LOG_SEND, (_event, entry: { level: LogLevel; module: string; message: string; data?: unknown }) => {
    writeLogEntry(entry);
  });

  // session:start — 启动翻译会话
  ipcMain.handle(IPC_CHANNELS.SESSION_START, async (_event, payload: { audioSource: 'system' | 'microphone' }) => {
    if (!registry) throw new Error('模块注册表未初始化');
    const session = registry.sessionManager.createSession(payload);
    registry.sessionManager.startSession(session.id);
    return session;
  });

  // session:stop — 停止翻译会话
  ipcMain.handle(IPC_CHANNELS.SESSION_STOP, async () => {
    if (!registry) throw new Error('模块注册表未初始化');
    // 停止当前活跃的会话（由 SessionManager 内部跟踪）
    await registry.sessionManager.endSession('');
  });

  // session:pause — 暂停翻译会话
  ipcMain.handle(IPC_CHANNELS.SESSION_PAUSE, async () => {
    if (!registry) throw new Error('模块注册表未初始化');
    registry.sessionManager.pauseSession('');
  });

  // config:update — 更新配置
  ipcMain.handle(IPC_CHANNELS.CONFIG_UPDATE, async (_event, payload: Record<string, unknown>) => {
    if (!registry) throw new Error('模块注册表未初始化');
    registry.sessionManager.updateConfig(payload);
  });

  // summary:trigger — 触发摘要生成
  ipcMain.handle(IPC_CHANNELS.SUMMARY_TRIGGER, async () => {
    if (!registry) throw new Error('模块注册表未初始化');
    await registry.sessionManager.triggerSummary();
  });
}
