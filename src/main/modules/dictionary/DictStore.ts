import { app } from 'electron';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, readdirSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { createLogger } from '../../utils/logger';

export interface DictFileInfo {
  name: string;
  filePath: string;
  dictType: string;
  count: number;
  enabled: boolean;
}

interface DictEntry {
  source: string;
  target: string;
}

export class DictStore {
  private l = createLogger('DictStore');
  private metaPath: string;
  private files: Map<string, DictFileInfo> = new Map();

  constructor() {
    this.metaPath = join(app.getPath('userData'), 'SynchroLens', 'dict-files.json');
    this.loadMeta();
  }

  loadFile(dictType: string, filePath: string): DictFileInfo {
    const entries = this.parseFile(filePath);
    this.l.info('词典文件已加载', { dictType, filePath, count: entries.length });
    const info: DictFileInfo = {
      name: basename(filePath),
      filePath,
      dictType,
      count: entries.length,
      enabled: true,
    };
    const key = `${dictType}:${filePath}`;
    this.files.set(key, { ...info, entries } as any);
    this.saveMeta();
    return info;
  }

  removeFile(dictType: string, filePath: string): void {
    const key = `${dictType}:${filePath}`;
    this.files.delete(key);
    this.saveMeta();
  }

  toggleFile(dictType: string, filePath: string, enabled: boolean): void {
    const key = `${dictType}:${filePath}`;
    const info = this.files.get(key) as any;
    if (info) {
      info.enabled = enabled;
      this.saveMeta();
    }
  }

  getEntries(dictType: string): DictEntry[] {
    const result: DictEntry[] = [];
    for (const [key, file] of this.files) {
      const fi = file as any;
      if (fi.dictType === dictType && fi.enabled && fi.entries) {
        result.push(...fi.entries);
      }
    }
    return result;
  }

  removeEntry(dictType: string, filePath: string, idx: number): void {
    const key = `${dictType}:${filePath}`;
    const fi = this.files.get(key) as any;
    if (fi?.entries) {
      fi.entries.splice(idx, 1);
      fi.count = fi.entries.length;
      this.saveMeta();
    }
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
          this.l.warn('不支持的词典格式', { ext });
          return [];
      }
    } catch (err) {
      this.l.error('词典解析失败', { filePath, error: (err as Error).message });
      return [];
    }
  }

  private parseCsv(content: string): DictEntry[] {
    const lines = content.split('\n');
    const entries: DictEntry[] = [];
    let start = 0;
    if (lines.length > 0 && /\p{L}/u.test(lines[0].split(',')[0])) start = 1;
    for (let i = start; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
        entries.push({ source: parts[0].trim(), target: parts[1].trim() });
      }
    }
    return entries;
  }

  private parseJson(content: string): DictEntry[] {
    const data = JSON.parse(content);
    if (Array.isArray(data)) {
      return data.map(item => ({
        source: item.source || item.key || '',
        target: item.target || item.value || '',
      })).filter(e => e.source && e.target);
    }
    if (typeof data === 'object') {
      return Object.entries(data).map(([k, v]) => ({
        source: k, target: String(v),
      }));
    }
    return [];
  }

  private parseTxt(content: string): DictEntry[] {
    const entries: DictEntry[] = [];
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      let sep = '';
      for (const char of ['=', ':', '\t']) {
        if (trimmed.includes(char)) { sep = char; break; }
      }
      if (sep) {
        const idx = trimmed.indexOf(sep);
        const source = trimmed.slice(0, idx).trim();
        const target = trimmed.slice(idx + 1).trim();
        if (source && target) entries.push({ source, target });
      }
    }
    return entries;
  }

  private loadMeta(): void {
    try {
      if (!existsSync(this.metaPath)) return;
      const raw = JSON.parse(readFileSync(this.metaPath, 'utf-8'));
      if (Array.isArray(raw)) {
        for (const item of raw) {
          const key = `${item.dictType}:${item.filePath}`;
          this.files.set(key, item);
        }
      }
    } catch {
      this.l.warn('词典元信息加载失败');
    }
  }

  private saveMeta(): void {
    try {
      const dir = dirname(this.metaPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const items: any[] = [];
      for (const val of this.files.values()) {
        const { entries, ...rest } = val as any;
        items.push(rest);
      }
      writeFileSync(this.metaPath, JSON.stringify(items, null, 2), 'utf-8');
    } catch (err) {
      this.l.error('词典元信息保存失败', { error: (err as Error).message });
    }
  }
}
