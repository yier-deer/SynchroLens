import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { basename, dirname, extname, join } from 'path';
import type { DictEntry, DictType, DictionaryFileInfo } from '../../../shared/types';
import { createLogger } from '../../utils/logger';

type FileDictType = Exclude<DictType, 'personal'>;

interface DictFileRuntime extends DictionaryFileInfo {
  entries: DictEntry[];
}

function normalizeCell(value: string): string {
  return value.trim().toLowerCase();
}

function buildKey(dictType: FileDictType, filePath: string): string {
  return `${dictType}:${filePath}`;
}

function isFileDictType(value: unknown): value is FileDictType {
  return value === 'language' || value === 'domain';
}

function hasHeader(parts: string[]): boolean {
  if (parts.length < 2) {
    return false;
  }

  const left = normalizeCell(parts[0]);
  const right = normalizeCell(parts[1]);
  const leftHeaders = new Set(['source', 'src', 'term', 'original', '原文', '术语']);
  const rightHeaders = new Set(['target', 'dst', 'translation', '译文', '目标', 'targetlanguage']);
  return leftHeaders.has(left) && rightHeaders.has(right);
}

export class DictStore {
  private readonly l = createLogger('DictStore');
  private readonly metaPath: string;
  private readonly files = new Map<string, DictFileRuntime>();

  constructor() {
    this.metaPath = join(app.getPath('userData'), 'SynchroLens', 'dict-files.json');
    this.loadMeta();
  }

  loadFile(dictType: FileDictType, filePath: string): DictionaryFileInfo {
    const entries = this.parseFile(filePath);
    const info: DictFileRuntime = {
      name: basename(filePath),
      filePath,
      dictType,
      count: entries.length,
      enabled: true,
      entries,
    };

    this.files.set(buildKey(dictType, filePath), info);
    this.saveMeta();
    this.l.info('词典文件已加载', { dictType, filePath, count: entries.length });
    return this.toFileInfo(info);
  }

  listFiles(dictType?: FileDictType): DictionaryFileInfo[] {
    return Array.from(this.files.values())
      .filter((file) => !dictType || file.dictType === dictType)
      .map((file) => this.toFileInfo(file))
      .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
  }

  removeFile(dictType: FileDictType, filePath: string): void {
    this.files.delete(buildKey(dictType, filePath));
    this.saveMeta();
  }

  toggleFile(dictType: FileDictType, filePath: string, enabled: boolean): void {
    const file = this.files.get(buildKey(dictType, filePath));
    if (!file) {
      return;
    }

    file.enabled = enabled;
    this.saveMeta();
  }

  getEntries(dictType: FileDictType): DictEntry[] {
    return Array.from(this.files.values())
      .filter((file) => file.dictType === dictType && file.enabled)
      .flatMap((file) => file.entries.map((entry) => ({ ...entry })));
  }

  getEnabledEntries(dictType: FileDictType): DictEntry[] {
    return this.getEntries(dictType);
  }

  removeEntry(dictType: FileDictType, filePath: string, idx: number): void {
    const file = this.files.get(buildKey(dictType, filePath));
    if (!file) {
      return;
    }

    file.entries.splice(idx, 1);
    file.count = file.entries.length;
    this.saveMeta();
  }

  removeEntryById(dictType: FileDictType, entryId: string): boolean {
    for (const file of this.files.values()) {
      if (file.dictType !== dictType) {
        continue;
      }

      const idx = file.entries.findIndex((entry) => entry.id === entryId);
      if (idx === -1) {
        continue;
      }

      file.entries.splice(idx, 1);
      file.count = file.entries.length;
      this.saveMeta();
      return true;
    }

    return false;
  }

  private toFileInfo(file: DictionaryFileInfo): DictionaryFileInfo {
    return {
      name: file.name,
      filePath: file.filePath,
      dictType: file.dictType,
      count: file.count,
      enabled: file.enabled,
    };
  }

  private parseFile(filePath: string): DictEntry[] {
    const ext = extname(filePath).toLowerCase();
    const content = readFileSync(filePath, 'utf-8');

    try {
      switch (ext) {
        case '.csv':
          return this.parseCsv(content);
        case '.json':
          return this.parseJson(content);
        case '.txt':
          return this.parseTxt(content);
        default:
          this.l.warn('不支持的词典格式', { filePath, ext });
          return [];
      }
    } catch (error) {
      this.l.error('词典解析失败', { filePath, error: (error as Error).message });
      return [];
    }
  }

  private parseCsv(content: string): DictEntry[] {
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const entries: DictEntry[] = [];
    for (let index = 0; index < lines.length; index += 1) {
      const parts = lines[index].split(',').map((part) => part.trim());
      if (index === 0 && hasHeader(parts)) {
        continue;
      }

      const [source, target] = parts;
      if (!source || !target) {
        continue;
      }

      entries.push({ source, target });
    }

    return entries;
  }

  private parseJson(content: string): DictEntry[] {
    const data = JSON.parse(content) as unknown;
    if (Array.isArray(data)) {
      return data.reduce<DictEntry[]>((entries, item) => {
        if (!item || typeof item !== 'object') {
          return entries;
        }
        const record = item as Record<string, unknown>;
        const source = String(record.source ?? record.key ?? record.original ?? '').trim();
        const target = String(record.target ?? record.value ?? record.translation ?? '').trim();
        if (!source || !target) {
          return entries;
        }

        const id = typeof record.id === 'string' ? record.id : undefined;
        entries.push(id ? { id, source, target } : { source, target });
        return entries;
      }, []);
    }

    if (data && typeof data === 'object') {
      return Object.entries(data as Record<string, unknown>)
        .map(([source, target]) => ({ source: source.trim(), target: String(target).trim() }))
        .filter((entry) => entry.source && entry.target);
    }

    return [];
  }

  private parseTxt(content: string): DictEntry[] {
    const entries: DictEntry[] = [];
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {
        continue;
      }

      const separator = ['\t', '=', ':'].find((candidate) => line.includes(candidate));
      if (!separator) {
        continue;
      }

      const idx = line.indexOf(separator);
      const source = line.slice(0, idx).trim();
      const target = line.slice(idx + separator.length).trim();
      if (source && target) {
        entries.push({ source, target });
      }
    }

    return entries;
  }

  private loadMeta(): void {
    try {
      if (!existsSync(this.metaPath)) {
        return;
      }

      const raw = JSON.parse(readFileSync(this.metaPath, 'utf-8')) as unknown;
      if (!Array.isArray(raw)) {
        return;
      }

      for (const item of raw) {
        if (!item || typeof item !== 'object') {
          continue;
        }

        const file = item as Record<string, unknown>;
        if (!isFileDictType(file.dictType) || typeof file.filePath !== 'string' || !existsSync(file.filePath)) {
          continue;
        }

        const entries = this.parseFile(file.filePath);
        const runtime: DictFileRuntime = {
          name: typeof file.name === 'string' ? file.name : basename(file.filePath),
          filePath: file.filePath,
          dictType: file.dictType,
          count: entries.length,
          enabled: file.enabled !== false,
          entries,
        };
        this.files.set(buildKey(runtime.dictType, runtime.filePath), runtime);
      }
    } catch (error) {
      this.l.warn('词典元信息加载失败', { error: (error as Error).message });
    }
  }

  private saveMeta(): void {
    try {
      const dir = dirname(this.metaPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      const data = this.listFiles();
      writeFileSync(this.metaPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      this.l.error('词典元信息保存失败', { error: (error as Error).message });
    }
  }
}
