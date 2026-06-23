import { XfyunIatClient } from '../../../src/main/modules/stt/XfyunIatClient';

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

jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return {
    ...actual,
    createHmac: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('mock-signature-base64'),
    }),
  };
});

jest.mock('../../../src/main/utils/logger', () => ({
  createLogger: jest.fn(() => mockLogger),
}));

describe('XfyunIatClient', () => {
  let sttClient: XfyunIatClient;
  let MockWebSocket: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    MockWebSocket = getMockWsCtor();
    sttClient = new XfyunIatClient();
  });

  afterEach(() => {
    jest.useRealTimers();
    sttClient.disconnect();
  });

  it('creates websocket and sends first frame on open', () => {
    sttClient.connect({
      appId: 'test-app',
      apiKey: 'test-key',
      apiSecret: 'test-secret',
      language: 'zh_cn',
    });

    expect(MockWebSocket).toHaveBeenCalledTimes(1);

    triggerEvent('open');

    expect(mockWsSend).toHaveBeenCalledTimes(1);
    const firstFrame = JSON.parse(mockWsSend.mock.calls[0][0]);
    expect(firstFrame.common.app_id).toBe('test-app');
    expect(firstFrame.data.status).toBe(0);
  });

  it('updates state to connected on open', () => {
    const stateCallback = jest.fn();
    sttClient.onStateChange(stateCallback);

    sttClient.connect({ appId: 'test', apiKey: 'key', apiSecret: 'secret', language: 'zh_cn' });
    triggerEvent('open');

    expect(sttClient.isConnected).toBe(true);
    expect(stateCallback).toHaveBeenCalledWith('connecting');
    expect(stateCallback).toHaveBeenCalledWith('connected');
  });

  it('parses partial result messages', () => {
    const resultCallback = jest.fn();
    sttClient.onResult(resultCallback);

    sttClient.connect({ appId: 'test', apiKey: 'key', apiSecret: 'secret', language: 'zh_cn' });
    triggerEvent('open');

    triggerEvent(
      'message',
      JSON.stringify({
        code: 0,
        data: {
          result: {
            ws: [{ cw: [{ w: 'Hello' }] }, { cw: [{ w: ' World' }] }],
          },
        },
      }),
    );

    expect(resultCallback).toHaveBeenCalledWith('Hello World', false, expect.any(String));
  });

  it('parses final result messages', () => {
    const resultCallback = jest.fn();
    sttClient.onResult(resultCallback);

    sttClient.connect({ appId: 'test', apiKey: 'key', apiSecret: 'secret', language: 'zh_cn' });
    triggerEvent('open');

    triggerEvent(
      'message',
      JSON.stringify({
        code: 0,
        data: {
          result: {
            ws: [{ cw: [{ w: 'Final text' }] }],
            ls: true,
          },
        },
      }),
    );

    expect(resultCallback).toHaveBeenCalledWith('Final text', true, expect.any(String));
  });

  it('reports api message errors', () => {
    const errorCallback = jest.fn();
    sttClient.onError(errorCallback);

    sttClient.connect({ appId: 'test', apiKey: 'key', apiSecret: 'secret', language: 'zh_cn' });
    triggerEvent('open');
    triggerEvent('message', JSON.stringify({ code: 10105, message: 'illegal access' }));

    expect(errorCallback).toHaveBeenCalled();
    expect(errorCallback.mock.calls[0][0].message).toContain('10105');
  });

  it('sends audio frames only when connected', () => {
    sttClient.connect({ appId: 'test', apiKey: 'key', apiSecret: 'secret', language: 'zh_cn' });
    triggerEvent('open');
    mockWsSend.mockClear();

    sttClient.sendAudio(new Int16Array([0, 100, -100, 200]));

    expect(mockWsSend).toHaveBeenCalledTimes(1);
    const frame = JSON.parse(mockWsSend.mock.calls[0][0]);
    expect(frame.data.status).toBe(1);
    expect(frame.data.audio).toBeTruthy();
  });

  it('logs first result latency from first sent audio frame', () => {
    jest.setSystemTime(new Date('2026-06-22T10:00:00.000Z'));
    sttClient.connect({ appId: 'test', apiKey: 'key', apiSecret: 'secret', language: 'zh_cn' });
    triggerEvent('open');
    mockWsSend.mockClear();

    sttClient.sendAudio(new Int16Array([0, 100, -100, 200]));

    jest.setSystemTime(new Date('2026-06-22T10:00:01.250Z'));
    triggerEvent(
      'message',
      JSON.stringify({
        code: 0,
        data: {
          result: {
            ws: [{ cw: [{ w: 'Hello' }] }],
          },
        },
      }),
    );

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        provider: 'xfyun-iat',
        firstResultLatencyMs: 1250,
        targetMs: 2000,
        audioFrames: 1,
      }),
    );
  });

  it('counts dropped frames when websocket is not ready', () => {
    sttClient.sendAudio(new Int16Array([0, 100]));

    expect(MockWebSocket).not.toHaveBeenCalled();
    expect(sttClient.getDroppedFrameCount()).toBe(1);
  });

  it('sends final frame and closes socket on disconnect', () => {
    sttClient.connect({ appId: 'test', apiKey: 'key', apiSecret: 'secret', language: 'zh_cn' });
    triggerEvent('open');
    mockWsSend.mockClear();

    sttClient.disconnect();

    expect(mockWsSend).toHaveBeenCalled();
    expect(JSON.parse(mockWsSend.mock.calls[0][0]).data.status).toBe(2);
    expect(mockWsClose).toHaveBeenCalled();
    expect(sttClient.isConnected).toBe(false);
  });

  it('does not auto reconnect after manual disconnect', () => {
    sttClient.connect({ appId: 'test', apiKey: 'key', apiSecret: 'secret', language: 'zh_cn' });
    triggerEvent('open');

    sttClient.disconnect();
    jest.advanceTimersByTime(10000);

    expect(MockWebSocket).toHaveBeenCalledTimes(1);
  });

  it('reports reconnecting on unexpected close and stops after max retries', () => {
    const stateCallback = jest.fn();
    const errorCallback = jest.fn();
    sttClient.onStateChange(stateCallback);
    sttClient.onError(errorCallback);

    sttClient.connect({ appId: 'test', apiKey: 'key', apiSecret: 'secret', language: 'zh_cn' });
    triggerEvent('open');
    MockWebSocket.mockClear();

    triggerEvent('close');
    expect(stateCallback).toHaveBeenCalledWith('reconnecting');
    jest.advanceTimersByTime(2001);
    expect(MockWebSocket).toHaveBeenCalledTimes(1);

    triggerEvent('close');
    jest.advanceTimersByTime(2001);
    expect(MockWebSocket).toHaveBeenCalledTimes(2);

    triggerEvent('close');
    jest.advanceTimersByTime(2001);
    expect(MockWebSocket).toHaveBeenCalledTimes(3);

    MockWebSocket.mockClear();
    triggerEvent('close');
    jest.advanceTimersByTime(2001);
    expect(MockWebSocket).not.toHaveBeenCalled();
    expect(errorCallback).toHaveBeenCalled();
  });

  it('logs websocket close code and reason', () => {
    sttClient.connect({ appId: 'test', apiKey: 'key', apiSecret: 'secret', language: 'zh_cn' });
    triggerEvent('open');

    triggerEvent('close', 1006, Buffer.from('network lost'));

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        code: 1006,
        reason: 'network lost',
      }),
    );
  });

  it('does not enable XFYun dynamic correction for English IAT sessions', () => {
    sttClient.setLanguage('en_us');
    sttClient.connect({
      appId: 'test-app',
      apiKey: 'test-key',
      apiSecret: 'test-secret',
      language: 'en_us',
    });

    triggerEvent('open');

    const firstFrame = JSON.parse(mockWsSend.mock.calls[0][0]);
    expect(firstFrame.business.language).toBe('en_us');
    expect(firstFrame.business.dwa).toBeUndefined();
  });
});
