import type {
  STTResult,
  TranslatePartialPayload,
  TranslationConstraint,
  TranslationPair,
  TranslationResult,
} from '../../../shared/types';
import { createLogger } from '../../utils/logger';
import { ContextWindowManager } from './ContextWindowManager';

interface TranslationAdapter {
  translate(
    text: string,
    context: TranslationPair[],
    constraints: TranslationConstraint[],
    signal?: AbortSignal,
  ): AsyncGenerator<string>;
}

interface TranslationGatewayDependencies {
  translator: TranslationAdapter;
  contextWindow: ContextWindowManager;
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === 'AbortError';
  }

  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes('abort');
}

interface TranslateSentenceOptions {
  constraints?: TranslationConstraint[];
  onPartial?: (payload: TranslatePartialPayload & { original: string; constraints: TranslationConstraint[] }) => void;
  signal?: AbortSignal;
}

export class TranslationGateway {
  private readonly l = createLogger('TranslationGateway');

  constructor(private readonly deps: TranslationGatewayDependencies) {}

  async translateSentence(
    sentence: STTResult,
    options: TranslateSentenceOptions = {},
  ): Promise<TranslationResult> {
    const original = sentence.text.trim();
    const constraints = options.constraints ?? [];
    if (!original) {
      return {
        sentenceId: sentence.sentenceId,
        original: sentence.text,
        translation: '',
        isFinal: true,
        corrections: [],
        constraints,
      };
    }

    let translation = '';
    const context = this.deps.contextWindow.getContext();

    try {
      for await (const chunk of this.deps.translator.translate(original, context, constraints, options.signal)) {
        translation += chunk;
        options.onPartial?.({
          sentenceId: sentence.sentenceId,
          original,
          translation,
          constraints,
        });
      }

      const result: TranslationResult = {
        sentenceId: sentence.sentenceId,
        original,
        translation: translation.trim(),
        isFinal: true,
        corrections: [],
        constraints,
      };
      this.deps.contextWindow.remember(result);
      return result;
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      this.l.warn('NMT 翻译降级到当前句失败', { sentenceId: sentence.sentenceId, error: message });
      return {
        sentenceId: sentence.sentenceId,
        original,
        translation: '',
        isFinal: true,
        corrections: [],
        constraints,
        error: message,
      };
    }
  }

  reset(): void {
    this.deps.contextWindow.reset();
  }

  updateWindowSize(size: number): void {
    this.deps.contextWindow.setMaxSize(size);
  }
}
