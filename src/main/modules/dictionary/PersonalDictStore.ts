import { app } from 'electron';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { DictEntry } from '../../../shared/types';
import { cosineSimilarity } from '../vector/EmbeddingClient';
import { createLogger } from '../../utils/logger';

/** 带向量的词典条目 */
interface DictEntryWithEmbedding extends DictEntry {
  embedding?: number[];
}

function genId(): string {
  return `pdict-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export class PersonalDictStore {
  private l = createLogger('PersonalDictStore');
  private dataPath: string;
  private items: DictEntryWithEmbedding[] = [];

  constructor() {
    this.dataPath = join(app.getPath('userData'), 'SynchroLens', 'personal-dict.json');
    this.load();
  }

  add(entry: { source: string; target: string; improvement: string; sourceNote: string }, embedding?: number[]): DictEntryWithEmbedding {
    const item: DictEntryWithEmbedding = { id: genId(), ...entry, createdAt: new Date().toISOString(), embedding };
    this.items.push(item);
    this.save();
    return item;
  }

  getAll(): DictEntryWithEmbedding[] {
    return [...this.items];
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

  isEnabled(): boolean {
    return this.items.length > 0;
  }

  /** 余弦相似度搜索与查询最相似的条目 */
  searchBySimilarity(queryEmbedding: number[], topK: number = 5, threshold: number = 0.7): DictEntryWithEmbedding[] {
    return this.items
      .filter((item) => item.embedding && item.embedding.length > 0)
      .map((item) => ({ item, score: cosineSimilarity(queryEmbedding, item.embedding!) }))
      .filter(({ score }) => score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(({ item }) => item);
  }

  private load(): void {
    try {
      if (!existsSync(this.dataPath)) { this.items = []; return; }
      const raw = JSON.parse(readFileSync(this.dataPath, 'utf-8'));
      this.items = Array.isArray(raw) ? raw : [];
    } catch { this.items = []; }
  }

  private save(): void {
    try {
      const dir = dirname(this.dataPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(this.dataPath, JSON.stringify(this.items, null, 2), 'utf-8');
    } catch (err) { this.l.error('个人词典保存失败', { error: (err as Error).message }); }
  }
}
