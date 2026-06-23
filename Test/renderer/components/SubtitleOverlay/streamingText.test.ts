import {
  buildStreamingDiffPlan,
  splitGraphemes,
} from '../../../../src/renderer/components/SubtitleOverlay/streamingText';

describe('streamingText', () => {
  it('splits CJK and Latin text into display graphemes', () => {
    expect(splitGraphemes('\u4f60\u597dHi')).toEqual(['\u4f60', '\u597d', 'H', 'i']);
  });

  it('plans a pure append as typing without repair', () => {
    expect(buildStreamingDiffPlan('I love', 'I love movies')).toEqual({
      stablePrefix: 'I love',
      removedSuffix: '',
      insertedSuffix: ' movies',
      isRevision: false,
    });
  });

  it('plans a revised suffix as repair plus inserted suffix', () => {
    expect(buildStreamingDiffPlan('I love cats', 'I love cars')).toEqual({
      stablePrefix: 'I love ca',
      removedSuffix: 'ts',
      insertedSuffix: 'rs',
      isRevision: true,
    });
  });

  it('treats a shorter next result as a revision', () => {
    expect(buildStreamingDiffPlan('hello world', 'hello')).toEqual({
      stablePrefix: 'hello',
      removedSuffix: ' world',
      insertedSuffix: '',
      isRevision: true,
    });
  });
});
