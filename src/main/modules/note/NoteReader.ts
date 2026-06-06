import { readdirSync, statSync, readFileSync, existsSync } from 'fs';
import { resolve, normalize, join } from 'path';
import type { NoteTreeItem } from '../../../shared/types';
import { createLogger } from '../../utils/logger';

export class NoteReader {
  private l = createLogger('NoteReader');
  private notesDir: string;

  constructor(notesDir: string) {
    this.notesDir = notesDir;
  }

  getNotesDir(): string {
    return this.notesDir;
  }

  /** 校验目标路径是否在 notesDir 内，防止 ../ 目录穿越攻击 */
  private validatePath(targetPath: string): string {
    const resolved = resolve(normalize(targetPath));
    const base = resolve(this.notesDir);
    if (!resolved.startsWith(base + '\\') && !resolved.startsWith(base + '/') && resolved !== base) {
      return '';
    }
    return resolved;
  }

  listNotes(dirPath?: string): NoteTreeItem[] {
    let targetDir = dirPath || this.notesDir;
    if (dirPath) {
      targetDir = this.validatePath(dirPath);
      if (!targetDir) return [];
    }
    if (!existsSync(targetDir)) return [];
    try {
      const entries = readdirSync(targetDir);
      const items: NoteTreeItem[] = [];
      for (const entry of entries) {
        if (entry.startsWith('.')) continue;
        const fullPath = join(targetDir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          items.push({
            name: entry,
            path: fullPath,
            type: 'directory',
            children: this.listNotes(fullPath),
          });
        } else if (entry.endsWith('.md')) {
          items.push({
            name: entry,
            path: fullPath,
            type: 'file',
            modifiedAt: stat.mtimeMs,
          });
        }
      }
      items.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return b.name.localeCompare(a.name);
      });
      return items;
    } catch {
      return [];
    }
  }

  readNote(filePath: string): string {
    const safePath = this.validatePath(filePath);
    if (!safePath) return '';
    try {
      if (!existsSync(safePath)) return '';
      return readFileSync(safePath, 'utf-8');
    } catch {
      return '';
    }
  }
}
