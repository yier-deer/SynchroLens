/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { useStreamingSubtitleText } from '../../../../src/renderer/components/SubtitleOverlay/useStreamingSubtitleText';
import type { STTResult } from '../../../../src/shared/types';

function result(sentenceId: string, text: string, isFinal = false): STTResult {
  return { sentenceId, text, isFinal, timestamp: 1 };
}

describe('useStreamingSubtitleText', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reveals a new sentence progressively', () => {
    const { result: hook } = renderHook(
      ({ transcript }) => useStreamingSubtitleText(transcript, { tickMs: 10, repairHoldMs: 30 }),
      { initialProps: { transcript: result('s1', 'Hey') } },
    );

    expect(hook.current.text).toBe('');

    act(() => {
      jest.advanceTimersByTime(10);
    });
    expect(hook.current.text).toBe('H');

    act(() => {
      jest.advanceTimersByTime(20);
    });
    expect(hook.current.text).toBe('Hey');
  });

  it('keeps typing when a partial extends the active sentence', () => {
    const { result: hook, rerender } = renderHook(
      ({ transcript }) => useStreamingSubtitleText(transcript, { tickMs: 10, repairHoldMs: 30 }),
      { initialProps: { transcript: result('s1', 'He') } },
    );

    act(() => {
      jest.advanceTimersByTime(20);
    });
    expect(hook.current.text).toBe('He');

    rerender({ transcript: result('s1', 'Hello') });
    act(() => {
      jest.advanceTimersByTime(30);
    });

    expect(hook.current.text).toBe('Hello');
    expect(hook.current.parts).toEqual([{ kind: 'stable', text: 'Hello' }]);
  });

  it('marks a revised suffix briefly before settling to the new text', () => {
    const { result: hook, rerender } = renderHook(
      ({ transcript }) => useStreamingSubtitleText(transcript, { tickMs: 10, repairHoldMs: 30 }),
      { initialProps: { transcript: result('s1', 'I love cats') } },
    );

    act(() => {
      jest.advanceTimersByTime(110);
    });
    expect(hook.current.text).toBe('I love cats');

    rerender({ transcript: result('s1', 'I love cars') });

    expect(hook.current.parts).toContainEqual({ kind: 'repair', text: 'ts' });

    act(() => {
      jest.advanceTimersByTime(30);
    });
    act(() => {
      jest.advanceTimersByTime(20);
    });

    expect(hook.current.text).toBe('I love cars');
    expect(hook.current.isRepairing).toBe(false);
  });

  it('resets immediately when the sentence id changes', () => {
    const { result: hook, rerender } = renderHook(
      ({ transcript }) => useStreamingSubtitleText(transcript, { tickMs: 10, repairHoldMs: 30 }),
      { initialProps: { transcript: result('s1', 'First') } },
    );

    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(hook.current.text).toBe('First');

    rerender({ transcript: result('s2', 'Next') });
    expect(hook.current.text).toBe('');

    act(() => {
      jest.advanceTimersByTime(40);
    });
    expect(hook.current.text).toBe('Next');
  });
});
