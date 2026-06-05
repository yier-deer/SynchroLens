/**
 * 渲染进程入口组件
 * 根据窗口类型渲染不同的窗口组件
 */

import { MainWindow } from './windows/main/MainWindow';

/** 支持的窗口类型 */
type WindowType = 'main' | 'subtitle' | 'control';

/** 从 URL search params 获取窗口类型（主进程加载时传入） */
function getWindowType(): WindowType {
  if (typeof window === 'undefined') return 'main';
  const params = new URLSearchParams(window.location.search);
  return (params.get('window') as WindowType) || 'main';
}

/**
 * 渲染进程入口
 * 路由到对应窗口组件
 */
export function App() {
  const windowType = getWindowType();

  if (windowType === 'main') {
    return <MainWindow />;
  }

  // 字幕窗口和控制窗口由对应入口组件渲染
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p style={{ color: '#9ca3af', fontSize: '14px' }}>
        {windowType === 'subtitle' ? 'SynchroLens 字幕窗口' : 'SynchroLens 控制窗口'}
      </p>
    </div>
  );
}
