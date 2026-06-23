import { TerminologyResolver } from '../../../src/main/modules/dictionary/TerminologyResolver';
import { PersonalizationResolver } from '../../../src/main/modules/personalization/PersonalizationResolver';

describe('PersonalizationResolver', () => {
  it('returns exact personal match plus shared terminology constraints', async () => {
    const terminologyResolver = new TerminologyResolver({
      getLanguageEntries: () => [{ source: 'server', target: '服务器' }],
      getDomainEntries: () => [{ source: 'latency', target: '时延' }],
      getPersonalEntries: () => [],
    });
    const resolver = new PersonalizationResolver({
      terminologyResolver,
      getPersonalEntries: () => [
        {
          id: 'p1',
          source: 'we should ship it',
          target: '这句按我习惯翻',
          improvement: '保持口语风格',
          sourceNote: 'note.md',
          createdAt: '2026-06-21T08:00:00.000Z',
        },
      ],
    });

    await expect(resolver.resolve('we should ship it despite server latency')).resolves.toEqual([
      {
        source: 'we should ship it',
        target: '这句按我习惯翻',
        sourceType: 'personal',
        priority: 3,
        matchType: 'exact',
        enforceMode: 'sentence',
        entryId: 'p1',
        score: undefined,
      },
      {
        source: 'latency',
        target: '时延',
        sourceType: 'domain',
        priority: 2,
        matchType: 'exact',
        enforceMode: 'term',
        entryId: undefined,
        filePath: undefined,
      },
      {
        source: 'server',
        target: '服务器',
        sourceType: 'language',
        priority: 1,
        matchType: 'exact',
        enforceMode: 'term',
        entryId: undefined,
        filePath: undefined,
      },
    ]);
  });

  it('does not use runtime embeddings or similar personal matches for ordinary translation', async () => {
    const terminologyResolver = new TerminologyResolver({
      getLanguageEntries: () => [],
      getDomainEntries: () => [],
    });
    const embedText = jest.fn().mockResolvedValue([0.1, 0.2, 0.3]);
    const searchSimilarEntries = jest.fn().mockReturnValue([
      {
        entry: {
          id: 'p2',
          source: 'launch plan',
          target: '按我的发布计划表述',
          improvement: '保持个人措辞',
          sourceNote: 'note.md',
          createdAt: '2026-06-21T08:00:00.000Z',
        },
        score: 0.91,
      },
    ]);
    const resolver = new PersonalizationResolver({
      terminologyResolver,
      getPersonalEntries: () => [],
      embeddingClient: { hasApiKey: true, embedText },
      searchSimilarEntries,
    } as any);

    await expect(resolver.resolve('release launch plan review')).resolves.toEqual([]);
    expect(embedText).not.toHaveBeenCalled();
    expect(searchSimilarEntries).not.toHaveBeenCalled();
  });

  it('does not call embeddings when exact personal entries match', async () => {
    const terminologyResolver = new TerminologyResolver({
      getLanguageEntries: () => [],
      getDomainEntries: () => [],
    });
    const embedText = jest.fn();
    const searchSimilarEntries = jest.fn();
    const resolver = new PersonalizationResolver({
      terminologyResolver,
      getPersonalEntries: () => [
        {
          id: 'p-exact',
          source: 'ship it',
          target: '按我的习惯说发布',
          improvement: '保持个人表达',
          sourceNote: 'note.md',
          createdAt: '2026-06-21T08:00:00.000Z',
        },
      ],
      embeddingClient: { hasApiKey: true, embedText },
      searchSimilarEntries,
    } as any);

    const constraints = await resolver.resolve('please ship it today');

    expect(constraints).toHaveLength(1);
    expect(constraints[0]).toEqual(expect.objectContaining({
      entryId: 'p-exact',
      matchType: 'exact',
    }));
    expect(embedText).not.toHaveBeenCalled();
    expect(searchSimilarEntries).not.toHaveBeenCalled();
  });

  it('returns shared terminology without consulting embedding lookup', async () => {
    const terminologyResolver = new TerminologyResolver({
      getLanguageEntries: () => [{ source: 'server', target: '服务器' }],
      getDomainEntries: () => [{ source: 'latency', target: '时延' }],
    });
    const embedText = jest.fn().mockRejectedValue(new Error('embedding unavailable'));
    const searchSimilarEntries = jest.fn();
    const resolver = new PersonalizationResolver({
      terminologyResolver,
      getPersonalEntries: () => [],
      embeddingClient: {
        hasApiKey: true,
        embedText,
      },
      searchSimilarEntries,
    } as any);

    await expect(resolver.resolve('server latency')).resolves.toEqual([
      {
        source: 'latency',
        target: '时延',
        sourceType: 'domain',
        priority: 2,
        matchType: 'exact',
        enforceMode: 'term',
        entryId: undefined,
        filePath: undefined,
      },
      {
        source: 'server',
        target: '服务器',
        sourceType: 'language',
        priority: 1,
        matchType: 'exact',
        enforceMode: 'term',
        entryId: undefined,
        filePath: undefined,
      },
    ]);
    expect(embedText).not.toHaveBeenCalled();
    expect(searchSimilarEntries).not.toHaveBeenCalled();
  });
});
