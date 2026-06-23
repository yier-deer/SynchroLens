import type {
  KnowledgeHit,
  KnowledgeRetrievalResult,
  KnowledgeSourceType,
  TranslationConstraint,
} from '../../../shared/types';

interface KnowledgeRetrieverDependencies {
  resolveConstraints: (text: string) => Promise<TranslationConstraint[]> | TranslationConstraint[];
  now?: () => number;
}

interface RetrieveOptions {
  maxHits?: number;
  timeoutMs?: number;
}

export class KnowledgeRetriever {
  private readonly now: () => number;

  constructor(private readonly deps: KnowledgeRetrieverDependencies) {
    this.now = deps.now ?? (() => Date.now());
  }

  async retrieve(query: string, options: RetrieveOptions = {}): Promise<KnowledgeRetrievalResult> {
    const normalized = query.trim();
    const startedAt = this.now();
    const timeoutMs = options.timeoutMs ?? 120;
    const maxHits = options.maxHits ?? 8;

    if (!normalized) {
      return { query, hits: [], durationMs: 0, degraded: false };
    }

    try {
      const constraints = await Promise.race([
        Promise.resolve(this.deps.resolveConstraints(normalized)),
        new Promise<never>((_resolve, reject) => {
          setTimeout(() => reject(new Error('knowledge retrieval timeout')), timeoutMs);
        }),
      ]);
      const hits = this.toKnowledgeHits(normalized, constraints).slice(0, maxHits);

      return {
        query,
        hits,
        durationMs: this.now() - startedAt,
        degraded: false,
      };
    } catch (error) {
      return {
        query,
        hits: [],
        durationMs: this.now() - startedAt,
        degraded: true,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async resolve(query: string): Promise<TranslationConstraint[]> {
    const result = await this.retrieve(query);
    return this.toTranslationConstraints(result.hits);
  }

  toTranslationConstraints(hits: KnowledgeHit[]): TranslationConstraint[] {
    return hits
      .filter((hit) => hit.consumers.includes('translation-constraint'))
      .map((hit) => ({
        source: hit.source,
        target: hit.target,
        sourceType: this.toConstraintSourceType(hit.sourceType),
        priority: hit.priority,
        matchType: hit.matchType,
        enforceMode: this.toEnforceMode(hit.sourceType),
        entryId: hit.entryId,
        filePath: hit.filePath,
        score: hit.score,
      }));
  }

  private toKnowledgeHits(query: string, constraints: TranslationConstraint[]): KnowledgeHit[] {
    return constraints
      .map((constraint, index) => ({
        id: `${constraint.sourceType}:${constraint.matchType}:${constraint.entryId ?? constraint.filePath ?? index}`,
        query,
        source: constraint.source,
        target: constraint.target,
        sourceType: this.toKnowledgeSourceType(constraint),
        matchType: constraint.matchType,
        priority: constraint.priority,
        score: constraint.score,
        entryId: constraint.entryId,
        filePath: constraint.filePath,
        consumers: ['translation-constraint', 'enhancement-recommendation'],
      } satisfies KnowledgeHit))
      .sort((left, right) => {
        if (right.priority !== left.priority) {
          return right.priority - left.priority;
        }
        if (left.matchType !== right.matchType) {
          return left.matchType === 'exact' ? -1 : 1;
        }
        if ((right.score ?? 0) !== (left.score ?? 0)) {
          return (right.score ?? 0) - (left.score ?? 0);
        }
        return right.source.length - left.source.length;
      });
  }

  private toKnowledgeSourceType(constraint: TranslationConstraint): KnowledgeSourceType {
    if (constraint.sourceType === 'language') {
      return 'language-dictionary';
    }
    if (constraint.sourceType === 'domain') {
      return 'domain-dictionary';
    }
    return constraint.matchType === 'similar' ? 'translation-memory' : 'personal-dictionary';
  }

  private toConstraintSourceType(sourceType: KnowledgeSourceType): TranslationConstraint['sourceType'] {
    if (sourceType === 'language-dictionary') {
      return 'language';
    }
    if (sourceType === 'domain-dictionary') {
      return 'domain';
    }
    return 'personal';
  }

  private toEnforceMode(sourceType: KnowledgeSourceType): TranslationConstraint['enforceMode'] {
    return sourceType === 'language-dictionary' || sourceType === 'domain-dictionary'
      ? 'term'
      : 'sentence';
  }
}
