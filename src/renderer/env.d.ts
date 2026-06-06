import type { SynchroLensAPI } from '../preload';

declare global {
  interface Window {
    synchrolens: SynchroLensAPI;
  }
}
