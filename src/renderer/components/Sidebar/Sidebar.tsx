/**
 * 左侧栏组件
 * 功能按钮竖向堆叠：笔记/词典/记忆/设置/准备录制
 */

import { useCallback } from 'react';

/** Sidebar 属性 */
interface SidebarProps {
  /** 当前活跃视图 */
  activeView: string;
  /** 视图切换回调 */
  onViewChange: (view: string) => void;
  /** 准备录制回调（最小化主窗 + 唤出控制悬浮窗） */
  onPrepareRecord: () => void;
}

/** 功能按钮定义 */
const NAV_ITEMS = [
  { key: 'notes', label: '📝 笔记' },
  { key: 'dictionary', label: '📖 词典' },
  { key: 'memory', label: '🧠 记忆' },
  { key: 'settings', label: '⚙️ 设置' },
  { key: 'record', label: '🎬 准备录制' },
] as const;

/** 侧边栏样式 */
const S = {
  sidebar: {
    width: '20%',
    minWidth: '180px',
    maxWidth: '260px',
    height: '100%',
    borderRight: '1px solid #374151',
    background: '#1f2937',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  nav: {
    padding: '16px 12px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  navBtn: (active: boolean) => ({
    padding: '10px 14px',
    borderRadius: '8px',
    border: 'none',
    background: active ? '#374151' : 'transparent',
    color: '#e5e7eb',
    fontSize: '14px',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'background 150ms',
  }),
  recordBtn: (active: boolean) => ({
    padding: '10px 14px',
    borderRadius: '8px',
    border: 'none',
    background: active ? '#dc2626' : '#2563eb',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'background 150ms',
  }),
} as const;

/**
 * 左侧栏组件
 * 功能按钮竖向堆叠，准备录制有特殊样式
 */
export function Sidebar({ activeView, onViewChange, onPrepareRecord }: SidebarProps) {
  const handleClick = useCallback(
    (key: string) => {
      if (key === 'record') {
        onPrepareRecord();
        return;
      }
      onViewChange(key);
    },
    [onViewChange, onPrepareRecord],
  );

  return (
    <div style={S.sidebar}>
      <nav style={S.nav}>
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.key;
          const isRecord = item.key === 'record';

          return (
            <button
              key={item.key}
              style={isRecord ? S.recordBtn(isActive) : S.navBtn(isActive)}
              onClick={() => handleClick(item.key)}
            >
              {isRecord && isActive ? '⏹ 停止录制' : item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
