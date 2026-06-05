/**
 * 控制悬浮窗入口组件
 * 横条状，始终置顶，可拖拽
 */

import { useState, useCallback } from 'react';
import { useSession } from '../../hooks/useSession';
import { useIPC } from '../../hooks/useIPC';
import { ControlBar } from '../../components/ControlBar/ControlBar';

/**
 * 控制悬浮窗入口
 * 集成 useSession 状态驱动 ControlBar
 */
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
    setSubtitleVisible((v) => !v);
  }, []);

  const handleMinimize = useCallback(() => {
    // 最小化由 Electron 窗口管理器处理
  }, []);

  const handleExit = useCallback(() => {
    // 退出：停止翻译 + 关闭窗口
    session.stopSession();
  }, [session]);

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
