/**
 * 主窗口入口组件
 * 三栏布局：左侧功能栏 | 中间笔记/设置 | 右侧摘要
 */

import { useState, useCallback } from 'react';
import { Sidebar } from '../../components/Sidebar/Sidebar';
import { SettingsPanel } from '../../components/SettingsPanel/SettingsPanel';
import { useSession } from '../../hooks/useSession';
import { useIPC } from '../../hooks/useIPC';
import { DEFAULT_CONFIG } from '@shared/types';
import type { AppConfig } from '@shared/types';

/** 主窗口样式 */
const S = {
  container: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    background: '#111827',
    color: '#e5e7eb',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  main: (settingsOpen: boolean) => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '24px',
    overflow: 'auto',
    maxWidth: settingsOpen ? '80%' : '60%',
    transition: 'max-width 300ms ease',
  }),
  rightPanel: {
    width: '20%',
    minWidth: '220px',
    borderLeft: '1px solid #374151',
    background: '#1f2937',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  placeholder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#6b7280',
    fontSize: '14px',
    textAlign: 'center' as const,
  },
  header: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#d1d5db',
    marginBottom: '16px',
  },
  summaryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  panelBtn: {
    padding: '4px 10px',
    borderRadius: '6px',
    border: 'none',
    background: '#374151',
    color: '#9ca3af',
    fontSize: '12px',
    cursor: 'pointer',
  },
} as const;

/**
 * 主窗口组件
 */
export function MainWindow() {
  const [activeView, setActiveView] = useState('notes');
  const [summaryVisible, setSummaryVisible] = useState(true);
  const [config, setConfig] = useState<AppConfig>({ ...DEFAULT_CONFIG });
  const ipc = useIPC();
  const session = useSession({ ipc });

  const handlePrepareRecord = useCallback(() => {
    setActiveView('record');
    ipc.startSession('system');
  }, [ipc]);

  const handleConfigSave = useCallback((partial: Partial<AppConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...partial };
      ipc.updateConfig(next as unknown as Record<string, unknown>);
      return next;
    });
  }, [ipc]);

  const isSettings = activeView === 'settings';

  return (
    <div style={S.container}>
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        onPrepareRecord={handlePrepareRecord}
      />

      {/* 中间栏：笔记 / 设置 */}
      <div style={S.main(isSettings)}>
        {isSettings ? (
          <SettingsPanel config={config} onSave={handleConfigSave} />
        ) : (
          <>
            <div style={S.header}>
              📝 实时笔记
              {session.sessionState === 'running' && (
                <span style={{ marginLeft: 12, color: '#22c55e', fontSize: 12, fontWeight: 400 }}>
                  ● 录制中
                </span>
              )}
            </div>
            {session.confirmedTranslations.length > 0 ? (
              session.confirmedTranslations.map((item) => (
                <div
                  key={item.sentenceId}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '6px',
                    background: '#1f2937',
                    marginBottom: '8px',
                  }}
                >
                  <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 4 }}>
                    {item.original}
                  </div>
                  <div style={{ fontSize: 16, color: '#e5e7eb' }}>
                    {item.translation}
                  </div>
                </div>
              ))
            ) : (
              <div style={S.placeholder}>
                {session.sessionState === 'running'
                  ? '等待翻译结果…'
                  : '点击左侧 🎬 准备录制 启动同声传译'}
              </div>
            )}
          </>
        )}
      </div>

      {/* 右侧栏：摘要 */}
      {isSettings ? null : (
        <div style={S.rightPanel}>
          <div style={S.summaryHeader}>
            <div style={S.header}>📊 摘要</div>
            <button
              style={S.panelBtn}
              onClick={() => setSummaryVisible((v) => !v)}
            >
              {summaryVisible ? '隐藏' : '显示'}
            </button>
          </div>
          {summaryVisible ? (
            session.summary ? (
              <div style={{ fontSize: 13, color: '#d1d5db', lineHeight: 1.6 }}>
                {session.summary}
              </div>
            ) : (
              <div style={S.placeholder}>暂无摘要内容</div>
            )
          ) : null}
        </div>
      )}
    </div>
  );
}
