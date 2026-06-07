/**
 * 悬浮字幕窗口入口组件
 * 使用 useSession Hook 获取状态，渲染 SubtitleOverlay
 */

import { useSession } from '../../hooks/useSession';
import { useIPC } from '../../hooks/useIPC';
import { SubtitleOverlay } from '../../components/SubtitleOverlay/SubtitleOverlay';
import { useState, useEffect } from 'react';

/**
 * 悬浮字幕窗口入口
 * 纯字幕显示，其余区域完全透明（由 Electron 窗口 transparent:true 控制）
 */
export function SubtitleWindow() {
  const ipc = useIPC();
  const session = useSession({ ipc });
  const [showBilingual, setShowBilingual] = useState(true);

  useEffect(() => {
    window.synchrolens.loadConfig().then((saved: unknown) => {
      if (saved && typeof saved === 'object') {
        const cfg = saved as { general?: { showBilingual?: boolean } };
        if (typeof cfg.general?.showBilingual === 'boolean') {
          setShowBilingual(cfg.general.showBilingual);
        }
      }
    }).catch(() => {});
  }, []);

  return (
    <SubtitleOverlay
      currentTranslation={session.currentTranslation}
      confirmedTranslations={session.confirmedTranslations}
      showBilingual={showBilingual}
    />
  );
}
