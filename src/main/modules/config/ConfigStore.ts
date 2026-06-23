/**
 * 配置持久化存储
 * 将 AppConfig 读写到 Electron userData 目录的 settings.json
 */

import { app } from 'electron';
import { join, dirname } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import appLogger from '../../utils/logger';
import type { AppConfig } from '../../../shared/types';
import { DEFAULT_CONFIG } from '../../../shared/types';
import { TencentTMTSecretStore } from './TencentTMTSecretStore';

function getConfigPath(): string {
  const userDataPath = app.getPath('userData');
  const configDir = join(userDataPath, 'SynchroLens');
  return join(configDir, 'settings.json');
}

function ensureConfigDir(configPath: string): void {
  const dir = dirname(configPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export class ConfigStore {
  private configPath: string;
  private secretStore: TencentTMTSecretStore;

  constructor() {
    this.configPath = getConfigPath();
    this.secretStore = new TencentTMTSecretStore();
  }

  /** 加载配置，深度合并到默认配置（防止新增字段缺失） */
  load(): AppConfig {
    try {
      ensureConfigDir(this.configPath);
      if (!existsSync(this.configPath)) {
        // 首次加载：设置默认笔记目录为项目下的 Note/ 文件夹
        const defaults = deepMerge(DEFAULT_CONFIG as any, { note: { saveDir: join(app.getAppPath(), 'Note') } }) as AppConfig;
        this.save(defaults);
        return defaults;
      }
      const raw = readFileSync(this.configPath, 'utf-8');
      const saved = JSON.parse(raw) as Partial<AppConfig>;
      let merged = deepMerge(DEFAULT_CONFIG as any, saved) as AppConfig;
      merged.stt = this.normalizeSttConfig(merged.stt);
      if (saved.translation?.tencent?.secretKeySaved) {
        delete merged.translation.tencent.secretKey;
        merged.translation.tencent.secretKeySaved = true;
      }
      if (hasSavedTencentCredentials(saved)) {
        merged.translation.provider = 'tencent-tmt';
        merged.translation.apiEndpoint = 'http://127.0.0.1:8765';
        merged.translation.model = 'tencent-tmt';
      }
      // 向量模型 API 端点和模型名始终使用代码默认值（用户只保留 apiKey）
      if (saved.vector) {
        merged.vector = { ...DEFAULT_CONFIG.vector, ...saved.vector };
        merged.vector.apiEndpoint = DEFAULT_CONFIG.vector.apiEndpoint;
        merged.vector.model = DEFAULT_CONFIG.vector.model;
      }
      // 如果 saveDir 仍为空，补齐默认值
      if (!merged.note.saveDir) {
        merged = deepMerge(merged as any, { note: { saveDir: join(app.getAppPath(), 'Note') } }) as AppConfig;
        this.save(merged);
      }
      appLogger.info('配置已加载', { path: this.configPath });
      return merged;
    } catch (err) {
      appLogger.warn('配置加载失败，使用默认配置', { error: (err as Error).message });
      return { ...DEFAULT_CONFIG };
    }
  }

  /** 保存配置到磁盘 */
  save(config: AppConfig): void {
    try {
      ensureConfigDir(this.configPath);
      const sanitized = sanitizeConfig(config, this.secretStore);
      writeFileSync(this.configPath, JSON.stringify(sanitized, null, 2), 'utf-8');
      appLogger.info('配置已保存', { path: this.configPath });
    } catch (err) {
      appLogger.error('配置保存失败', { error: (err as Error).message });
      throw err;
    }
  }

  getTencentSecretKey(): string | null {
    return this.secretStore.loadSecretKey();
  }

  private normalizeSttConfig(stt: AppConfig['stt']): AppConfig['stt'] {
    return {
      ...stt,
      provider: stt.provider === ('xfyun' as AppConfig['stt']['provider'])
        ? 'xfyun-rtasr'
        : stt.provider,
    };
  }
}

function hasSavedTencentCredentials(config: Partial<AppConfig>): boolean {
  const tencent = config.translation?.tencent;
  return Boolean(tencent?.secretId?.trim() || tencent?.secretKeySaved);
}

function sanitizeConfig(config: AppConfig, secretStore: TencentTMTSecretStore): AppConfig {
  const cloned = JSON.parse(JSON.stringify(config)) as AppConfig;
  const tencent = cloned.translation?.tencent;

  if (!tencent) {
    return cloned;
  }

  const nextSecret = tencent.secretKey?.trim();
  if (nextSecret) {
    secretStore.saveSecretKey(nextSecret);
    tencent.secretKeySaved = true;
  }

  delete tencent.secretKey;
  return cloned;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function deepMerge(defaults: any, saved: any): any {
  const result = { ...defaults };
  for (const key of Object.keys(saved)) {
    const savedVal = saved[key];
    const defaultVal = defaults[key];
    if (
      savedVal !== null &&
      savedVal !== undefined &&
      typeof savedVal === 'object' &&
      !Array.isArray(savedVal) &&
      typeof defaultVal === 'object' &&
      !Array.isArray(defaultVal) &&
      defaultVal !== null
    ) {
      result[key] = deepMerge(defaultVal, savedVal);
    } else if (savedVal !== undefined) {
      result[key] = savedVal;
    }
  }
  return result;
}
