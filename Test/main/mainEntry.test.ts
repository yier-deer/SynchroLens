/**
 * Electron 涓昏繘绋嬪叆鍙ｅ崟鍏冩祴璇? * 娴嬭瘯绐楀彛鍒涘缓鍜岀敓鍛藉懆鏈熸敞鍐? */

const mockBrowserWindow = jest.fn();
const mockTray = jest.fn();
const mockGlobalShortcut = {
  register: jest.fn(),
  unregisterAll: jest.fn(),
};
let lastTranslatorInstance: {
  setApiKey: jest.Mock;
  setApiEndpoint: jest.Mock;
  setModel: jest.Mock;
  setTargetLanguage: jest.Mock;
} | null = null;
const mockTranslatorConstructor = jest.fn().mockImplementation(() => {
  lastTranslatorInstance = {
    setApiKey: jest.fn(),
    setApiEndpoint: jest.fn(),
    setModel: jest.fn(),
    setTargetLanguage: jest.fn(),
  };
  return lastTranslatorInstance;
});
let lastNmtTranslatorInstance: {
  setApiKey: jest.Mock;
  setApiEndpoint: jest.Mock;
  setModel: jest.Mock;
  setTargetLanguage: jest.Mock;
} | null = null;
const mockNmtTranslatorConstructor = jest.fn().mockImplementation(() => {
  lastNmtTranslatorInstance = {
    setApiKey: jest.fn(),
    setApiEndpoint: jest.fn(),
    setModel: jest.fn(),
    setTargetLanguage: jest.fn(),
  };
  return lastNmtTranslatorInstance;
});
let lastTranslationGatewayArgs: Record<string, unknown> | null = null;
let lastTranslationGatewayInstance: { updateWindowSize: jest.Mock } | null = null;
const mockTranslationGatewayConstructor = jest.fn().mockImplementation((args) => {
  lastTranslationGatewayArgs = args;
  lastTranslationGatewayInstance = {
    updateWindowSize: jest.fn(),
  };
  return lastTranslationGatewayInstance;
});
let lastAdapterServerInstance: {
  start: jest.Mock;
  stop: jest.Mock;
} | null = null;
let mockSttClientInstance: {
  connect: jest.Mock;
  sendAudio: jest.Mock;
  disconnect: jest.Mock;
  onResult: jest.Mock;
  onError: jest.Mock;
  onClose: jest.Mock;
  onStateChange: jest.Mock;
  setLanguage: jest.Mock;
  isConnected: boolean;
} | null = null;
const mockCreateSTTClient = jest.fn().mockImplementation(() => {
  mockSttClientInstance = {
    connect: jest.fn(),
    sendAudio: jest.fn(),
    disconnect: jest.fn(),
    onResult: jest.fn(),
    onError: jest.fn(),
    onClose: jest.fn(),
    onStateChange: jest.fn(),
    setLanguage: jest.fn(),
    isConnected: true,
  };
  return mockSttClientInstance;
});
const mockTencentTMTAdapterServerConstructor = jest.fn().mockImplementation(() => {
  lastAdapterServerInstance = {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
  };
  return lastAdapterServerInstance;
});
const mockSessionManagerConstructor = jest.fn().mockImplementation(() => ({
  createSession: jest.fn(),
  startSession: jest.fn().mockResolvedValue(undefined),
  pauseSession: jest.fn(),
  resumeSession: jest.fn(),
  endSession: jest.fn().mockResolvedValue(undefined),
  getSessionState: jest.fn(),
  updateConfig: jest.fn(),
  triggerSummary: jest.fn().mockResolvedValue(undefined),
  onSessionStateChange: jest.fn(),
  onSessionSTTPartial: jest.fn(),
  onSessionTranslatePartial: jest.fn(),
  onSessionTranslateFinal: jest.fn(),
  onSessionCorrect: jest.fn(),
  onNoteSaved: jest.fn(),
  onNoteSummary: jest.fn(),
  onEnhancementStatus: jest.fn(),
}));
let mockSavedConfig: any = null;

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
    getPath: jest.fn((key: string) => (key === 'userData' ? '/tmp/userData' : '/tmp')),
    getAppPath: jest.fn(() => '/tmp/app'),
  },
  BrowserWindow: mockBrowserWindow,
  Tray: mockTray,
  Menu: {
    buildFromTemplate: jest.fn(() => ({})),
  },
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
  },
  globalShortcut: mockGlobalShortcut,
  screen: {
    getPrimaryDisplay: jest.fn(() => ({
      workAreaSize: {
        width: 1440,
        height: 900,
      },
    })),
  },
  dialog: {
    showMessageBox: jest.fn().mockResolvedValue({ response: 0, canceled: false, filePaths: [] }),
    showOpenDialog: jest.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
    showErrorBox: jest.fn(),
  },
}));

jest.mock('path', () => ({
  join: jest.fn((...args: string[]) => args.join('/')),
  resolve: jest.fn((...args: string[]) => args.join('/')),
  basename: jest.fn((p: string) => p.split('/').pop() || p),
  dirname: jest.fn((p: string) => {
    const parts = p.split('/');
    parts.pop();
    return parts.join('/') || '/';
  }),
  extname: jest.fn((p: string) => {
    const idx = p.lastIndexOf('.');
    return idx >= 0 ? p.slice(idx) : '';
  }),
}));

jest.mock('../../src/main/modules/audio/AudioCapture', () => ({
  AudioCapture: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
    onData: jest.fn(() => jest.fn()),
    getAvailableDevices: jest.fn().mockResolvedValue([]),
    isRunning: false,
  })),
}));

jest.mock('../../src/main/modules/stt/STTClientFactory', () => ({
  createSTTClient: mockCreateSTTClient,
}));

jest.mock('../../src/main/modules/translate/Translator', () => ({
  Translator: mockTranslatorConstructor,
}));

jest.mock('../../src/main/modules/translate/NMTTranslator', () => ({
  NMTTranslator: mockNmtTranslatorConstructor,
}));

jest.mock('../../src/main/modules/translate/TranslationGateway', () => ({
  TranslationGateway: mockTranslationGatewayConstructor,
}));

jest.mock('../../src/main/modules/tmt/TencentTMTAdapterServer', () => ({
  TencentTMTAdapterServer: mockTencentTMTAdapterServerConstructor,
}));

jest.mock('../../src/main/modules/note/NoteRepository', () => ({
  NoteRepository: jest.fn().mockImplementation(() => ({
    createSessionNote: jest.fn().mockResolvedValue('/tmp/app/Note/2026-06-21/10-00.md'),
    appendSentence: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../src/main/modules/correction/CorrectionDetector', () => ({
  CorrectionDetector: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../src/main/modules/enhancement/EnhancementOrchestrator', () => ({
  EnhancementOrchestrator: jest.fn().mockImplementation(() => ({
    runCorrection: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../src/main/modules/enhancement/KnowledgeRetriever', () => ({
  KnowledgeRetriever: jest.fn().mockImplementation(() => ({ resolve: jest.fn() })),
}));

jest.mock('../../src/main/modules/favorite/FavoriteStore', () => ({
  FavoriteStore: jest.fn().mockImplementation(() => ({
    getAll: jest.fn().mockReturnValue([]),
    add: jest.fn(),
    remove: jest.fn(),
    removeBatch: jest.fn(),
    search: jest.fn().mockReturnValue([]),
    exportToMarkdown: jest.fn(),
  })),
}));

jest.mock('../../src/main/modules/note/NoteReader', () => ({
  NoteReader: jest.fn().mockImplementation(() => ({
    listNotes: jest.fn().mockReturnValue([]),
    readNote: jest.fn().mockReturnValue(''),
    getNotesDir: jest.fn().mockReturnValue('/tmp/app/Note'),
    setNotesDir: jest.fn(),
  })),
}));

jest.mock('../../src/main/modules/dictionary/DictStore', () => ({
  DictStore: jest.fn().mockImplementation(() => ({
    getEntries: jest.fn().mockReturnValue([]),
    getEnabledEntries: jest.fn().mockReturnValue([]),
    removeEntryById: jest.fn(),
    loadFile: jest.fn(),
    removeFile: jest.fn(),
    toggleFile: jest.fn(),
  })),
}));

jest.mock('../../src/main/modules/dictionary/PersonalDictStore', () => ({
  PersonalDictStore: jest.fn().mockImplementation(() => ({
    add: jest.fn(),
    getAll: jest.fn().mockReturnValue([]),
    searchBySimilarityWithScores: jest.fn().mockReturnValue([]),
    remove: jest.fn(),
  })),
}));

jest.mock('../../src/main/modules/session/SessionManager', () => ({
  SessionManager: mockSessionManagerConstructor,
}));

jest.mock('../../src/main/modules/config/ConfigStore', () => ({
  ConfigStore: jest.fn().mockImplementation(() => ({
    load: jest.fn(() => mockSavedConfig ?? {
      general: {
        language: 'zh-CN',
        theme: 'system',
        minimizeToTray: true,
        autoStart: false,
        showBilingual: false,
        cardStyle: 'dark',
      },
      stt: {
        provider: 'xfyun-rtasr',
        language: 'zh_cn',
      },
      translation: {
        provider: 'tencent-tmt',
        targetLanguage: 'zh-CN',
        apiEndpoint: 'http://127.0.0.1:8765',
        apiKey: 'nmt-test-key',
        model: 'tencent-tmt',
        contextCorrection: true,
        contextWindowSize: 5,
        tencent: {
          enabled: true,
          secretId: 'sid',
          region: 'ap-guangzhou',
          projectId: 0,
          sourceLanguage: 'auto',
          secretKeySaved: true,
        },
      },
      llm: {
        provider: 'deepseek',
        apiEndpoint: 'https://api.deepseek.com',
        apiKey: 'llm-test-key',
        model: 'deepseek-v4-flash',
      },
      vector: {},
      note: {
        saveDir: '/tmp/app/Note',
        autoSave: true,
        autoSaveInterval: 5000,
        autoSummary: true,
        summaryThreshold: 20,
      },
      audio: {
        source: 'system',
        systemAudioBackend: 'wasapi',
        sampleRate: 16000,
        noiseReduction: false,
      },
    }),
    save: jest.fn(),
  })),
}));

jest.mock('../../src/main/modules/vector/EmbeddingClient', () => ({
  EmbeddingClient: jest.fn().mockImplementation(() => ({
    embedTexts: jest.fn().mockResolvedValue([]),
  })),
}));

describe('涓昏繘绋嬪叆鍙?mainEntry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockBrowserWindow.mockImplementation(() => ({
      loadFile: jest.fn().mockReturnThis(),
      loadURL: jest.fn().mockReturnThis(),
      show: jest.fn(),
      hide: jest.fn(),
      focus: jest.fn(),
      minimize: jest.fn(),
      setAlwaysOnTop: jest.fn(),
      on: jest.fn().mockReturnThis(),
      once: jest.fn().mockReturnThis(),
      isDestroyed: jest.fn().mockReturnValue(false),
      webContents: { send: jest.fn() },
      close: jest.fn(),
    }));
    mockTray.mockImplementation(() => ({
      setToolTip: jest.fn(),
      setContextMenu: jest.fn(),
    }));
    lastTranslatorInstance = null;
    lastNmtTranslatorInstance = null;
    lastTranslationGatewayArgs = null;
    lastTranslationGatewayInstance = null;
    lastAdapterServerInstance = null;
    mockSttClientInstance = null;
    mockSavedConfig = null;
    delete process.env.LLM_API_ENDPOINT;
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_MODEL;
    delete process.env.DEEPSEEK_API_ENDPOINT;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_MODEL;
    delete process.env.NMT_API_ENDPOINT;
    delete process.env.NMT_API_KEY;
    delete process.env.NMT_MODEL;
  });

  describe('registerAppLifecycle 鐢熷懡鍛ㄦ湡娉ㄥ唽', () => {
    it('搴旇鍦?app.whenReady 鍚庡垱寤轰富绐楀彛', async () => {
      const { registerAppLifecycle } = require('../../src/main/mainEntry');

      registerAppLifecycle();
      await Promise.resolve();
      await Promise.resolve();

      expect(mockBrowserWindow).toHaveBeenCalled();
    });

    it('should use language and domain terminology, not KnowledgeRetriever, as the translation constraint resolver', async () => {
      const { registerAppLifecycle } = require('../../src/main/mainEntry');
      const { KnowledgeRetriever } = require('../../src/main/modules/enhancement/KnowledgeRetriever');

      registerAppLifecycle();
      await Promise.resolve();
      await Promise.resolve();

      expect(KnowledgeRetriever).not.toHaveBeenCalled();
      const sessionArgs = mockSessionManagerConstructor.mock.calls[mockSessionManagerConstructor.mock.calls.length - 1]?.[0];
      const constraints = sessionArgs.constraintResolver.resolve('server latency');
      expect(constraints).toEqual([]);
      expect(mockSessionManagerConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          constraintResolver: expect.objectContaining({
            resolve: expect.any(Function),
          }),
        }),
      );
    });

    it('搴旇娉ㄥ唽 window-all-closed 浜嬩欢', () => {
      const { registerAppLifecycle } = require('../../src/main/mainEntry');
      const { app } = require('electron');

      registerAppLifecycle();

      expect(app.on).toHaveBeenCalledWith('window-all-closed', expect.any(Function));
    });

    it('搴旇鎶婃寔涔呭寲 LLM 閰嶇疆娉ㄥ叆澧炲己 Translator锛屼笖 NMT 浠嶄綔涓轰富閾捐矾 translator', async () => {
      const { registerAppLifecycle } = require('../../src/main/mainEntry');
      const { Translator } = require('../../src/main/modules/translate/Translator');
      const { NMTTranslator } = require('../../src/main/modules/translate/NMTTranslator');

      registerAppLifecycle();
      await Promise.resolve();
      await Promise.resolve();

      expect(Translator).toHaveBeenCalledWith({
        apiEndpoint: 'https://api.deepseek.com',
        apiKey: '',
        model: 'deepseek-v4-flash',
      });
      expect(lastTranslatorInstance?.setApiKey).toHaveBeenCalledWith('llm-test-key');
      expect(lastTranslatorInstance?.setApiEndpoint).toHaveBeenCalledWith('https://api.deepseek.com');
      expect(lastTranslatorInstance?.setModel).toHaveBeenCalledWith('deepseek-v4-flash');

      expect(NMTTranslator).toHaveBeenCalledWith({
        apiEndpoint: 'http://127.0.0.1:8765',
        apiKey: '',
        model: 'nmt-default',
        targetLanguage: 'zh-CN',
      });
      expect(lastNmtTranslatorInstance?.setApiKey).toHaveBeenCalledWith('nmt-test-key');
      expect(lastNmtTranslatorInstance?.setApiEndpoint).toHaveBeenCalledWith('http://127.0.0.1:8765');
      expect(lastNmtTranslatorInstance?.setModel).toHaveBeenCalledWith('tencent-tmt');
      expect(lastNmtTranslatorInstance?.setTargetLanguage).toHaveBeenCalledWith('zh-CN');
      expect(lastTranslationGatewayArgs?.translator).toBe(lastNmtTranslatorInstance);
      expect(lastTranslationGatewayArgs?.translator).not.toBe(lastTranslatorInstance);
      expect(lastTranslationGatewayInstance?.updateWindowSize).toHaveBeenCalledWith(5);
      expect(mockTencentTMTAdapterServerConstructor).toHaveBeenCalled();
      expect(lastAdapterServerInstance?.start).toHaveBeenCalled();
      expect(mockCreateSTTClient).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'xfyun-rtasr' }),
      );
    });

    it('does not apply stale generic NMT endpoint/model when provider is Tencent TMT', async () => {
      mockSavedConfig = {
        general: {
          language: 'zh-CN',
          theme: 'system',
          minimizeToTray: true,
          autoStart: false,
          showBilingual: false,
          cardStyle: 'dark',
        },
        stt: {
          provider: 'xfyun-rtasr',
          language: 'zh_cn',
        },
        translation: {
          provider: 'tencent-tmt',
          targetLanguage: 'zh-CN',
          apiEndpoint: 'https://api.deepseek.com',
          apiKey: 'nmt-test-key',
          model: 'deepseek-v4-flash',
          contextCorrection: true,
          contextWindowSize: 5,
          tencent: {
            enabled: true,
            secretId: 'sid',
            region: 'ap-guangzhou',
            projectId: 0,
            sourceLanguage: 'auto',
            secretKeySaved: true,
          },
        },
        llm: {
          provider: 'deepseek',
          apiEndpoint: 'https://api.deepseek.com',
          apiKey: 'llm-test-key',
          model: 'deepseek-v4-flash',
        },
        vector: {},
        note: {
          saveDir: '/tmp/app/Note',
          autoSave: true,
          autoSaveInterval: 5000,
          autoSummary: true,
          summaryThreshold: 20,
        },
        audio: {
          source: 'system',
          systemAudioBackend: 'wasapi',
          sampleRate: 16000,
          noiseReduction: false,
        },
      };
      const { registerAppLifecycle } = require('../../src/main/mainEntry');

      registerAppLifecycle();
      await Promise.resolve();
      await Promise.resolve();

      expect(lastNmtTranslatorInstance?.setApiEndpoint).not.toHaveBeenCalledWith('https://api.deepseek.com');
      expect(lastNmtTranslatorInstance?.setApiEndpoint).toHaveBeenCalledWith('http://127.0.0.1:8765');
      expect(lastNmtTranslatorInstance?.setModel).not.toHaveBeenCalledWith('deepseek-v4-flash');
      expect(lastNmtTranslatorInstance?.setModel).toHaveBeenCalledWith('tencent-tmt');
      expect(lastAdapterServerInstance?.start).toHaveBeenCalled();
    });

    it('creates a subtitle window tall enough for long bilingual subtitles', async () => {
      const { registerAppLifecycle } = require('../../src/main/mainEntry');
      const { ipcMain } = require('electron');

      registerAppLifecycle();
      await Promise.resolve();
      await Promise.resolve();

      process.env.XFYUN_APP_ID = 'app-id';
      process.env.XFYUN_API_KEY = 'api-key';
      process.env.XFYUN_API_SECRET = 'api-secret';
      const handler = ipcMain.handle.mock.calls.find(
        (call: unknown[]) => call[0] === 'window:prepare-record',
      )?.[1];

      await handler();

      const subtitleWindowOptions = mockBrowserWindow.mock.calls
        .map((call) => call[0])
        .find((options) => options?.transparent === true && options?.width === 800);

      expect(subtitleWindowOptions).toEqual(
        expect.objectContaining({
          height: expect.any(Number),
          resizable: false,
        }),
      );
      expect(subtitleWindowOptions.height).toBeGreaterThanOrEqual(260);
    });
  });

  describe('getMainWindow', () => {
    it('搴旇鍦ㄤ富绐楀彛鏈垱寤烘椂杩斿洖 null', () => {
      const { getMainWindow } = require('../../src/main/mainEntry');

      expect(getMainWindow()).toBeNull();
    });
  });

  describe('getSubtitleWindow', () => {
    it('搴旇鍦ㄥ瓧骞曠獥鍙ｆ湭鍒涘缓鏃惰繑鍥?null', () => {
      const { getSubtitleWindow } = require('../../src/main/mainEntry');

      expect(getSubtitleWindow()).toBeNull();
    });
  });

  describe('getControlWindow', () => {
    it('搴旇鍦ㄦ帶鍒剁獥鍙ｆ湭鍒涘缓鏃惰繑鍥?null', () => {
      const { getControlWindow } = require('../../src/main/mainEntry');

      expect(getControlWindow()).toBeNull();
    });
  });

  describe('getAllWindows', () => {
    it('搴旇鍦ㄦ棤绐楀彛鏃惰繑鍥炵┖鏁扮粍', () => {
      const { getAllWindows } = require('../../src/main/mainEntry');

      expect(getAllWindows()).toEqual([]);
    });
  });
});

