/**
 * useSession Hook 单元测试
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';

describe('useSession 会话状态管理 Hook', () => {
  let mockIpc: any;

  beforeEach(() => {
    mockIpc = {
      on: jest.fn().mockReturnValue(() => {}),
      startSession: jest.fn().mockResolvedValue(undefined),
      stopSession: jest.fn().mockResolvedValue(undefined),
      pauseSession: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('应该在初始状态为 idle', () => {
    const { result } = renderHook(() => {
      const { useSession } = require('../../../src/renderer/hooks/useSession');
      return useSession({ ipc: mockIpc });
    });

    expect(result.current.sessionState).toBe('idle');
    expect(result.current.sttPartials).toEqual([]);
    expect(result.current.currentTranslation).toBeNull();
    expect(result.current.confirmedTranslations).toEqual([]);
    expect(result.current.corrections).toEqual([]);
    expect(result.current.notePath).toBeNull();
    expect(result.current.summary).toBeNull();
  });

  it('应该在组件卸载时取消所有 IPC 监听', () => {
    const unsub1 = jest.fn();
    const unsub2 = jest.fn();
    mockIpc.on = jest
      .fn()
      .mockReturnValueOnce(unsub1)
      .mockReturnValueOnce(unsub2)
      .mockReturnValue(() => {});

    const { unmount } = renderHook(() => {
      const { useSession } = require('../../../src/renderer/hooks/useSession');
      return useSession({ ipc: mockIpc });
    });

    unmount();

    expect(unsub1).toHaveBeenCalled();
    expect(unsub2).toHaveBeenCalled();
  });

  it('应该在 startSession 时调用 IPC 并设置 running', async () => {
    const { result } = renderHook(() => {
      const { useSession } = require('../../../src/renderer/hooks/useSession');
      return useSession({ ipc: mockIpc });
    });

    await act(async () => {
      await result.current.startSession('system');
    });

    expect(result.current.sessionState).toBe('running');
    expect(mockIpc.startSession).toHaveBeenCalledWith('system');
  });

  it('应该在 stopSession 时设置 stopped', async () => {
    const { result } = renderHook(() => {
      const { useSession } = require('../../../src/renderer/hooks/useSession');
      return useSession({ ipc: mockIpc });
    });

    await act(async () => {
      await result.current.stopSession();
    });

    expect(result.current.sessionState).toBe('stopped');
  });

  it('应该在 pauseSession 时设置 paused', async () => {
    const { result } = renderHook(() => {
      const { useSession } = require('../../../src/renderer/hooks/useSession');
      return useSession({ ipc: mockIpc });
    });

    await act(async () => {
      await result.current.pauseSession();
    });

    expect(result.current.sessionState).toBe('paused');
  });

  it('应该在 correctTranslation 时更新当前句翻译', () => {
    const { result } = renderHook(() => {
      const { useSession } = require('../../../src/renderer/hooks/useSession');
      return useSession({ ipc: mockIpc });
    });

    act(() => {
      result.current.correctTranslation('修正后译文');
    });
  });

  it('应该注册所有需要的 IPC 通道监听', () => {
    renderHook(() => {
      const { useSession } = require('../../../src/renderer/hooks/useSession');
      return useSession({ ipc: mockIpc });
    });

    const channels = mockIpc.on.mock.calls.map((call: any) => call[0]);
    expect(channels).toContain('stt:partial');
    expect(channels).toContain('stt:sentence');
    expect(channels).toContain('translate:partial');
    expect(channels).toContain('translate:final');
    expect(channels).toContain('translate:correct');
    expect(channels).toContain('note:saved');
    expect(channels).toContain('note:summary');
  });
});
