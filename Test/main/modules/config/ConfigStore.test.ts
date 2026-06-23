export {};

const mockSafeStorage = {
  isEncryptionAvailable: jest.fn(),
  encryptString: jest.fn(),
  decryptString: jest.fn(),
};

const fileStore = new Map<string, string>();

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/tmp/userData'),
    getAppPath: jest.fn(() => '/tmp/app'),
  },
  safeStorage: mockSafeStorage,
}));

jest.mock('path', () => ({
  join: jest.fn((...args: string[]) => args.join('/')),
  resolve: jest.fn((...args: string[]) => args.join('/')),
  basename: jest.fn((input: string) => input.split('/').pop() || input),
  dirname: jest.fn((input: string) => {
    const parts = input.split('/');
    parts.pop();
    return parts.join('/') || '/';
  }),
}));

jest.mock('../../../../src/main/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
  writeLogEntry: jest.fn(),
  setLogLevel: jest.fn(),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn((path: string) => fileStore.has(path) || path === '/tmp/userData/SynchroLens'),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn((path: string) => {
    const value = fileStore.get(path);
    if (value === undefined) {
      throw new Error(`ENOENT: ${path}`);
    }
    return value;
  }),
  writeFileSync: jest.fn((path: string, value: string | Buffer) => {
    fileStore.set(path, typeof value === 'string' ? value : value.toString('base64'));
  }),
  unlinkSync: jest.fn((path: string) => {
    fileStore.delete(path);
  }),
}));

describe('ConfigStore', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    fileStore.clear();
  });

  it('persists tencent config without writing secretKey into settings.json', () => {
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
    mockSafeStorage.encryptString.mockReturnValue(Buffer.from('ciphertext'));

    const { ConfigStore } = require('../../../../src/main/modules/config/ConfigStore');
    const { DEFAULT_CONFIG } = require('../../../../src/shared/types');

    const store = new ConfigStore();
    store.save({
      ...DEFAULT_CONFIG,
      translation: {
        ...DEFAULT_CONFIG.translation,
        provider: 'tencent-tmt',
        tencent: {
          ...DEFAULT_CONFIG.translation.tencent,
          secretId: 'sid',
          secretKey: 'raw-secret',
        },
      },
    });

    const saved = JSON.parse(fileStore.get('/tmp/userData/SynchroLens/settings.json') || '{}');

    expect(saved.translation.tencent.secretId).toBe('sid');
    expect(saved.translation.tencent.secretKey).toBeUndefined();
    expect(saved.translation.tencent.secretKeySaved).toBe(true);
    expect(fileStore.get('/tmp/userData/SynchroLens/tencent-tmt-secret.bin')).toBe('Y2lwaGVydGV4dA==');
  });

  it('throws and does not persist config when tencent secret encryption is unavailable', () => {
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);

    const { ConfigStore } = require('../../../../src/main/modules/config/ConfigStore');
    const { DEFAULT_CONFIG } = require('../../../../src/shared/types');

    const store = new ConfigStore();
    expect(() => store.save({
      ...DEFAULT_CONFIG,
      translation: {
        ...DEFAULT_CONFIG.translation,
        provider: 'tencent-tmt',
        tencent: {
          ...DEFAULT_CONFIG.translation.tencent,
          secretId: 'sid',
          secretKey: 'raw-secret',
        },
      },
    })).toThrow('安全存储不可用');

    expect(fileStore.has('/tmp/userData/SynchroLens/settings.json')).toBe(false);
    expect(fileStore.has('/tmp/userData/SynchroLens/tencent-tmt-secret.bin')).toBe(false);
  });

  it('does not return the raw secretKey when loading config', () => {
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
    mockSafeStorage.decryptString.mockReturnValue('raw-secret');
    const { DEFAULT_CONFIG } = require('../../../../src/shared/types');

    fileStore.set(
      '/tmp/userData/SynchroLens/settings.json',
      JSON.stringify({
        ...DEFAULT_CONFIG,
        translation: {
          ...DEFAULT_CONFIG.translation,
          provider: 'tencent-tmt',
          tencent: {
            ...DEFAULT_CONFIG.translation.tencent,
            secretId: 'sid',
            secretKeySaved: true,
          },
        },
      }),
    );
    fileStore.set('/tmp/userData/SynchroLens/tencent-tmt-secret.bin', Buffer.from('ciphertext').toString('base64'));

    const { ConfigStore } = require('../../../../src/main/modules/config/ConfigStore');

    const store = new ConfigStore();
    const loaded = store.load();

    expect(loaded.translation.tencent.secretId).toBe('sid');
    expect(loaded.translation.tencent.secretKeySaved).toBe(true);
    expect(loaded.translation.tencent.secretKey).toBeUndefined();
  });

  it('normalizes stale DeepSeek translation config to Tencent TMT when saved Tencent credentials exist', () => {
    const { DEFAULT_CONFIG } = require('../../../../src/shared/types');

    fileStore.set(
      '/tmp/userData/SynchroLens/settings.json',
      JSON.stringify({
        ...DEFAULT_CONFIG,
        translation: {
          ...DEFAULT_CONFIG.translation,
          provider: 'deepseek',
          apiEndpoint: 'https://api.deepseek.com',
          model: 'deepseek-v4-flash',
          tencent: {
            ...DEFAULT_CONFIG.translation.tencent,
            secretId: 'sid',
            secretKeySaved: true,
          },
        },
      }),
    );

    const { ConfigStore } = require('../../../../src/main/modules/config/ConfigStore');

    const store = new ConfigStore();
    const loaded = store.load();

    expect(loaded.translation.provider).toBe('tencent-tmt');
    expect(loaded.translation.apiEndpoint).toBe('http://127.0.0.1:8765');
    expect(loaded.translation.model).toBe('tencent-tmt');
  });

  it('normalizes legacy xfyun provider to xfyun-rtasr for realtime captions', () => {
    const { DEFAULT_CONFIG } = require('../../../../src/shared/types');

    fileStore.set(
      '/tmp/userData/SynchroLens/settings.json',
      JSON.stringify({
        ...DEFAULT_CONFIG,
        stt: {
          ...DEFAULT_CONFIG.stt,
          provider: 'xfyun',
        },
      }),
    );

    const { ConfigStore } = require('../../../../src/main/modules/config/ConfigStore');

    const store = new ConfigStore();
    const loaded = store.load();

    expect(loaded.stt.provider).toBe('xfyun-rtasr');
  });
});
