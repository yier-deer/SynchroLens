import {
  registerIPCHandlers,
  sendToAllWindows,
  setModuleRegistry,
  setBrowserWindows,
  ModuleRegistry,
} from '../../../src/main/ipc/handlers';

jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
  },
  BrowserWindow: jest.fn(),
}));

describe('ipc handlers 通道处理器', () => {
  let mockRegistry: Parameters<typeof setModuleRegistry>[0];

  beforeEach(() => {
    jest.clearAllMocks();

    mockRegistry = {
      audioCapture: {
        start: jest.fn(),
        stop: jest.fn(),
        onData: jest.fn(),
        getAvailableDevices: jest.fn(),
      },
      sttClient: {
        connect: jest.fn(),
        sendAudio: jest.fn(),
        disconnect: jest.fn(),
        onResult: jest.fn(),
        onError: jest.fn(),
        onClose: jest.fn(),
        reconnect: jest.fn(),
      },
      translator: {
        translate: jest.fn(),
        translateFull: jest.fn(),
        generateSummary: jest.fn(),
      },
      noteWriter: {
        createNoteFile: jest.fn(),
        appendEntry: jest.fn(),
        appendSummary: jest.fn(),
      },
      correctionDetector: {
        checkConsistency: jest.fn(),
        shouldCheck: jest.fn(),
      },
      sessionManager: {
        createSession: jest.fn(),
        startSession: jest.fn(),
        pauseSession: jest.fn(),
        resumeSession: jest.fn(),
        endSession: jest.fn(),
        getSessionState: jest.fn(),
        updateConfig: jest.fn(),
        triggerSummary: jest.fn(),
      },
    };
  });

  describe('registerIPCHandlers', () => {
    it('应该注册 session:start 通道', () => {
      const { ipcMain } = require('electron');
      registerIPCHandlers();
      setModuleRegistry(mockRegistry);

      expect(ipcMain.handle).toHaveBeenCalledWith('session:start', expect.any(Function));
    });

    it('应该在注册后设置5个 ipcMain.handle 通道', () => {
      const { ipcMain } = require('electron');
      registerIPCHandlers();

      const channels = ipcMain.handle.mock.calls.map((call: unknown[]) => call[0]);
      expect(channels).toContain('session:start');
      expect(channels).toContain('session:stop');
      expect(channels).toContain('session:pause');
      expect(channels).toContain('config:update');
      expect(channels).toContain('summary:trigger');
    });
  });

  describe('session:start 处理逻辑', () => {
    it('应该在 payload 正确时调用 sessionManager.createSession', async () => {
      const { ipcMain } = require('electron');
      registerIPCHandlers();
      setModuleRegistry(mockRegistry);

      const handler = ipcMain.handle.mock.calls.find(
        (call: unknown[]) => call[0] === 'session:start',
      )?.[1];

      expect(handler).toBeDefined();

      mockRegistry.sessionManager.createSession = jest.fn().mockReturnValue({
        id: 'test-session',
        startTime: Date.now(),
        audioSource: 'system',
        sentences: [],
      });

      const payload = { audioSource: 'system' as const };
      const result = await handler({}, payload);

      expect(mockRegistry.sessionManager.createSession).toHaveBeenCalledWith(payload);
      expect(mockRegistry.sessionManager.startSession).toHaveBeenCalledWith('test-session');
      expect(result.id).toBe('test-session');
    });
  });

  describe('session:stop 处理逻辑', () => {
    it('应该调用 sessionManager.endSession', async () => {
      const { ipcMain } = require('electron');
      registerIPCHandlers();
      setModuleRegistry(mockRegistry);

      const handler = ipcMain.handle.mock.calls.find(
        (call: unknown[]) => call[0] === 'session:stop',
      )?.[1];

      await handler({});
      expect(mockRegistry.sessionManager.endSession).toHaveBeenCalled();
    });
  });

  describe('session:pause 处理逻辑', () => {
    it('应该调用 sessionManager.pauseSession', async () => {
      const { ipcMain } = require('electron');
      registerIPCHandlers();
      setModuleRegistry(mockRegistry);

      const handler = ipcMain.handle.mock.calls.find(
        (call: unknown[]) => call[0] === 'session:pause',
      )?.[1];

      await handler({});
      expect(mockRegistry.sessionManager.pauseSession).toHaveBeenCalled();
    });
  });

  describe('config:update 处理逻辑', () => {
    it('应该将配置传递给 sessionManager.updateConfig', async () => {
      const { ipcMain } = require('electron');
      registerIPCHandlers();
      setModuleRegistry(mockRegistry);

      const handler = ipcMain.handle.mock.calls.find(
        (call: unknown[]) => call[0] === 'config:update',
      )?.[1];

      const config = { translation: { targetLanguage: 'en-US' } };
      await handler({}, config);
      expect(mockRegistry.sessionManager.updateConfig).toHaveBeenCalledWith(config);
    });
  });

  describe('summary:trigger 处理逻辑', () => {
    it('应该调用 sessionManager.triggerSummary', async () => {
      const { ipcMain } = require('electron');
      registerIPCHandlers();
      setModuleRegistry(mockRegistry);

      const handler = ipcMain.handle.mock.calls.find(
        (call: unknown[]) => call[0] === 'summary:trigger',
      )?.[1];

      await handler({});
      expect(mockRegistry.sessionManager.triggerSummary).toHaveBeenCalled();
    });
  });

  describe('sendToAllWindows', () => {
    it('应该向所有窗口推送数据', () => {
      const mockSend = jest.fn();
      const mockWin = {
        webContents: { send: mockSend },
        isDestroyed: jest.fn().mockReturnValue(false),
      };

      setBrowserWindows([mockWin as any] as any);

      sendToAllWindows('stt:partial', { text: 'hello' });

      expect(mockSend).toHaveBeenCalledWith('synchroLens:event', 'stt:partial', { text: 'hello' });
    });

    it('应该跳过已销毁的窗口', () => {
      const mockSend = jest.fn();
      const mockWin = {
        webContents: { send: mockSend },
        isDestroyed: jest.fn().mockReturnValue(true),
      };

      setBrowserWindows([mockWin as any] as any);

      sendToAllWindows('stt:partial', { text: 'hello' });
      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});
