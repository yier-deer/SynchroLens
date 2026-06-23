import type { STTResult } from '../../../shared/types';

type SentenceCallback = (result: STTResult) => void;

export class SentenceAssembler {
  private currentSentence: STTResult | null = null;
  private history: STTResult[] = [];
  private callbacks = new Set<SentenceCallback>();

  push(result: STTResult): void {
    const text = result.text.trim();
    const fallbackText =
      !text && this.currentSentence?.sentenceId === result.sentenceId
        ? this.currentSentence.text.trim()
        : text;

    if (!fallbackText) {
      return;
    }

    const normalized: STTResult = {
      sentenceId: result.sentenceId,
      text: fallbackText,
      isFinal: result.isFinal,
      timestamp: result.timestamp,
    };

    if (normalized.isFinal) {
      this.currentSentence = null;
      this.history.push(normalized);
    } else {
      this.currentSentence = normalized;
    }

    for (const callback of this.callbacks) {
      callback(normalized);
    }
  }

  flush(): STTResult | null {
    if (!this.currentSentence) {
      return null;
    }

    const flushed: STTResult = {
      ...this.currentSentence,
      isFinal: true,
    };

    this.currentSentence = null;
    this.history.push(flushed);

    for (const callback of this.callbacks) {
      callback(flushed);
    }

    return flushed;
  }

  reset(): void {
    this.currentSentence = null;
    this.history = [];
  }

  onSentence(callback: SentenceCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  getCurrentSentence(): STTResult | null {
    return this.currentSentence;
  }

  getHistory(): STTResult[] {
    return [...this.history];
  }
}
