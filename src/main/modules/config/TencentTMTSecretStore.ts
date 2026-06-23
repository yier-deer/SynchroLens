import { app, safeStorage } from 'electron';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';

const SECRET_FILE = 'tencent-tmt-secret.bin';

function getSecretPath(): string {
  return join(app.getPath('userData'), 'SynchroLens', SECRET_FILE);
}

function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export class TencentTMTSecretStore {
  private readonly secretPath: string;

  constructor() {
    this.secretPath = getSecretPath();
  }

  saveSecretKey(secretKey: string): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('安全存储不可用');
    }

    ensureDir(this.secretPath);
    const encrypted = safeStorage.encryptString(secretKey);
    writeFileSync(this.secretPath, encrypted);
  }

  loadSecretKey(): string | null {
    if (!existsSync(this.secretPath)) {
      return null;
    }

    if (!safeStorage.isEncryptionAvailable()) {
      return null;
    }

    const encrypted = readFileSync(this.secretPath);
    return safeStorage.decryptString(
      Buffer.isBuffer(encrypted) ? encrypted : Buffer.from(encrypted, 'base64'),
    );
  }

  hasSecretKey(): boolean {
    return existsSync(this.secretPath);
  }

  clearSecretKey(): void {
    if (existsSync(this.secretPath)) {
      unlinkSync(this.secretPath);
    }
  }
}
