import { useState, useCallback, useEffect } from 'react';
import { useSession } from '../../hooks/useSession';
import { useIPC } from '../../hooks/useIPC';
import { ControlBar } from '../../components/ControlBar/ControlBar';

export function ControlWindow() {
  const [subtitleVisible, setSubtitleVisible] = useState(true);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const ipc = useIPC();
  const session = useSession({ ipc });

  const handleToggleRecording = useCallback(() => {
    if (session.sessionState === 'running') {
      session.stopSession();
    } else {
      session.startSession('system');
    }
  }, [session]);

  const handleToggleSubtitle = useCallback(() => {
    const newVisible = !subtitleVisible;
    setSubtitleVisible(newVisible);
    window.synchrolens.toggleSubtitle(newVisible).catch(() => {});
  }, [subtitleVisible]);

  const handleMinimize = useCallback(() => {
    window.synchrolens.exitControl('minimize').catch(() => {});
  }, []);

  const handleExit = useCallback(() => {
    setShowExitDialog(true);
  }, []);

  const handleExitTray = useCallback(() => {
    setShowExitDialog(false);
    window.synchrolens.exitControl('minimize').catch(() => {});
  }, []);

  const handleExitStop = useCallback(() => {
    setShowExitDialog(false);
    session.stopSession();
    window.synchrolens.exitControl('stop').catch(() => {});
  }, [session]);

  const handleExitCancel = useCallback(() => {
    setShowExitDialog(false);
  }, []);

  return (
    <>
      <ControlBar
        sessionState={session.sessionState}
        subtitleVisible={subtitleVisible}
        onToggleRecording={handleToggleRecording}
        onToggleSubtitle={handleToggleSubtitle}
        onMinimize={handleMinimize}
        onExit={handleExit}
      />
      {showExitDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-panel p-5 w-72">
            <h3 className="text-base font-semibold text-surface-100 mb-4 text-center">确认退出</h3>
            <div className="space-y-2">
              <button onClick={handleExitTray} className="w-full py-2.5 rounded-lg bg-surface-800 text-surface-200 text-sm font-medium hover:bg-surface-700 transition-all duration-200">
                最小化到系统托盘
              </button>
              <button onClick={handleExitStop} className="w-full py-2.5 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-all duration-200">
                关闭控制窗口（停止录制）
              </button>
              <button onClick={handleExitCancel} className="w-full py-2.5 rounded-lg bg-transparent text-surface-400 text-sm font-medium hover:bg-surface-800/50 transition-all duration-200">
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
