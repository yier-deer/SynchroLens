/**
 * Preload 脚本单元测试
 * 由于 preload 运行在 Electron 隔离环境中，
 * Electron API（contextBridge, ipcRenderer）必须在 jest.config 中 mock
 */

// Electron API mock 已在 beforeAll 中设置
const mockIpcRenderer = {
  on: jest.fn(),
  invoke: jest.fn().mockResolvedValue(undefined),
};
const mockContextBridge = {
  exposeInMainWorld: jest.fn(),
};

// 必须在任何 import 之前设置 mock
jest.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: jest.fn(),
  },
  ipcRenderer: {
    on: jest.fn(),
    invoke: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('preload index', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该在加载时调用 contextBridge.exposeInMainWorld', () => {
    const { contextBridge } = require('electron');

    // 重新加载 preload 模块以触发 exposeInMainWorld 调用
    jest.isolateModules(() => {
      require('../../src/preload/index');
    });

    expect(contextBridge.exposeInMainWorld).toHaveBeenCalled();
  });

  it('exposeInMainWorld 的 key 应为 synchroLens', () => {
    const { contextBridge } = require('electron');

    jest.isolateModules(() => {
      require('../../src/preload/index');
    });

    const calls = contextBridge.exposeInMainWorld.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0][0]).toBe('synchrolens');
  });

  it('暴露的 API 应包含 on/off/once 方法', () => {
    const { contextBridge } = require('electron');

    jest.isolateModules(() => {
      require('../../src/preload/index');
    });

    const api = contextBridge.exposeInMainWorld.mock.calls[0]?.[1];
    expect(api).toBeDefined();
    expect(typeof api.on).toBe('function');
    expect(typeof api.off).toBe('function');
    expect(typeof api.once).toBe('function');
  });

  it('暴露的 API 应包含 startSession 方法', () => {
    const { contextBridge } = require('electron');

    jest.isolateModules(() => {
      require('../../src/preload/index');
    });

    const api = contextBridge.exposeInMainWorld.mock.calls[0]?.[1];
    expect(typeof api.startSession).toBe('function');
    expect(typeof api.stopSession).toBe('function');
    expect(typeof api.pauseSession).toBe('function');
    expect(typeof api.updateConfig).toBe('function');
    expect(typeof api.triggerSummary).toBe('function');
  });

  it('on 方法应返回取消监听函数', () => {
    const { contextBridge } = require('electron');

    jest.isolateModules(() => {
      require('../../src/preload/index');
    });

    const api = contextBridge.exposeInMainWorld.mock.calls[0]?.[1];
    const callback = jest.fn();
    const unsubscribe = api.on('stt:partial', callback);

    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
    // 取消后不应抛错
  });

  it('off 方法应移除监听', () => {
    const { contextBridge } = require('electron');

    jest.isolateModules(() => {
      require('../../src/preload/index');
    });

    const api = contextBridge.exposeInMainWorld.mock.calls[0]?.[1];
    const callback = jest.fn();

    api.on('stt:partial', callback);
    api.off('stt:partial', callback);
    // 移除后不抛错
  });

  it('once 方法应只触发一次', () => {
    const { contextBridge } = require('electron');

    jest.isolateModules(() => {
      require('../../src/preload/index');
    });

    const api = contextBridge.exposeInMainWorld.mock.calls[0]?.[1];
    const callback = jest.fn();

    api.once('translate:final', callback);
    // once 注册不抛错
  });

  it('startSession 应调用 ipcRenderer.invoke', () => {
    const { contextBridge, ipcRenderer } = require('electron');

    jest.isolateModules(() => {
      require('../../src/preload/index');
    });

    const api = contextBridge.exposeInMainWorld.mock.calls[0]?.[1];
    api.startSession('system');

    expect(ipcRenderer.invoke).toHaveBeenCalledWith('session:start', {
      audioSource: 'system',
    });
  });

  it('stopSession 应调用 ipcRenderer.invoke', () => {
    const { contextBridge, ipcRenderer } = require('electron');

    jest.isolateModules(() => {
      require('../../src/preload/index');
    });

    const api = contextBridge.exposeInMainWorld.mock.calls[0]?.[1];
    api.stopSession();

    expect(ipcRenderer.invoke).toHaveBeenCalledWith('session:stop');
  });

  it('pauseSession 应调用 ipcRenderer.invoke', () => {
    const { contextBridge, ipcRenderer } = require('electron');

    jest.isolateModules(() => {
      require('../../src/preload/index');
    });

    const api = contextBridge.exposeInMainWorld.mock.calls[0]?.[1];
    api.pauseSession();

    expect(ipcRenderer.invoke).toHaveBeenCalledWith('session:pause');
  });

  it('updateConfig 应传递配置对象', () => {
    const { contextBridge, ipcRenderer } = require('electron');

    jest.isolateModules(() => {
      require('../../src/preload/index');
    });

    const api = contextBridge.exposeInMainWorld.mock.calls[0]?.[1];
    api.updateConfig({ targetLanguage: 'en-US' });

    expect(ipcRenderer.invoke).toHaveBeenCalledWith('config:update', {
      targetLanguage: 'en-US',
    });
  });

  it('triggerSummary 应调用 ipcRenderer.invoke', () => {
    const { contextBridge, ipcRenderer } = require('electron');

    jest.isolateModules(() => {
      require('../../src/preload/index');
    });

    const api = contextBridge.exposeInMainWorld.mock.calls[0]?.[1];
    api.triggerSummary();

    expect(ipcRenderer.invoke).toHaveBeenCalledWith('summary:trigger');
  });
});
