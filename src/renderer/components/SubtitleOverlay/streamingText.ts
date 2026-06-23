export type StreamingTextPartKind = 'stable' | 'repair' | 'typing';

export interface StreamingTextPart {
  kind: StreamingTextPartKind;
  text: string;
}

export interface StreamingDiffPlan {
  stablePrefix: string;
  removedSuffix: string;
  insertedSuffix: string;
  isRevision: boolean;
}

type SegmenterCtor = new (
  locales?: string | string[],
  options?: { granularity?: 'grapheme' },
) => {
  segment(value: string): Iterable<{ segment: string }>;
};

export function splitGraphemes(value: string): string[] {
  const segmenterCtor = (Intl as typeof Intl & { Segmenter?: SegmenterCtor }).Segmenter;
  if (typeof segmenterCtor === 'function') {
    const segmenter = new segmenterCtor(undefined, { granularity: 'grapheme' });
    return Array.from(segmenter.segment(value), (part) => part.segment);
  }

  return Array.from(value);
}

export function buildStreamingDiffPlan(previousText: string, nextText: string): StreamingDiffPlan {
  const previous = splitGraphemes(previousText);
  const next = splitGraphemes(nextText);
  let prefixLength = 0;

  while (
    prefixLength < previous.length &&
    prefixLength < next.length &&
    previous[prefixLength] === next[prefixLength]
  ) {
    prefixLength += 1;
  }

  const stablePrefix = previous.slice(0, prefixLength).join('');
  const removedSuffix = previous.slice(prefixLength).join('');
  const insertedSuffix = next.slice(prefixLength).join('');

  return {
    stablePrefix,
    removedSuffix,
    insertedSuffix,
    isRevision: removedSuffix.length > 0,
  };
}
