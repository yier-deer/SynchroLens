import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { STTResult } from '../../../shared/types';
import {
  buildStreamingDiffPlan,
  splitGraphemes,
  type StreamingTextPart,
} from './streamingText';

interface StreamingOptions {
  tickMs?: number;
  repairHoldMs?: number;
}

interface StreamingState {
  sentenceId: string | null;
  text: string;
  parts: StreamingTextPart[];
  isRepairing: boolean;
}

const DEFAULT_TICK_MS = 24;
const DEFAULT_REPAIR_HOLD_MS = 260;

function stable(text: string): StreamingTextPart[] {
  return text ? [{ kind: 'stable', text }] : [];
}

function visibleText(parts: StreamingTextPart[]): string {
  return parts
    .filter((part) => part.kind !== 'repair')
    .map((part) => part.text)
    .join('');
}

export function useStreamingSubtitleText(
  transcript: STTResult | null,
  options: StreamingOptions = {},
): StreamingState {
  const tickMs = options.tickMs ?? DEFAULT_TICK_MS;
  const repairHoldMs = options.repairHoldMs ?? DEFAULT_REPAIR_HOLD_MS;
  const [state, setState] = useState<StreamingState>({
    sentenceId: null,
    text: '',
    parts: [],
    isRepairing: false,
  });
  const displayedTextRef = useRef('');
  const sentenceIdRef = useRef<string | null>(null);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const target = transcript?.text.trim() ?? '';
  const sentenceId = transcript?.sentenceId ?? null;

  const clearTimers = useCallback(() => {
    for (const timer of timersRef.current) {
      clearTimeout(timer);
    }
    timersRef.current = [];
  }, []);

  const setStableText = useCallback((nextSentenceId: string | null, text: string) => {
    displayedTextRef.current = text;
    setState({
      sentenceId: nextSentenceId,
      text,
      parts: stable(text),
      isRepairing: false,
    });
  }, []);

  const scheduleTyping = useCallback(
    (nextSentenceId: string, baseText: string, suffix: string) => {
      const graphemes = splitGraphemes(suffix);

      if (graphemes.length === 0) {
        setStableText(nextSentenceId, baseText);
        return;
      }

      graphemes.forEach((_, index) => {
        const timer = setTimeout(() => {
          const typedSuffix = graphemes.slice(0, index + 1).join('');
          const nextText = baseText + typedSuffix;
          const isComplete = index === graphemes.length - 1;
          const parts: StreamingTextPart[] = isComplete
            ? stable(nextText)
            : ([
                ...stable(baseText),
                { kind: 'typing', text: typedSuffix },
              ] as StreamingTextPart[]).filter((part) => part.text);

          displayedTextRef.current = nextText;
          setState({
            sentenceId: nextSentenceId,
            text: nextText,
            parts,
            isRepairing: false,
          });
        }, tickMs * (index + 1));
        timersRef.current.push(timer);
      });
    },
    [setStableText, tickMs],
  );

  useEffect(() => {
    clearTimers();

    if (!sentenceId || !target) {
      sentenceIdRef.current = sentenceId;
      setStableText(sentenceId, '');
      return clearTimers;
    }

    const isNewSentence = sentenceIdRef.current !== sentenceId;
    sentenceIdRef.current = sentenceId;

    if (isNewSentence) {
      displayedTextRef.current = '';
      setState({ sentenceId, text: '', parts: [], isRepairing: false });
      scheduleTyping(sentenceId, '', target);
      return clearTimers;
    }

    const previousText = displayedTextRef.current;
    if (previousText === target) {
      setStableText(sentenceId, target);
      return clearTimers;
    }

    const plan = buildStreamingDiffPlan(previousText, target);

    if (plan.isRevision) {
      const repairParts: StreamingTextPart[] = ([
        ...stable(plan.stablePrefix),
        { kind: 'repair', text: plan.removedSuffix },
      ] as StreamingTextPart[]).filter((part) => part.text);

      setState({
        sentenceId,
        text: visibleText(repairParts),
        parts: repairParts,
        isRepairing: true,
      });

      const timer = setTimeout(() => {
        displayedTextRef.current = plan.stablePrefix;
        setState({
          sentenceId,
          text: plan.stablePrefix,
          parts: stable(plan.stablePrefix),
          isRepairing: false,
        });
        scheduleTyping(sentenceId, plan.stablePrefix, plan.insertedSuffix);
      }, repairHoldMs);
      timersRef.current.push(timer);
      return clearTimers;
    }

    scheduleTyping(sentenceId, plan.stablePrefix, plan.insertedSuffix);
    return clearTimers;
  }, [clearTimers, repairHoldMs, scheduleTyping, sentenceId, setStableText, target]);

  return useMemo(() => state, [state]);
}
