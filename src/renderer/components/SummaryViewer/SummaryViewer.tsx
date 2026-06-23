/**
 * 摘要查看器组件
 * 显示当前笔记的智能摘要内容
 */

interface SummaryViewerProps {
  summary: string | null;
  onGenerateSummary: () => void;
  isRunning: boolean;
  status?: {
    state: 'idle' | 'running' | 'completed' | 'failed';
    error: string | null;
  };
}

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
  status: {
    fontSize: '12px',
    color: '#9ca3af',
  },
  error: {
    fontSize: '12px',
    color: '#fca5a5',
  },
} as const;

export function SummaryViewer({ summary, onGenerateSummary, isRunning, status }: SummaryViewerProps) {
  return (
    <div style={S.container}>
      {summary ? (
        <div style={S.content}>{summary}</div>
      ) : (
        <div style={S.placeholder}>
          {isRunning ? '录制完成后可生成摘要' : '暂无摘要内容'}
        </div>
      )}

      {status?.state === 'running' ? <div style={S.status}>摘要生成中...</div> : null}
      {status?.state === 'failed' && status.error ? <div style={S.error}>{status.error}</div> : null}

      <button
        style={S.generateBtn}
        onClick={onGenerateSummary}
        disabled={!isRunning}
      >
        生成摘要
      </button>
    </div>
  );
}
