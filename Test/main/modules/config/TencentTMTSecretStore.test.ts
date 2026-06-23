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
  },
  safeStorage: mockSafeStorage,
}));

jest.mock('path', () => ({
  join: jest.fn((...args: string[]) => args.join('/')),
  resolve: jest.fn((...args: string[]) => args.join('/')),
  dirname: jest.fn((input: string) => {
    const parts = input.split('/');
    parts.pop();
    return parts.join('/') || '/';
  }),
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

describe('TencentTMTSecretStore', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    fileStore.clear();
  });

  it('stores the secret key with electron safeStorage encryption', () => {
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
    mockSafeStorage.encryptString.mockReturnValue(Buffer.from('ciphertext'));

    const { TencentTMTSecretStore } = require('../../../../src/main/modules/config/TencentTMTSecretStore.ts');

    const store = new TencentTMTSecretStore();
    store.saveSecretKey('secret-value');

    expect(mockSafeStorage.encryptString).toHaveBeenCalledWith('secret-value');
    expect(fileStore.get('/tmp/userData/SynchroLens/tencent-tmt-secret.bin')).toBe('Y2lwaGVydGV4dA==');
  });

  it('loads and decrypts the saved secret key', () => {
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
    mockSafeStorage.decryptString.mockReturnValue('secret-value');
    fileStore.set('/tmp/userData/SynchroLens/tencent-tmt-secret.bin', Buffer.from('ciphertext').toString('base64'));

    const { TencentTMTSecretStore } = require('../../../../src/main/modules/config/TencentTMTSecretStore.ts');

    const store = new TencentTMTSecretStore();
    expect(store.loadSecretKey()).toBe('secret-value');
    expect(mockSafeStorage.decryptString).toHaveBeenCalledWith(Buffer.from('ciphertext'));
  });

  it('throws when encryption is unavailable during save', () => {
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);

    const { TencentTMTSecretStore } = require('../../../../src/main/modules/config/TencentTMTSecretStore.ts');

    const store = new TencentTMTSecretStore();
    expect(() => store.saveSecretKey('secret-value')).toThrow('安全存储不可用');
  });
});
