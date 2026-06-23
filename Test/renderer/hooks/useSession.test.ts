/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { IPC_CHANNELS } from '../../../src/shared/ipcChannels';

function getListener(mockIpc: any, channel: string): ((data: unknown) => void) | undefined {
  const call = mockIpc.on.mock.calls.find((entry: unknown[]) => entry[0] === channel);
  return call?.[1];
}

describe('useSession', () => {
  let mockIpc: any;

  beforeEach(() => {
    mockIpc = {
      on: jest.fn().mockReturnValue(() => {}),
      startSession: jest.fn().mockResolvedValue(undefined),
      stopSession: jest.fn().mockResolvedValue(undefined),
      pauseSession: jest.fn().mockResolvedValue(undefined),
      resumeSession: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('starts with idle state and empty transcript', () => {
    const { result } = renderHook(() => {
      const { useSession } = require('../../../src/renderer/hooks/useSession');
      return useSession({ ipc: mockIpc });
    });

    expect(result.current.sessionState).toBe('idle');
    expect(result.current.currentTranscript).toBeNull();
    expect(result.current.confirmedTranscripts).toEqual([]);
    expect(result.current.latestTranscript).toBeNull();
    expect(result.current.notePath).toBeNull();
  });

  it('unsubscribes ipc listeners on unmount', () => {
    const unsub1 = jest.fn();
    const unsub2 = jest.fn();
    const unsub3 = jest.fn();
    const unsub4 = jest.fn();
    mockIpc.on = jest
      .fn()
      .mockReturnValueOnce(unsub1)
      .mockReturnValueOnce(unsub2)
      .mockReturnValueOnce(unsub3)
      .mockReturnValueOnce(unsub4)
      .mockReturnValue(() => {});

    const { unmount } = renderHook(() => {
      const { useSession } = require('../../../src/renderer/hooks/useSession');
      return useSession({ ipc: mockIpc });
    });

    unmount();

    expect(unsub1).toHaveBeenCalled();
    expect(unsub2).toHaveBeenCalled();
    expect(unsub3).toHaveBeenCalled();
    expect(unsub4).toHaveBeenCalled();
  });

  it('calls startSession and waits for main-process state events', async () => {
    const { result } = renderHook(() => {
      const { useSession } = require('../../../src/renderer/hooks/useSession');
      return useSession({ ipc: mockIpc });
    });

    await act(async () => {
      await result.current.startSession('system');
    });

    expect(result.current.sessionState).toBe('idle');
    expect(result.current.notePath).toBeNull();
    expect(mockIpc.startSession).toHaveBeenCalledWith('system');
  });

  it('waits for a main-process event after stopSession', async () => {
    const { result } = renderHook(() => {
      const { useSession } = require('../../../src/renderer/hooks/useSession');
      return useSession({ ipc: mockIpc });
    });

    await act(async () => {
      await result.current.stopSession();
    });

    expect(result.current.sessionState).toBe('idle');
  });

  it('waits for a main-process event after pauseSession', async () => {
    const { result } = renderHook(() => {
      const { useSession } = require('../../../src/renderer/hooks/useSession');
      return useSession({ ipc: mockIpc });
    });

    await act(async () => {
      await result.current.pauseSession();
    });

    expect(result.current.sessionState).toBe('idle');
  });

  it('waits for a main-process event after resumeSession', async () => {
    const { result } = renderHook(() => {
      const { useSession } = require('../../../src/renderer/hooks/useSession');
      return useSession({ ipc: mockIpc });
    });

    await act(async () => {
      await result.current.resumeSession();
    });

    expect(result.current.sessionState).toBe('idle');
  });

  it('consumes partial and final STT events', () => {
    const { result } = renderHook(() => {
      const { useSession } = require('../../../src/renderer/hooks/useSession');
      return useSession({ ipc: mockIpc });
    });

    act(() => {
      getListener(mockIpc, IPC_CHANNELS.STT_PARTIAL)?.({
        sentenceId: 's1',
        text: 'hello',
        isFinal: false,
        timestamp: 1,
      });
    });

    expect(result.current.currentTranscript).toEqual({
      sentenceId: 's1',
      text: 'hello',
      isFinal: false,
      timestamp: 1,
    });

    act(() => {
      getListener(mockIpc, IPC_CHANNELS.STT_SENTENCE)?.({
        sentenceId: 's1',
        text: 'hello world',
        isFinal: true,
        timestamp: 2,
      });
    });

    expect(result.current.currentTranscript).toBeNull();
    expect(result.current.confirmedTranscripts).toEqual([
      { sentenceId: 's1', text: 'hello world', isFinal: true, timestamp: 2 },
    ]);
    expect(result.current.latestTranscript).toEqual({
      sentenceId: 's1',
      text: 'hello world',
      isFinal: true,
      timestamp: 2,
    });
  });

  it('consumes partial and final translation events', () => {
    const { result } = renderHook(() => {
      const { useSession } = require('../../../src/renderer/hooks/useSession');
      return useSession({ ipc: mockIpc });
    });

    act(() => {
      getListener(mockIpc, IPC_CHANNELS.TRANSLATE_PARTIAL)?.({
        sentenceId: 's1',
        original: 'hello world',
        translation: '你好',
      });
    });

    expect(result.current.currentTranslation).toEqual({
      sentenceId: 's1',
      original: 'hello world',
      translation: '你好',
    });

    act(() => {
      getListener(mockIpc, IPC_CHANNELS.TRANSLATE_FINAL)?.({
        sentenceId: 's1',
        original: 'hello world',
        translation: '你好世界',
        isFinal: true,
        corrections: [],
      });
    });

    expect(result.current.currentTranslation).toBeNull();
    expect(result.current.confirmedTranslations).toEqual([
      {
        sentenceId: 's1',
        original: 'hello world',
        translation: '你好世界',
        isFinal: true,
        corrections: [],
      },
    ]);
  });

  it('clears current translation when a new STT sentence starts', () => {
    const { result } = renderHook(() => {
      const { useSession } = require('../../../src/renderer/hooks/useSession');
      return useSession({ ipc: mockIpc });
    });

    act(() => {
      getListener(mockIpc, IPC_CHANNELS.STT_PARTIAL)?.({
        sentenceId: 's1',
        text: 'first',
        isFinal: false,
        timestamp: 1,
      });
      getListener(mockIpc, IPC_CHANNELS.TRANSLATE_PARTIAL)?.({
        sentenceId: 's1',
        original: 'first',
        translation: 'first translated',
      });
    });

    expect(result.current.currentTranslation?.sentenceId).toBe('s1');

    act(() => {
      getListener(mockIpc, IPC_CHANNELS.STT_PARTIAL)?.({
        sentenceId: 's2',
        text: 'second',
        isFinal: false,
        timestamp: 2,
      });
    });

    expect(result.current.currentTranscript?.sentenceId).toBe('s2');
    expect(result.current.currentTranslation).toBeNull();
  });

  it('ignores partial translation events for an older active sentence', () => {
    const { result } = renderHook(() => {
      const { useSession } = require('../../../src/renderer/hooks/useSession');
      return useSession({ ipc: mockIpc });
    });

    act(() => {
      getListener(mockIpc, IPC_CHANNELS.STT_PARTIAL)?.({
        sentenceId: 's2',
        text: 'second',
        isFinal: false,
        timestamp: 2,
      });
      getListener(mockIpc, IPC_CHANNELS.TRANSLATE_PARTIAL)?.({
        sentenceId: 's1',
        original: 'first',
        translation: 'first translated',
      });
    });

    expect(result.current.currentTranslation).toBeNull();
  });

  it('keeps the active sentence translation when an older final translation arrives', () => {
    const { result } = renderHook(() => {
      const { useSession } = require('../../../src/renderer/hooks/useSession');
      return useSession({ ipc: mockIpc });
    });

    act(() => {
      getListener(mockIpc, IPC_CHANNELS.STT_PARTIAL)?.({
        sentenceId: 's2',
        text: 'second',
        isFinal: false,
        timestamp: 2,
      });
      getListener(mockIpc, IPC_CHANNELS.TRANSLATE_PARTIAL)?.({
        sentenceId: 's2',
        original: 'second',
        translation: 'second partial',
      });
      getListener(mockIpc, IPC_CHANNELS.TRANSLATE_FINAL)?.({
        sentenceId: 's1',
        original: 'first',
        translation: 'first final',
        isFinal: true,
        corrections: [],
      });
    });

    expect(result.current.currentTranslation).toEqual({
      sentenceId: 's2',
      original: 'second',
      translation: 'second partial',
    });
    expect(result.current.confirmedTranslations).toEqual([
      {
        sentenceId: 's1',
        original: 'first',
        translation: 'first final',
        isFinal: true,
        corrections: [],
      },
    ]);
  });

  it('consumes the latest saved note path from the main process', () => {
    const { result } = renderHook(() => {
      const { useSession } = require('../../../src/renderer/hooks/useSession');
      return useSession({ ipc: mockIpc });
    });

    act(() => {
      getListener(mockIpc, IPC_CHANNELS.NOTE_SAVED)?.({ filePath: 'D:/notes/2026-06-21/10-00.md' });
    });

    expect(result.current.notePath).toBe('D:/notes/2026-06-21/10-00.md');
  });

  it('consumes note summary events from main process', () => {
    const { result } = renderHook(() => {
      const { useSession } = require('../../../src/renderer/hooks/useSession');
      return useSession({ ipc: mockIpc });
    });

    act(() => {
      getListener(mockIpc, IPC_CHANNELS.NOTE_SUMMARY)?.({ summary: '会议摘要：已生成' });
    });

    expect(result.current.summary).toBe('会议摘要：已生成');
  });

  it('consumes enhancement status updates from main process', () => {
    const { result } = renderHook(() => {
      const { useSession } = require('../../../src/renderer/hooks/useSession');
      return useSession({ ipc: mockIpc });
    });

    act(() => {
      getListener(mockIpc, IPC_CHANNELS.ENHANCEMENT_STATUS)?.({
        kind: 'correction',
        state: 'completed',
        sessionId: 's1',
        corrections: [{ from: '旧译文', to: '新译文', reason: '术语统一', timestamp: 1 }],
      });
    });

    expect(result.current.enhancementStatus.correction.state).toBe('completed');
    expect(result.current.enhancementStatus.correction.corrections).toEqual([
      { from: '旧译文', to: '新译文', reason: '术语统一', timestamp: 1 },
    ]);
  });

  it('keeps sidecar correction state separate from confirmed translation results and stores recommendation updates', () => {
    const { result } = renderHook(() => {
      const { useSession } = require('../../../src/renderer/hooks/useSession');
      return useSession({ ipc: mockIpc });
    });

    act(() => {
      getListener(mockIpc, IPC_CHANNELS.TRANSLATE_FINAL)?.({
        sentenceId: 's3',
        original: 'Project kickoff',
        translation: '椤圭洰鍚姩',
        isFinal: true,
        corrections: [],
      });
      getListener(mockIpc, IPC_CHANNELS.ENHANCEMENT_STATUS)?.({
        kind: 'correction',
        state: 'completed',
        sessionId: 's3',
        corrections: [{ from: '椤圭洰鍚姩', to: '椤圭洰鍚姩浼?', reason: '鏇寸鍚堜笓涓氳〃杈?', timestamp: 2 }],
      });
      getListener(mockIpc, IPC_CHANNELS.ENHANCEMENT_STATUS)?.({
        kind: 'recommendation',
        state: 'completed',
        sessionId: 's3',
        recommendations: ['kickoff -> 鍚姩浼?'],
      });
    });

    expect(result.current.confirmedTranslations).toEqual([
      {
        sentenceId: 's3',
        original: 'Project kickoff',
        translation: '椤圭洰鍚姩',
        isFinal: true,
        corrections: [],
      },
    ]);
    expect(result.current.corrections).toEqual([]);
    expect(result.current.enhancementStatus.correction.corrections).toEqual([
      { from: '椤圭洰鍚姩', to: '椤圭洰鍚姩浼?', reason: '鏇寸鍚堜笓涓氳〃杈?', timestamp: 2 },
    ]);
    expect(result.current.enhancementStatus.recommendation.recommendations).toEqual(['kickoff -> 鍚姩浼?']);
  });

  it('consumes session state changes from main process', () => {
    const { result } = renderHook(() => {
      const { useSession } = require('../../../src/renderer/hooks/useSession');
      return useSession({ ipc: mockIpc });
    });

    act(() => {
      getListener(mockIpc, IPC_CHANNELS.SESSION_STATE_CHANGE)?.({ state: 'reconnecting' });
    });

    expect(result.current.sessionState).toBe('reconnecting');
  });

  it('registers note-saved channel for note path updates', () => {
    renderHook(() => {
      const { useSession } = require('../../../src/renderer/hooks/useSession');
      return useSession({ ipc: mockIpc });
    });

    const channels = mockIpc.on.mock.calls.map((call: any) => call[0]);
    expect(channels).toContain('stt:partial');
    expect(channels).toContain('stt:sentence');
    expect(channels).toContain('note:saved');
    expect(channels).toContain('session:state-change');
  });
});
