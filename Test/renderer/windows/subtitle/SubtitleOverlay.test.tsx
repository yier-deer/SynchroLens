/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { SubtitleOverlay } from '../../../../src/renderer/components/SubtitleOverlay/SubtitleOverlay';
import type { STTResult } from '../../../../src/shared/types';

jest.mock('../../../../src/renderer/components/SubtitleOverlay/useStreamingSubtitleText', () => ({
  useStreamingSubtitleText: (transcript: { sentenceId: string; text: string } | null) => ({
    sentenceId: transcript?.sentenceId ?? null,
    text: transcript?.text ?? '',
    parts: transcript?.text ? [{ kind: 'stable', text: transcript.text }] : [],
    isRepairing: false,
  }),
}));

function makeResult(sentenceId: string, text: string, isFinal = true): STTResult {
  return { sentenceId, text, isFinal, timestamp: Date.now() };
}

describe('SubtitleOverlay', () => {
  it('renders an empty container without transcript data', () => {
    const { container } = render(
      <SubtitleOverlay currentTranscript={null} confirmedTranscripts={[]} sessionState="idle" />,
    );

    expect(container.firstChild).toBeTruthy();
  });

  it('renders current partial transcript', () => {
    render(
      <SubtitleOverlay
        currentTranscript={makeResult('s1', 'Hello World', false)}
        confirmedTranscripts={[]}
        sessionState="recognizing"
      />,
    );

    expect(screen.getByText('Hello World')).toBeDefined();
  });

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

  it('marks stable active source text without a repair data attribute', () => {
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

  it('keeps long source text and translation in bounded visible regions', () => {
    const longText = Array.from({ length: 40 }, (_, index) => `word${index}`).join(' ');
    render(
      <SubtitleOverlay
        currentTranscript={makeResult('current', longText, false)}
        confirmedTranscripts={[]}
        currentTranslation={{
          sentenceId: 'current',
          original: longText,
          translation: '这是一段应该完整显示的中文翻译，不应该只剩半行。',
        }}
        sessionState="recognizing"
      />,
    );

    const shell = screen.getByTestId('subtitle-shell');
    const source = screen.getByTestId('subtitle-active-source');
    const translation = screen.getByTestId('subtitle-active-translation');

    expect(shell.style.maxHeight).toBe('260px');
    expect(source.style.maxHeight).toBe('126px');
    expect(source.style.overflowY).toBe('hidden');
    expect(translation.style.maxHeight).toBe('76px');
    expect(translation.style.overflowY).toBe('hidden');
  });

  it('shows state label from main-process session state', () => {
    render(
      <SubtitleOverlay
        currentTranscript={null}
        confirmedTranscripts={[]}
        sessionState="reconnecting"
      />,
    );

    expect(screen.getByText('重连中')).toBeDefined();
  });
});
