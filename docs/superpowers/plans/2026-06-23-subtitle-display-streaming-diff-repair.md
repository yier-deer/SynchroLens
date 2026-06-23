# Subtitle Display Streaming Diff Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not use subagents, delegation, or parallel agents for this project unless the user explicitly changes that rule.

**Goal:** Make the floating subtitle window display one active sentence at a time, reveal newly recognized text character-by-character, and visually repair the active sentence when later STT partials revise earlier text.

**Architecture:** Keep the existing STT/translation IPC contracts unchanged for this phase. Add a renderer-only streaming display layer that consumes the existing `STTResult.text` whole-text partials, computes display diffs, animates appended graphemes, and briefly marks revised suffixes before settling to the latest text. The final STT/translation/note/enhancement chain stays untouched.

**Tech Stack:** Electron renderer, React 18, TypeScript, Jest, React Testing Library, existing `stt:partial`, `stt:sentence`, `translate:partial`, and `translate:final` events.

---

## Hard Boundaries

- Single agent only. Do not start subagents, delegate, or use parallel agent workflows.
- Do not reset, stash, checkout, rebase, or revert unrelated existing changes.
- Do not change the backend STT provider model in this A-phase.
- Do not parse RTASR token metadata, `seg_id`, `ls`, or provider revision fields in this phase. That is reserved for B.
- Do not make translation requests more frequent, change the 650 ms partial translation debounce, or add translation rollback in this phase. That is reserved for C.
- Do not modify notes, history persistence, knowledge retrieval, correction, recommendation, summary, or final translation sidecars.
- Do not change IPC channel names or shared `STTResult` / `TranslatePartialPayload` shapes.
- Do not store secrets, credentials, raw audio, or raw full provider payloads in tests/docs/logs.

## Current Context

Read these files first:

- `E:\Trae\CONTEXT\context-20260623-1042.md`
- `E:\Trae\CONTEXT\context-20260623-1417.md`
- `src\renderer\components\SubtitleOverlay\SubtitleOverlay.tsx`
- `src\renderer\hooks\useSession.ts`
- `src\shared\types.ts`
- `Test\renderer\windows\subtitle\SubtitleOverlay.test.tsx`
- `Test\renderer\hooks\useSession.test.ts`

Current behavior:

- `useSession` stores one `currentTranscript` and replaces it wholesale on every `stt:partial`.
- On `stt:sentence`, `useSession` clears `currentTranscript` and appends the final result to `confirmedTranscripts`.
- `SubtitleOverlay` renders `currentTranscript.text` as one static block and renders several confirmed history lines below it.
- Translation partials are independent and currently render whenever `currentTranslation` exists.

Target A-phase behavior:

- The floating subtitle overlay shows one active source sentence, not a stack of historical source sentences.
- New text appears progressively by grapheme/character.
- If a later partial changes earlier text in the active sentence, the changed suffix is briefly shown as repaired/replaced and then the latest text becomes the normal display.
- A final sentence remains visible as the current line until the next partial starts, then the overlay switches to the new sentence.
- Confirmed transcript history remains available in renderer state for other windows/features; it is just not rendered as a multi-line history stack in the floating subtitle overlay.

## File Structure

Create:

- `src\renderer\components\SubtitleOverlay\streamingText.ts`
  - Pure functions for grapheme splitting and diff planning.
- `src\renderer\components\SubtitleOverlay\useStreamingSubtitleText.ts`
  - React hook that turns incoming whole-text transcript updates into animated display segments.
- `Test\renderer\components\SubtitleOverlay\streamingText.test.ts`
  - Unit tests for grapheme splitting and text-diff repair planning.
- `Test\renderer\components\SubtitleOverlay\useStreamingSubtitleText.test.tsx`
  - Hook tests using fake timers.

Modify:

- `src\renderer\components\SubtitleOverlay\SubtitleOverlay.tsx`
  - Render one active sentence using streaming segments and repair styles.
- `src\renderer\hooks\useSession.ts`
  - Clear stale `currentTranslation` when a new source sentence starts or a partial translation belongs to an older sentence.
- `Test\renderer\windows\subtitle\SubtitleOverlay.test.tsx`
  - Update component tests for one-sentence display and repair rendering.
- `Test\renderer\hooks\useSession.test.ts`
  - Add stale translation guard tests.
- `E:\Trae\CONTEXT\context-20260623-1417.md`
  - Update execution status and evidence.

Do not modify:

- `src/main/modules/stt/XfyunRtasrClient.ts`
- `src/main/modules/session/SessionManager.ts`
- `src/shared/types.ts`
- `src/shared/ipcChannels.ts`
- translation gateway or NMT/TMT modules

## Display Model

Use these renderer-local types in `streamingText.ts`:

```ts
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
```

Definitions:

- `stable`: already accepted display text for the active sentence.
- `typing`: newly revealed latest text.
- `repair`: obsolete suffix from the previous display that is briefly marked as replaced.

Diff rule:

- Split strings into graphemes.
- Compute the longest common prefix between previous displayed text and next target text.
- `removedSuffix = previous.slice(prefixLength)`.
- `insertedSuffix = next.slice(prefixLength)`.
- `isRevision = removedSuffix.length > 0`.

This deliberately avoids common-suffix patching because live ASR revisions usually revise the active suffix. B-phase token metadata can later replace this heuristic with provider-stable token flags.

## Task 1: Add Pure Streaming Diff Helpers

**Files:**
- Create: `src\renderer\components\SubtitleOverlay\streamingText.ts`
- Test: `Test\renderer\components\SubtitleOverlay\streamingText.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `Test/renderer/components/SubtitleOverlay/streamingText.test.ts`:

```ts
import {
  buildStreamingDiffPlan,
  splitGraphemes,
} from '../../../../src/renderer/components/SubtitleOverlay/streamingText';

describe('streamingText', () => {
  it('splits CJK and Latin text into display graphemes', () => {
    expect(splitGraphemes('浣犲ソHi')).toEqual(['浣?, '濂?, 'H', 'i']);
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
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm.cmd test -- Test/renderer/components/SubtitleOverlay/streamingText.test.ts --runInBand
```

Expected: FAIL because `streamingText.ts` does not exist.

- [ ] **Step 3: Implement the minimal helper**

Create `src/renderer/components/SubtitleOverlay/streamingText.ts`:

```ts
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

export function splitGraphemes(value: string): string[] {
  const SegmenterCtor = Intl.Segmenter;
  if (typeof SegmenterCtor === 'function') {
    const segmenter = new SegmenterCtor(undefined, { granularity: 'grapheme' });
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
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```powershell
npm.cmd test -- Test/renderer/components/SubtitleOverlay/streamingText.test.ts --runInBand
```

Expected: PASS.

## Task 2: Add Streaming Subtitle Hook

**Files:**
- Create: `src\renderer\components\SubtitleOverlay\useStreamingSubtitleText.ts`
- Test: `Test\renderer\components\SubtitleOverlay\useStreamingSubtitleText.test.tsx`

- [ ] **Step 1: Write the failing hook tests**

Create `Test/renderer/components/SubtitleOverlay/useStreamingSubtitleText.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run hook tests to verify RED**

Run:

```powershell
npm.cmd test -- Test/renderer/components/SubtitleOverlay/useStreamingSubtitleText.test.tsx --runInBand
```

Expected: FAIL because `useStreamingSubtitleText.ts` does not exist.

- [ ] **Step 3: Implement the hook**

Create `src/renderer/components/SubtitleOverlay/useStreamingSubtitleText.ts`:

```ts
import { useEffect, useMemo, useRef, useState } from 'react';
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

function joinParts(parts: StreamingTextPart[]): string {
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

  const clearTimers = () => {
    for (const timer of timersRef.current) {
      clearTimeout(timer);
    }
    timersRef.current = [];
  };

  const scheduleTyping = (baseText: string, suffix: string) => {
    const graphemes = splitGraphemes(suffix);
    if (graphemes.length === 0) {
      displayedTextRef.current = baseText;
      setState((prev) => ({
        ...prev,
        text: baseText,
        parts: stable(baseText),
        isRepairing: false,
      }));
      return;
    }

    graphemes.forEach((_, index) => {
      const timer = setTimeout(() => {
        const nextText = baseText + graphemes.slice(0, index + 1).join('');
        displayedTextRef.current = nextText;
        setState((prev) => ({
          ...prev,
          text: nextText,
          parts: stable(nextText),
          isRepairing: false,
        }));
      }, tickMs * (index + 1));
      timersRef.current.push(timer);
    });
  };

  useEffect(() => {
    clearTimers();

    if (!sentenceId || !target) {
      displayedTextRef.current = '';
      sentenceIdRef.current = sentenceId;
      setState({ sentenceId, text: '', parts: [], isRepairing: false });
      return clearTimers;
    }

    const isNewSentence = sentenceIdRef.current !== sentenceId;
    sentenceIdRef.current = sentenceId;

    if (isNewSentence) {
      displayedTextRef.current = '';
      setState({ sentenceId, text: '', parts: [], isRepairing: false });
      scheduleTyping('', target);
      return clearTimers;
    }

    const previousText = displayedTextRef.current;
    if (previousText === target) {
      setState({ sentenceId, text: target, parts: stable(target), isRepairing: false });
      return clearTimers;
    }

    const plan = buildStreamingDiffPlan(previousText, target);

    if (plan.isRevision) {
      const repairParts: StreamingTextPart[] = [
        ...stable(plan.stablePrefix),
        { kind: 'repair', text: plan.removedSuffix },
      ];
      setState({
        sentenceId,
        text: joinParts(repairParts),
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
        scheduleTyping(plan.stablePrefix, plan.insertedSuffix);
      }, repairHoldMs);
      timersRef.current.push(timer);
      return clearTimers;
    }

    scheduleTyping(plan.stablePrefix, plan.insertedSuffix);
    return clearTimers;
  }, [sentenceId, target, tickMs, repairHoldMs]);

  return useMemo(() => state, [state]);
}
```

If TypeScript complains about `Intl.Segmenter`, add the minimal type guard in `streamingText.ts` instead of weakening compiler settings. Do not edit `tsconfig` for this.

- [ ] **Step 4: Run hook tests to verify GREEN**

Run:

```powershell
npm.cmd test -- Test/renderer/components/SubtitleOverlay/useStreamingSubtitleText.test.tsx --runInBand
```

Expected: PASS.

## Task 3: Render One Active Sentence In SubtitleOverlay

**Files:**
- Modify: `src\renderer\components\SubtitleOverlay\SubtitleOverlay.tsx`
- Test: `Test\renderer\windows\subtitle\SubtitleOverlay.test.tsx`

- [ ] **Step 1: Write failing component tests**

Modify `Test/renderer/windows/subtitle/SubtitleOverlay.test.tsx`.

Add this test:

```tsx
it('renders the latest confirmed sentence as the active sentence when no partial is active', () => {
  render(
    <SubtitleOverlay
      currentTranscript={null}
      confirmedTranscripts={[makeResult('s1', 'First'), makeResult('s2', 'Second')]}
      sessionState="listening"
    />,
  );

  expect(screen.queryByText('First')).toBeNull();
  expect(screen.getByText('Second')).toBeDefined();
});
```

Replace the old "shows only the latest visible transcript history" expectation with:

```tsx
it('does not render a multi-sentence history stack in the floating subtitle', () => {
  const confirmed = Array.from({ length: 12 }, (_, index) =>
    makeResult(`s${index}`, `Sentence ${index}`),
  );

  render(
    <SubtitleOverlay
      currentTranscript={null}
      confirmedTranscripts={confirmed}
      sessionState="listening"
    />,
  );

  expect(screen.queryByText('Sentence 10')).toBeNull();
  expect(screen.getByText('Sentence 11')).toBeDefined();
});
```

Add a current-over-final test:

```tsx
it('prefers the current partial over the latest confirmed sentence', () => {
  render(
    <SubtitleOverlay
      currentTranscript={makeResult('current', 'Now typing', false)}
      confirmedTranscripts={[makeResult('old', 'Before')]}
      sessionState="recognizing"
    />,
  );

  expect(screen.getByText('Now typing')).toBeDefined();
  expect(screen.queryByText('Before')).toBeNull();
});
```

- [ ] **Step 2: Run component tests to verify RED**

Run:

```powershell
npm.cmd test -- Test/renderer/windows/subtitle/SubtitleOverlay.test.tsx --runInBand
```

Expected: FAIL because the component still renders history.

- [ ] **Step 3: Update SubtitleOverlay rendering**

In `src/renderer/components/SubtitleOverlay/SubtitleOverlay.tsx`:

1. Import the hook:

```ts
import { useStreamingSubtitleText } from './useStreamingSubtitleText';
```

2. Remove `UI_CONSTANTS.MAX_VISIBLE_SENTENCES` usage from this component.

3. Compute active transcript:

```ts
const latestConfirmedTranscript = confirmedTranscripts[confirmedTranscripts.length - 1] ?? null;
const activeTranscript = currentTranscript ?? latestConfirmedTranscript;
const streaming = useStreamingSubtitleText(activeTranscript);
```

4. Filter translation to the active sentence:

```ts
const activeSentenceId = activeTranscript?.sentenceId ?? null;
const activeConfirmedTranslation = activeSentenceId
  ? confirmedTranslations.find((item) => item.sentenceId === activeSentenceId) ?? null
  : null;
const activeTranslation =
  currentTranslation?.sentenceId === activeSentenceId
    ? currentTranslation
    : activeConfirmedTranslation;
```

5. Render only `streaming.parts`, not historical transcript rows:

```tsx
{streaming.parts.length > 0 ? (
  <div style={STYLE.currentOriginal} data-testid="subtitle-active-source">
    {streaming.parts.map((part, index) => (
      <span
        key={`${part.kind}-${index}-${part.text}`}
        data-repair={part.kind === 'repair' ? 'true' : undefined}
        style={part.kind === 'repair' ? STYLE.repairText : part.kind === 'typing' ? STYLE.typingText : undefined}
      >
        {part.text}
      </span>
    ))}
  </div>
) : null}
```

6. Render the active translation only:

```tsx
{activeTranslation?.error ? (
  <div style={STYLE.errorText}>Translation failed: {activeTranslation.error}</div>
) : activeTranslation?.translation ? (
  <div style={STYLE.currentTranslation}>{activeTranslation.translation}</div>
) : null}
```

7. Add styles:

```ts
typingText: {
  color: '#ffffff',
},
repairText: {
  color: '#fca5a5',
  textDecoration: 'line-through',
  opacity: 0.85,
},
```

Keep the state label and drag handle. Do not add visible instructional text.

- [ ] **Step 4: Make tests deterministic**

For component tests that expect the full sentence immediately, either:

- use fake timers and advance enough time, or
- mock `useStreamingSubtitleText` at the top of `SubtitleOverlay.test.tsx`:

```ts
jest.mock('../../../../src/renderer/components/SubtitleOverlay/useStreamingSubtitleText', () => ({
  useStreamingSubtitleText: (transcript: { sentenceId: string; text: string } | null) => ({
    sentenceId: transcript?.sentenceId ?? null,
    text: transcript?.text ?? '',
    parts: transcript?.text ? [{ kind: 'stable', text: transcript.text }] : [],
    isRepairing: false,
  }),
}));
```

Use the mock for component layout tests; keep real animation behavior covered in `useStreamingSubtitleText.test.tsx`.

- [ ] **Step 5: Run component tests to verify GREEN**

Run:

```powershell
npm.cmd test -- Test/renderer/windows/subtitle/SubtitleOverlay.test.tsx --runInBand
```

Expected: PASS.

## Task 4: Prevent Stale Partial Translation Display

**Files:**
- Modify: `src\renderer\hooks\useSession.ts`
- Test: `Test\renderer\hooks\useSession.test.ts`

- [ ] **Step 1: Add failing stale-translation tests**

Add to `Test/renderer/hooks/useSession.test.ts`:

```ts
it('clears current translation when a new STT sentence starts', () => {
  const { result } = renderHook(() => {
    const { useSession } = require('../../../src/renderer/hooks/useSession');
    return useSession({ ipc: mockIpc });
  });

  act(() => {
    getListener(mockIpc, IPC_CHANNELS.STT_PARTIAL)?.({
      sentenceId: 's1',
      text: 'first',
      isFinal: false,
      timestamp: 1,
    });
    getListener(mockIpc, IPC_CHANNELS.TRANSLATE_PARTIAL)?.({
      sentenceId: 's1',
      original: 'first',
      translation: '绗竴鍙?,
    });
  });

  expect(result.current.currentTranslation?.sentenceId).toBe('s1');

  act(() => {
    getListener(mockIpc, IPC_CHANNELS.STT_PARTIAL)?.({
      sentenceId: 's2',
      text: 'second',
      isFinal: false,
      timestamp: 2,
    });
  });

  expect(result.current.currentTranscript?.sentenceId).toBe('s2');
  expect(result.current.currentTranslation).toBeNull();
});

it('ignores partial translation events for an older active sentence', () => {
  const { result } = renderHook(() => {
    const { useSession } = require('../../../src/renderer/hooks/useSession');
    return useSession({ ipc: mockIpc });
  });

  act(() => {
    getListener(mockIpc, IPC_CHANNELS.STT_PARTIAL)?.({
      sentenceId: 's2',
      text: 'second',
      isFinal: false,
      timestamp: 2,
    });
    getListener(mockIpc, IPC_CHANNELS.TRANSLATE_PARTIAL)?.({
      sentenceId: 's1',
      original: 'first',
      translation: '绗竴鍙?,
    });
  });

  expect(result.current.currentTranslation).toBeNull();
});
```

- [ ] **Step 2: Run hook tests to verify RED**

Run:

```powershell
npm.cmd test -- Test/renderer/hooks/useSession.test.ts --runInBand
```

Expected: FAIL because stale partial translations are currently accepted globally.

- [ ] **Step 3: Update `useSession`**

In `src/renderer/hooks/useSession.ts`, add a ref for the active transcript sentence id:

```ts
const activeTranscriptSentenceId = useRef<string | null>(null);
```

In the `STT_PARTIAL` handler:

```ts
if (isSTTResult(data)) {
  setCurrentTranscript(data);
  if (activeTranscriptSentenceId.current !== data.sentenceId) {
    activeTranscriptSentenceId.current = data.sentenceId;
    setCurrentTranslation(null);
  }
}
```

In the `STT_SENTENCE` handler:

```ts
if (isSTTResult(data)) {
  activeTranscriptSentenceId.current = data.sentenceId;
  setCurrentTranscript(null);
  setConfirmedTranscripts((prev) => [...prev, data]);
  setLatestTranscript(data);
}
```

In the `TRANSLATE_PARTIAL` handler:

```ts
if (isTranslatePartialPayload(data)) {
  if (
    activeTranscriptSentenceId.current &&
    data.sentenceId !== activeTranscriptSentenceId.current
  ) {
    return;
  }
  setCurrentTranslation(data);
}
```

In `resetTranscriptState`, clear the ref:

```ts
activeTranscriptSentenceId.current = null;
```

Do not change `TRANSLATE_FINAL`; final translations should still append to confirmed translations.

- [ ] **Step 4: Run hook tests to verify GREEN**

Run:

```powershell
npm.cmd test -- Test/renderer/hooks/useSession.test.ts --runInBand
```

Expected: PASS.

## Task 5: Polish Floating Subtitle Layout For One-Sentence Display

**Files:**
- Modify: `src\renderer\components\SubtitleOverlay\SubtitleOverlay.tsx`
- Test: `Test\renderer\windows\subtitle\SubtitleOverlay.test.tsx`

- [ ] **Step 1: Add layout assertions**

Add to `SubtitleOverlay.test.tsx`:

```tsx
it('marks repaired text with a repair data attribute', () => {
  const { container } = render(
    <SubtitleOverlay
      currentTranscript={makeResult('current', 'Now', false)}
      confirmedTranscripts={[]}
      sessionState="recognizing"
    />,
  );

  const source = screen.getByTestId('subtitle-active-source');
  expect(source).toBeDefined();
  expect(container.querySelector('[data-repair="true"]')).toBeNull();
});
```

This test mainly guards stable DOM shape. Repair behavior itself is covered by the hook tests.

- [ ] **Step 2: Run component tests**

Run:

```powershell
npm.cmd test -- Test/renderer/windows/subtitle/SubtitleOverlay.test.tsx --runInBand
```

Expected: PASS after Task 3. If it fails, fix only the DOM/styling needed for the one-sentence display.

- [ ] **Step 3: Apply restrained layout changes**

Use these style constraints in `SubtitleOverlay.tsx`:

```ts
shell: {
  padding: '12px 20px 16px',
  background: 'rgba(0, 0, 0, 0.42)',
  borderRadius: '12px',
  width: 'min(820px, calc(100vw - 32px))',
  minHeight: '72px',
  color: '#ffffff',
},
currentOriginal: {
  fontSize: '24px',
  fontWeight: 600,
  lineHeight: '1.45',
  overflowWrap: 'anywhere',
},
currentTranslation: {
  marginTop: '6px',
  fontSize: '18px',
  lineHeight: '1.4',
  color: '#93c5fd',
  overflowWrap: 'anywhere',
},
```

Keep the existing visual tone. Do not add cards, helper text, decorative gradients, or extra controls.

- [ ] **Step 4: Run focused component tests again**

Run:

```powershell
npm.cmd test -- Test/renderer/windows/subtitle/SubtitleOverlay.test.tsx --runInBand
```

Expected: PASS.

## Task 6: Focused Integration Verification

**Files:**
- Test only unless a regression is found.

- [ ] **Step 1: Run all renderer tests touched by this plan**

Run:

```powershell
npm.cmd test -- Test/renderer/components/SubtitleOverlay/streamingText.test.ts Test/renderer/components/SubtitleOverlay/useStreamingSubtitleText.test.tsx Test/renderer/windows/subtitle/SubtitleOverlay.test.tsx Test/renderer/hooks/useSession.test.ts --runInBand
```

Expected: all pass.

- [ ] **Step 2: Run shared affected window tests**

Run:

```powershell
npm.cmd test -- Test/renderer/windows/main/MainWindow.test.tsx Test/renderer/windows/subtitle/SubtitleOverlay.test.tsx Test/renderer/windows/control/ControlWindow.test.tsx --runInBand
```

Expected: all pass. If `ControlWindow.test.tsx` does not exist in this checkout, omit that file and record that it was not present.

- [ ] **Step 3: Run typecheck**

Run:

```powershell
npm.cmd run typecheck
```

Expected: no TypeScript errors.

## Task 7: Full Regression Verification

**Files:**
- Test only unless a regression is found.

- [ ] **Step 1: Run full Jest**

Run:

```powershell
npm.cmd test -- --runInBand
```

Expected: all suites pass. If unrelated existing failures appear, record the exact failing suites, first failing assertion, and why they are unrelated.

- [ ] **Step 2: Run build**

Run:

```powershell
npm.cmd run build
```

Expected: build succeeds.

- [ ] **Step 3: Optional visual smoke**

If a local UI session is available:

```powershell
npm.cmd run build
npm.cmd run preview
```

Manual smoke:

1. Start a system-audio session.
2. Speak or play a sentence where partials extend normally, for example `I love watching movies`.
3. Confirm the floating subtitle reveals the active sentence progressively.
4. Speak or play wording likely to be revised by ASR, or simulate partials in tests/log playback if live ASR does not revise naturally.
5. Confirm a revised suffix briefly marks as repaired and settles to the newest text.
6. Confirm only one active source sentence is visible in the floating subtitle.
7. Confirm final translation/notes still occur as before.

Do not copy credentials or raw provider payloads into the report.

## Task 8: Update Handoff Context

**Files:**
- Modify: `E:\Trae\CONTEXT\context-20260623-1417.md`

- [ ] **Step 1: Update status**

Append concise execution evidence:

```md
## Current Status

A-phase display-layer streaming subtitle plan was executed.

Implemented:

- Renderer-only streaming display helper and hook.
- One active sentence display in floating subtitle overlay.
- Grapheme-by-grapheme reveal for new text.
- Brief repair marking for revised suffixes.
- Stale partial translation guard by active sentence id.

Verification:

- `<command>` -> `<result>`
```

- [ ] **Step 2: Record risks**

Keep these risks if still true:

```md
## Open Questions / Risks

- A-phase is heuristic and uses whole-text partial diffs; true provider-stable token repair is deferred to B.
- Translation-side streaming repair is deferred to C.
- Live RTASR revisions may be rare in a short smoke; automated hook tests cover the revision behavior deterministically.
```

## Acceptance Criteria

- Floating subtitle overlay renders one active source sentence, not a history stack.
- Existing `confirmedTranscripts` state remains intact for other features.
- New current sentence text reveals progressively.
- Same-sentence partial extension continues typing from the displayed prefix.
- Same-sentence partial revision briefly marks the old suffix as repaired and settles to the new text.
- New `sentenceId` resets the display and starts typing the new sentence.
- Partial translation display is filtered to the active sentence id to avoid stale subtitle/translation mismatch.
- No backend STT, SessionManager, TranslationGateway, NMT/TMT, notes, knowledge, correction, recommendation, or summary behavior is changed.
- Focused Jest, full Jest, typecheck, and build either pass or have documented unrelated failures.

## B And C Extension Notes

B-phase can replace the heuristic `buildStreamingDiffPlan(previousText, nextText)` source with token metadata once RTASR parsing exposes:

- token text,
- token index/order,
- segment id,
- stable/final flags,
- revision/delete/replace semantics,
- `ls` or equivalent final segment marker.

C-phase should not reuse the display typing timer to drive translation requests. It needs a separate cancellable translation scheduler with request coalescing, stale response rejection, and UI rules for provisional vs final translated text.

## Copy-Paste Prompt For Execution AI

You are taking over the existing SynchroLens-new checkout.

Expected local path on this machine:

- `E:\Trae\Project\七牛云\SynchroLens-new`

Read first:

- `E:\Trae\CONTEXT\context-20260623-1042.md`
- `E:\Trae\CONTEXT\context-20260623-1417.md`
- `docs\superpowers\plans\2026-06-23-subtitle-display-streaming-diff-repair.md`

Hard rules:

- Single agent only. Do not use subagents, delegation, or parallel agents.
- Do not reset, stash, checkout, rebase, or revert unrelated existing changes.
- Implement only A: display-layer character streaming plus diff repair.
- Do not implement B token-level RTASR parsing.
- Do not implement C translation-side streaming repair.
- Do not change backend IPC payloads or main-process STT/translation modules.
- Preserve final-only sidecars: notes, knowledge retrieval, correction, recommendation, and summary.
- Do not copy secrets into code, docs, logs, tests, or reports.

Goal:

Make the floating subtitle window display one active sentence at a time, reveal text character-by-character from existing STT partials, and briefly repair changed suffixes when later partials revise the active sentence.

Execute this plan task by task with TDD:

1. Add pure streaming diff helpers.
2. Add `useStreamingSubtitleText`.
3. Render one active sentence in `SubtitleOverlay`.
4. Prevent stale partial translation display by active sentence id.
5. Polish floating subtitle layout for one-sentence display.
6. Run focused integration verification.
7. Run full regression verification.
8. Update `E:\Trae\CONTEXT\context-20260623-1417.md`.

Required verification:

```powershell
cd E:\Trae\Project\七牛云\SynchroLens-new
npm.cmd test -- Test/renderer/components/SubtitleOverlay/streamingText.test.ts Test/renderer/components/SubtitleOverlay/useStreamingSubtitleText.test.tsx Test/renderer/windows/subtitle/SubtitleOverlay.test.tsx Test/renderer/hooks/useSession.test.ts --runInBand
npm.cmd run typecheck
npm.cmd test -- --runInBand
npm.cmd run build
```

Report with:

- Blocking Findings
- Non-Blocking Findings
- Changes Made
- Command Results
- Manual Visual Smoke Evidence
- Boundary Confirmation
- Decision: Ready / Not Ready

