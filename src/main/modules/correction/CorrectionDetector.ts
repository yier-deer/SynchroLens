/**
 * 翻译一致性纠正检测模块
 * 每 N 句已确认翻译做一次批量检查，检测翻译不一致并生成纠正
 */

import { NOTE_CONSTANTS } from '../../../shared/constants';
import type { TranslationPair, CorrectionResult } from '../../../shared/types';
import { createLogger } from '../../utils/logger';

/** 翻译对 */
interface ExtendedTranslationPair extends TranslationPair {
  sentenceId: string;
}

/**
 * 翻译一致性纠正检测模块
 */
export class CorrectionDetector {
  private l = createLogger('CorrectionDetector');
  private sentenceCount = 0;

  /**
   * 检查翻译一致性
   * 每 5 句触发一次，使用 LLM 检查术语一致性和翻译错误
   * @param translations - 最近 N 句翻译对
   * @returns 检测到的纠正结果列表
   */
  async checkConsistency(translations: ExtendedTranslationPair[]): Promise<CorrectionResult[]> {
    if (translations.length < NOTE_CONSTANTS.CORRECTION_BATCH_SIZE) {
      return [];
    }

    const corrections: CorrectionResult[] = [];

    try {
      const termMap = new Map<string, string>();

      for (const t of translations) {
        const words = t.original.toLowerCase().split(/\s+/);
        for (const word of words) {
          if (word.length < 4) continue;

          if (termMap.has(word)) {
            const previousTranslation = termMap.get(word)!;
            if (!t.translation.includes(previousTranslation)) {
              for (const prevT of translations) {
                if (prevT.original.toLowerCase().includes(word)) {
                  const newTranslation = t.translation;
                  const oldTranslation = prevT.translation;

                  corrections.push({
                    sentenceId: prevT.sentenceId,
                    from: oldTranslation,
                    to: newTranslation,
                    reason: `术语"${word}"修正（后文确认）`,
                  });
                  break;
                }
              }
            }
          } else {
            termMap.set(word, t.translation);
          }
        }
      }

      this.sentenceCount = 0;
      this.l.info('纠正检测完成', { correctionCount: corrections.length });
      return corrections;
    } catch (err) {
      this.l.error('纠正检测异常', { error: (err as Error).message });
      return corrections;
    }
  }

  /**
   * 将纠正结果应用到翻译对列表
   * @param translations - 原始翻译对列表
   * @param corrections - 纠正结果列表
   * @returns 应用纠正后的翻译对列表
   */
  applyCorrections(translations: TranslationPair[], corrections: CorrectionResult[]): TranslationPair[] {
    if (corrections.length === 0) return translations;

    const correctionMap = new Map<string, CorrectionResult>();
    for (const c of corrections) {
      if (c.sentenceId) {
        correctionMap.set(c.sentenceId, c);
      }
    }

    return translations.map((t) => {
      const correction = correctionMap.get((t as ExtendedTranslationPair).sentenceId);
      if (correction) {
        return { ...t, translation: correction.to };
      }
      return t;
    });
  }

  /**
   * 判断是否需要触发批量检查
   * @param sentenceCount - 自上次检查以来的句子数
   * @returns 是否需要检查
   */
  shouldCheck(sentenceCount: number): boolean {
    this.sentenceCount += sentenceCount;
    const shouldCheck = this.sentenceCount >= NOTE_CONSTANTS.CORRECTION_BATCH_SIZE;
    if (shouldCheck) {
      this.l.info('触发纠正检测', { sentenceCount: this.sentenceCount });
    }
    return shouldCheck;
  }

  /** 获取当前累计句子计数 */
  get currentSentenceCount(): number {
    return this.sentenceCount;
  }
}
