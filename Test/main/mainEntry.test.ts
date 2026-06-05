/**
 * Electron 主进程入口单元测试
 * 测试窗口创建和生命周期注册
 */

const mockBrowserWindow = jest.fn();

jest.mock('../../src/main/utils/logger', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  return {
    __esModule: true,
    default: mockLogger,
    createLogger: jest.fn().mockReturnValue(mockLogger),
    writeLogEntry: jest.fn(),
    setLogLevel: jest.fn(),
  };
});

jest.mock('electron', () => ({
  app: {
    whenReady: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    isPackaged: false,
    quit: jest.fn(),
  },
  BrowserWindow: mockBrowserWindow,
}));

jest.mock('path', () => ({
  join: jest.fn((...args: string[]) => args.join('/')),
  resolve: jest.fn((...args: string[]) => args.join('/')),
  basename: jest.fn((p: string) => p.split('/').pop() || p),
}));

describe('主进程入口 mainEntry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 重置模块以清除 mainEntry 内部状态
    jest.resetModules();
    mockBrowserWindow.mockImplementation(() => ({
      loadFile: jest.fn().mockReturnThis(),
      show: jest.fn(),
      setIgnoreMouseEvents: jest.fn(),
      on: jest.fn().mockReturnThis(),
      once: jest.fn().mockReturnThis(),
      isDestroyed: jest.fn().mockReturnValue(false),
      webContents: { send: jest.fn() },
      close: jest.fn(),
    }));
  });

  describe('registerAppLifecycle 生命周期注册', () => {
    it('应该在 app.whenReady 后创建主窗口', async () => {
      const { registerAppLifecycle } = require('../../src/main/mainEntry');
      const { app } = require('electron');

      registerAppLifecycle();
      await Promise.resolve();
      await Promise.resolve();

      expect(mockBrowserWindow).toHaveBeenCalled();
    });

    it('应该注册 window-all-closed 事件', () => {
      const { registerAppLifecycle } = require('../../src/main/mainEntry');
      const { app } = require('electron');

      registerAppLifecycle();

      expect(app.on).toHaveBeenCalledWith('window-all-closed', expect.any(Function));
    });
  });

  describe('getMainWindow', () => {
    it('应该在主窗口未创建时返回 null', () => {
      const { getMainWindow } = require('../../src/main/mainEntry');

      expect(getMainWindow()).toBeNull();
    });
  });

  describe('getSubtitleWindow', () => {
    it('应该在字幕窗口未创建时返回 null', () => {
      const { getSubtitleWindow } = require('../../src/main/mainEntry');

      expect(getSubtitleWindow()).toBeNull();
    });
  });

  describe('getControlWindow', () => {
    it('应该在控制窗口未创建时返回 null', () => {
      const { getControlWindow } = require('../../src/main/mainEntry');

      expect(getControlWindow()).toBeNull();
    });
  });

  describe('getAllWindows', () => {
    it('应该在无窗口时返回空数组', () => {
      const { getAllWindows } = require('../../src/main/mainEntry');

      expect(getAllWindows()).toEqual([]);
    });
  });
});
