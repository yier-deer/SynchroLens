import { TerminologyResolver } from '../../../src/main/modules/dictionary/TerminologyResolver';

describe('TerminologyResolver', () => {
  it('keeps ordinary translation terminology to language and domain dictionaries', () => {
    const resolver = new TerminologyResolver({
      getLanguageEntries: () => [{ source: 'apple', target: '苹果' }],
      getDomainEntries: () => [{ source: 'apple', target: '苹果公司' }],
    });

    expect(resolver.resolve('I like apple devices')).toEqual([
      {
        source: 'apple',
        target: '苹果公司',
        sourceType: 'domain',
        priority: 2,
        matchType: 'exact',
        enforceMode: 'term',
        entryId: undefined,
        filePath: undefined,
      },
    ]);
  });

  it('returns both language and domain terms when sources differ', () => {
    const resolver = new TerminologyResolver({
      getLanguageEntries: () => [{ source: 'server', target: '服务器' }],
      getDomainEntries: () => [{ source: 'latency', target: '时延' }],
    });

    expect(resolver.resolve('server latency is improving')).toEqual([
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
});
