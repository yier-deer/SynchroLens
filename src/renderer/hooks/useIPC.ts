/**
 * IPC 通信 Hook
 * 封装 preload 暴露的 window.synchroLens API，提供类型安全的事件监听和操作请求
 */

import { useCallback, useRef, useEffect } from 'react';
import { IPC_CHANNELS } from '../../shared/ipcChannels';

/** 获取 window 引用（浏览器用 window，测试环境用 globalThis） */
const win: any = typeof window !== 'undefined' ? window : globalThis;

/** 获取安全的 API 引用 */
function getAPI(): typeof win.synchrolens | null {
  return win.synchrolens ?? null;
}

/**
 * IPC 通信 Hook
 */
export function useIPC() {
  const apiRef = useRef(getAPI());

  useEffect(() => {
    apiRef.current = getAPI();
  });

  const on = useCallback((channel: string, callback: (data: unknown) => void): (() => void) | undefined => {
    const api = apiRef.current;
    if (!api) return undefined;
    return api.on(channel, callback);
  }, []);

  const off = useCallback((channel: string, callback: (data: unknown) => void): void => {
    const api = apiRef.current;
    if (!api) return;
    api.off(channel, callback);
  }, []);

  const startSession = useCallback(async (audioSource: 'system' | 'microphone'): Promise<void> => {
    const api = apiRef.current;
    if (!api) throw new Error('SynchroLens API 未就绪');
    return api.startSession(audioSource);
  }, []);

  const stopSession = useCallback(async (): Promise<void> => {
    const api = apiRef.current;
    if (!api) throw new Error('SynchroLens API 未就绪');
    return api.stopSession();
  }, []);

  const pauseSession = useCallback(async (): Promise<void> => {
    const api = apiRef.current;
    if (!api) throw new Error('SynchroLens API 未就绪');
    return api.pauseSession();
  }, []);

  const resumeSession = useCallback(async (): Promise<void> => {
    const api = apiRef.current;
    if (!api) throw new Error('SynchroLens API 未就绪');
    return api.resumeSession();
  }, []);

  const updateConfig = useCallback(async (config: Record<string, unknown>): Promise<void> => {
    const api = apiRef.current;
    if (!api) throw new Error('SynchroLens API 未就绪');
    return api.updateConfig(config);
  }, []);

  const triggerSummary = useCallback(async (): Promise<void> => {
    const api = apiRef.current;
    if (!api) throw new Error('SynchroLens API 未就绪');
    return api.triggerSummary();
  }, []);

  return {
    on,
    off,
    startSession,
    stopSession,
    pauseSession,
    resumeSession,
    updateConfig,
    triggerSummary,
    IPC_CHANNELS,
  };
}
