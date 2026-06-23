import type { SynchroLensAPI } from '../preload/index';

declare global {
  interface Window {
    synchrolens: SynchroLensAPI;
  }
}
