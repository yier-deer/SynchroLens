import type {
  CorrectionResult,
  EnhancementConfig,
  EnhancementStatusPayload,
  TranslationConstraint,
  TranslationResult,
} from '../../../shared/types';

interface CorrectionDetectorPort {
  checkConsistency(translations: TranslationResult[]): Promise<CorrectionResult[]>;
  shouldCheck(sentenceCount: number): boolean;
}

interface RunCorrectionParams {
  config?: Partial<EnhancementConfig> | null;
  sessionId: string;
  translations: TranslationResult[];
  correctionDetector?: CorrectionDetectorPort;
  emitStatus: (sessionId: string, payload: EnhancementStatusPayload) => void;
}

interface SummaryTranslatorPort {
  generateSummary(sentences: TranslationResult[]): Promise<string>;
}

interface SummaryNoteRepositoryPort {
  appendSummary?(filePath: string, summary: string): Promise<void>;
}

interface RunSummaryParams {
  config?: Partial<EnhancementConfig> | null;
  sessionId: string;
  translations: TranslationResult[];
  notePath?: string;
  translator?: SummaryTranslatorPort;
  noteRepository?: SummaryNoteRepositoryPort;
  emitStatus: (sessionId: string, payload: EnhancementStatusPayload) => void;
  onSummary?: (summary: string) => void;
}

interface RunRecommendationParams {
  config?: Partial<EnhancementConfig> | null;
  sessionId: string;
  translations: TranslationResult[];
  emitStatus: (sessionId: string, payload: EnhancementStatusPayload) => void;
}

export class EnhancementOrchestrator {
  constructor(
    private readonly now: () => number = () => Date.now(),
    private readonly recommendationBuilder: (translations: TranslationResult[]) => string[] = buildRecommendations,
  ) {}

  async runCorrection({
    config,
    sessionId,
    translations,
    correctionDetector,
    emitStatus,
  }: RunCorrectionParams): Promise<void> {
    if (!config?.enabled || !config.correctionEnabled || !correctionDetector?.shouldCheck(1)) {
      return;
    }

    emitStatus(sessionId, {
      kind: 'correction',
      state: 'running',
      sessionId,
    });

    try {
      const corrections = await correctionDetector.checkConsistency(translations);
      emitStatus(sessionId, {
        kind: 'correction',
        state: 'completed',
        sessionId,
        corrections: corrections.map((correction) => ({
          ...correction,
          timestamp: this.now(),
        })),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emitStatus(sessionId, {
        kind: 'correction',
        state: 'failed',
        sessionId,
        error: message,
      });
    }
  }

  async runSummary({
    config,
    sessionId,
    translations,
    notePath,
    translator,
    noteRepository,
    emitStatus,
    onSummary,
  }: RunSummaryParams): Promise<void> {
    if (!config?.enabled || !config.summaryEnabled || !translator || translations.length === 0) {
      return;
    }

    emitStatus(sessionId, {
      kind: 'summary',
      state: 'running',
      sessionId,
    });

    try {
      const summary = await translator.generateSummary(translations);
      if (notePath) {
        await noteRepository?.appendSummary?.(notePath, summary);
      }
      onSummary?.(summary);
      emitStatus(sessionId, {
        kind: 'summary',
        state: 'completed',
        sessionId,
        summary,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emitStatus(sessionId, {
        kind: 'summary',
        state: 'failed',
        sessionId,
        error: message,
      });
    }
  }

  async runRecommendation({
    config,
    sessionId,
    translations,
    emitStatus,
  }: RunRecommendationParams): Promise<void> {
    if (!config?.enabled || !config.recommendationEnabled) {
      return;
    }

    emitStatus(sessionId, {
      kind: 'recommendation',
      state: 'running',
      sessionId,
    });

    try {
      const recommendations = this.recommendationBuilder(translations);
      emitStatus(sessionId, {
        kind: 'recommendation',
        state: 'completed',
        sessionId,
        recommendations,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emitStatus(sessionId, {
        kind: 'recommendation',
        state: 'failed',
        sessionId,
        error: message,
      });
    }
  }
}

function buildRecommendations(translations: TranslationResult[]): string[] {
  const seen = new Set<string>();
  const constraints: TranslationConstraint[] = [];

  for (const translation of translations) {
    for (const constraint of translation.constraints ?? []) {
      const source = constraint.source.trim();
      const target = constraint.target.trim();
      if (!source || !target) {
        continue;
      }

      const key = `${constraint.sourceType}:${source}:${target}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      constraints.push({ ...constraint, source, target });
    }
  }

  return constraints
    .sort((left, right) => {
      if (right.priority !== left.priority) {
        return right.priority - left.priority;
      }
      if ((right.score ?? 0) !== (left.score ?? 0)) {
        return (right.score ?? 0) - (left.score ?? 0);
      }
      return right.source.length - left.source.length;
    })
    .slice(0, 10)
    .map((constraint) => `${constraint.source} -> ${constraint.target}`);
}
