import type { AppConfig } from '../../../shared/types';
import type { ISTTClient } from './types';
import { XfyunIatClient } from './XfyunIatClient';
import { XfyunRtasrClient } from './XfyunRtasrClient';

export function createSTTClient(config?: Partial<AppConfig['stt']>): ISTTClient {
  switch (config?.provider) {
    case 'xfyun-iat':
      return new XfyunIatClient();
    case 'xfyun-rtasr':
    case undefined:
      return new XfyunRtasrClient();
    default:
      return new XfyunRtasrClient();
  }
}
