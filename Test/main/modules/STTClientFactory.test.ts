import { createSTTClient } from '../../../src/main/modules/stt/STTClientFactory';
import { XfyunRtasrClient } from '../../../src/main/modules/stt/XfyunRtasrClient';
import { XfyunIatClient } from '../../../src/main/modules/stt/XfyunIatClient';

describe('createSTTClient', () => {
  it('creates RTASR client for xfyun-rtasr provider', () => {
    expect(createSTTClient({ provider: 'xfyun-rtasr' } as any)).toBeInstanceOf(XfyunRtasrClient);
  });

  it('creates IAT fallback client for xfyun-iat provider', () => {
    expect(createSTTClient({ provider: 'xfyun-iat' } as any)).toBeInstanceOf(XfyunIatClient);
  });

  it('defaults to RTASR for realtime captions', () => {
    expect(createSTTClient({} as any)).toBeInstanceOf(XfyunRtasrClient);
  });
});
