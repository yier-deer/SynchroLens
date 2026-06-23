import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import type { PersonalDictEntry } from '../../../shared/types';
import { createLogger } from '../../utils/logger';
import { cosineSimilarity } from '../vector/EmbeddingClient';

interface DictEntryWithEmbedding extends PersonalDictEntry {
  embedding?: number[];
}

export interface ScoredPersonalDictEntry {
  entry: PersonalDictEntry;
  score: number;
}

function genId(): string {
  return `pdict-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export class PersonalDictStore {
  private readonly l = createLogger('PersonalDictStore');
  private readonly dataPath: string;
  private items: DictEntryWithEmbedding[] = [];

  constructor() {
    this.dataPath = join(app.getPath('userData'), 'SynchroLens', 'personal-dict.json');
    this.load();
  }

  add(
    entry: { source: string; target: string; improvement: string; sourceNote: string },
    embedding?: number[],
  ): DictEntryWithEmbedding {
    const item: DictEntryWithEmbedding = {
      id: genId(),
      source: entry.source.trim(),
      target: entry.target.trim(),
      improvement: entry.improvement.trim(),
      sourceNote: entry.sourceNote.trim(),
      createdAt: new Date().toISOString(),
      embedding,
    };

    this.items.unshift(item);
    this.save();
    return { ...item };
  }

  getAll(): PersonalDictEntry[] {
    return this.items.map(({ embedding: _embedding, ...entry }) => ({ ...entry }));
  }

  getRuntimeEntries(): DictEntryWithEmbedding[] {
    return this.items.map((item) => ({ ...item, embedding: item.embedding ? [...item.embedding] : undefined }));
  }

  remove(id: string): boolean {
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) {
      return false;
    }

    this.items.splice(index, 1);
    this.save();
    return true;
  }

  removeBatch(ids: string[]): number {
    const idSet = new Set(ids);
    const before = this.items.length;
    this.items = this.items.filter((item) => !idSet.has(item.id));
    const removed = before - this.items.length;
    if (removed > 0) {
      this.save();
    }
    return removed;
  }

  isEnabled(): boolean {
    return this.items.length > 0;
  }

  searchBySimilarityWithScores(
    queryEmbedding: number[],
    topK = 5,
    threshold = 0.7,
  ): ScoredPersonalDictEntry[] {
    return this.items
      .filter((item) => item.embedding && item.embedding.length > 0)
      .map((item) => ({ item, score: cosineSimilarity(queryEmbedding, item.embedding!) }))
      .filter(({ score }) => score >= threshold)
      .sort((left, right) => right.score - left.score)
      .slice(0, topK)
      .map(({ item, score }) => {
        const { embedding: _embedding, ...entry } = item;
        return { entry: { ...entry }, score };
      });
  }

  searchBySimilarity(queryEmbedding: number[], topK = 5, threshold = 0.7): PersonalDictEntry[] {
    return this.searchBySimilarityWithScores(queryEmbedding, topK, threshold).map(({ entry }) => entry);
  }

  private load(): void {
    try {
      if (!existsSync(this.dataPath)) {
        this.items = [];
        return;
      }

      const raw = JSON.parse(readFileSync(this.dataPath, 'utf-8')) as unknown;
      if (!Array.isArray(raw)) {
        this.items = [];
        return;
      }

      this.items = raw
        .filter((item): item is DictEntryWithEmbedding => Boolean(item && typeof item === 'object'))
        .map((item) => ({
          id: String(item.id),
          source: String(item.source ?? '').trim(),
          target: String(item.target ?? '').trim(),
          improvement: String(item.improvement ?? '').trim(),
          sourceNote: String(item.sourceNote ?? '').trim(),
          createdAt: String(item.createdAt ?? ''),
          embedding: Array.isArray(item.embedding)
            ? item.embedding.filter((value): value is number => typeof value === 'number')
            : undefined,
        }))
        .filter((item) => item.id && item.source && item.target);
    } catch {
      this.items = [];
    }
  }

  private save(): void {
    try {
      const dir = dirname(this.dataPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      writeFileSync(this.dataPath, JSON.stringify(this.items, null, 2), 'utf-8');
    } catch (error) {
      this.l.error('个人词典保存失败', { error: (error as Error).message });
    }
  }
}
