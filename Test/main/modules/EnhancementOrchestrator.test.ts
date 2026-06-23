import { EnhancementOrchestrator } from '../../../src/main/modules/enhancement/EnhancementOrchestrator';
import type { EnhancementConfig, TranslationResult } from '../../../src/shared/types';

function createEnhancementConfig(overrides: Partial<EnhancementConfig> = {}): EnhancementConfig {
  return {
    enabled: true,
    summaryEnabled: false,
    correctionEnabled: true,
    recommendationEnabled: false,
    ...overrides,
  };
}

function createTranslation(overrides: Partial<TranslationResult> = {}): TranslationResult {
  return {
    sentenceId: 'sent-1',
    original: 'first sentence',
    translation: 'initial translation',
    isFinal: true,
    corrections: [],
    constraints: [],
    ...overrides,
  };
}

describe('EnhancementOrchestrator', () => {
  const now = 1700000000000;

  it('short-circuits when enhancement is disabled', async () => {
    const detector = {
      shouldCheck: jest.fn(),
      checkConsistency: jest.fn(),
    };
    const emitStatus = jest.fn();
    const orchestrator = new EnhancementOrchestrator(() => now);

    await orchestrator.runCorrection({
      config: createEnhancementConfig({ enabled: false }),
      sessionId: 'session-1',
      translations: [createTranslation()],
      correctionDetector: detector,
      emitStatus,
    });

    expect(detector.shouldCheck).not.toHaveBeenCalled();
    expect(detector.checkConsistency).not.toHaveBeenCalled();
    expect(emitStatus).not.toHaveBeenCalled();
  });

  it('short-circuits when correction enhancement is disabled', async () => {
    const detector = {
      shouldCheck: jest.fn(),
      checkConsistency: jest.fn(),
    };
    const emitStatus = jest.fn();
    const orchestrator = new EnhancementOrchestrator(() => now);

    await orchestrator.runCorrection({
      config: createEnhancementConfig({ correctionEnabled: false }),
      sessionId: 'session-1',
      translations: [createTranslation()],
      correctionDetector: detector,
      emitStatus,
    });

    expect(detector.shouldCheck).not.toHaveBeenCalled();
    expect(detector.checkConsistency).not.toHaveBeenCalled();
    expect(emitStatus).not.toHaveBeenCalled();
  });

  it('emits running and completed with timestamped correction sidecar results without rewriting the main translation output', async () => {
    const translation = createTranslation();
    const detector = {
      shouldCheck: jest.fn().mockReturnValue(true),
      checkConsistency: jest.fn().mockResolvedValue([
        {
          sentenceId: 'sent-1',
          from: 'old translation',
          to: 'new translation',
          reason: 'terminology consistency',
        },
      ]),
    };
    const emitStatus = jest.fn();
    const orchestrator = new EnhancementOrchestrator(() => now);

    await orchestrator.runCorrection({
      config: createEnhancementConfig(),
      sessionId: 'session-1',
      translations: [translation],
      correctionDetector: detector,
      emitStatus,
    });

    expect(detector.shouldCheck).toHaveBeenCalledWith(1);
    expect(detector.checkConsistency).toHaveBeenCalledWith([translation]);
    expect(emitStatus).toHaveBeenNthCalledWith(1, 'session-1', {
      kind: 'correction',
      state: 'running',
      sessionId: 'session-1',
    });
    expect(emitStatus).toHaveBeenNthCalledWith(2, 'session-1', {
      kind: 'correction',
      state: 'completed',
      sessionId: 'session-1',
      corrections: [
        {
          sentenceId: 'sent-1',
          from: 'old translation',
          to: 'new translation',
          reason: 'terminology consistency',
          timestamp: now,
        },
      ],
    });
    expect(translation.translation).toBe('initial translation');
    expect(translation.corrections).toEqual([]);
  });

  it('emits failed and resolves without throwing when the detector rejects', async () => {
    const detector = {
      shouldCheck: jest.fn().mockReturnValue(true),
      checkConsistency: jest.fn().mockRejectedValue(new Error('detector failed')),
    };
    const emitStatus = jest.fn();
    const orchestrator = new EnhancementOrchestrator(() => now);

    await expect(
      orchestrator.runCorrection({
        config: createEnhancementConfig(),
        sessionId: 'session-1',
        translations: [createTranslation()],
        correctionDetector: detector,
        emitStatus,
      }),
    ).resolves.toBeUndefined();

    expect(emitStatus).toHaveBeenNthCalledWith(1, 'session-1', {
      kind: 'correction',
      state: 'running',
      sessionId: 'session-1',
    });
    expect(emitStatus).toHaveBeenNthCalledWith(2, 'session-1', {
      kind: 'correction',
      state: 'failed',
      sessionId: 'session-1',
      error: 'detector failed',
    });
  });

  it('emits summary sidecar status, stores the summary, and appends it to the note', async () => {
    const translation = createTranslation({ sentenceId: 'sent-2', translation: 'final text' });
    const translator = {
      generateSummary: jest.fn().mockResolvedValue('summary generated'),
    };
    const noteRepository = {
      appendSummary: jest.fn().mockResolvedValue(undefined),
    };
    const emitStatus = jest.fn();
    const onSummary = jest.fn();
    const orchestrator = new EnhancementOrchestrator(() => now);

    await orchestrator.runSummary({
      config: createEnhancementConfig({ summaryEnabled: true }),
      sessionId: 'session-1',
      translations: [translation],
      notePath: 'E:/notes/session.md',
      translator,
      noteRepository,
      emitStatus,
      onSummary,
    });

    expect(translator.generateSummary).toHaveBeenCalledWith([translation]);
    expect(noteRepository.appendSummary).toHaveBeenCalledWith('E:/notes/session.md', 'summary generated');
    expect(onSummary).toHaveBeenCalledWith('summary generated');
    expect(emitStatus).toHaveBeenNthCalledWith(1, 'session-1', {
      kind: 'summary',
      state: 'running',
      sessionId: 'session-1',
    });
    expect(emitStatus).toHaveBeenNthCalledWith(2, 'session-1', {
      kind: 'summary',
      state: 'completed',
      sessionId: 'session-1',
      summary: 'summary generated',
    });
  });

  it('emits summary failure status and resolves without throwing when summary generation fails', async () => {
    const translator = {
      generateSummary: jest.fn().mockRejectedValue(new Error('summary timeout')),
    };
    const emitStatus = jest.fn();
    const onSummary = jest.fn();
    const orchestrator = new EnhancementOrchestrator(() => now);

    await expect(
      orchestrator.runSummary({
        config: createEnhancementConfig({ summaryEnabled: true }),
        sessionId: 'session-1',
        translations: [createTranslation()],
        translator,
        emitStatus,
        onSummary,
      }),
    ).resolves.toBeUndefined();

    expect(onSummary).not.toHaveBeenCalled();
    expect(emitStatus).toHaveBeenNthCalledWith(1, 'session-1', {
      kind: 'summary',
      state: 'running',
      sessionId: 'session-1',
    });
    expect(emitStatus).toHaveBeenNthCalledWith(2, 'session-1', {
      kind: 'summary',
      state: 'failed',
      sessionId: 'session-1',
      error: 'summary timeout',
    });
  });

  it('emits recommendation sidecar results from translation constraints without mutating translations or writing dictionary entries', async () => {
    const translation = createTranslation({
      constraints: [
        {
          source: 'server',
          target: '服务器',
          sourceType: 'language',
          priority: 1,
          matchType: 'exact',
          enforceMode: 'term',
        },
        {
          source: 'kickoff',
          target: '启动会',
          sourceType: 'personal',
          priority: 3,
          matchType: 'exact',
          enforceMode: 'sentence',
        },
        {
          source: 'latency',
          target: '时延',
          sourceType: 'domain',
          priority: 2,
          matchType: 'exact',
          enforceMode: 'term',
        },
        {
          source: 'kickoff',
          target: '启动会',
          sourceType: 'personal',
          priority: 3,
          matchType: 'exact',
          enforceMode: 'sentence',
        },
        {
          source: 'launch plan',
          target: '发布计划',
          sourceType: 'personal',
          priority: 3,
          matchType: 'similar',
          enforceMode: 'sentence',
          score: 0.94,
        },
      ],
    });
    const emitStatus = jest.fn();
    const orchestrator = new EnhancementOrchestrator(() => now);

    await orchestrator.runRecommendation({
      config: createEnhancementConfig({ recommendationEnabled: true }),
      sessionId: 'session-1',
      translations: [translation],
      emitStatus,
    });

    expect(emitStatus).toHaveBeenNthCalledWith(1, 'session-1', {
      kind: 'recommendation',
      state: 'running',
      sessionId: 'session-1',
    });
    expect(emitStatus).toHaveBeenNthCalledWith(2, 'session-1', {
      kind: 'recommendation',
      state: 'completed',
      sessionId: 'session-1',
      recommendations: [
        'launch plan -> 发布计划',
        'kickoff -> 启动会',
        'latency -> 时延',
        'server -> 服务器',
      ],
    });
    expect(translation.translation).toBe('initial translation');
  });

  it('does not infer recommendation candidates from original or translated text', async () => {
    const translation = createTranslation({
      original: 'contains latency',
      translation: '包含时延',
      constraints: [],
    });
    const emitStatus = jest.fn();
    const orchestrator = new EnhancementOrchestrator(() => now);

    await orchestrator.runRecommendation({
      config: createEnhancementConfig({ recommendationEnabled: true }),
      sessionId: 'session-1',
      translations: [translation],
      emitStatus,
    });

    expect(emitStatus).toHaveBeenNthCalledWith(2, 'session-1', {
      kind: 'recommendation',
      state: 'completed',
      sessionId: 'session-1',
      recommendations: [],
    });
  });
});
