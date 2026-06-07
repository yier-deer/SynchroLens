import { useState, useCallback, useRef, useEffect } from 'react';
import type { STTResult, TranslationResult, Correction, SessionState } from '../../shared/types';
import { isSTTResult, isTranslationResult } from '../../shared/types';
import { IPC_CHANNELS } from '../../shared/ipcChannels';

type IPCApi = {
  on(channel: string, callback: (data: unknown) => void): (() => void) | undefined;
  startSession(audioSource: 'system' | 'microphone'): Promise<void>;
  stopSession(): Promise<void>;
  pauseSession(): Promise<void>;
  resumeSession(): Promise<void>;
};

interface UseSessionDeps {
  ipc: IPCApi;
}

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
  const stoppedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const subs: Array<(() => void) | undefined> = [];

    subs.push(
      ipc.on(IPC_CHANNELS.STT_PARTIAL, (data) => {
        if (isSTTResult(data)) {
          setSTTPartials(prev => [...prev, data]);
        }
      }),
    );

    subs.push(
      ipc.on(IPC_CHANNELS.STT_SENTENCE, (data) => {
        const result = data as STTResult;
        if (isSTTResult(result)) {
          setSTTPartials(prev => prev.filter(item => item.sentenceId !== result.sentenceId));
          setCurrentTranslation(prev => {
            if (prev && prev.sentenceId === result.sentenceId) {
              return { ...prev, isFinal: true };
            }
            return prev;
          });
        }
      }),
    );

    subs.push(
      ipc.on(IPC_CHANNELS.TRANSLATE_PARTIAL, (data) => {
        const payload = data as { sentenceId: string; translation: string; original?: string };
        if (payload?.sentenceId && typeof payload?.translation === 'string') {
          setCurrentTranslation({
            sentenceId: payload.sentenceId,
            original: payload.original || '',
            translation: payload.translation,
            isFinal: false,
            corrections: [],
          });
        }
      }),
    );

    subs.push(
      ipc.on(IPC_CHANNELS.TRANSLATE_FINAL, (data) => {
        const payload = data as TranslationResult;
        if (isTranslationResult(payload)) {
          setCurrentTranslation(null);
          setConfirmedTranslations(prev => [...prev, payload]);
        }
      }),
    );

    subs.push(
      ipc.on(IPC_CHANNELS.TRANSLATE_CORRECT, (data) => {
        const payload = data as { sentenceId: string; oldTranslation: string; newTranslation: string; reason: string };
        if (payload?.sentenceId && payload?.reason) {
          setCorrections(prev => [
            ...prev,
            {
              from: payload.oldTranslation,
              to: payload.newTranslation,
              reason: payload.reason,
              timestamp: Date.now(),
            },
          ]);
          setConfirmedTranslations(prev =>
            prev.map(item =>
              item.sentenceId === payload.sentenceId
                ? { ...item, translation: payload.newTranslation }
                : item,
            ),
          );
        }
      }),
    );

    subs.push(
      ipc.on(IPC_CHANNELS.NOTE_SAVED, (data) => {
        const payload = data as { filePath: string };
        if (payload?.filePath) {
          setNotePath(payload.filePath);
        }
      }),
    );

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

  const stopSession = useCallback(async () => {
    await ipc.stopSession();
    setSessionState('stopped');
    if (stoppedTimer.current) clearTimeout(stoppedTimer.current);
    stoppedTimer.current = setTimeout(() => {
      setSessionState('idle');
    }, 3000);
  }, [ipc]);

  const pauseSession = useCallback(async () => {
    await ipc.pauseSession();
    setSessionState('paused');
  }, [ipc]);

  const resumeSession = useCallback(async () => {
    await ipc.resumeSession();
    setSessionState('running');
  }, [ipc]);

  const correctTranslation = useCallback((newTranslation: string) => {
    setCurrentTranslation(prev => {
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
    resumeSession,
    correctTranslation,
  };
}
