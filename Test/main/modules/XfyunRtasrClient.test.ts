import { XfyunRtasrClient } from '../../../src/main/modules/stt/XfyunRtasrClient';

let mockWsInstance: any;
let mockWsSend: jest.Mock;
let mockWsClose: jest.Mock;
let handlers: Record<string, (...args: any[]) => void>;
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

function triggerEvent(event: string, ...args: any[]) {
  if (handlers[event]) {
    handlers[event](...args);
  }
}

function getMockWsCtor(): jest.Mock {
  return require('ws').default as jest.Mock;
}

jest.mock('ws', () => {
  const ctor = jest.fn().mockImplementation(() => {
    handlers = {};
    mockWsSend = jest.fn();
    mockWsClose = jest.fn();
    mockWsInstance = {
      on: jest.fn((event: string, handler: (...args: any[]) => void) => {
        handlers[event] = handler;
      }),
      send: mockWsSend,
      close: mockWsClose,
      readyState: 1,
    };
    return mockWsInstance;
  });

  (ctor as any).OPEN = 1;

  return {
    __esModule: true,
    default: ctor,
  };
});

jest.mock('../../../src/main/utils/logger', () => ({
  createLogger: jest.fn(() => mockLogger),
}));

describe('XfyunRtasrClient', () => {
  let client: XfyunRtasrClient;
  let MockWebSocket: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    MockWebSocket = getMockWsCtor();
    client = new XfyunRtasrClient();
  });

  afterEach(() => {
    jest.useRealTimers();
    client.disconnect();
  });

  it('connects to the RTASR websocket endpoint with appid, ts, and signa query params', () => {
    jest.setSystemTime(new Date('2026-06-23T10:00:00.000Z'));

    client.connect({ appId: 'test-app', apiKey: 'test-key', apiSecret: 'test-secret', language: 'en_us' });

    expect(MockWebSocket).toHaveBeenCalledTimes(1);
    const url = String(MockWebSocket.mock.calls[0][0]);
    expect(url).toContain('wss://rtasr.xfyun.cn/v1/ws');
    expect(url).toContain('appid=test-app');
    expect(url).toContain('ts=');
    expect(url).toContain('signa=');
  });

  it('sends raw PCM bytes while connected', () => {
    client.connect({ appId: 'test-app', apiKey: 'test-key', apiSecret: 'test-secret', language: 'en_us' });
    triggerEvent('open');

    client.sendAudio(new Int16Array([1, -1, 2, -2]));

    expect(mockWsSend).toHaveBeenCalledTimes(1);
    const sent = mockWsSend.mock.calls[0][0] as Buffer;
    expect(Buffer.isBuffer(sent)).toBe(true);
    expect(sent.byteLength).toBe(8);
  });

  it('sends end marker before closing', () => {
    client.connect({ appId: 'test-app', apiKey: 'test-key', apiSecret: 'test-secret', language: 'en_us' });
    triggerEvent('open');
    mockWsSend.mockClear();

    client.disconnect();

    expect(mockWsSend).toHaveBeenCalledWith(expect.stringContaining('{"end":true}'));
    expect(mockWsClose).toHaveBeenCalled();
  });

  it('emits partial RTASR text messages with provider metadata', () => {
    const resultCallback = jest.fn();
    client.onResult(resultCallback);
    client.connect({ appId: 'test-app', apiKey: 'test-key', apiSecret: 'test-secret', language: 'en_us' });
    triggerEvent('open');

    triggerEvent('message', JSON.stringify({ action: 'result', data: 'hello world', sid: 'sid-1' }));

    expect(resultCallback).toHaveBeenCalledWith(
      'hello world',
      false,
      expect.any(String),
      expect.objectContaining({ provider: 'xfyun-rtasr', stable: false }),
    );
  });

  it('emits final text when RTASR marks the stream complete', () => {
    const resultCallback = jest.fn();
    client.onResult(resultCallback);
    client.connect({ appId: 'test-app', apiKey: 'test-key', apiSecret: 'test-secret', language: 'en_us' });
    triggerEvent('open');

    triggerEvent('message', JSON.stringify({ action: 'result', data: 'final text', type: 'final' }));

    expect(resultCallback).toHaveBeenCalledWith(
      'final text',
      true,
      expect.any(String),
      expect.objectContaining({ provider: 'xfyun-rtasr', stable: true }),
    );
  });

  it('extracts nested RTASR word payloads from JSON data strings', () => {
    const resultCallback = jest.fn();
    client.onResult(resultCallback);
    client.connect({ appId: 'test-app', apiKey: 'test-key', apiSecret: 'test-secret', language: 'en_us' });
    triggerEvent('open');

    triggerEvent('message', JSON.stringify({
      action: 'result',
      code: '0',
      data: JSON.stringify({
        seg_id: 3,
        cn: {
          st: {
            rt: [
              {
                ws: [
                  { cw: [{ w: '. ', wp: 'p' }] },
                  { cw: [{ w: 'I', wp: 'n' }] },
                  { cw: [{ w: ' love', wp: 'n' }] },
                  { cw: [{ w: ' watching', wp: 'n' }] },
                  { cw: [{ w: ' movies', wp: 'n' }] },
                ],
              },
            ],
            type: '1',
          },
        },
        ls: false,
      }),
    }));

    expect(resultCallback).toHaveBeenCalledWith(
      'I love watching movies',
      false,
      expect.any(String),
      expect.objectContaining({ provider: 'xfyun-rtasr', stable: false }),
    );
  });

  it('treats nested RTASR type 0 payloads as final sentence results', () => {
    const resultCallback = jest.fn();
    client.onResult(resultCallback);
    client.connect({ appId: 'test-app', apiKey: 'test-key', apiSecret: 'test-secret', language: 'en_us' });
    triggerEvent('open');

    triggerEvent('message', JSON.stringify({
      action: 'result',
      code: '0',
      data: JSON.stringify({
        seg_id: 7,
        cn: {
          st: {
            rt: [
              {
                ws: [
                  { cw: [{ w: 'First', wp: 'n' }] },
                  { cw: [{ w: ' sentence', wp: 'n' }] },
                ],
              },
            ],
            type: '0',
          },
        },
        ls: false,
      }),
    }));
    triggerEvent('message', JSON.stringify({ action: 'result', data: 'next sentence' }));

    expect(resultCallback).toHaveBeenNthCalledWith(
      1,
      'First sentence',
      true,
      expect.any(String),
      expect.objectContaining({ provider: 'xfyun-rtasr', stable: true }),
    );
    expect(resultCallback.mock.calls[1][2]).not.toBe(resultCallback.mock.calls[0][2]);
  });

  it('reports RTASR error messages through onError', () => {
    const errorCallback = jest.fn();
    client.onError(errorCallback);
    client.connect({ appId: 'test-app', apiKey: 'test-key', apiSecret: 'test-secret', language: 'en_us' });
    triggerEvent('open');

    triggerEvent('message', JSON.stringify({ action: 'error', code: '10105', desc: 'illegal access' }));

    expect(errorCallback).toHaveBeenCalledWith(expect.any(Error));
    expect(errorCallback.mock.calls[0][0].message).toContain('10105');
  });

  it('logs first result latency with provider and target metadata', () => {
    jest.setSystemTime(new Date('2026-06-23T10:00:00.000Z'));
    client.connect({ appId: 'test-app', apiKey: 'test-key', apiSecret: 'test-secret', language: 'en_us' });
    triggerEvent('open');
    client.sendAudio(new Int16Array([1, 2, 3, 4]));

    jest.setSystemTime(new Date('2026-06-23T10:00:01.500Z'));
    triggerEvent('message', JSON.stringify({ action: 'result', data: 'hello' }));

    expect(mockLogger.info).toHaveBeenCalledWith(
      'STT first result latency',
      expect.objectContaining({
        provider: 'xfyun-rtasr',
        firstResultLatencyMs: 1500,
        targetMs: 2000,
      }),
    );
  });

  it('does not auto reconnect after a fatal RTASR auth error', () => {
    const stateCallback = jest.fn();
    const errorCallback = jest.fn();
    client.onStateChange(stateCallback);
    client.onError(errorCallback);

    client.connect({ appId: 'test-app', apiKey: 'test-key', apiSecret: 'test-secret', language: 'en_us' });
    triggerEvent('open');
    MockWebSocket.mockClear();

    triggerEvent('message', JSON.stringify({ action: 'error', code: '10105', desc: 'illegal access|no appid info' }));
    triggerEvent('close', 1000, Buffer.from(''));
    jest.advanceTimersByTime(5000);

    expect(errorCallback).toHaveBeenCalledWith(expect.any(Error));
    expect(stateCallback).toHaveBeenCalledWith('failed');
    expect(MockWebSocket).not.toHaveBeenCalled();
  });
});
