import { TRANSLATE_CONSTANTS } from '../../../shared/constants';
import type { TranslationPair, TranslationResult } from '../../../shared/types';

export class ContextWindowManager {
  private pairs: TranslationPair[] = [];
  private maxSize: number;

  constructor(maxSize: number = TRANSLATE_CONSTANTS.CONTEXT_WINDOW_SIZE) {
    this.maxSize = maxSize;
  }

  setMaxSize(maxSize: number): void {
    const normalized = Number.isFinite(maxSize) && maxSize > 0
      ? Math.max(1, Math.floor(maxSize))
      : TRANSLATE_CONSTANTS.CONTEXT_WINDOW_SIZE;
    this.maxSize = normalized;
    this.trim();
  }

  remember(result: TranslationResult): void {
    const translation = result.translation.trim();
    if (!translation || result.error) {
      return;
    }

    this.pairs.push({
      sentenceId: result.sentenceId,
      original: result.original,
      translation,
    });
    this.trim();
  }

  getContext(): TranslationPair[] {
    return [...this.pairs];
  }

  reset(): void {
    this.pairs = [];
  }

  private trim(): void {
    if (this.pairs.length <= this.maxSize) {
      return;
    }

    this.pairs = this.pairs.slice(-this.maxSize);
  }
}
