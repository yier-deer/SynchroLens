/**
 * 字幕渲染组件
 * 歌词式双语字幕，支持流式显示和纠正动画
 */

import { useState, useEffect } from 'react';
import { UI_CONSTANTS } from '@shared/constants';
import type { TranslationResult } from '@shared/types';

/** 字幕行样式常量 */
const STYLE = {
  container: {
    padding: '12px 24px',
    background: `rgba(0, 0, 0, ${UI_CONSTANTS.SUBTITLE_BG_OPACITY})`,
    borderRadius: '8px',
    maxWidth: '800px',
    minHeight: '60px',
  },
  source: {
    fontSize: '14px',
    color: '#9ca3af',
    marginBottom: '4px',
    lineHeight: '1.4',
  },
  target: {
    fontSize: '22px',
    color: '#ffffff',
    fontWeight: 600,
    lineHeight: '1.4',
  },
  cursor: {
    display: 'inline-block',
    width: '2px',
    height: '1.1em',
    backgroundColor: '#60a5fa',
    marginLeft: '2px',
    animation: 'blink 1s step-end infinite',
  },
  historyItem: {
    opacity: '0.5',
    transition: `opacity ${UI_CONSTANTS.CORRECTION_ANIMATION_MS}ms ease`,
  },
  correction: {
    animation: `fadeIn ${UI_CONSTANTS.CORRECTION_ANIMATION_MS}ms ease-in`,
  },
} as const;

/** 光标闪烁动画样式 */
const cursorKeyframes = `
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

/** SubtitleOverlay 属性 */
interface SubtitleOverlayProps {
  /** 当前正在翻译的句子（流式） */
  currentTranslation: TranslationResult | null;
  /** 已确认的翻译结果列表 */
  confirmedTranslations: TranslationResult[];
  /** 是否显示双语（原文+译文），false 只显示译文 */
  showBilingual?: boolean;
}

/**
 * 字幕渲染组件
 * 当前句显示在底部带光标，已确认句向上滚动
 */
export function SubtitleOverlay({ currentTranslation, confirmedTranslations, showBilingual = true }: SubtitleOverlayProps) {
  const [prevTranslation, setPrevTranslation] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState(false);

  // 纠正动画检测：当前句翻译变化时触发
  useEffect(() => {
    if (
      currentTranslation &&
      prevTranslation !== null &&
      currentTranslation.translation !== prevTranslation
    ) {
      setCorrecting(true);
      const timer = setTimeout(() => setCorrecting(false), UI_CONSTANTS.CORRECTION_ANIMATION_MS);
      return () => clearTimeout(timer);
    }
    if (currentTranslation) {
      setPrevTranslation(currentTranslation.translation);
    }
  }, [currentTranslation?.translation]);

  const visibleHistory = confirmedTranslations.slice(-UI_CONSTANTS.MAX_VISIBLE_SENTENCES);
  const hasCurrent = currentTranslation !== null;

  return (
    <div style={STYLE.container}>
      <style>{cursorKeyframes}</style>

      {/* 已确认句（向上滚动，半透明） */}
      {visibleHistory.length > 0
        ? visibleHistory.map((item) => (
            <div key={item.sentenceId} style={STYLE.historyItem}>
              {showBilingual && <div style={STYLE.source}>{item.original}</div>}
              <div style={STYLE.target}>{item.translation}</div>
            </div>
          ))
        : null}

      {/* 当前句（流式输出 + 光标） */}
      {hasCurrent ? (
        <div style={correcting ? STYLE.correction : undefined}>
          {showBilingual && <div style={STYLE.source}>{currentTranslation.original || '...'}</div>}
          <div style={STYLE.target}>
            {currentTranslation.translation}
            {currentTranslation.isFinal ? null : <span style={STYLE.cursor} />}
          </div>
        </div>
      ) : null}
    </div>
  );
}
