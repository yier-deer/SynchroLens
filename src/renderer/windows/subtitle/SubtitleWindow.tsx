/**
 * 悬浮字幕窗口入口组件
 * 使用 useSession Hook 获取状态，渲染 SubtitleOverlay
 */

import { useSession } from '../../hooks/useSession';
import { useIPC } from '../../hooks/useIPC';
import { SubtitleOverlay } from '../../components/SubtitleOverlay/SubtitleOverlay';

/**
 * 悬浮字幕窗口入口
 * 纯字幕显示，其余区域完全透明（由 Electron 窗口 transparent:true 控制）
 */
export function SubtitleWindow() {
  const ipc = useIPC();
  const session = useSession({ ipc });

  return (
    <SubtitleOverlay
      currentTranslation={session.currentTranslation}
      confirmedTranslations={session.confirmedTranslations}
    />
  );
}
