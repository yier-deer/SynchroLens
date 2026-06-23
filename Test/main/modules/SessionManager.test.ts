import { SessionManager, type SessionDependencies } from '../../../src/main/modules/session/SessionManager';
import { AUDIO_CONSTANTS } from '../../../src/shared/constants';
import type { AppConfig, Session, TranslationResult } from '../../../src/shared/types';

function createMockDeps(): SessionDependencies {
  return {
    audioCapture: {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn(),
      onData: jest.fn(() => jest.fn()),
      isRunning: false,
    },
    sttClient: {
      connect: jest.fn(),
      sendAudio: jest.fn(),
      disconnect: jest.fn(),
      onResult: jest.fn(),
      onError: jest.fn(),
      onClose: jest.fn(),
      onStateChange: jest.fn(),
      isConnected: false,
    },
    noteRepository: {
      createSessionNote: jest.fn().mockResolvedValue('E:/notes/2026-06-21/10-00.md'),
      appendSentence: jest.fn().mockResolvedValue(undefined),
      appendSummary: jest.fn().mockResolvedValue(undefined),
    } as SessionDependencies['noteRepository'] & { appendSummary: jest.Mock },
    translator: {
      generateSummary: jest.fn().mockResolvedValue('summary generated'),
    },
    correctionDetector: {
      checkConsistency: jest.fn().mockResolvedValue([
        { sentenceId: 'sent-1', from: 'old translation', to: 'new translation', reason: 'consistency' },
      ]),
      shouldCheck: jest.fn().mockReturnValue(true),
    },
    enhancementOrchestrator: {
      runCorrection: jest.fn().mockResolvedValue(undefined),
      runRecommendation: jest.fn().mockResolvedValue(undefined),
      runSummary: jest.fn().mockResolvedValue(undefined),
    },
    translationGateway: {
      translateSentence: jest.fn().mockImplementation(async (sentence, options) => {
        options?.onPartial?.({
          sentenceId: sentence.sentenceId,
          original: sentence.text,
          translation: 'partial translation',
          constraints: options?.constraints ?? [],
        });
        return {
          sentenceId: sentence.sentenceId,
          original: sentence.text,
          translation: 'final translation',
          isFinal: true,
          corrections: [],
          constraints: options?.constraints ?? [],
        } as TranslationResult;
      }),
      reset: jest.fn(),
      updateWindowSize: jest.fn(),
    },
  };
}

function createTestSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'test-session-1',
    startTime: Date.now(),
    audioSource: 'system',
    sentences: [],
    ...overrides,
  };
}

function createConfig(saveDir = 'E:/notes'): Partial<AppConfig> {
  return {
    note: {
      saveDir,
      autoSave: true,
      autoSaveInterval: 5000,
      autoSummary: true,
      summaryThreshold: 20,
    },
    translation: {
      provider: 'nmt',
      targetLanguage: 'zh-CN',
      apiEndpoint: 'http://127.0.0.1:8765',
      apiKey: 'nmt-key',
      model: 'nmt-default',
      contextCorrection: false,
      contextWindowSize: 3,
      tencent: {
        enabled: true,
        region: 'ap-guangzhou',
        projectId: 0,
        sourceLanguage: 'auto',
        secretKeySaved: false,
      },
    },
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

type EnhancementOrchestratorMock = NonNullable<SessionDependencies['enhancementOrchestrator']>;

async function flushAsyncWork(cycles = 3): Promise<void> {
  for (let i = 0; i < cycles; i += 1) {
    await Promise.resolve();
  }
}

function emitSTT(
  deps: SessionDependencies,
  text: string,
  isFinal: boolean,
  sentenceId: string,
  metadata?: import('../../../src/main/modules/stt/types').STTResultMetadata,
): void {
  const onResultMock = deps.sttClient.onResult as jest.Mock;
  const sttResultCallback = onResultMock.mock.calls[onResultMock.mock.calls.length - 1]?.[0] as
    | ((
        nextText: string,
        nextIsFinal: boolean,
        nextSentenceId: string,
        nextMetadata?: import('../../../src/main/modules/stt/types').STTResultMetadata,
      ) => void)
    | undefined;

  sttResultCallback?.(text, isFinal, sentenceId, metadata);
}

describe('SessionManager', () => {
  let manager: SessionManager;
  let deps: SessionDependencies;

  beforeEach(() => {
    jest.clearAllMocks();
    deps = createMockDeps();
    manager = new SessionManager(deps);
    manager.updateConfig(createConfig());
  });

  it('creates a new session', () => {
    const session = manager.createSession('system');

    expect(session.id).toBeTruthy();
    expect(session.audioSource).toBe('system');
    expect(session.sentences).toEqual([]);
  });

  it('starts audio capture and STT for a session', async () => {
    const session = createTestSession();

    await manager.startSession(session);

    expect(deps.translationGateway?.reset).toHaveBeenCalled();
    expect(deps.translationGateway?.updateWindowSize).toHaveBeenCalledWith(3);
    expect(deps.noteRepository?.createSessionNote).toHaveBeenCalledWith(session, 'E:/notes');
    expect(deps.audioCapture.start).toHaveBeenCalledWith('system');
    expect(deps.sttClient.connect).toHaveBeenCalled();
    expect(deps.audioCapture.onData).toHaveBeenCalled();
    expect(deps.sttClient.onResult).toHaveBeenCalled();
    expect(manager.currentSession?.notePath).toBe('E:/notes/2026-06-21/10-00.md');
  });

  it('forwards audio chunks to STT sendAudio', async () => {
    const session = createTestSession();

    await manager.startSession(session);

    const onData = (deps.audioCapture.onData as jest.Mock).mock.calls[0][0];
    const frame = new Int16Array(AUDIO_CONSTANTS.FRAME_SIZE / Int16Array.BYTES_PER_ELEMENT).fill(1);
    onData(frame);

    expect(deps.sttClient.sendAudio).toHaveBeenCalledWith(frame);
  });

  it('does not emit listening state until STT reports connected', async () => {
    const stateCallback = jest.fn();
    manager.onSessionStateChange(stateCallback);

    const session = createTestSession();
    await manager.startSession(session);

    expect(stateCallback).not.toHaveBeenCalledWith(session.id, 'listening');

    const onStateChange = (deps.sttClient.onStateChange as jest.Mock).mock.calls[0][0];
    onStateChange('connected');

    expect(stateCallback).toHaveBeenCalledWith(session.id, 'listening');
  });

  it('emits transcript events from STT results', async () => {
    const transcriptCallback = jest.fn();
    manager.onSessionTranscript(transcriptCallback);

    const session = createTestSession();
    await manager.startSession(session);

    emitSTT(deps, 'partial text', false, 'sent-1');
    emitSTT(deps, 'partial text full', true, 'sent-1');

    expect(transcriptCallback.mock.calls[0][1]).toMatchObject({
      sentenceId: 'sent-1',
      text: 'partial text',
      isFinal: false,
    });
    expect(transcriptCallback.mock.calls[1][1]).toMatchObject({
      sentenceId: 'sent-1',
      text: 'partial text full',
      isFinal: true,
    });
  });

  it('accepts provider metadata on STT results without changing transcript behavior', async () => {
    const transcriptCallback = jest.fn();
    manager.onSessionSTTPartial(transcriptCallback);

    const session = createTestSession();
    await manager.startSession(session);

    emitSTT(deps, 'hello from rtasr', false, 'rtasr-1', {
      provider: 'xfyun-rtasr',
      sequence: 1,
      stable: false,
    });

    expect(transcriptCallback).toHaveBeenCalledWith(
      session.id,
      expect.objectContaining({
        sentenceId: 'rtasr-1',
        text: 'hello from rtasr',
        isFinal: false,
      }),
    );
  });

  it('writes the final bilingual translation to the session note and emits translation events', async () => {
    const noteSavedCallback = jest.fn();
    const translatePartialCallback = jest.fn();
    const translateFinalCallback = jest.fn();
    manager.onNoteSaved(noteSavedCallback);
    manager.onSessionTranslatePartial(translatePartialCallback);
    manager.onSessionTranslateFinal(translateFinalCallback);

    const session = createTestSession();
    await manager.startSession(session);

    const onResultMock = deps.sttClient.onResult as jest.Mock;
    const onResult = onResultMock.mock.calls[onResultMock.mock.calls.length - 1][0];
    onResult('confirmed sentence', true, 'sent-1');

    await flushAsyncWork(2);

    expect(deps.noteRepository?.appendSentence).toHaveBeenCalledWith(
      'E:/notes/2026-06-21/10-00.md',
      expect.objectContaining({
        sentenceId: 'sent-1',
        original: 'confirmed sentence',
        translation: 'final translation',
        isFinal: true,
      }),
    );
    expect(translatePartialCallback).toHaveBeenCalledWith('test-session-1', {
      sentenceId: 'sent-1',
      original: 'confirmed sentence',
      translation: 'partial translation',
      constraints: [],
    });
    expect(translateFinalCallback).toHaveBeenCalledWith('test-session-1', {
      sentenceId: 'sent-1',
      original: 'confirmed sentence',
      translation: 'final translation',
      isFinal: true,
      corrections: [],
      constraints: [],
    });
    expect(manager.currentSession?.sentences).toEqual([
      {
        sentenceId: 'sent-1',
        original: 'confirmed sentence',
        translation: 'final translation',
        isFinal: true,
        corrections: [],
        constraints: [],
      },
    ]);
    expect(noteSavedCallback).toHaveBeenCalledWith('test-session-1', {
      filePath: 'E:/notes/2026-06-21/10-00.md',
    });
  });

  it('does not commit a final note entry until final translation is available', async () => {
    const deferred = createDeferred<TranslationResult>();
    (deps.translationGateway?.translateSentence as jest.Mock).mockReturnValueOnce(deferred.promise);
    manager = new SessionManager(deps);
    manager.updateConfig(createConfig());

    const session = createTestSession();
    await manager.startSession(session);

    emitSTT(deps, 'waiting for translation', true, 'sent-note-final');
    await flushAsyncWork(2);

    expect(deps.noteRepository?.appendSentence).not.toHaveBeenCalled();

    deferred.resolve({
      sentenceId: 'sent-note-final',
      original: 'waiting for translation',
      translation: '等待翻译完成',
      isFinal: true,
      corrections: [],
      constraints: [],
    });
    await flushAsyncWork(4);

    expect(deps.noteRepository?.appendSentence).toHaveBeenCalledWith(
      'E:/notes/2026-06-21/10-00.md',
      expect.objectContaining({
        sentenceId: 'sent-note-final',
        original: 'waiting for translation',
        translation: '等待翻译完成',
      }),
    );
  });

  it('continues translation with empty constraints when terminology resolution fails', async () => {
    deps.constraintResolver = {
      resolve: jest.fn().mockRejectedValue(new Error('terminology resolution failed')),
    };
    manager = new SessionManager(deps);
    manager.updateConfig(createConfig());
    const translatePartialCallback = jest.fn();
    const translateFinalCallback = jest.fn();
    manager.onSessionTranslatePartial(translatePartialCallback);
    manager.onSessionTranslateFinal(translateFinalCallback);

    const session = createTestSession();
    await manager.startSession(session);

    const onResultMock = deps.sttClient.onResult as jest.Mock;
    const onResult = onResultMock.mock.calls[onResultMock.mock.calls.length - 1][0];
    onResult('sentence after retrieval failure', true, 'sent-knowledge-fallback');

    await flushAsyncWork(3);

    expect(deps.noteRepository?.appendSentence).toHaveBeenCalledWith(
      'E:/notes/2026-06-21/10-00.md',
      expect.objectContaining({
        sentenceId: 'sent-knowledge-fallback',
        original: 'sentence after retrieval failure',
        translation: 'final translation',
      }),
    );
    expect(deps.translationGateway?.translateSentence).toHaveBeenCalledWith(
      expect.objectContaining({
        sentenceId: 'sent-knowledge-fallback',
        text: 'sentence after retrieval failure',
      }),
      expect.objectContaining({ constraints: [] }),
    );
    expect(translatePartialCallback).toHaveBeenCalledWith(
      'test-session-1',
      expect.objectContaining({ constraints: [] }),
    );
    expect(translateFinalCallback).toHaveBeenCalledWith(
      'test-session-1',
      expect.objectContaining({
        sentenceId: 'sent-knowledge-fallback',
        constraints: [],
      }),
    );
  });

  it('emits provisional translation for partial STT without committing side effects', async () => {
    jest.useFakeTimers();
    deps.constraintResolver = {
      resolve: jest.fn().mockResolvedValue([
        {
          source: 'latency',
          target: '延迟',
          sourceType: 'domain',
          priority: 1,
          matchType: 'exact',
          enforceMode: 'term',
        },
      ]),
    };
    manager = new SessionManager(deps);
    manager.updateConfig(createConfig());
    const translatePartialCallback = jest.fn();
    const translateFinalCallback = jest.fn();
    manager.onSessionTranslatePartial(translatePartialCallback);
    manager.onSessionTranslateFinal(translateFinalCallback);

    const session = createTestSession();
    await manager.startSession(session);

    const onResultMock = deps.sttClient.onResult as jest.Mock;
    const onResult = onResultMock.mock.calls[onResultMock.mock.calls.length - 1][0];
    onResult('partial current speech', false, 'sent-partial');
    jest.advanceTimersByTime(700);
    await flushAsyncWork(4);

    expect(deps.translationGateway?.translateSentence).toHaveBeenCalledWith(
      expect.objectContaining({
        sentenceId: 'sent-partial',
        text: 'partial current speech',
        isFinal: false,
      }),
      expect.objectContaining({
        constraints: [],
        signal: expect.any(AbortSignal),
      }),
    );
    expect(translatePartialCallback).toHaveBeenCalledWith(
      'test-session-1',
      expect.objectContaining({
        sentenceId: 'sent-partial',
        original: 'partial current speech',
        translation: 'partial translation',
        constraints: [],
      }),
    );
    expect(deps.constraintResolver.resolve).not.toHaveBeenCalled();
    expect(deps.noteRepository?.appendSentence).not.toHaveBeenCalled();
    expect(translateFinalCallback).not.toHaveBeenCalled();
    expect(manager.currentSession?.sentences).toEqual([]);
    expect(deps.enhancementOrchestrator?.runCorrection).not.toHaveBeenCalled();
    expect(deps.enhancementOrchestrator?.runRecommendation).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('starts provisional translation for partial STT without debounce delay', async () => {
    manager = new SessionManager(deps);
    manager.updateConfig(createConfig());
    const translatePartialCallback = jest.fn();
    manager.onSessionTranslatePartial(translatePartialCallback);

    const session = createTestSession();
    await manager.startSession(session);

    emitSTT(deps, 'live partial speech', false, 'sent-live-partial');
    await flushAsyncWork(4);

    expect(deps.translationGateway?.translateSentence).toHaveBeenCalledWith(
      expect.objectContaining({
        sentenceId: 'sent-live-partial',
        text: 'live partial speech',
        isFinal: false,
      }),
      expect.objectContaining({
        constraints: [],
        signal: expect.any(AbortSignal),
      }),
    );
    expect(translatePartialCallback).toHaveBeenCalledWith(
      'test-session-1',
      expect.objectContaining({
        sentenceId: 'sent-live-partial',
        original: 'live partial speech',
        translation: 'partial translation',
      }),
    );
  });

  it('ignores stale partial translation chunks after a newer same-sentence partial starts', async () => {
    const oldDeferred = createDeferred<TranslationResult>();
    const newDeferred = createDeferred<TranslationResult>();
    let oldPartial:
      | ((payload: { sentenceId: string; original: string; translation: string; constraints: [] }) => void)
      | undefined;
    let newPartial:
      | ((payload: { sentenceId: string; original: string; translation: string; constraints: [] }) => void)
      | undefined;

    (deps.translationGateway?.translateSentence as jest.Mock).mockImplementation((sentence, options) => {
      if (sentence.text === 'old partial') {
        oldPartial = options?.onPartial;
        return oldDeferred.promise;
      }

      newPartial = options?.onPartial;
      return newDeferred.promise;
    });
    manager = new SessionManager(deps);
    manager.updateConfig(createConfig());
    const translatePartialCallback = jest.fn();
    manager.onSessionTranslatePartial(translatePartialCallback);

    const session = createTestSession();
    await manager.startSession(session);

    emitSTT(deps, 'old partial', false, 'sent-stream');
    await flushAsyncWork(2);
    emitSTT(deps, 'newer partial', false, 'sent-stream');
    await flushAsyncWork(2);

    oldPartial?.({
      sentenceId: 'sent-stream',
      original: 'old partial',
      translation: 'old translation',
      constraints: [],
    });
    newPartial?.({
      sentenceId: 'sent-stream',
      original: 'newer partial',
      translation: 'new translation',
      constraints: [],
    });

    expect(translatePartialCallback).toHaveBeenCalledTimes(1);
    expect(translatePartialCallback).toHaveBeenCalledWith(
      'test-session-1',
      expect.objectContaining({
        sentenceId: 'sent-stream',
        original: 'newer partial',
        translation: 'new translation',
      }),
    );

    oldDeferred.resolve({
      sentenceId: 'sent-stream',
      original: 'old partial',
      translation: 'old final',
      isFinal: true,
      corrections: [],
      constraints: [],
    });
    newDeferred.resolve({
      sentenceId: 'sent-stream',
      original: 'newer partial',
      translation: 'new final',
      isFinal: true,
      corrections: [],
      constraints: [],
    });
    await flushAsyncWork(4);
  });

  it('translates RTASR partials provisionally and keeps knowledge and notes final-only', async () => {
    jest.useFakeTimers();
    deps.constraintResolver = {
      resolve: jest.fn().mockResolvedValue([]),
    };
    manager = new SessionManager(deps);
    manager.updateConfig(createConfig());
    const session = createTestSession();
    const partialCallback = jest.fn();
    manager.onSessionTranslatePartial(partialCallback);

    await manager.startSession(session);
    emitSTT(deps, 'current speech', false, 'rtasr-1', {
      provider: 'xfyun-rtasr',
      stable: false,
    });

    jest.advanceTimersByTime(651);
    await Promise.resolve();

    expect(deps.translationGateway?.translateSentence).toHaveBeenCalledWith(
      expect.objectContaining({ sentenceId: 'rtasr-1', text: 'current speech', isFinal: false }),
      expect.objectContaining({ constraints: [] }),
    );
    expect(deps.constraintResolver?.resolve).not.toHaveBeenCalled();
    expect(deps.noteRepository?.appendSentence).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('uses final RTASR text as the authoritative sidecar input', async () => {
    deps.constraintResolver = {
      resolve: jest.fn().mockResolvedValue([]),
    };
    manager = new SessionManager(deps);
    manager.updateConfig(createConfig());

    const session = createTestSession();
    await manager.startSession(session);

    emitSTT(deps, 'final speech', true, 'rtasr-2', {
      provider: 'xfyun-rtasr',
      stable: true,
    });

    await Promise.resolve();
    await flushAsyncWork();

    expect(deps.constraintResolver?.resolve).toHaveBeenCalledWith('final speech');
    expect(deps.noteRepository?.appendSentence).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ original: 'final speech', translation: 'final translation', isFinal: true }),
    );
  });

  it('emits STT state changes from the client', async () => {
    const stateCallback = jest.fn();
    manager.onSessionStateChange(stateCallback);

    const session = createTestSession();
    await manager.startSession(session);

    const onStateChange = (deps.sttClient.onStateChange as jest.Mock).mock.calls[0][0];
    onStateChange('recognizing');
    onStateChange('reconnecting');

    expect(stateCallback).toHaveBeenCalledWith(session.id, 'recognizing');
    expect(stateCallback).toHaveBeenCalledWith(session.id, 'reconnecting');
  });

  it('pauses and resumes audio capture without optimistic listening state', async () => {
    const stateCallback = jest.fn();
    manager.onSessionStateChange(stateCallback);

    const session = createTestSession();
    await manager.startSession(session);
    jest.clearAllMocks();

    manager.pauseSession();
    expect(deps.audioCapture.stop).toHaveBeenCalled();
    expect(stateCallback).toHaveBeenCalledWith(session.id, 'paused');

    manager.resumeSession();
    expect(deps.audioCapture.start).toHaveBeenCalledWith('system');
    expect(stateCallback).not.toHaveBeenCalledWith(session.id, 'listening');
  });

  it('flushes the last partial sentence before ending the session', async () => {
    const session = createTestSession();
    await manager.startSession(session);

    const onResult = (deps.sttClient.onResult as jest.Mock).mock.calls[0][0];
    onResult('last partial', false, 'sent-2');

    await manager.endSession();

    expect(deps.noteRepository?.appendSentence).toHaveBeenCalledWith(
      'E:/notes/2026-06-21/10-00.md',
      expect.objectContaining({
        sentenceId: 'sent-2',
        original: 'last partial',
        translation: 'final translation',
        isFinal: true,
      }),
    );
    expect(deps.translationGateway?.translateSentence).toHaveBeenCalledWith(
      expect.objectContaining({ sentenceId: 'sent-2', text: 'last partial', isFinal: true }),
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        onPartial: expect.any(Function),
      }),
    );
    expect(deps.audioCapture.stop).toHaveBeenCalled();
    expect(deps.sttClient.disconnect).toHaveBeenCalled();
    expect(manager.currentSession).toBeNull();
    expect(manager.getSessionState()).toBe('stopped');
  });

  it('uses the latest note.saveDir for a new session after config changes', async () => {
    manager.updateConfig(createConfig('D:/fresh-notes'));
    const session = createTestSession({ id: 'test-session-2' });

    await manager.startSession(session);

    expect(deps.noteRepository?.createSessionNote).toHaveBeenCalledWith(session, 'D:/fresh-notes');
  });

  it('does not generate summary when enhancement is disabled', async () => {
    manager.updateConfig({
      ...createConfig(),
      enhancement: {
        enabled: false,
        summaryEnabled: true,
        correctionEnabled: true,
        recommendationEnabled: true,
      },
    } as Partial<AppConfig>);

    await manager.triggerSummary();

    expect((deps.translator as { generateSummary: jest.Mock }).generateSummary).not.toHaveBeenCalled();
  });

  it('delegates summary generation to the enhancement orchestrator when summary is enabled', async () => {
    manager.onNoteSaved(jest.fn());
    const noteSummaryCallback = jest.fn();
    manager.onNoteSummary(noteSummaryCallback);
    manager.updateConfig({
      ...createConfig(),
      enhancement: {
        enabled: true,
        summaryEnabled: true,
        correctionEnabled: false,
        recommendationEnabled: false,
      },
    } as Partial<AppConfig>);

    const session = createTestSession();
    await manager.startSession(session);
    const onResult = (deps.sttClient.onResult as jest.Mock).mock.calls[0][0];
    onResult('confirmed sentence', true, 'sent-1');
    await flushAsyncWork(2);

    await manager.triggerSummary();

    expect((deps.translator as { generateSummary: jest.Mock }).generateSummary).not.toHaveBeenCalled();
    expect((deps.enhancementOrchestrator as any).runSummary).toHaveBeenCalledWith({
      config: expect.objectContaining({ enabled: true, summaryEnabled: true }),
      sessionId: 'test-session-1',
      translations: [
        expect.objectContaining({ sentenceId: 'sent-1', translation: 'final translation' }),
      ],
      notePath: 'E:/notes/2026-06-21/10-00.md',
      translator: deps.translator,
      noteRepository: deps.noteRepository,
      emitStatus: expect.any(Function),
      onSummary: expect.any(Function),
    });
    const summaryParams = ((deps.enhancementOrchestrator as any).runSummary as jest.Mock).mock.calls[0][0];
    summaryParams.onSummary('summary generated');
    expect(manager.currentSession?.summary).toBe('summary generated');
    expect(noteSummaryCallback).toHaveBeenCalledWith('test-session-1', { summary: 'summary generated' });
  });

  it('does not throw to the caller when summary enhancement fails', async () => {
    deps = createMockDeps();
    deps.enhancementOrchestrator = {
      runCorrection: jest.fn().mockResolvedValue(undefined),
      runRecommendation: jest.fn().mockResolvedValue(undefined),
      runSummary: jest.fn().mockImplementation(async ({ emitStatus }: { emitStatus: Function }) => {
        emitStatus('test-session-1', {
          kind: 'summary',
          state: 'failed',
          sessionId: 'test-session-1',
          error: 'summary timeout',
        });
      }),
    } as any;
    manager = new SessionManager(deps);
    manager.updateConfig({
      ...createConfig(),
      enhancement: {
        enabled: true,
        summaryEnabled: true,
        correctionEnabled: false,
        recommendationEnabled: false,
      },
    } as Partial<AppConfig>);
    const enhancementStatusCallback = jest.fn();
    manager.onEnhancementStatus(enhancementStatusCallback);

    const session = createTestSession();
    await manager.startSession(session);
    const onResult = (deps.sttClient.onResult as jest.Mock).mock.calls[0][0];
    onResult('confirmed sentence', true, 'sent-1');
    await flushAsyncWork(2);

    await expect(manager.triggerSummary()).resolves.toBeUndefined();

    expect(enhancementStatusCallback).toHaveBeenCalledWith('test-session-1', {
      kind: 'summary',
      state: 'failed',
      sessionId: 'test-session-1',
      error: 'summary timeout',
    });
    expect(manager.currentSession?.summary).toBeUndefined();
  });

  it('dispatches correction enhancement after translate:final without blocking later sentences', async () => {
    const translateFinalCallback = jest.fn();
    const correctionDeferred = createDeferred<void>();
    const dispatchSnapshots: Array<{
      sentenceCount: number;
      translateFinalCalls: number;
      snapshot: TranslationResult[];
    }> = [];

    deps = createMockDeps();
    deps.correctionDetector = {
      checkConsistency: jest.fn().mockReturnValue(correctionDeferred.promise),
      shouldCheck: jest.fn().mockReturnValue(true),
    };
    deps.enhancementOrchestrator = {
      runCorrection: jest.fn().mockImplementation(async ({ translations }: { translations: TranslationResult[] }) => {
        dispatchSnapshots.push({
          sentenceCount: manager.currentSession?.sentences.length ?? 0,
          translateFinalCalls: translateFinalCallback.mock.calls.length,
          snapshot: translations,
        });
        await correctionDeferred.promise;
      }),
      runRecommendation: jest.fn().mockResolvedValue(undefined),
      runSummary: jest.fn().mockResolvedValue(undefined),
    } as EnhancementOrchestratorMock;
    manager = new SessionManager(deps);
    manager.updateConfig({
      ...createConfig(),
      enhancement: {
        enabled: true,
        summaryEnabled: false,
        correctionEnabled: true,
        recommendationEnabled: false,
      },
    } as Partial<AppConfig>);
    manager.onSessionTranslateFinal(translateFinalCallback);

    const session = createTestSession();
    await manager.startSession(session);

    const onResult = (deps.sttClient.onResult as jest.Mock).mock.calls[0][0];
    onResult('first sentence', true, 'sent-1');
    await flushAsyncWork(4);

    onResult('second sentence', true, 'sent-2');
    await flushAsyncWork(6);

    expect(translateFinalCallback).toHaveBeenNthCalledWith(
      1,
      'test-session-1',
      expect.objectContaining({
        sentenceId: 'sent-1',
        original: 'first sentence',
        isFinal: true,
        corrections: [],
        constraints: [],
      }),
    );
    expect(translateFinalCallback).toHaveBeenNthCalledWith(
      2,
      'test-session-1',
      expect.objectContaining({
        sentenceId: 'sent-2',
        original: 'second sentence',
        isFinal: true,
        corrections: [],
        constraints: [],
      }),
    );
    expect((deps.enhancementOrchestrator?.runCorrection as jest.Mock)).toHaveBeenCalledTimes(2);
    expect((deps.enhancementOrchestrator?.runRecommendation as jest.Mock)).toHaveBeenCalledTimes(2);
    expect(dispatchSnapshots[0]).toMatchObject({
      sentenceCount: 1,
      translateFinalCalls: 1,
      snapshot: [
        expect.objectContaining({
          sentenceId: 'sent-1',
          original: 'first sentence',
          translation: 'final translation',
        }),
      ],
    });
    expect(dispatchSnapshots[1]).toMatchObject({
      sentenceCount: 2,
      translateFinalCalls: 2,
      snapshot: [
        expect.objectContaining({ sentenceId: 'sent-1' }),
        expect.objectContaining({ sentenceId: 'sent-2' }),
      ],
    });

    correctionDeferred.resolve();
    await flushAsyncWork();
  });

  it('delegates summary for the last completed session after ending the main path', async () => {
    deps = createMockDeps();
    manager = new SessionManager(deps);
    manager.updateConfig({
      ...createConfig(),
      enhancement: {
        enabled: true,
        summaryEnabled: true,
        correctionEnabled: false,
        recommendationEnabled: false,
      },
    } as Partial<AppConfig>);

    const session = createTestSession();
    await manager.startSession(session);

    const onResult = (deps.sttClient.onResult as jest.Mock).mock.calls[0][0];
    onResult('confirmed sentence', true, 'sent-1');
    await flushAsyncWork();

    await manager.endSession();
    await manager.triggerSummary();

    expect((deps.translator as { generateSummary: jest.Mock }).generateSummary).not.toHaveBeenCalled();
    expect((deps.enhancementOrchestrator as any).runSummary).toHaveBeenCalledWith({
      config: expect.objectContaining({ enabled: true, summaryEnabled: true }),
      sessionId: 'test-session-1',
      translations: [
        expect.objectContaining({
          sentenceId: 'sent-1',
          original: 'confirmed sentence',
          isFinal: true,
          corrections: [],
          constraints: [],
        }),
      ],
      notePath: 'E:/notes/2026-06-21/10-00.md',
      translator: deps.translator,
      noteRepository: deps.noteRepository,
      emitStatus: expect.any(Function),
      onSummary: expect.any(Function),
    });
    expect(manager.currentSession).toBeNull();
  });

  it('returns live session states driven by main-process events', async () => {
    expect(manager.getSessionState()).toBe('idle');

    const session = createTestSession();
    await manager.startSession(session);
    expect(manager.getSessionState()).toBe('idle');

    const onStateChange = (deps.sttClient.onStateChange as jest.Mock).mock.calls[0][0];
    onStateChange('connected');
    expect(manager.getSessionState()).toBe('listening');

    manager.pauseSession();
    expect(manager.getSessionState()).toBe('paused');
  });
});
