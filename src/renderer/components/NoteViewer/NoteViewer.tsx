/**
 * 笔记查看器组件
 * Markdown 渲染显示笔记内容
 */

import type { TranslationResult } from '@shared/types';

/** NoteViewer 属性 */
interface NoteViewerProps {
  /** 已确认的翻译结果列表 */
  translations: TranslationResult[];
  /** 会话状态 */
  isRunning: boolean;
}

/** 样式常量 */
const S = {
  container: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '16px 0',
  },
  item: {
    padding: '12px 16px',
    borderRadius: '6px',
    background: '#1f2937',
    marginBottom: '8px',
  },
  original: {
    fontSize: '13px',
    color: '#9ca3af',
    marginBottom: '4px',
    wordBreak: 'break-word' as const,
  },
  translation: {
    fontSize: '16px',
    color: '#e5e7eb',
    wordBreak: 'break-word' as const,
  },
  timestamp: {
    fontSize: '11px',
    color: '#6b7280',
    marginTop: '4px',
    textAlign: 'right' as const,
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#6b7280',
    fontSize: '14px',
  },
} as const;

/**
 * 笔记查看器
 * 以条目列表展示已确认的翻译句子
 */
export function NoteViewer({ translations, isRunning }: NoteViewerProps) {
  if (translations.length === 0) {
    return (
      <div style={S.empty}>
        {isRunning ? '等待翻译结果…' : '暂无笔记内容'}
      </div>
    );
  }

  return (
    <div style={S.container}>
      {translations.map((item) => (
        <div key={item.sentenceId} style={S.item}>
          <div style={S.original}>{item.original}</div>
          <div style={S.translation}>{item.translation}</div>
        </div>
      ))}
    </div>
  );
}
