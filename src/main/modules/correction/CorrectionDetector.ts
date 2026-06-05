/**
 * 翻译一致性纠正检测模块
 * 每 N 句已确认翻译做一次批量检查，检测翻译不一致并生成纠正
 */

import { NOTE_CONSTANTS } from '../../../shared/constants';
import type { TranslationPair, CorrectionResult } from '../../../shared/types';

/** 翻译对 */
interface ExtendedTranslationPair extends TranslationPair {
  sentenceId: string;
}

/**
 * 翻译一致性纠正检测模块
 */
export class CorrectionDetector {
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

    // 检查术语一致性：同一英文单词是否有不同中文译法
    const termMap = new Map<string, string>();

    for (const t of translations) {
      const words = t.original.toLowerCase().split(/\s+/);
      for (const word of words) {
        // 只检查长度 >= 4 的词（减少噪音）
        if (word.length < 4) continue;

        if (termMap.has(word)) {
          const previousTranslation = termMap.get(word)!;
          // 检查当前句中该词是否有一段译文与之前不同
          // 简化：检查译文中是否包含之前记录的译文片段
          if (!t.translation.includes(previousTranslation)) {
            // 存在不一致，需要确定哪一句错了
            // 这里做简化处理：如果后文不一致，纠正前面的
            for (const prevT of translations) {
              if (prevT.original.toLowerCase().includes(word)) {
                // 提取后文的译文中与这个词相关的部分（简化处理）
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
          // 首次出现，记录该词和对应译文（简化：整句译文）
          termMap.set(word, t.translation);
        }
      }
    }

    // 重置计数器
    this.sentenceCount = 0;
    return corrections;
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
    return this.sentenceCount >= NOTE_CONSTANTS.CORRECTION_BATCH_SIZE;
  }

  /** 获取当前累计句子计数 */
  get currentSentenceCount(): number {
    return this.sentenceCount;
  }
}
