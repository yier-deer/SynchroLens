/**
 * useIPC Hook 单元测试
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';

function createMockAPI() {
  return {
    on: jest.fn((_channel: string, _callback: (data: unknown) => void) => jest.fn()),
    off: jest.fn(),
    startSession: jest.fn().mockResolvedValue(undefined),
    stopSession: jest.fn().mockResolvedValue(undefined),
    pauseSession: jest.fn().mockResolvedValue(undefined),
    updateConfig: jest.fn().mockResolvedValue(undefined),
    triggerSummary: jest.fn().mockResolvedValue(undefined),
  };
}

describe('useIPC IPC 通信 Hook', () => {
  let mockApi: ReturnType<typeof createMockAPI>;

  beforeEach(() => {
    mockApi = createMockAPI();
    (globalThis as any).synchroLens = mockApi;
  });

  afterEach(() => {
    delete (globalThis as any).synchroLens;
  });

  it('应该在 synchroLens 存在时返回完整 API', () => {
    const { result } = renderHook(() => {
      const { useIPC } = require('../../../src/renderer/hooks/useIPC');
      return useIPC();
    });

    expect(typeof result.current.on).toBe('function');
    expect(typeof result.current.startSession).toBe('function');
    expect(typeof result.current.stopSession).toBe('function');
    expect(typeof result.current.pauseSession).toBe('function');
    expect(typeof result.current.updateConfig).toBe('function');
    expect(typeof result.current.triggerSummary).toBe('function');
    expect(result.current.IPC_CHANNELS).toBeDefined();
  });

  it('应该在 API 缺失时调用操作抛出异常', async () => {
    delete (globalThis as any).synchroLens;

    const { result } = renderHook(() => {
      const { useIPC } = require('../../../src/renderer/hooks/useIPC');
      return useIPC();
    });

    try {
      await act(async () => {
        await result.current.startSession('microphone');
      });
      fail('应该抛出异常');
    } catch (err: any) {
      expect(err.message).toContain('API 未就绪');
    }
  });

  it('应该代理 startSession 调用', async () => {
    const { result } = renderHook(() => {
      const { useIPC } = require('../../../src/renderer/hooks/useIPC');
      return useIPC();
    });

    await act(async () => {
      await result.current.startSession('microphone');
    });

    expect(mockApi.startSession).toHaveBeenCalledWith('microphone');
  });

  it('应该代理 stopSession 调用', async () => {
    const { result } = renderHook(() => {
      const { useIPC } = require('../../../src/renderer/hooks/useIPC');
      return useIPC();
    });

    await act(async () => {
      await result.current.stopSession();
    });

    expect(mockApi.stopSession).toHaveBeenCalled();
  });

  it('应该代理 pauseSession 调用', async () => {
    const { result } = renderHook(() => {
      const { useIPC } = require('../../../src/renderer/hooks/useIPC');
      return useIPC();
    });

    await act(async () => {
      await result.current.pauseSession();
    });

    expect(mockApi.pauseSession).toHaveBeenCalled();
  });

  it('应该代理 triggerSummary 调用', async () => {
    const { result } = renderHook(() => {
      const { useIPC } = require('../../../src/renderer/hooks/useIPC');
      return useIPC();
    });

    await act(async () => {
      await result.current.triggerSummary();
    });

    expect(mockApi.triggerSummary).toHaveBeenCalled();
  });

  it('应该支持 on 事件注册并返回取消函数', () => {
    const { result } = renderHook(() => {
      const { useIPC } = require('../../../src/renderer/hooks/useIPC');
      return useIPC();
    });

    const callback = jest.fn();
    const unsub = result.current.on('stt:partial', callback);

    expect(mockApi.on).toHaveBeenCalledWith('stt:partial', callback);
    expect(typeof unsub).toBe('function');
  });
});
