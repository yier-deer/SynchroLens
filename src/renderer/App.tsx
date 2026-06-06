import { MainWindow } from './windows/main/MainWindow';
import { ControlWindow } from './windows/control/ControlWindow';
import { SubtitleWindow } from './windows/subtitle/SubtitleWindow';
import { ErrorBoundary } from './components/common/ErrorBoundary';

type WindowType = 'main' | 'subtitle' | 'control';

function getWindowType(): WindowType {
  if (typeof window === 'undefined') return 'main';
  const params = new URLSearchParams(window.location.search);
  return (params.get('window') as WindowType) || 'main';
}

export function App() {
  const windowType = getWindowType();

  if (windowType === 'subtitle') {
    return <ErrorBoundary><SubtitleWindow /></ErrorBoundary>;
  }

  if (windowType === 'control') {
    return <ErrorBoundary><ControlWindow /></ErrorBoundary>;
  }

  return <ErrorBoundary><MainWindow /></ErrorBoundary>;
}
