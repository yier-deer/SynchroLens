import { useState, useCallback } from 'react';
import { Sidebar, type ViewType } from '../../components/Sidebar/Sidebar';
import { NotesView } from '../../components/Notes/NotesView';
import { FavoritesView } from '../../components/Favorites/FavoritesView';
import { DictionaryView } from '../../components/Dictionary/DictionaryView';
import { SettingsPanel } from '../../components/SettingsPanel/SettingsPanel';
import { ToastProvider, useToast } from '../../components/common/Toast';
import { SplashScreen } from '../../components/common/SplashScreen';
import { useSession } from '../../hooks/useSession';
import { useIPC } from '../../hooks/useIPC';
import { DEFAULT_CONFIG } from '@shared/types';
import type { AppConfig, NoteTreeItem } from '@shared/types';

function SettingsWithActions({ config, onSave }: { config: AppConfig; onSave: (partial: Partial<AppConfig>) => void }) {
  const { showToast } = useToast();

  const handleExportNotes = useCallback(async () => {
    try {
      const dir = await window.synchrolens.selectDirectory();
      if (!dir) return;
      const savePath = `${dir}\\notes-export-${Date.now()}.zip`;
      await window.synchrolens.exportAllNotes(savePath);
      showToast('笔记导出成功');
    } catch {
      showToast('导出失败', 'error');
    }
  }, [showToast]);

  const handleClearData = useCallback(async () => {
    const confirmed = window.confirm('确定要清除所有历史数据吗？此操作不可撤销。');
    if (!confirmed) return;
    try {
      await window.synchrolens.clearData(['notes', 'favorites', 'personalDict']);
      showToast('历史数据已清除');
    } catch {
      showToast('清除失败', 'error');
    }
  }, [showToast]);

  const handleSaveSettings = useCallback((newConfig: AppConfig) => {
    onSave(newConfig);
    showToast('设置已保存');
  }, [onSave, showToast]);

  return (
    <SettingsPanel
      config={config}
      onSave={handleSaveSettings}
      onExportNotes={handleExportNotes}
      onClearData={handleClearData}
    />
  );
}

export function MainWindow() {
  const [showSplash, setShowSplash] = useState(true);
  const [activeView, setActiveView] = useState<ViewType>('notes');
  const [selectedNote, setSelectedNote] = useState<NoteTreeItem | null>(null);
  const [summaryVisible, setSummaryVisible] = useState(true);
  const [config, setConfig] = useState<AppConfig>({ ...DEFAULT_CONFIG });
  const ipc = useIPC();
  const session = useSession({ ipc });

  const isRecording = session.sessionState === 'running';
  const isNotes = activeView === 'notes';

  const handleViewChange = useCallback((view: ViewType) => {
    setActiveView(view);
    setSelectedNote(null);
  }, []);

  const handleNoteSelect = useCallback((note: NoteTreeItem) => {
    setSelectedNote(note);
    setActiveView('notes');
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedNote(null);
  }, []);

  const handlePrepareRecord = useCallback(() => {
    window.synchrolens.prepareRecord().catch(() => {});
  }, []);

  const handleConfigSave = useCallback((partial: Partial<AppConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...partial };
      ipc.updateConfig(next as unknown as Record<string, unknown>);
      return next;
    });
  }, [ipc]);

  if (showSplash) {
    return (
      <ToastProvider>
        <SplashScreen onComplete={() => setShowSplash(false)} />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="flex h-screen w-screen bg-surface-950 text-surface-100 font-sans">
        <div className="w-[20%] min-w-[220px] border-r border-surface-800/50">
          <Sidebar
            activeView={activeView}
            onViewChange={handleViewChange}
            onNoteSelect={handleNoteSelect}
            isRecording={isRecording}
            onPrepareRecord={handlePrepareRecord}
          />
        </div>

        <div className={activeView === 'notes' && !selectedNote ? 'flex-1' : 'flex-[4]'}>
          {activeView === 'notes' && (
            <NotesView
              selectedNote={selectedNote}
              onClearSelection={handleClearSelection}
            />
          )}
          {activeView === 'favorites' && <FavoritesView />}
          {activeView === 'dictionary' && <DictionaryView />}
          {activeView === 'settings' && (
            <div className="h-full overflow-auto p-4">
              <SettingsWithActions config={config} onSave={handleConfigSave} />
            </div>
          )}
        </div>

        {isNotes && !selectedNote && (
          <div className="w-[20%] min-w-[220px] border-l border-surface-800/50 bg-surface-900/50 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-surface-300">摘要</h3>
              <button
                className="px-3 py-1 rounded-md bg-surface-800 text-xs text-surface-400 hover:text-surface-200 transition-colors"
                onClick={() => setSummaryVisible(v => !v)}
              >
                {summaryVisible ? '隐藏' : '显示'}
              </button>
            </div>
            {summaryVisible && (
              session.summary ? (
                <p className="text-sm text-surface-400 leading-relaxed">{session.summary}</p>
              ) : (
                <p className="text-sm text-surface-500 text-center mt-8">暂无摘要内容</p>
              )
            )}
          </div>
        )}
      </div>
    </ToastProvider>
  );
}
