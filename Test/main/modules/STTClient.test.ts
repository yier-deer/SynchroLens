/**
 * STTClient 讯飞 WebSocket 实时转写客户端单元测试
 * 测试 WebSocket 连接、音频发送、结果解析、断线重连
 */

import { STTClient } from '../../../src/main/modules/stt/STTClient';

/** 当前模拟的 WebSocket 实例 */
let mockWsInstance: any;
let mockWsOn: any;
let mockWsSend: any;
let mockWsClose: any;
let handlers: Record<string, (...args: any[]) => void>;

/** 触发 WebSocket 事件 */
function triggerEvent(event: string, ...args: any[]) {
  if (handlers[event]) {
    handlers[event](...args);
  }
}

/** 获取 Mock WebSocket 构造函数引用 */
function getMockWsCtor(): jest.Mock {
  return (require('ws').default as jest.Mock);
}

// Mock ws 模块
jest.mock('ws', () => {
  const mockCtor = jest.fn().mockImplementation(() => {
    handlers = {};
    mockWsOn = jest.fn((event: string, handler: (...args: any[]) => void) => {
      handlers[event] = handler;
    });
    mockWsSend = jest.fn();
    mockWsClose = jest.fn();
    mockWsInstance = {
      on: mockWsOn,
      send: mockWsSend,
      close: mockWsClose,
      readyState: 1, // OPEN
    };
    return mockWsInstance;
  });

  // WebSocket.OPEN 静态常量
  (mockCtor as any).OPEN = 1;

  return {
    __esModule: true,
    default: mockCtor,
  };
});

// Mock crypto.createHmac
jest.mock('crypto', () => {
  const actualCrypto = jest.requireActual('crypto');
  return {
    ...actualCrypto,
    createHmac: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('mock-signature-base64'),
    }),
  };
});

describe('STTClient 讯飞实时转写客户端', () => {
  let sttClient: STTClient;
  let MockWebSocket: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    MockWebSocket = getMockWsCtor();
    sttClient = new STTClient();
  });

  afterEach(() => {
    jest.useRealTimers();
    sttClient.disconnect();
  });

  describe('connect 建立连接', () => {
    it('应该创建 WebSocket 连接并在打开后发送首帧', () => {
      const config = { appId: 'test-app', apiKey: 'test-key', apiSecret: 'test-secret' };
      sttClient.connect(config);

      expect(MockWebSocket).toHaveBeenCalledTimes(1);

      triggerEvent('open');

      expect(mockWsSend).toHaveBeenCalledTimes(1);
      const firstFrame = JSON.parse(mockWsSend.mock.calls[0][0]);
      expect(firstFrame.common.app_id).toBe('test-app');
      expect(firstFrame.data.status).toBe(0);
      expect(firstFrame.data.format).toBe('audio/L16;rate=16000');
    });

    it('应该在连接建立后设置 isConnected 为 true', () => {
      sttClient.connect({ appId: 'test', apiKey: 'key', apiSecret: 'secret' });
      triggerEvent('open');
      expect(sttClient.isConnected).toBe(true);
    });

    it('应该在连接错误时通知错误回调', () => {
      const errorCallback = jest.fn();
      sttClient.onError(errorCallback);

      sttClient.connect({ appId: 'test', apiKey: 'key', apiSecret: 'secret' });
      triggerEvent('error', new Error('Connection refused'));

      expect(errorCallback).toHaveBeenCalled();
      expect(errorCallback.mock.calls[0][0]).toBeInstanceOf(Error);
    });

    it('应该在连接关闭时通知关闭回调', () => {
      const closeCallback = jest.fn();
      sttClient.onClose(closeCallback);

      sttClient.connect({ appId: 'test', apiKey: 'key', apiSecret: 'secret' });
      triggerEvent('close');

      expect(closeCallback).toHaveBeenCalled();
      expect(sttClient.isConnected).toBe(false);
    });
  });

  describe('sendAudio 发送音频数据', () => {
    it('应该在连接状态下发送 base64 编码的音频帧', () => {
      sttClient.connect({ appId: 'test', apiKey: 'key', apiSecret: 'secret' });
      triggerEvent('open');
      mockWsSend.mockClear();

      const pcmData = new Int16Array([0, 100, -100, 200]);
      sttClient.sendAudio(pcmData);

      expect(mockWsSend).toHaveBeenCalledTimes(1);

      const frame = JSON.parse(mockWsSend.mock.calls[0][0]);
      expect(frame.data.status).toBe(1);
      expect(frame.data.encoding).toBe('raw');
      expect(frame.data.audio).toBeTruthy();
    });

    it('应该在未连接时不发送数据', () => {
      const pcmData = new Int16Array([0, 100, -100, 200]);
      sttClient.sendAudio(pcmData);

      expect(MockWebSocket).not.toHaveBeenCalled();
    });

    it('应该在 WebSocket 非 OPEN 状态时不发送数据', () => {
      sttClient.connect({ appId: 'test', apiKey: 'key', apiSecret: 'secret' });
      triggerEvent('open');
      mockWsInstance.readyState = 3; // CLOSED
      mockWsSend.mockClear();

      const pcmData = new Int16Array([0, 100]);
      sttClient.sendAudio(pcmData);

      expect(mockWsSend).not.toHaveBeenCalled();
    });
  });

  describe('disconnect 断开连接', () => {
    it('应该发送结束帧并关闭连接', () => {
      sttClient.connect({ appId: 'test', apiKey: 'key', apiSecret: 'secret' });
      triggerEvent('open');
      mockWsSend.mockClear();

      sttClient.disconnect();

      expect(mockWsSend).toHaveBeenCalled();
      const endFrame = JSON.parse(mockWsSend.mock.calls[0][0]);
      expect(endFrame.data.status).toBe(2);
      expect(endFrame.data.audio).toBe('');

      expect(mockWsClose).toHaveBeenCalled();
      expect(sttClient.isConnected).toBe(false);
    });

    it('应该在断开连接后停止自动重连', () => {
      sttClient.connect({ appId: 'test', apiKey: 'key', apiSecret: 'secret' });
      triggerEvent('open');

      sttClient.disconnect();

      jest.advanceTimersByTime(10000);
      expect(MockWebSocket).toHaveBeenCalledTimes(1);
    });
  });

  describe('onResult 结果回调', () => {
    it('应该在收到中间结果时以 isFinal=false 回调', () => {
      const resultCallback = jest.fn();
      sttClient.onResult(resultCallback);

      sttClient.connect({ appId: 'test', apiKey: 'key', apiSecret: 'secret' });
      triggerEvent('open');

      const partialMessage = JSON.stringify({
        code: 0,
        data: {
          result: {
            ws: [
              { cw: [{ w: 'Hello' }] },
              { cw: [{ w: ' ' }] },
              { cw: [{ w: 'World' }] },
            ],
          },
        },
      });
      triggerEvent('message', partialMessage);

      expect(resultCallback).toHaveBeenCalled();
      const callArgs = resultCallback.mock.calls[0];
      expect(callArgs[0]).toBe('Hello World');
      expect(callArgs[1]).toBe(false);
      expect(typeof callArgs[2]).toBe('string');
    });

    it('应该在 ws 格式的结果中正确解析中英文混合文本', () => {
      const resultCallback = jest.fn();
      sttClient.onResult(resultCallback);

      sttClient.connect({ appId: 'test', apiKey: 'key', apiSecret: 'secret' });
      triggerEvent('open');

      const message = JSON.stringify({
        code: 0,
        data: {
          result: {
            ws: [
              { cw: [{ w: '测试' }, { w: '文本' }] },
            ],
          },
        },
      });
      triggerEvent('message', message);

      expect(resultCallback.mock.calls[0][0]).toBe('测试文本');
    });

    it('应该在收到句结束信号（ls=true）时以 isFinal=true 回调', () => {
      const resultCallback = jest.fn();
      sttClient.onResult(resultCallback);

      sttClient.connect({ appId: 'test', apiKey: 'key', apiSecret: 'secret' });
      triggerEvent('open');

      const finalMessage = JSON.stringify({
        code: 0,
        data: {
          result: {
            ws: [{ cw: [{ w: 'Final text' }] }],
            ls: true,
          },
        },
      });
      triggerEvent('message', finalMessage);

      expect(resultCallback.mock.calls[0][1]).toBe(true);
    });

    it('应该在 API 返回错误码时触发 onError', () => {
      const errorCallback = jest.fn();
      sttClient.onError(errorCallback);

      sttClient.connect({ appId: 'test', apiKey: 'key', apiSecret: 'secret' });
      triggerEvent('open');

      const errorMessage = JSON.stringify({
        code: 10105,
        message: 'illegal access',
      });
      triggerEvent('message', errorMessage);

      expect(errorCallback).toHaveBeenCalled();
      expect(errorCallback.mock.calls[0][0].message).toContain('10105');
    });
  });

  describe('重连机制', () => {
    it('应该手动 reconnect 重置计数器并重连', () => {
      sttClient.connect({ appId: 'test', apiKey: 'key', apiSecret: 'secret' });
      triggerEvent('close');

      MockWebSocket.mockClear();
      sttClient.reconnect();

      expect(MockWebSocket).toHaveBeenCalledTimes(1);
    });

    it('应该在连续3次连接断开后不再自动重连', () => {
      sttClient.connect({ appId: 'test', apiKey: 'key', apiSecret: 'secret' });
      MockWebSocket.mockClear();

      // 第1次断开 → 自动重连 #1
      triggerEvent('close');
      jest.advanceTimersByTime(2001);
      expect(MockWebSocket).toHaveBeenCalledTimes(1);

      // 第2次断开（不触发 open，继续累积计数）→ 自动重连 #2
      triggerEvent('close');
      jest.advanceTimersByTime(2001);
      expect(MockWebSocket).toHaveBeenCalledTimes(2);

      // 第3次断开 → 自动重连 #3
      triggerEvent('close');
      jest.advanceTimersByTime(2001);
      expect(MockWebSocket).toHaveBeenCalledTimes(3);

      // 第4次断开 — 超过最大3次，不应再重连
      const errorCallback = jest.fn();
      sttClient.onError(errorCallback);
      MockWebSocket.mockClear();
      triggerEvent('close');
      jest.advanceTimersByTime(2001);
      expect(MockWebSocket).not.toHaveBeenCalled();

      expect(errorCallback).toHaveBeenCalled();
      expect(errorCallback.mock.calls[0][0].message).toContain('最大重试次数');
    });
  });

  describe('多个回调注册', () => {
    it('应该支持多个 onResult 回调', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();

      sttClient.onResult(cb1);
      sttClient.onResult(cb2);

      sttClient.connect({ appId: 'test', apiKey: 'key', apiSecret: 'secret' });
      triggerEvent('open');

      const message = JSON.stringify({
        code: 0,
        data: {
          result: {
            ws: [{ cw: [{ w: 'Hello' }] }],
          },
        },
      });
      triggerEvent('message', message);

      expect(cb1).toHaveBeenCalled();
      expect(cb2).toHaveBeenCalled();
    });
  });

  describe('isConnected 状态', () => {
    it('应该在初始状态返回 false', () => {
      expect(sttClient.isConnected).toBe(false);
    });

    it('应该在连接后返回 true', () => {
      sttClient.connect({ appId: 'test', apiKey: 'key', apiSecret: 'secret' });
      triggerEvent('open');
      expect(sttClient.isConnected).toBe(true);
    });

    it('应该在断开后返回 false', () => {
      sttClient.connect({ appId: 'test', apiKey: 'key', apiSecret: 'secret' });
      triggerEvent('open');
      sttClient.disconnect();
      expect(sttClient.isConnected).toBe(false);
    });
  });
});
