import { useState, useCallback } from 'react';
import { useSession } from '../../hooks/useSession';
import { useIPC } from '../../hooks/useIPC';
import { ControlBar } from '../../components/ControlBar/ControlBar';

export function ControlWindow() {
  const [subtitleVisible, setSubtitleVisible] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const ipc = useIPC();
  const session = useSession({ ipc });

  const handleToggleRecording = useCallback(async () => {
    if (isToggling) return;
    setIsToggling(true);
    try {
      if (session.sessionState === 'running') {
        await session.stopSession();
      } else {
        await session.startSession('system');
      }
    } catch (err) {
      window.synchrolens?.log?.('error', 'ControlWindow', '会话切换失败', {
        action: session.sessionState === 'running' ? 'stop' : 'start',
        error: (err as Error).message,
      });
    } finally {
      setIsToggling(false);
    }
  }, [session, isToggling]);

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
