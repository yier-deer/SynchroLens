/**
 * 左侧栏组件
 * 上方功能按钮 + 下方文件夹树
 */

import { useState, useCallback } from 'react';
import type { Session } from '@shared/types';

/** Sidebar 属性 */
interface SidebarProps {
  /** 当前活跃视图 */
  activeView: string;
  /** 视图切换回调 */
  onViewChange: (view: string) => void;
  /** 会话列表 */
  sessions: Session[];
  /** 开始录制回调 */
  onStartRecording: () => void;
}

/** 功能按钮定义 */
const NAV_ITEMS = [
  { key: 'notes', label: '📝 笔记', disabled: false },
  { key: 'dictionary', label: '📖 词典', disabled: true },
  { key: 'memory', label: '🧠 记忆', disabled: true },
  { key: 'settings', label: '⚙️ 设置', disabled: false },
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
  navBtn: (active: boolean, disabled: boolean) => ({
    padding: '10px 14px',
    borderRadius: '8px',
    border: 'none',
    background: active ? '#374151' : 'transparent',
    color: disabled ? '#6b7280' : '#e5e7eb',
    fontSize: '14px',
    fontWeight: active ? 600 : 400,
    cursor: disabled ? 'not-allowed' : 'pointer',
    textAlign: 'left' as const,
    transition: 'background 150ms',
    opacity: disabled ? 0.5 : 1,
  }),
  separator: {
    height: '1px',
    background: '#374151',
    margin: '12px 0',
  },
  recordBtn: (isRecording: boolean) => ({
    padding: '10px 14px',
    borderRadius: '8px',
    border: 'none',
    background: isRecording ? '#dc2626' : '#2563eb',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'background 150ms',
  }),
  folderTree: {
    padding: '12px',
    borderTop: '1px solid #374151',
    maxHeight: '200px',
    overflowY: 'auto' as const,
    fontSize: '12px',
    color: '#9ca3af',
  },
} as const;

/**
 * 左侧栏组件
 * 上方功能按钮竖向堆叠，录制按钮用分隔线隔开，下方文件夹树
 */
export function Sidebar({ activeView, onViewChange, sessions, onStartRecording }: SidebarProps) {
  const [isRecording, setIsRecording] = useState(false);

  const handleRecord = useCallback(() => {
    const next = !isRecording;
    setIsRecording(next);
    if (next) {
      onStartRecording();
    }
  }, [isRecording, onStartRecording]);

  // 按日期分组会话
  const groupedSessions = sessions.reduce(
    (groups, session) => {
      const date = new Date(session.startTime).toLocaleDateString('zh-CN');
      if (!groups[date]) groups[date] = [];
      groups[date].push(session);
      return groups;
    },
    {} as Record<string, Session[]>,
  );

  return (
    <div style={S.sidebar}>
      <nav style={S.nav}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            style={S.navBtn(activeView === item.key, item.disabled)}
            onClick={() => !item.disabled && onViewChange(item.key)}
            disabled={item.disabled}
            title={item.disabled ? '后续版本支持' : undefined}
          >
            {item.label}
          </button>
        ))}

        <div style={S.separator} />

        <button style={S.recordBtn(isRecording)} onClick={handleRecord}>
          {isRecording ? '⏹ 停止录制' : '🔴 开始录制'}
        </button>
      </nav>

      <div style={S.folderTree}>
        <div style={{ fontWeight: 600, marginBottom: 8, color: '#d1d5db' }}>
          历史会话
        </div>
        {Object.keys(groupedSessions).length > 0
          ? Object.entries(groupedSessions).map(([date, items]) => (
              <div key={date} style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{date}</div>
                {items.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      padding: '2px 8px',
                      cursor: 'pointer',
                      borderRadius: '4px',
                    }}
                  >
                    {new Date(s.startTime).toLocaleTimeString('zh-CN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                ))}
              </div>
            ))
          : <div style={{ color: '#6b7280' }}>暂无历史会话</div>}
      </div>
    </div>
  );
}
