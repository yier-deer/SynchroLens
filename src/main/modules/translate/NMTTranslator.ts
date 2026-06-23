import { TRANSLATE_CONSTANTS } from '../../../shared/constants';
import type { TranslationConstraint, TranslationPair } from '../../../shared/types';
import { createLogger } from '../../utils/logger';

interface NMTTranslatorConfig {
  apiEndpoint?: string;
  apiKey?: string;
  model?: string;
  targetLanguage?: string;
  timeoutMs?: number;
}

interface NMTResponse {
  translation?: string;
  text?: string;
  data?: {
    translation?: string;
    text?: string;
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sortConstraints(constraints: TranslationConstraint[]): TranslationConstraint[] {
  return [...constraints].sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }
    return right.source.length - left.source.length;
  });
}

export class NMTTranslator {
  private readonly l = createLogger('NMTTranslator');
  private apiEndpoint: string;
  private apiKey: string;
  private model: string;
  private targetLanguage: string;
  private timeoutMs: number;

  constructor(config: NMTTranslatorConfig) {
    this.apiEndpoint = config.apiEndpoint?.trim() || 'http://127.0.0.1:8765';
    this.apiKey = config.apiKey?.trim() || '';
    this.model = config.model?.trim() || 'nmt-default';
    this.targetLanguage = config.targetLanguage?.trim() || 'zh-CN';
    this.timeoutMs = config.timeoutMs ?? TRANSLATE_CONSTANTS.TRANSLATION_TIMEOUT_MS;
  }

  setApiKey(key: string): void {
    this.apiKey = key.trim();
  }

  setModel(model: string): void {
    this.model = model.trim() || this.model;
  }

  setTargetLanguage(targetLanguage: string): void {
    this.targetLanguage = targetLanguage.trim() || this.targetLanguage;
  }

  setApiEndpoint(endpoint: string): void {
    this.apiEndpoint = endpoint.trim() || this.apiEndpoint;
  }

  async *translate(
    text: string,
    context: TranslationPair[],
    constraints: TranslationConstraint[] = [],
    signal?: AbortSignal,
  ): AsyncGenerator<string> {
    this.l.info('NMT 翻译开始', {
      textLen: text.length,
      contextLen: context.length,
      constraintCount: constraints.length,
    });

    const response = await fetch(this.buildUrl(), {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({
        text,
        targetLanguage: this.targetLanguage,
        model: this.model,
        context,
      }),
      signal: this.mergeSignal(signal),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`NMT 翻译失败: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ''}`);
    }

    const payload = (await response.json()) as NMTResponse;
    const translation = payload.translation ?? payload.text ?? payload.data?.translation ?? payload.data?.text ?? '';
    const normalized = translation.trim();
    if (!normalized) {
      throw new Error('NMT 翻译失败: empty translation');
    }

    const enforced = this.applyConstraints(normalized, constraints);
    yield enforced;
    this.l.info('NMT 翻译完成', {
      textLen: text.length,
      translationLen: enforced.length,
      constraintCount: constraints.length,
    });
  }

  private applyConstraints(translation: string, constraints: TranslationConstraint[]): string {
    if (constraints.length === 0) {
      return translation;
    }

    let output = translation;
    const terminologyConstraints = constraints.filter((constraint) =>
      (constraint.sourceType === 'language' || constraint.sourceType === 'domain') &&
      constraint.enforceMode === 'term'
    );

    for (const constraint of sortConstraints(terminologyConstraints)) {
      const source = constraint.source.trim();
      const target = constraint.target.trim();
      if (!source || !target || output.includes(target)) {
        continue;
      }

      if (constraint.enforceMode === 'sentence') {
        output = target;
        continue;
      }

      const sourcePattern = new RegExp(escapeRegExp(source), 'gi');
      if (sourcePattern.test(output)) {
        output = output.replace(sourcePattern, target);
        continue;
      }

      output = `${target} ${output}`.trim();
    }

    return output;
  }

  private buildHeaders(): Record<string, string> {
    return this.apiKey
      ? {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        }
      : {
          'Content-Type': 'application/json',
        };
  }

  private mergeSignal(signal?: AbortSignal): AbortSignal {
    if (!signal) {
      return AbortSignal.timeout(this.timeoutMs);
    }

    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), this.timeoutMs);
    const merged = AbortSignal.any([signal, timeoutController.signal]);
    merged.addEventListener('abort', () => clearTimeout(timer), { once: true });
    return merged;
  }

  private buildUrl(): string {
    return this.apiEndpoint.endsWith('/translate')
      ? this.apiEndpoint
      : `${this.apiEndpoint.replace(/\/$/, '')}/translate`;
  }
}
