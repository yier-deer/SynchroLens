import { useState, useCallback, useRef } from 'react';
import { useSession } from '../../hooks/useSession';
import { useIPC } from '../../hooks/useIPC';
import { ControlBar } from '../../components/ControlBar/ControlBar';

export function ControlWindow() {
  const [subtitleVisible, setSubtitleVisible] = useState(true);
  const togglingRef = useRef(false);
  const ipc = useIPC();
  const session = useSession({ ipc });

  const handleToggleRecording = useCallback(async () => {
    if (togglingRef.current) return;
    togglingRef.current = true;

    const isRunning = session.sessionState !== 'idle' && session.sessionState !== 'stopped';
    try {
      if (isRunning) {
        await session.stopSession();
      } else {
        await session.startSession('system');
      }
    } catch (err) {
      const api = (window as any).synchrolens;
      api?.log?.('error', 'ControlWindow', '会话切换失败', {
        action: isRunning ? 'stop' : 'start',
        error: (err as Error).message,
      });
    } finally {
      togglingRef.current = false;
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
    window.synchrolens.exitControl('prompt').catch(() => {});
  }, []);

  return (
    <ControlBar
      sessionState={session.sessionState}
      subtitleVisible={subtitleVisible}
      onToggleRecording={handleToggleRecording}
      onToggleSubtitle={handleToggleSubtitle}
      onMinimize={handleMinimize}
      onExit={handleExit}
    />
  );
}
