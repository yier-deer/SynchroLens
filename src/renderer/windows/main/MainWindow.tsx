import { useState, useCallback, useEffect } from 'react';
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

function SettingsWithActions({ config, onSave }: { config: AppConfig; onSave: (config: AppConfig) => void }) {
  const { showToast } = useToast();
  const [showExportConfirm, setShowExportConfirm] = useState(false);

  const handleExportNotesClick = useCallback(() => {
    setShowExportConfirm(true);
  }, []);

  const handleExportConfirm = useCallback(async () => {
    setShowExportConfirm(false);
    try {
      const dir = await window.synchrolens.selectDirectory();
      if (!dir) return;
      const savePath = `${dir}\\notes-export-${Date.now()}.zip`;
      await window.synchrolens.exportAllNotes(savePath);
      showToast(`笔记已导出到 ${savePath}`);
    } catch {
      showToast('导出失败', 'error');
    }
  }, [showToast]);

  const handleExportCancel = useCallback(() => {
    setShowExportConfirm(false);
  }, []);

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
    <>
      <SettingsPanel
        config={config}
        onSave={handleSaveSettings}
        onExportNotes={handleExportNotesClick}
        onClearData={undefined}
      />
      {showExportConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface-800 border border-surface-700 rounded-xl p-6 w-96 shadow-2xl">
            <h3 className="text-base font-semibold text-surface-100 mb-2">导出全部笔记</h3>
            <p className="text-sm text-surface-400 mb-6">确定要导出全部笔记吗？导出文件将保存为 ZIP 压缩包。</p>
            <div className="flex justify-end gap-3">
              <button onClick={handleExportCancel} className="px-4 py-2 rounded-lg bg-surface-700 text-surface-300 text-sm hover:bg-surface-600 transition-colors">
                取消
              </button>
              <button onClick={handleExportConfirm} className="px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors">
                确定导出
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function MainWindow() {
  const [showSplash, setShowSplash] = useState(true);
  const [activeView, setActiveView] = useState<ViewType>('notes');
  const [selectedNote, setSelectedNote] = useState<NoteTreeItem | null>(null);
  const [lastNotePath, setLastNotePath] = useState<string | null>(null);
  const [noteSummary, setNoteSummary] = useState('');
  const [summaryVisible, setSummaryVisible] = useState(true);
  const [config, setConfig] = useState<AppConfig>({ ...DEFAULT_CONFIG });
  const ipc = useIPC();
  const session = useSession({ ipc });

  // 启动时从磁盘加载已保存的配置
  useEffect(() => {
    window.synchrolens.loadConfig().then((saved: unknown) => {
      if (saved && typeof saved === 'object') {
        setConfig(saved as AppConfig);
      }
    }).catch(() => {});
  }, []);

  // 主题切换
  useEffect(() => {
    const theme = config.general?.theme || 'system';
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const applySystem = (e: MediaQueryListEvent | MediaQueryList) => {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      };
      applySystem(mq);
      mq.addEventListener('change', applySystem);
      return () => mq.removeEventListener('change', applySystem);
    }
    document.documentElement.setAttribute('data-theme', theme);
  }, [config.general?.theme]);

  const isRecording = session.sessionState === 'running';
  const isNotes = activeView === 'notes';

  const handleViewChange = useCallback((view: ViewType) => {
    setActiveView(view);
    setSelectedNote(null);
  }, []);

  const handleNoteSelect = useCallback((note: NoteTreeItem) => {
    setSelectedNote(note);
    setLastNotePath(note.path);
    setActiveView('notes');
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedNote(null);
  }, []);

  const handlePrepareRecord = useCallback(() => {
    window.synchrolens.prepareRecord().catch(() => {});
  }, []);

  const handleConfigSave = useCallback(async (newConfig: AppConfig) => {
    setConfig(newConfig);
    ipc.updateConfig(newConfig as unknown as Record<string, unknown>);
    // 持久化保存到磁盘
    await window.synchrolens.saveConfig(newConfig);
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
            lastViewedNotePath={lastNotePath}
          />
        </div>

        <div className={activeView === 'notes' && !selectedNote ? 'flex-1' : 'flex-[4]'}>
          {activeView === 'notes' && (
            <NotesView
              selectedNote={selectedNote}
              onClearSelection={handleClearSelection}
              onSummaryExtracted={setNoteSummary}
            />
          )}
          {activeView === 'favorites' && <FavoritesView cardStyle={config.general?.cardStyle || '暗夜蓝'} onNavigateToNote={(notePath) => {
            const findAndSelect = async () => {
              try {
                const tree = await window.synchrolens.listNotes() as NoteTreeItem[];
                const findNote = (items: NoteTreeItem[]): NoteTreeItem | null => {
                  for (const it of items) {
                    if (it.type === 'file' && it.path === notePath) return it;
                    if (it.children) { const f = findNote(it.children); if (f) return f; }
                  }
                  return null;
                };
                const note = findNote(tree);
                if (note) { setSelectedNote(note); setActiveView('notes'); }
              } catch {
                const parts = notePath.replace(/\\/g, '/').split('/');
                const name = parts[parts.length - 1] || notePath;
                setSelectedNote({ name, path: notePath, type: 'file' });
                setActiveView('notes');
              }
            };
            findAndSelect();
          }} />}
          {activeView === 'dictionary' && <DictionaryView />}
          {activeView === 'settings' && (
            <div className="h-full overflow-auto p-4">
              <SettingsWithActions config={config} onSave={handleConfigSave} />
            </div>
          )}
        </div>

        {isNotes && (
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
              (session.summary || noteSummary) ? (
                <p className="text-sm text-surface-400 leading-relaxed">{noteSummary || session.summary}</p>
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
