/**
 * SessionManager 会话生命周期管理器单元测试
 * 测试会话创建、管线编排、状态管理、摘要生成
 */

import { SessionManager, SessionDependencies } from '../../../src/main/modules/session/SessionManager';
import type { Session } from '../../../src/shared/types';

/** 创建完整的模拟依赖 */
function createMockDeps(): SessionDependencies {
  return {
    audioCapture: {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn(),
      onData: jest.fn(() => jest.fn()), // 返回取消订阅函数
      isRunning: false,
    },
    sttClient: {
      connect: jest.fn(),
      sendAudio: jest.fn(),
      disconnect: jest.fn(),
      onResult: jest.fn(),
      isConnected: false,
    },
    translator: {
      translate: jest.fn(),
      buildContextWindow: jest.fn(),
      translateFull: jest.fn(),
      generateSummary: jest.fn(),
      setApiKey: jest.fn(),
    },
    noteWriter: {
      createNoteFile: jest.fn(),
      appendEntry: jest.fn().mockResolvedValue(undefined),
      appendSummary: jest.fn().mockResolvedValue(undefined),
      writeHeader: jest.fn().mockResolvedValue(undefined),
    },
    correctionDetector: {
      checkConsistency: jest.fn().mockResolvedValue([]),
      shouldCheck: jest.fn().mockReturnValue(false),
      currentSentenceCount: 0,
    },
  };
}

/** 创建测试会话 */
function createTestSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'test-session-1',
    startTime: Date.now(),
    audioSource: 'system',
    sentences: [],
    ...overrides,
  };
}

describe('SessionManager 会话生命周期管理器', () => {
  let manager: SessionManager;
  let deps: SessionDependencies;

  beforeEach(() => {
    jest.clearAllMocks();
    deps = createMockDeps();
    manager = new SessionManager(deps);
  });

  describe('createSession 创建会话', () => {
    it('应该创建新会话并返回 Session 对象', () => {
      const session = manager.createSession('system');

      expect(session.id).toBeTruthy();
      expect(session.audioSource).toBe('system');
      expect(session.startTime).toBeGreaterThan(0);
      expect(session.sentences).toEqual([]);
      expect(session.endTime).toBeUndefined();
    });

    it('应该创建麦克风来源的会话', () => {
      const session = manager.createSession('microphone');

      expect(session.audioSource).toBe('microphone');
    });
  });

  describe('startSession 启动会话', () => {
    it('应该启动音频采集', () => {
      const session = createTestSession();
      manager.startSession(session);

      expect(deps.audioCapture.start).toHaveBeenCalledWith('system');
    });

    it('应该在启动后设置音频→STT 数据管线', () => {
      const session = createTestSession();
      manager.startSession(session);

      expect(deps.audioCapture.onData).toHaveBeenCalled();
      expect(deps.sttClient.onResult).toHaveBeenCalled();
    });

    it('应该通知状态变更为 running', () => {
      const stateCallback = jest.fn();
      manager.onSessionStateChange(stateCallback);

      const session = createTestSession();
      manager.startSession(session);

      expect(stateCallback).toHaveBeenCalledWith(session.id, 'running');
    });

    it('应该在 STT 中间结果时触发回调', () => {
      const sttCallback = jest.fn();
      manager.onSessionSTTPartial(sttCallback);

      const session = createTestSession();
      manager.startSession(session);

      // 获取注册的 onResult 回调并触发中间结果
      const onResultCallback = (deps.sttClient.onResult as jest.Mock).mock.calls[0][0];
      onResultCallback('partial text', false, 'sent-1');

      expect(sttCallback).toHaveBeenCalled();
      expect(sttCallback.mock.calls[0][1]).toEqual({
        sentenceId: 'sent-1',
        text: 'partial text',
        isFinal: false,
      });
    });
  });

  describe('pauseSession / resumeSession 暂停和恢复', () => {
    it('应该在暂停时停止音频采集', () => {
      const session = createTestSession();
      manager.startSession(session);

      manager.pauseSession();

      expect(deps.audioCapture.stop).toHaveBeenCalled();
    });

    it('应该在恢复时重启音频采集', () => {
      const session = createTestSession();
      manager.startSession(session);

      manager.pauseSession();
      manager.resumeSession();

      expect(deps.audioCapture.start).toHaveBeenCalledTimes(2);
      expect(deps.audioCapture.start).toHaveBeenLastCalledWith('system');
    });

    it('应该在暂停和恢复时通知状态变更', () => {
      const stateCallback = jest.fn();
      manager.onSessionStateChange(stateCallback);

      const session = createTestSession();
      manager.startSession(session);
      jest.clearAllMocks();

      manager.pauseSession();
      expect(stateCallback).toHaveBeenCalledWith(session.id, 'paused');

      manager.resumeSession();
      expect(stateCallback).toHaveBeenCalledWith(session.id, 'running');
    });
  });

  describe('endSession 结束会话', () => {
    it('应该停止所有模块', () => {
      const session = createTestSession();
      manager.startSession(session);

      manager.endSession();

      expect(deps.audioCapture.stop).toHaveBeenCalled();
      expect(deps.sttClient.disconnect).toHaveBeenCalled();
    });

    it('应该在结束后清除活跃会话', () => {
      const session = createTestSession();
      manager.startSession(session);

      manager.endSession();

      expect(manager.currentSession).toBeNull();
    });

    it('应该通知状态变更为 stopped', () => {
      const stateCallback = jest.fn();
      manager.onSessionStateChange(stateCallback);

      const session = createTestSession();
      manager.startSession(session);
      jest.clearAllMocks();

      manager.endSession();

      expect(stateCallback).toHaveBeenCalledWith(session.id, 'stopped');
    });
  });

  describe('getSessionState 获取状态', () => {
    it('应该在没有活跃会话时返回 idle', () => {
      expect(manager.getSessionState()).toBe('idle');
    });

    it('应该在音频采集运行时返回 running', () => {
      Object.defineProperty(deps.audioCapture, 'isRunning', { value: true, configurable: true });
      const session = createTestSession();
      manager.startSession(session);

      expect(manager.getSessionState()).toBe('running');
    });

    it('应该在音频采集停止时返回 paused', () => {
      const session = createTestSession();
      manager.startSession(session);
      manager.pauseSession();

      Object.defineProperty(deps.audioCapture, 'isRunning', { value: false, configurable: true });
      expect(manager.getSessionState()).toBe('paused');
    });
  });

  describe('triggerSummary 触发摘要', () => {
    it('应该在无活跃会话时直接返回', async () => {
      await manager.triggerSummary();

      expect(deps.translator.generateSummary).not.toHaveBeenCalled();
    });

    it('应该在无已确认句子时直接返回', async () => {
      const session = createTestSession();
      manager.startSession(session);

      await manager.triggerSummary();

      expect(deps.translator.generateSummary).not.toHaveBeenCalled();
    });
  });
});
