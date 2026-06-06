import { app } from 'electron';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { Favorite } from '../../../shared/types';
import { createLogger } from '../../utils/logger';

function genId(): string {
  return `fav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export class FavoriteStore {
  private l = createLogger('FavoriteStore');
  private dataPath: string;
  private items: Favorite[] = [];

  constructor() {
    this.dataPath = join(app.getPath('userData'), 'SynchroLens', 'favorites.json');
    this.load();
  }

  getAll(): Favorite[] {
    return [...this.items];
  }

  add(item: { text: string; noteFileName: string; noteFilePath: string }): Favorite {
    const fav: Favorite = { id: genId(), ...item, createdAt: new Date().toISOString() };
    this.items.push(fav);
    this.save();
    return fav;
  }

  remove(id: string): boolean {
    const idx = this.items.findIndex(i => i.id === id);
    if (idx === -1) return false;
    this.items.splice(idx, 1);
    this.save();
    return true;
  }

  removeBatch(ids: string[]): number {
    const idSet = new Set(ids);
    const before = this.items.length;
    this.items = this.items.filter(i => !idSet.has(i.id));
    const removed = before - this.items.length;
    if (removed > 0) this.save();
    return removed;
  }

  search(query: string): Favorite[] {
    const q = query.toLowerCase();
    return this.items.filter(
      i => i.text.toLowerCase().includes(q) || i.noteFileName.toLowerCase().includes(q)
    );
  }

  exportToMarkdown(ids: string[], savePath: string): void {
    const selected = this.items.filter(i => ids.includes(i.id));
    const lines: string[] = ['# 收藏导出', ''];
    for (const item of selected) {
      lines.push('---', '', `**文本**: "${item.text}"`, `**来源**: ${item.noteFileName}`, `**时间**: ${item.createdAt}`, '');
    }
    writeFileSync(savePath, lines.join('\n'), 'utf-8');
  }

  private load(): void {
    try {
      if (!existsSync(this.dataPath)) {
        this.items = [];
        return;
      }
      const raw = JSON.parse(readFileSync(this.dataPath, 'utf-8'));
      this.items = Array.isArray(raw) ? raw : [];
    } catch {
      this.items = [];
    }
  }

  private save(): void {
    try {
      const dir = dirname(this.dataPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(this.dataPath, JSON.stringify(this.items, null, 2), 'utf-8');
    } catch (err) {
      this.l.error('收藏保存失败', { error: (err as Error).message });
    }
  }
}
