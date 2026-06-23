import { SessionManager, type SessionDependencies } from '../../src/main/modules/session/SessionManager';
import type { AppConfig, Session, TranslationResult } from '../../src/shared/types';

function createConfig(): Partial<AppConfig> {
  return {
    note: {
      saveDir: 'E:/notes',
      autoSave: true,
      autoSaveInterval: 5000,
      autoSummary: false,
      summaryThreshold: 20,
    },
    translation: {
      provider: 'nmt',
      targetLanguage: 'zh-CN',
      apiEndpoint: 'http://127.0.0.1:8765',
      apiKey: 'nmt-key',
      model: 'nmt-default',
      contextCorrection: false,
      contextWindowSize: 2,
      tencent: {
        enabled: true,
        region: 'ap-guangzhou',
        projectId: 0,
        sourceLanguage: 'auto',
        secretKeySaved: false,
      },
    },
    enhancement: {
      enabled: false,
      summaryEnabled: true,
      correctionEnabled: true,
      recommendationEnabled: true,
    },
  };
}

function createSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-e2e-1',
    startTime: Date.now(),
    audioSource: 'system',
    sentences: [],
    ...overrides,
  };
}

async function flushAsyncWork(cycles = 4): Promise<void> {
  for (let i = 0; i < cycles; i += 1) {
    await Promise.resolve();
  }
}

describe('端到端演示 — 第三阶段 NMT 主链路', () => {
  let sessionManager: SessionManager;
  let deps: SessionDependencies;
  let sttCallbacks: Array<(text: string, isFinal: boolean, sentenceId: string) => void>;

  beforeEach(() => {
    jest.clearAllMocks();
    sttCallbacks = [];

    deps = {
      audioCapture: {
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn(),
        onData: jest.fn(() => jest.fn()),
        isRunning: true,
      },
      sttClient: {
        connect: jest.fn(),
        sendAudio: jest.fn(),
        disconnect: jest.fn(),
        onResult: jest.fn((callback) => {
          sttCallbacks.push(callback);
        }),
        onError: jest.fn(),
        onClose: jest.fn(),
        onStateChange: jest.fn(),
        isConnected: true,
      },
      noteRepository: {
        createSessionNote: jest.fn().mockResolvedValue('E:/notes/2026-06-21/10-00.md'),
        appendSentence: jest.fn().mockResolvedValue(undefined),
      },
      translationGateway: {
        translateSentence: jest.fn().mockImplementation(async (sentence, options) => {
          options?.onPartial?.({
            sentenceId: sentence.sentenceId,
            original: sentence.text,
            translation: '你',
            constraints: options?.constraints ?? [],
          });
          return {
            sentenceId: sentence.sentenceId,
            original: sentence.text,
            translation: '你好世界',
            isFinal: true,
            corrections: [],
            constraints: options?.constraints ?? [],
          } as TranslationResult;
        }),
        reset: jest.fn(),
        updateWindowSize: jest.fn(),
      },
    };

    sessionManager = new SessionManager(deps);
    sessionManager.updateConfig(createConfig());
  });

  function emitSTT(text: string, isFinal: boolean, sentenceId: string): void {
    sttCallbacks[sttCallbacks.length - 1]?.(text, isFinal, sentenceId);
  }

  it('原文句子会进入 NMT 并持续输出原文与译文事件', async () => {
    const transcriptCallback = jest.fn();
    const translatePartialCallback = jest.fn();
    const translateFinalCallback = jest.fn();
    const noteSavedCallback = jest.fn();
    sessionManager.onSessionTranscript(transcriptCallback);
    sessionManager.onSessionTranslatePartial(translatePartialCallback);
    sessionManager.onSessionTranslateFinal(translateFinalCallback);
    sessionManager.onNoteSaved(noteSavedCallback);

    await sessionManager.startSession(createSession());

    emitSTT('Hello', false, 'sent-1');
    emitSTT('Hello world', true, 'sent-1');
    await flushAsyncWork();

    expect(transcriptCallback).toHaveBeenNthCalledWith(
      1,
      'session-e2e-1',
      expect.objectContaining({ sentenceId: 'sent-1', text: 'Hello', isFinal: false }),
    );
    expect(transcriptCallback).toHaveBeenNthCalledWith(
      2,
      'session-e2e-1',
      expect.objectContaining({ sentenceId: 'sent-1', text: 'Hello world', isFinal: true }),
    );
    expect(deps.noteRepository?.appendSentence).toHaveBeenCalledWith(
      'E:/notes/2026-06-21/10-00.md',
      expect.objectContaining({
        sentenceId: 'sent-1',
        original: 'Hello world',
        translation: '\u4f60\u597d\u4e16\u754c',
        isFinal: true,
      }),
    );
    expect(translatePartialCallback).toHaveBeenCalledWith('session-e2e-1', {
      sentenceId: 'sent-1',
      original: 'Hello world',
      translation: '你',
      constraints: [],
    });
    expect(translateFinalCallback).toHaveBeenCalledWith('session-e2e-1', {
      sentenceId: 'sent-1',
      original: 'Hello world',
      translation: '你好世界',
      isFinal: true,
      corrections: [],
      constraints: [],
    });
    expect(noteSavedCallback).toHaveBeenCalledWith('session-e2e-1', {
      filePath: 'E:/notes/2026-06-21/10-00.md',
    });
    expect(sessionManager.currentSession?.sentences).toEqual([
      {
        sentenceId: 'sent-1',
        original: 'Hello world',
        translation: '你好世界',
        isFinal: true,
        corrections: [],
      constraints: [],
      },
    ]);
  });

  it('翻译失败只影响当前句，不会拖垮会话和原文落盘', async () => {
    (deps.translationGateway?.translateSentence as jest.Mock).mockResolvedValueOnce({
      sentenceId: 'sent-2',
      original: 'Failure case',
      translation: '',
      isFinal: true,
      corrections: [],
      constraints: [],
      error: 'nmt timeout',
    } satisfies TranslationResult);

    const translateFinalCallback = jest.fn();
    sessionManager.onSessionTranslateFinal(translateFinalCallback);

    await sessionManager.startSession(createSession());
    emitSTT('Failure case', true, 'sent-2');
    await flushAsyncWork();

    expect(deps.noteRepository?.appendSentence).toHaveBeenCalledWith(
      'E:/notes/2026-06-21/10-00.md',
      expect.objectContaining({
        sentenceId: 'sent-2',
        original: 'Failure case',
        translation: '',
        isFinal: true,
      }),
    );
    expect(translateFinalCallback).toHaveBeenCalledWith('session-e2e-1', {
      sentenceId: 'sent-2',
      original: 'Failure case',
      translation: '',
      isFinal: true,
      corrections: [],
      constraints: [],
      error: 'nmt timeout',
    });
    expect(sessionManager.currentSession?.sentences[0]).toMatchObject({
      sentenceId: 'sent-2',
      error: 'nmt timeout',
    });
    expect(sessionManager.currentSession).not.toBeNull();
  });

  it('uses language and domain terminology constraints in the NMT main path without personal dictionary influence', async () => {
    const terminologyConstraints = [
      {
        source: 'latency',
        target: '时延',
        sourceType: 'domain',
        priority: 2,
        matchType: 'exact',
        enforceMode: 'term',
      },
    ] as const;
    deps.constraintResolver = {
      resolve: jest.fn().mockResolvedValue(terminologyConstraints),
    };
    sessionManager = new SessionManager(deps);
    sessionManager.updateConfig(createConfig());

    const translateFinalCallback = jest.fn();
    sessionManager.onSessionTranslateFinal(translateFinalCallback);

    await sessionManager.startSession(createSession());
    emitSTT('server latency', true, 'sent-terminology-1');
    await flushAsyncWork();

    expect(deps.translationGateway?.translateSentence).toHaveBeenCalledWith(
      expect.objectContaining({ sentenceId: 'sent-terminology-1', text: 'server latency' }),
      expect.objectContaining({ constraints: terminologyConstraints }),
    );
    expect(translateFinalCallback).toHaveBeenCalledWith(
      'session-e2e-1',
      expect.objectContaining({ constraints: terminologyConstraints }),
    );
  });

  it('continues translation when terminology resolution fails', async () => {
    deps.constraintResolver = {
      resolve: jest.fn().mockRejectedValue(new Error('dictionary timeout')),
    };
    sessionManager = new SessionManager(deps);
    sessionManager.updateConfig(createConfig());

    const translateFinalCallback = jest.fn();
    sessionManager.onSessionTranslateFinal(translateFinalCallback);

    await sessionManager.startSession(createSession());
    emitSTT('fallback sentence', true, 'sent-terminology-2');
    await flushAsyncWork();

    expect(deps.translationGateway?.translateSentence).toHaveBeenCalledWith(
      expect.objectContaining({ sentenceId: 'sent-terminology-2', text: 'fallback sentence' }),
      expect.objectContaining({ constraints: [] }),
    );
    expect(translateFinalCallback).toHaveBeenCalledWith(
      'session-e2e-1',
      expect.objectContaining({
        sentenceId: 'sent-terminology-2',
        constraints: [],
      }),
    );
  });

  it('暂停会中止在途翻译，恢复后继续同一句翻译', async () => {
    const translateFinalCallback = jest.fn();
    sessionManager.onSessionTranslateFinal(translateFinalCallback);

    const abortingPromise = jest.fn().mockImplementation(
      (_sentence, options?: { signal?: AbortSignal; onPartial?: (payload: { sentenceId: string; original: string; translation: string }) => void }) =>
        new Promise<TranslationResult>((resolve, reject) => {
      options?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('aborted', 'AbortError')),
            { once: true },
          );
        }),
    );
    const resumedPromise = jest.fn().mockImplementation(async (sentence, options) => {
      options?.onPartial?.({
        sentenceId: sentence.sentenceId,
        original: sentence.text,
        translation: '恢',
        constraints: options?.constraints ?? [],
      });
      return {
        sentenceId: sentence.sentenceId,
        original: sentence.text,
        translation: '恢复后的译文',
        isFinal: true,
        corrections: [],
      constraints: [],
      } as TranslationResult;
    });

    (deps.translationGateway?.translateSentence as jest.Mock)
      .mockImplementationOnce(abortingPromise)
      .mockImplementationOnce(resumedPromise);

    await sessionManager.startSession(createSession());
    emitSTT('Pause me', true, 'sent-3');
    await flushAsyncWork(1);

    sessionManager.pauseSession();
    await flushAsyncWork(1);
    expect(translateFinalCallback).not.toHaveBeenCalled();

    sessionManager.resumeSession();
    await flushAsyncWork();

    expect(deps.translationGateway?.translateSentence).toHaveBeenCalledTimes(2);
    expect(translateFinalCallback).toHaveBeenCalledWith('session-e2e-1', {
      sentenceId: 'sent-3',
      original: 'Pause me',
      translation: '恢复后的译文',
      isFinal: true,
      corrections: [],
      constraints: [],
    });
  });

  it('停止会 flush 最后 partial，并在停止前完成该句翻译', async () => {
    const translateFinalCallback = jest.fn();
    sessionManager.onSessionTranslateFinal(translateFinalCallback);

    await sessionManager.startSession(createSession());
    emitSTT('Last partial', false, 'sent-4');

    await sessionManager.endSession();

    expect(deps.noteRepository?.appendSentence).toHaveBeenCalledWith(
      'E:/notes/2026-06-21/10-00.md',
      expect.objectContaining({
        sentenceId: 'sent-4',
        original: 'Last partial',
        translation: '\u4f60\u597d\u4e16\u754c',
        isFinal: true,
      }),
    );
    expect(translateFinalCallback).toHaveBeenCalledWith('session-e2e-1', {
      sentenceId: 'sent-4',
      original: 'Last partial',
      translation: '你好世界',
      isFinal: true,
      corrections: [],
      constraints: [],
    });
    expect(sessionManager.currentSession).toBeNull();
    expect(sessionManager.getSessionState()).toBe('stopped');
  });
});
