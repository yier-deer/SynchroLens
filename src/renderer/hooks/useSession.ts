/**
 * 会话状态管理 Hook
 * 管理翻译会话的完整状态，包括 STT 结果、翻译结果、纠正记录
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { STTResult, TranslationResult, Correction, SessionState } from '../../shared/types';
import { isSTTResult, isTranslationResult, isCorrection } from '../../shared/types';
import { IPC_CHANNELS } from '../../shared/ipcChannels';

/** 用于在回调中稳定访问的 API 引用 */
type IPCApi = {
  on(channel: string, callback: (data: unknown) => void): (() => void) | undefined;
  startSession(audioSource: 'system' | 'microphone'): Promise<void>;
  stopSession(): Promise<void>;
  pauseSession(): Promise<void>;
};

/** useSession 依赖注入接口 */
interface UseSessionDeps {
  ipc: IPCApi;
}

/**
 * 会话状态管理 Hook
 * 监听所有 IPC 事件，维护翻译会话完整状态
 */
export function useSession(deps: UseSessionDeps) {
  const { ipc } = deps;

  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [sttPartials, setSTTPartials] = useState<STTResult[]>([]);
  const [currentTranslation, setCurrentTranslation] = useState<TranslationResult | null>(null);
  const [confirmedTranslations, setConfirmedTranslations] = useState<TranslationResult[]>([]);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [notePath, setNotePath] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const unsubscribers = useRef<Array<() => void>>([]);

  /** 注册 IPC 事件监听 */
  useEffect(() => {
    const subs: Array<(() => void) | undefined> = [];

    // STT 中间结果
    subs.push(
      ipc.on(IPC_CHANNELS.STT_PARTIAL, (data) => {
        if (isSTTResult(data)) {
          setSTTPartials((prev) => [...prev, data]);
        }
      }),
    );

    // STT 最终句子
    subs.push(
      ipc.on(IPC_CHANNELS.STT_SENTENCE, (data) => {
        const result = data as STTResult;
        if (isSTTResult(result)) {
          setSTTPartials((prev) => prev.filter((item) => item.sentenceId !== result.sentenceId));
          setCurrentTranslation((prev) => {
            if (prev && prev.sentenceId === result.sentenceId) {
              return { ...prev, isFinal: true };
            }
            return prev;
          });
        }
      }),
    );

    // 翻译流式片段
    subs.push(
      ipc.on(IPC_CHANNELS.TRANSLATE_PARTIAL, (data) => {
        const payload = data as { sentenceId: string; translation: string };
        if (payload?.sentenceId && typeof payload?.translation === 'string') {
          setCurrentTranslation({
            sentenceId: payload.sentenceId,
            original: '',
            translation: payload.translation,
            isFinal: false,
            corrections: [],
          });
        }
      }),
    );

    // 翻译最终结果
    subs.push(
      ipc.on(IPC_CHANNELS.TRANSLATE_FINAL, (data) => {
        const payload = data as TranslationResult;
        if (isTranslationResult(payload)) {
          setCurrentTranslation(null);
          setConfirmedTranslations((prev) => [...prev, payload]);
        }
      }),
    );

    // 翻译纠正通知
    subs.push(
      ipc.on(IPC_CHANNELS.TRANSLATE_CORRECT, (data) => {
        const payload = data as { sentenceId: string; oldTranslation: string; newTranslation: string; reason: string };
        if (payload?.sentenceId && payload?.reason) {
          setCorrections((prev) => [
            ...prev,
            {
              from: payload.oldTranslation,
              to: payload.newTranslation,
              reason: payload.reason,
              timestamp: Date.now(),
            },
          ]);
          setConfirmedTranslations((prev) =>
            prev.map((item) =>
              item.sentenceId === payload.sentenceId
                ? { ...item, translation: payload.newTranslation }
                : item,
            ),
          );
        }
      }),
    );

    // 笔记保存通知
    subs.push(
      ipc.on(IPC_CHANNELS.NOTE_SAVED, (data) => {
        const payload = data as { filePath: string };
        if (payload?.filePath) {
          setNotePath(payload.filePath);
        }
      }),
    );

    // 摘要生成通知
    subs.push(
      ipc.on(IPC_CHANNELS.NOTE_SUMMARY, (data) => {
        const payload = data as { summary: string };
        if (payload?.summary) {
          setSummary(payload.summary);
        }
      }),
    );

    const validSubs = subs.filter((s): s is (() => void) => typeof s === 'function');
    unsubscribers.current = validSubs;

    return () => {
      for (const unsub of unsubscribers.current) {
        unsub();
      }
      unsubscribers.current = [];
    };
  }, [ipc]);

  /** 开始会话 */
  const startSession = useCallback(
    async (audioSource: 'system' | 'microphone') => {
      setSessionState('running');
      setSTTPartials([]);
      setCurrentTranslation(null);
      setConfirmedTranslations([]);
      setCorrections([]);
      setNotePath(null);
      setSummary(null);
      await ipc.startSession(audioSource);
    },
    [ipc],
  );

  /** 停止会话 */
  const stopSession = useCallback(async () => {
    await ipc.stopSession();
    setSessionState('stopped');
  }, [ipc]);

  /** 暂停会话 */
  const pauseSession = useCallback(async () => {
    await ipc.pauseSession();
    setSessionState('paused');
  }, [ipc]);

  /** 手动纠正当前句翻译 */
  const correctTranslation = useCallback((newTranslation: string) => {
    setCurrentTranslation((prev) => {
      if (!prev) return prev;
      return { ...prev, translation: newTranslation };
    });
  }, []);

  return {
    sessionState,
    sttPartials,
    currentTranslation,
    confirmedTranslations,
    corrections,
    notePath,
    summary,
    startSession,
    stopSession,
    pauseSession,
    correctTranslation,
  };
}
