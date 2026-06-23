import { STTClient } from '../../../src/main/modules/stt/STTClient';

describe('STTClient compatibility export', () => {
  it('constructs the XFYun IAT fallback client', () => {
    expect(new STTClient()).toBeDefined();
  });
});
