import { MainWindow } from './windows/main/MainWindow';
import { ControlWindow } from './windows/control/ControlWindow';
import { SubtitleWindow } from './windows/subtitle/SubtitleWindow';

type WindowType = 'main' | 'subtitle' | 'control';

function getWindowType(): WindowType {
  if (typeof window === 'undefined') return 'main';
  const params = new URLSearchParams(window.location.search);
  return (params.get('window') as WindowType) || 'main';
}

export function App() {
  const windowType = getWindowType();

  if (windowType === 'subtitle') {
    return <SubtitleWindow />;
  }

  if (windowType === 'control') {
    return <ControlWindow />;
  }

  return <MainWindow />;
}
