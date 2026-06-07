import { useState, useCallback } from 'react';
import { useSession } from '../../hooks/useSession';
import { useIPC } from '../../hooks/useIPC';
import { ControlBar } from '../../components/ControlBar/ControlBar';

export function ControlWindow() {
  const [subtitleVisible, setSubtitleVisible] = useState(true);
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
