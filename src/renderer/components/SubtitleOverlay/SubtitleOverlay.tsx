import type { SessionState, STTResult, TranslatePartialPayload, TranslationResult } from '@shared/types';
import { useStreamingSubtitleText } from './useStreamingSubtitleText';

const STYLE = {
  shell: {
    padding: '12px 20px 16px',
    background: 'rgba(0, 0, 0, 0.42)',
    borderRadius: '12px',
    width: 'min(820px, calc(100vw - 32px))',
    minHeight: '72px',
    maxHeight: '260px',
    color: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
  },
  handle: {
    width: '100%',
    height: '18px',
    WebkitAppRegion: 'drag' as const,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: '36px',
    height: '4px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.25)',
  },
  state: {
    fontSize: '12px',
    color: '#d1d5db',
    marginBottom: '8px',
  },
  currentOriginal: {
    fontSize: '24px',
    fontWeight: 600,
    lineHeight: '1.45',
    overflowWrap: 'anywhere' as const,
    maxHeight: '126px',
    overflowY: 'hidden' as const,
  },
  currentTranslation: {
    marginTop: '6px',
    fontSize: '18px',
    lineHeight: '1.4',
    color: '#93c5fd',
    overflowWrap: 'anywhere' as const,
    maxHeight: '76px',
    overflowY: 'hidden' as const,
  },
  errorText: {
    fontSize: '14px',
    lineHeight: '1.35',
    color: '#fca5a5',
  },
  typingText: {
    color: '#ffffff',
  },
  repairText: {
    color: '#fca5a5',
    textDecoration: 'line-through',
    opacity: 0.85,
  },
} as const;

const STATE_LABELS: Record<SessionState, string> = {
  idle: '\u5f85\u673a\u4e2d',
  running: '\u8fd0\u884c\u4e2d',
  listening: '\u76d1\u542c\u4e2d',
  recognizing: '\u8bc6\u522b\u4e2d',
  reconnecting: '\u91cd\u8fde\u4e2d',
  paused: '\u5df2\u6682\u505c',
  stopped: '\u5df2\u505c\u6b62',
  error: '\u8bc6\u522b\u5f02\u5e38',
};

interface SubtitleOverlayProps {
  currentTranscript: STTResult | null;
  confirmedTranscripts: STTResult[];
  currentTranslation?: TranslatePartialPayload | null;
  confirmedTranslations?: TranslationResult[];
  sessionState: SessionState;
}

function getTranslationError(
  translation: TranslatePartialPayload | TranslationResult | null,
): string | undefined {
  return translation && 'error' in translation ? translation.error : undefined;
}

export function SubtitleOverlay({
  currentTranscript,
  confirmedTranscripts,
  currentTranslation = null,
  confirmedTranslations = [],
  sessionState,
}: SubtitleOverlayProps) {
  const latestConfirmedTranscript = confirmedTranscripts[confirmedTranscripts.length - 1] ?? null;
  const activeTranscript = currentTranscript ?? latestConfirmedTranscript;
  const streaming = useStreamingSubtitleText(activeTranscript);
  const activeSentenceId = activeTranscript?.sentenceId ?? null;
  const activeConfirmedTranslation = activeSentenceId
    ? confirmedTranslations.find((item) => item.sentenceId === activeSentenceId) ?? null
    : null;
  const activeTranslation =
    currentTranslation?.sentenceId === activeSentenceId ? currentTranslation : activeConfirmedTranslation;
  const activeTranslationError = getTranslationError(activeTranslation);

  return (
    <div style={STYLE.shell} data-testid="subtitle-shell">
      <div style={STYLE.handle}>
        <div style={STYLE.dot} />
      </div>
      <div style={STYLE.state}>{STATE_LABELS[sessionState]}</div>
      {streaming.parts.length > 0 ? (
        <div style={STYLE.currentOriginal} data-testid="subtitle-active-source">
          {streaming.parts.map((part, index) => (
            <span
              key={`${part.kind}-${index}-${part.text}`}
              data-repair={part.kind === 'repair' ? 'true' : undefined}
              style={
                part.kind === 'repair'
                  ? STYLE.repairText
                  : part.kind === 'typing'
                    ? STYLE.typingText
                    : undefined
              }
            >
              {part.text}
            </span>
          ))}
        </div>
      ) : null}
      {activeTranslationError ? (
        <div style={STYLE.errorText}>Translation failed: {activeTranslationError}</div>
      ) : activeTranslation?.translation ? (
        <div style={STYLE.currentTranslation} data-testid="subtitle-active-translation">
          {activeTranslation.translation}
        </div>
      ) : null}
    </div>
  );
}
