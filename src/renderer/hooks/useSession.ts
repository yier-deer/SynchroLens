import { useCallback, useEffect, useRef, useState } from 'react';
import { IPC_CHANNELS } from '../../shared/ipcChannels';
import type {
  EnhancementStatusPayload,
  NoteSavedPayload,
  NoteSummaryPayload,
  SessionState,
  STTResult,
  TranslatePartialPayload,
  TranslationResult,
} from '../../shared/types';
import { isSessionState, isSTTResult, isTranslationResult } from '../../shared/types';

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

function isTranslatePartialPayload(value: unknown): value is TranslatePartialPayload {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.sentenceId === 'string' &&
    typeof obj.translation === 'string' &&
    typeof obj.original === 'string'
  );
}

type EnhancementState = 'idle' | 'running' | 'completed' | 'failed';

type EnhancementStatusState = {
  summary: { state: EnhancementState; summary: string | null; error: string | null };
  correction: { state: EnhancementState; corrections: TranslationResult['corrections']; error: string | null };
  recommendation: { state: EnhancementState; recommendations: string[]; error: string | null };
};

function createEnhancementStatus(): EnhancementStatusState {
  return {
    summary: { state: 'idle', summary: null, error: null },
    correction: { state: 'idle', corrections: [], error: null },
    recommendation: { state: 'idle', recommendations: [], error: null },
  };
}

export function useSession({ ipc }: UseSessionDeps) {
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [currentTranscript, setCurrentTranscript] = useState<STTResult | null>(null);
  const [confirmedTranscripts, setConfirmedTranscripts] = useState<STTResult[]>([]);
  const [latestTranscript, setLatestTranscript] = useState<STTResult | null>(null);
  const [currentTranslation, setCurrentTranslation] = useState<TranslatePartialPayload | null>(null);
  const [confirmedTranslations, setConfirmedTranslations] = useState<TranslationResult[]>([]);
  const [corrections, setCorrections] = useState<TranslationResult['corrections']>([]);
  const [notePath, setNotePath] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [enhancementStatus, setEnhancementStatus] = useState(createEnhancementStatus());
  const unsubscribers = useRef<Array<() => void>>([]);
  const stoppedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTranscriptSentenceId = useRef<string | null>(null);

  useEffect(() => {
    const subscriptions: Array<(() => void) | undefined> = [];

    subscriptions.push(
      ipc.on(IPC_CHANNELS.STT_PARTIAL, (data) => {
        if (isSTTResult(data)) {
          setCurrentTranscript(data);
          if (activeTranscriptSentenceId.current !== data.sentenceId) {
            activeTranscriptSentenceId.current = data.sentenceId;
            setCurrentTranslation(null);
          }
        }
      }),
    );

    subscriptions.push(
      ipc.on(IPC_CHANNELS.STT_SENTENCE, (data) => {
        if (isSTTResult(data)) {
          activeTranscriptSentenceId.current = data.sentenceId;
          setCurrentTranscript(null);
          setConfirmedTranscripts((prev) => [...prev, data]);
          setLatestTranscript(data);
        }
      }),
    );

    subscriptions.push(
      ipc.on(IPC_CHANNELS.TRANSLATE_PARTIAL, (data) => {
        if (isTranslatePartialPayload(data)) {
          if (
            activeTranscriptSentenceId.current &&
            data.sentenceId !== activeTranscriptSentenceId.current
          ) {
            return;
          }
          setCurrentTranslation(data);
        }
      }),
    );

    subscriptions.push(
      ipc.on(IPC_CHANNELS.TRANSLATE_FINAL, (data) => {
        if (isTranslationResult(data)) {
          if (!activeTranscriptSentenceId.current || data.sentenceId === activeTranscriptSentenceId.current) {
            setCurrentTranslation(null);
          }
          setConfirmedTranslations((prev) => [...prev, data]);
          setCorrections((prev) => [...prev, ...data.corrections]);
        }
      }),
    );

    subscriptions.push(
      ipc.on(IPC_CHANNELS.NOTE_SAVED, (data) => {
        const payload = data as NoteSavedPayload | null;
        if (payload?.filePath) {
          setNotePath(payload.filePath);
        }
      }),
    );

    subscriptions.push(
      ipc.on(IPC_CHANNELS.NOTE_SUMMARY, (data) => {
        const payload = data as NoteSummaryPayload | null;
        if (payload?.summary) {
          setSummary(payload.summary);
        }
      }),
    );

    subscriptions.push(
      ipc.on(IPC_CHANNELS.ENHANCEMENT_STATUS, (data) => {
        const payload = data as EnhancementStatusPayload | null;
        if (!payload) {
          return;
        }
        setEnhancementStatus((prev) => {
          if (payload.kind === 'summary') {
            return {
              ...prev,
              summary: {
                state: payload.state,
                summary: payload.summary ?? prev.summary.summary,
                error: payload.error ?? null,
              },
            };
          }
          if (payload.kind === 'correction') {
            return {
              ...prev,
              correction: {
                state: payload.state,
                corrections: payload.corrections ?? prev.correction.corrections,
                error: payload.error ?? null,
              },
            };
          }
          return {
            ...prev,
            recommendation: {
              state: payload.state,
              recommendations: payload.recommendations ?? prev.recommendation.recommendations,
              error: payload.error ?? null,
            },
          };
        });
      }),
    );

    subscriptions.push(
      ipc.on(IPC_CHANNELS.SESSION_STATE_CHANGE, (data) => {
        const payload = data as { state?: unknown };
        if (isSessionState(payload?.state)) {
          setSessionState(payload.state);
        }
      }),
    );

    unsubscribers.current = subscriptions.filter(
      (subscription): subscription is () => void => typeof subscription === 'function',
    );

    return () => {
      for (const unsubscribe of unsubscribers.current) {
        unsubscribe();
      }
      unsubscribers.current = [];
    };
  }, [ipc]);

  const resetTranscriptState = useCallback(() => {
    activeTranscriptSentenceId.current = null;
    setCurrentTranscript(null);
    setConfirmedTranscripts([]);
    setLatestTranscript(null);
    setCurrentTranslation(null);
    setConfirmedTranslations([]);
    setCorrections([]);
    setNotePath(null);
    setSummary(null);
    setEnhancementStatus(createEnhancementStatus());
  }, []);

  const startSession = useCallback(
    async (audioSource: 'system' | 'microphone') => {
      resetTranscriptState();
      await ipc.startSession(audioSource);
    },
    [ipc, resetTranscriptState],
  );

  const stopSession = useCallback(async () => {
    await ipc.stopSession();
    if (stoppedTimer.current) {
      clearTimeout(stoppedTimer.current);
    }
  }, [ipc]);

  const pauseSession = useCallback(async () => {
    await ipc.pauseSession();
  }, [ipc]);

  const resumeSession = useCallback(async () => {
    await ipc.resumeSession();
  }, [ipc]);

  return {
    sessionState,
    currentTranscript,
    confirmedTranscripts,
    latestTranscript,
    sttPartials: currentTranscript ? [currentTranscript] : [],
    currentTranslation,
    confirmedTranslations,
    corrections,
    notePath,
    summary,
    enhancementStatus,
    startSession,
    stopSession,
    pauseSession,
    resumeSession,
  };
}
