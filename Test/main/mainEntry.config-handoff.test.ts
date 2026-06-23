const mockBrowserWindow = jest.fn();
const mockGlobalShortcut = {
  register: jest.fn(),
  unregisterAll: jest.fn(),
};
const mockSessionManagerInstance = {
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
  onNoteSaved: jest.fn(),
  onNoteSummary: jest.fn(),
  onEnhancementStatus: jest.fn(),
};
const mockSessionManagerConstructor = jest.fn(() => mockSessionManagerInstance);

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
  Tray: jest.fn(() => ({ setToolTip: jest.fn(), setContextMenu: jest.fn() })),
  Menu: { buildFromTemplate: jest.fn(() => ({})) },
  ipcMain: { handle: jest.fn(), on: jest.fn() },
  globalShortcut: mockGlobalShortcut,
  dialog: {
    showMessageBox: jest.fn().mockResolvedValue({ response: 0, canceled: false, filePaths: [] }),
    showOpenDialog: jest.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
    showErrorBox: jest.fn(),
  },
}));

jest.mock('../../src/main/modules/audio/AudioCapture', () => ({
  AudioCapture: jest.fn(() => ({
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn(),
    onData: jest.fn(() => jest.fn()),
    getAvailableDevices: jest.fn().mockResolvedValue([]),
    isRunning: false,
  })),
}));

jest.mock('../../src/main/modules/stt/STTClientFactory', () => ({
  createSTTClient: jest.fn(() => ({
    connect: jest.fn(),
    sendAudio: jest.fn(),
    disconnect: jest.fn(),
    onResult: jest.fn(),
    onError: jest.fn(),
    onClose: jest.fn(),
    onStateChange: jest.fn(),
    setLanguage: jest.fn(),
    isConnected: true,
  })),
}));

jest.mock('../../src/main/modules/translate/Translator', () => ({
  Translator: jest.fn(() => ({
    setApiKey: jest.fn(),
    setApiEndpoint: jest.fn(),
    setModel: jest.fn(),
    generateSummary: jest.fn(),
  })),
}));

jest.mock('../../src/main/modules/translate/NMTTranslator', () => ({
  NMTTranslator: jest.fn(() => ({
    setApiKey: jest.fn(),
    setApiEndpoint: jest.fn(),
    setModel: jest.fn(),
    setTargetLanguage: jest.fn(),
  })),
}));

jest.mock('../../src/main/modules/translate/TranslationGateway', () => ({
  TranslationGateway: jest.fn(() => ({
    reset: jest.fn(),
    updateWindowSize: jest.fn(),
    translateSentence: jest.fn(),
  })),
}));

jest.mock('../../src/main/modules/tmt/TencentTMTAdapterServer', () => ({
  TencentTMTAdapterServer: jest.fn(() => ({
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../src/main/modules/note/NoteRepository', () => ({
  NoteRepository: jest.fn(() => ({
    createSessionNote: jest.fn().mockResolvedValue('/tmp/saved-note-dir/2026-06-23/15-46.md'),
    appendSentence: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../src/main/modules/note/NoteReader', () => ({
  NoteReader: jest.fn(() => ({
    listNotes: jest.fn().mockReturnValue([]),
    readNote: jest.fn().mockReturnValue(''),
    getNotesDir: jest.fn().mockReturnValue('/tmp/saved-note-dir'),
    setNotesDir: jest.fn(),
  })),
}));

jest.mock('../../src/main/modules/correction/CorrectionDetector', () => ({
  CorrectionDetector: jest.fn(() => ({})),
}));

jest.mock('../../src/main/modules/enhancement/EnhancementOrchestrator', () => ({
  EnhancementOrchestrator: jest.fn(() => ({
    runCorrection: jest.fn().mockResolvedValue(undefined),
    runRecommendation: jest.fn().mockResolvedValue(undefined),
    runSummary: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../src/main/modules/enhancement/KnowledgeRetriever', () => ({
  KnowledgeRetriever: jest.fn(() => ({ resolve: jest.fn() })),
}));

jest.mock('../../src/main/modules/favorite/FavoriteStore', () => ({
  FavoriteStore: jest.fn(() => ({
    getAll: jest.fn().mockReturnValue([]),
    add: jest.fn(),
    remove: jest.fn(),
    removeBatch: jest.fn(),
    search: jest.fn().mockReturnValue([]),
    exportToMarkdown: jest.fn(),
  })),
}));

jest.mock('../../src/main/modules/dictionary/DictStore', () => ({
  DictStore: jest.fn(() => ({
    getEntries: jest.fn().mockReturnValue([]),
    getEnabledEntries: jest.fn().mockReturnValue([]),
    removeEntryById: jest.fn(),
    loadFile: jest.fn(),
    removeFile: jest.fn(),
    toggleFile: jest.fn(),
  })),
}));

jest.mock('../../src/main/modules/dictionary/PersonalDictStore', () => ({
  PersonalDictStore: jest.fn(() => ({
    add: jest.fn(),
    getAll: jest.fn().mockReturnValue([]),
    searchBySimilarityWithScores: jest.fn().mockReturnValue([]),
    remove: jest.fn(),
  })),
}));

jest.mock('../../src/main/modules/vector/EmbeddingClient', () => ({
  EmbeddingClient: jest.fn(() => ({
    embedTexts: jest.fn().mockResolvedValue([]),
    setApiKey: jest.fn(),
    setApiEndpoint: jest.fn(),
    setModel: jest.fn(),
  })),
}));

jest.mock('../../src/main/modules/session/SessionManager', () => ({
  SessionManager: mockSessionManagerConstructor,
}));

jest.mock('../../src/main/modules/config/ConfigStore', () => ({
  ConfigStore: jest.fn(() => ({
    load: jest.fn(() => ({
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
        saveDir: '/tmp/saved-note-dir',
        autoSave: true,
        autoSaveInterval: 5000,
        autoSummary: true,
        summaryThreshold: 20,
      },
      enhancement: {
        enabled: false,
        summaryEnabled: true,
        correctionEnabled: true,
        recommendationEnabled: true,
      },
      audio: {
        source: 'system',
        systemAudioBackend: 'wasapi',
        sampleRate: 16000,
        noiseReduction: false,
      },
    })),
    save: jest.fn(),
    getTencentSecretKey: jest.fn().mockReturnValue(null),
  })),
}));

describe('mainEntry startup config handoff', () => {
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
  });

  it('applies the loaded config to SessionManager before sessions start', async () => {
    const { registerAppLifecycle } = require('../../src/main/mainEntry');

    registerAppLifecycle();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockSessionManagerInstance.updateConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        note: expect.objectContaining({ saveDir: '/tmp/saved-note-dir' }),
        translation: expect.objectContaining({ provider: 'tencent-tmt' }),
      }),
    );
  });
});

export {};
