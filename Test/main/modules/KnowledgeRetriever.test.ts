import { KnowledgeRetriever } from '../../../src/main/modules/enhancement/KnowledgeRetriever';
import type { KnowledgeHit, TranslationConstraint } from '../../../src/shared/types';

function constraint(overrides: Partial<TranslationConstraint>): TranslationConstraint {
  return {
    source: 'source',
    target: 'target',
    sourceType: 'domain',
    priority: 2,
    matchType: 'exact',
    enforceMode: 'term',
    ...overrides,
  };
}

describe('KnowledgeRetriever', () => {
  it('normalizes exact language, domain, and personal constraints into knowledge hits', async () => {
    const retriever = new KnowledgeRetriever({
      resolveConstraints: () => [
        constraint({ source: 'server', target: '服务器', sourceType: 'language', priority: 1 }),
        constraint({ source: 'latency', target: '时延', sourceType: 'domain', priority: 2, filePath: 'domain.csv' }),
        constraint({
          source: 'ship it',
          target: '按我的习惯发布',
          sourceType: 'personal',
          priority: 3,
          entryId: 'p1',
          enforceMode: 'sentence',
        }),
      ],
      now: () => 100,
    });

    const result = await retriever.retrieve(' server latency ');

    expect(result).toEqual({
      query: ' server latency ',
      durationMs: 0,
      degraded: false,
      hits: [
        expect.objectContaining({ source: 'ship it', sourceType: 'personal-dictionary', priority: 3 }),
        expect.objectContaining({ source: 'latency', sourceType: 'domain-dictionary', priority: 2, filePath: 'domain.csv' }),
        expect.objectContaining({ source: 'server', sourceType: 'language-dictionary', priority: 1 }),
      ],
    });
    expect(result.hits.every((hit) => hit.consumers.includes('translation-constraint'))).toBe(true);
    expect(result.hits.every((hit) => hit.consumers.includes('enhancement-recommendation'))).toBe(true);
  });

  it('normalizes similar personal constraints as translation memory and preserves score', async () => {
    const retriever = new KnowledgeRetriever({
      resolveConstraints: () => [
        constraint({
          source: 'launch plan',
          target: '发布计划',
          sourceType: 'personal',
          priority: 3,
          matchType: 'similar',
          enforceMode: 'sentence',
          score: 0.93,
          entryId: 'p2',
        }),
      ],
    });

    const result = await retriever.retrieve('launch review');

    expect(result.hits).toEqual([
      expect.objectContaining({
        source: 'launch plan',
        sourceType: 'translation-memory',
        matchType: 'similar',
        score: 0.93,
      }),
    ]);
  });

  it('sorts hits by priority, exactness, score, and source length while applying maxHits', async () => {
    const retriever = new KnowledgeRetriever({
      resolveConstraints: () => [
        constraint({ source: 'short', target: '短', priority: 2, matchType: 'exact' }),
        constraint({ source: 'longer source', target: '更长', priority: 2, matchType: 'exact' }),
        constraint({ source: 'similar low', target: '低分', priority: 2, matchType: 'similar', score: 0.7 }),
        constraint({ source: 'similar high', target: '高分', priority: 2, matchType: 'similar', score: 0.95 }),
        constraint({ source: 'top', target: '最高', priority: 5, matchType: 'similar', score: 0.1 }),
      ],
    });

    const result = await retriever.retrieve('query', { maxHits: 4 });

    expect(result.hits.map((hit) => hit.source)).toEqual([
      'top',
      'longer source',
      'short',
      'similar high',
    ]);
  });

  it('returns degraded empty results when the resolver throws', async () => {
    const retriever = new KnowledgeRetriever({
      resolveConstraints: () => {
        throw new Error('dictionary unavailable');
      },
      now: () => 123,
    });

    const result = await retriever.retrieve('query');

    expect(result).toEqual({
      query: 'query',
      hits: [],
      durationMs: 0,
      degraded: true,
      error: 'dictionary unavailable',
    });
  });

  it('returns degraded empty results on timeout without throwing', async () => {
    jest.useFakeTimers();
    const retriever = new KnowledgeRetriever({
      resolveConstraints: () => new Promise<TranslationConstraint[]>(() => undefined),
      now: () => 200,
    });

    const pending = retriever.retrieve('query', { timeoutMs: 20 });
    await jest.advanceTimersByTimeAsync(20);
    const result = await pending;

    expect(result).toEqual({
      query: 'query',
      hits: [],
      durationMs: 0,
      degraded: true,
      error: 'knowledge retrieval timeout',
    });
    jest.useRealTimers();
  });

  it('returns empty non-degraded results for blank queries', async () => {
    const resolveConstraints = jest.fn();
    const retriever = new KnowledgeRetriever({ resolveConstraints });

    await expect(retriever.retrieve('   ')).resolves.toEqual({
      query: '   ',
      hits: [],
      durationMs: 0,
      degraded: false,
    });
    expect(resolveConstraints).not.toHaveBeenCalled();
  });

  it('converts knowledge hits back to translation constraints for the main translation path', async () => {
    const retriever = new KnowledgeRetriever({ resolveConstraints: () => [] });
    const hits: KnowledgeHit[] = [
      {
        id: 'domain:exact:latency',
        query: 'latency',
        source: 'latency',
        target: '时延',
        sourceType: 'domain-dictionary',
        matchType: 'exact',
        priority: 2,
        filePath: 'domain.csv',
        consumers: ['translation-constraint', 'enhancement-recommendation'],
      },
      {
        id: 'memory:similar:p1',
        query: 'launch',
        source: 'launch plan',
        target: '发布计划',
        sourceType: 'translation-memory',
        matchType: 'similar',
        priority: 3,
        score: 0.9,
        entryId: 'p1',
        consumers: ['enhancement-recommendation'],
      },
    ];

    expect(retriever.toTranslationConstraints(hits)).toEqual([
      {
        source: 'latency',
        target: '时延',
        sourceType: 'domain',
        priority: 2,
        matchType: 'exact',
        enforceMode: 'term',
        entryId: undefined,
        filePath: 'domain.csv',
        score: undefined,
      },
    ]);
  });

  it('resolve returns constraints that can be sent directly to TranslationGateway', async () => {
    const retriever = new KnowledgeRetriever({
      resolveConstraints: () => [
        constraint({
          source: 'latency',
          target: '时延',
          sourceType: 'domain',
          priority: 2,
          matchType: 'exact',
          enforceMode: 'term',
        }),
      ],
    });

    await expect(retriever.resolve('server latency')).resolves.toEqual([
      {
        source: 'latency',
        target: '时延',
        sourceType: 'domain',
        priority: 2,
        matchType: 'exact',
        enforceMode: 'term',
        entryId: undefined,
        filePath: undefined,
        score: undefined,
      },
    ]);
  });
});
