/**
 * 控制栏组件
 * 包含开始/停止、字幕开关、最小化、退出按钮
 */

import type { SessionState } from '@shared/types';

/** ControlBar 属性 */
interface ControlBarProps {
  /** 会话状态 */
  sessionState: SessionState;
  /** 字幕窗口是否显示 */
  subtitleVisible: boolean;
  /** 开始/停止回调 */
  onToggleRecording: () => void;
  /** 字幕显隐切换回调 */
  onToggleSubtitle: () => void;
  /** 最小化回调 */
  onMinimize: () => void;
  /** 退出回调 */
  onExit: () => void;
}

/** 样式常量 */
const S = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '100%',
    padding: '0 12px',
    background: '#1f2937',
    borderRadius: '8px',
    border: '1px solid #374151',
    userSelect: 'none' as const,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#d1d5db',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  btn: (active: boolean) => ({
    padding: '4px 10px',
    borderRadius: '6px',
    border: 'none',
    background: active ? '#374151' : 'transparent',
    color: active ? '#ffffff' : '#9ca3af',
    fontSize: '12px',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    transition: 'all 150ms',
  }),
  recordBtn: (running: boolean) => ({
    padding: '4px 10px',
    borderRadius: '6px',
    border: 'none',
    background: running ? '#dc2626' : '#2563eb',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    marginLeft: '4px',
  }),
  closeBtn: {
    padding: '4px 8px',
    borderRadius: '4px',
    border: 'none',
    background: 'transparent',
    color: '#ef4444',
    fontSize: '16px',
    cursor: 'pointer',
  },
} as const;

/**
 * 控制栏组件
 * 横条布局：左侧标题 + 右侧控制按钮组
 */
export function ControlBar({
  sessionState,
  subtitleVisible,
  onToggleRecording,
  onToggleSubtitle,
  onMinimize,
  onExit,
}: ControlBarProps) {
  const isRunning = sessionState === 'running';

  return (
    <div style={S.bar}>
      <div style={S.left}>
        🎙 SynchroLens
        {isRunning && (
          <span style={{ color: '#22c55e', fontSize: 11, marginLeft: 6 }}>● 录制中</span>
        )}
      </div>

      <div style={S.right}>
        <button style={S.recordBtn(isRunning)} onClick={onToggleRecording}>
          {isRunning ? '⏹ 停止' : '▶ 开始'}
        </button>

        <button
          style={S.btn(subtitleVisible)}
          onClick={onToggleSubtitle}
        >
          字幕: {subtitleVisible ? '开' : '关'}
        </button>

        <button style={S.btn(false)} onClick={onMinimize}>
          —
        </button>

        <button style={S.closeBtn} onClick={onExit} title="退出">
          ✕
        </button>
      </div>
    </div>
  );
}
