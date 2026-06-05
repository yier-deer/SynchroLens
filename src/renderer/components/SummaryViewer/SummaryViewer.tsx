/**
 * 摘要查看器组件
 * 显示当前笔记的智能摘要内容
 */

import { UI_CONSTANTS } from '@shared/constants';

/** SummaryViewer 属性 */
interface SummaryViewerProps {
  /** 摘要内容 */
  summary: string | null;
  /** 触发摘要生成 */
  onGenerateSummary: () => void;
  /** 会话状态 */
  isRunning: boolean;
}

/** 样式常量 */
const S = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  content: {
    flex: 1,
    fontSize: '13px',
    color: '#d1d5db',
    lineHeight: '1.6',
    overflowY: 'auto' as const,
  },
  placeholder: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#6b7280',
    fontSize: '14px',
    textAlign: 'center' as const,
  },
  generateBtn: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    background: '#2563eb',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 150ms',
  },
} as const;

/**
 * 摘要查看器
 * 展示智能摘要内容，支持手动触发生成
 */
export function SummaryViewer({ summary, onGenerateSummary, isRunning }: SummaryViewerProps) {
  return (
    <div style={S.container}>
      {summary ? (
        <div style={S.content}>{summary}</div>
      ) : (
        <div style={S.placeholder}>
          {isRunning ? '录制完成后可生成摘要' : '暂无摘要内容'}
        </div>
      )}

      <button
        style={S.generateBtn}
        onClick={onGenerateSummary}
        disabled={!isRunning}
      >
        🧠 生成摘要
      </button>
    </div>
  );
}
