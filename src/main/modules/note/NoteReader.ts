import { readdirSync, statSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
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

  listNotes(dirPath?: string): NoteTreeItem[] {
    const targetDir = dirPath || this.notesDir;
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
    try {
      if (!existsSync(filePath)) return '';
      return readFileSync(filePath, 'utf-8');
    } catch {
      return '';
    }
  }
}
