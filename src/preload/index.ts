/**
 * SynchroLens Preload 脚本
 * 通过 contextBridge 安全暴露 IPC API 给渲染进程
 * 不包含任何业务逻辑，仅做 IPC 桥接
 */

import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipcChannels';

/** 同步事件监听的包装层，绕过 contextBridge 的 Proxy 限制 */
const listenerMap = new Map<string, Set<(...args: unknown[]) => void>>();

ipcRenderer.on('synchroLens:event', (_event, channel: string, ...args: unknown[]) => {
  const listeners = listenerMap.get(channel);
  if (listeners) {
    for (const cb of listeners) {
      cb(...args);
    }
  }
});

/** SynchroLens 渲染进程 API */
export interface SynchroLensAPI {
  /** 监听 IPC 事件，返回取消监听函数 */
  on(channel: string, callback: (data: unknown) => void): () => void;
  /** 取消监听 IPC 事件 */
  off(channel: string, callback: (data: unknown) => void): void;
  /** 一次性监听 IPC 事件 */
  once(channel: string, callback: (data: unknown) => void): void;
  /** 开始翻译会话 */
  startSession(audioSource: 'system' | 'microphone'): Promise<void>;
  /** 停止翻译会话 */
  stopSession(): Promise<void>;
  /** 暂停翻译会话 */
  pauseSession(): Promise<void>;
  /** 更新配置 */
  updateConfig(config: Record<string, unknown>): Promise<void>;
  /** 触发摘要生成 */
  triggerSummary(): Promise<void>;
}

/**
 * 构建要暴露给渲染进程的 API 对象
 * @returns SynchroLensAPI 实例
 */
function buildAPI(): SynchroLensAPI {
  return {
    on(channel: string, callback: (data: unknown) => void): () => void {
      if (!listenerMap.has(channel)) {
        listenerMap.set(channel, new Set());
      }
      const listeners = listenerMap.get(channel)!;
      listeners.add(callback);

      return () => {
        listeners.delete(callback);
      };
    },

    off(channel: string, callback: (data: unknown) => void): void {
      const listeners = listenerMap.get(channel);
      if (listeners) {
        listeners.delete(callback);
      }
    },

    once(channel: string, callback: (data: unknown) => void): void {
      const wrappedCallback = (data: unknown) => {
        callback(data);
        const listeners = listenerMap.get(channel);
        if (listeners) {
          listeners.delete(wrappedCallback);
        }
      };
      if (!listenerMap.has(channel)) {
        listenerMap.set(channel, new Set());
      }
      const listeners = listenerMap.get(channel)!;
      listeners.add(wrappedCallback);
    },

    startSession(audioSource: 'system' | 'microphone'): Promise<void> {
      return ipcRenderer.invoke(IPC_CHANNELS.SESSION_START, { audioSource });
    },

    stopSession(): Promise<void> {
      return ipcRenderer.invoke(IPC_CHANNELS.SESSION_STOP);
    },

    pauseSession(): Promise<void> {
      return ipcRenderer.invoke(IPC_CHANNELS.SESSION_PAUSE);
    },

    updateConfig(config: Record<string, unknown>): Promise<void> {
      return ipcRenderer.invoke(IPC_CHANNELS.CONFIG_UPDATE, config);
    },

    triggerSummary(): Promise<void> {
      return ipcRenderer.invoke(IPC_CHANNELS.SUMMARY_TRIGGER);
    },
  };
}

/** 通过 contextBridge 安全暴露 API 到渲染进程的 window.synchroLens */
contextBridge.exposeInMainWorld('synchroLens', buildAPI());
