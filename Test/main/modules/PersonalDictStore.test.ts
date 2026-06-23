import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { PersonalDictStore } from '../../../src/main/modules/dictionary/PersonalDictStore';

let userDataDir = '';

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => userDataDir),
  },
}));

describe('PersonalDictStore', () => {
  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'synchrolens-pdict-'));
  });

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true });
  });

  it('returns scored similar entries sorted by score and filtered by threshold', () => {
    const store = new PersonalDictStore();
    store.add(
      {
        source: 'close match',
        target: '高分匹配',
        improvement: '保留个人表达',
        sourceNote: 'note-a.md',
      },
      [1, 0],
    );
    store.add(
      {
        source: 'medium match',
        target: '中分匹配',
        improvement: '保留术语',
        sourceNote: 'note-b.md',
      },
      [0.8, 0.6],
    );
    store.add(
      {
        source: 'low match',
        target: '低分匹配',
        improvement: '应该被过滤',
        sourceNote: 'note-c.md',
      },
      [0, 1],
    );

    const results = store.searchBySimilarityWithScores([1, 0], 5, 0.7);

    expect(results.map(({ entry }) => entry.source)).toEqual(['close match', 'medium match']);
    expect(results[0].score).toBeCloseTo(1);
    expect(results[1].score).toBeCloseTo(0.8);
    expect(results[0].entry).not.toHaveProperty('embedding');
  });

  it('keeps searchBySimilarity compatible by returning entries without embeddings or scores', () => {
    const store = new PersonalDictStore();
    store.add(
      {
        source: 'legacy match',
        target: '兼容返回',
        improvement: '旧调用方不需要分数',
        sourceNote: 'note.md',
      },
      [1, 0],
    );

    const [entry] = store.searchBySimilarity([1, 0], 1, 0.7);

    expect(entry.source).toBe('legacy match');
    expect(entry).not.toHaveProperty('embedding');
    expect(entry).not.toHaveProperty('score');
  });
});
