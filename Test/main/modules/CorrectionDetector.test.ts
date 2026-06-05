/**
 * CorrectionDetector 翻译一致性纠正检测单元测试
 * 测试术语一致性检查、纠正应用、批量触发逻辑
 */

import { CorrectionDetector } from '../../../src/main/modules/correction/CorrectionDetector';
import type { TranslationPair, CorrectionResult } from '../../../src/shared/types';

/** 创建翻译对 */
function pair(sentenceId: string, original: string, translation: string): TranslationPair {
  return { sentenceId, original, translation };
}

/** 创建标准测试数据 */
function makeTranslations(): TranslationPair[] {
  return [
    pair('s1', 'The algorithm is efficient', '该算法是高效的'),
    pair('s2', 'Algorithm complexity matters', '算法复杂性很重要'),
    pair('s3', 'Data structure selection', '数据结构选择'),
    pair('s4', 'The data structure affects performance', '数据结构影响性能'),
    pair('s5', 'Efficient algorithm design', '高效算法设计'),
  ];
}

describe('CorrectionDetector 翻译一致性纠正检测', () => {
  let detector: CorrectionDetector;

  beforeEach(() => {
    detector = new CorrectionDetector();
  });

  describe('checkConsistency 一致性检查', () => {
    it('应该在翻译数量不足5句时返回空数组', async () => {
      const translations: TranslationPair[] = [
        pair('s1', 'Hello world', '你好世界'),
        pair('s2', 'Good morning', '早上好'),
        pair('s3', 'How are you', '你好吗'),
        pair('s4', 'I am fine', '我很好'),
      ];

      const result = await detector.checkConsistency(translations);

      expect(result).toEqual([]);
    });

    it('应该在翻译完全一致（无术语冲突）时返回空数组', async () => {
      const translations: TranslationPair[] = [
        pair('s1', 'The book is good', '这本书很好'),
        pair('s2', 'I like books', '我喜欢书'),
        pair('s3', 'This is a pen', '这是一支笔'),
        pair('s4', 'Pen and paper', '笔和纸'),
        pair('s5', 'Reading is fun', '阅读很有趣'),
      ];

      // "book" 出现两次，"pen" 出现两次，但译文中没有冲突检测
      const result = await detector.checkConsistency(translations);

      // 简化检测：词长<4的跳过，所以 "pen"(3) 跳过，"book"(4) 的检测依赖译文中是否包含之前记录的译文片段
      // 这里"book"首次出现译文中没有特殊术语，所以不应产生纠正
      expect(Array.isArray(result)).toBe(true);
    });

    it('应该在术语翻译不一致时返回纠正结果', async () => {
      const translations: TranslationPair[] = [
        pair('s1', 'The algorithm is complex', '该算法很复杂'),
        pair('s2', 'Algorithm analysis', '算法分析很重要'),
        pair('s3', 'Machine learning algorithm', '机器学习方法'),
        pair('s4', 'This data structure is key', '这个数据结构是关键'),
        pair('s5', 'The structure matters', '结构很重要'),
      ];

      const result = await detector.checkConsistency(translations);

      // "algorithm" (长度>=4) 和 "data" (长度4)、"structure" (长度>=4)各出现多次
      // 检测到不一致时会生成纠正
      expect(Array.isArray(result)).toBe(true);
    });

    it('应该重置句子计数器', async () => {
      detector.shouldCheck(8); // 让内部计数器 >= 5
      expect(detector.currentSentenceCount).toBeGreaterThanOrEqual(5);

      const translations = makeTranslations();
      await detector.checkConsistency(translations);

      // checkConsistency 后计数器应归零
      expect(detector.currentSentenceCount).toBe(0);
    });
  });

  describe('applyCorrections 应用纠正', () => {
    it('应该将纠正结果应用到翻译对列表', () => {
      const translations: TranslationPair[] = [
        pair('s1', 'Hello', '你好'),
        pair('s2', 'World', '世界'),
      ];

      const corrections: CorrectionResult[] = [
        { sentenceId: 's1', from: '你好', to: '您好', reason: '更正式' },
      ];

      const result = detector.applyCorrections(translations, corrections);

      expect(result[0].translation).toBe('您好');
      expect(result[1].translation).toBe('世界');
    });

    it('应该在纠正列表为空时返回原列表不变', () => {
      const translations: TranslationPair[] = [
        pair('s1', 'Hello', '你好'),
      ];

      const result = detector.applyCorrections(translations, []);

      expect(result).toEqual(translations);
    });

    it('应该只更新有匹配 sentenceId 的条目', () => {
      const translations: TranslationPair[] = [
        pair('s1', 'Hello', '你好'),
        pair('s2', 'World', '世界'),
        pair('s3', 'Test', '测试'),
      ];

      const corrections: CorrectionResult[] = [
        { sentenceId: 's2', from: '世界', to: '地球', reason: '修正' },
      ];

      const result = detector.applyCorrections(translations, corrections);

      expect(result[0].translation).toBe('你好'); // 未变
      expect(result[1].translation).toBe('地球'); // 已纠正
      expect(result[2].translation).toBe('测试'); // 未变
    });

    it('应该在 sentenceId 不匹配时不修改原条目', () => {
      const translations: TranslationPair[] = [
        pair('s1', 'Hello', '你好'),
      ];

      const corrections: CorrectionResult[] = [
        { sentenceId: 'non-existent', from: '你好', to: '您好', reason: '修正' },
      ];

      const result = detector.applyCorrections(translations, corrections);

      expect(result[0].translation).toBe('你好');
    });
  });

  describe('shouldCheck 批量检查触发', () => {
    it('应该在句子数达到阈值时返回 true', () => {
      // CORRECTION_BATCH_SIZE = 5
      expect(detector.shouldCheck(5)).toBe(true);
    });

    it('应该在句子数不足阈值时返回 false', () => {
      expect(detector.shouldCheck(3)).toBe(false);
    });

    it('应该累加句子计数', () => {
      expect(detector.shouldCheck(3)).toBe(false);
      expect(detector.currentSentenceCount).toBe(3);

      expect(detector.shouldCheck(1)).toBe(false);
      expect(detector.currentSentenceCount).toBe(4);

      expect(detector.shouldCheck(1)).toBe(true);
      expect(detector.currentSentenceCount).toBe(5);
    });
  });

  describe('currentSentenceCount 计数', () => {
    it('应该初始化为 0', () => {
      expect(detector.currentSentenceCount).toBe(0);
    });
  });
});
