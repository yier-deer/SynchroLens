import {
  formatSessionHeader,
  formatTranslationEntry,
  formatCorrectionEntry,
  buildMarkdownDocument,
} from '../../../src/main/utils/markdownFormatter';

describe('markdownFormatter Markdown 格式化', () => {
  describe('formatSessionHeader', () => {
    it('应该生成包含会话标题、日期、语言、时长、句子数的 Markdown 头部', () => {
      const header = formatSessionHeader({
        startTime: new Date('2026-06-05T14:30:00+08:00').getTime(),
        audioSource: '系统音频',
        sentenceCount: 47,
        duration: '12分35秒',
      });

      expect(header).toContain('# 2026-06-05 14:30:00 翻译会话');
      expect(header).toContain('音频源: 系统音频');
      expect(header).toContain('时长: 12分35秒');
      expect(header).toContain('句子数: 47');
    });
  });

  describe('formatTranslationEntry', () => {
    it('应该格式化单条翻译条目为包含原文、译文和时间戳的格式', () => {
      const timestamp = new Date('2026-06-05T14:30:15+08:00').getTime();
      const entry = formatTranslationEntry('The bank was closed today.', '银行今天关门了。', timestamp);

      expect(entry).toContain('14:30:15');
      expect(entry).toContain('The bank was closed today.');
      expect(entry).toContain('银行今天关门了。');
      expect(entry).toContain('|');
    });
  });

  describe('formatCorrectionEntry', () => {
    it('应该格式化纠正条目，标注被纠正的原文和修正后的译文', () => {
      const entry = formatCorrectionEntry({
        from: '河岸',
        to: '银行',
        reason: '金融语境',
      });

      expect(entry).toContain('~~河岸~~');
      expect(entry).toContain('银行');
      expect(entry).toContain('金融语境');
    });
  });

  describe('buildMarkdownDocument', () => {
    it('应该将头部和条目列表组装为完整的 Markdown 文档', () => {
      const header = '# 2026-06-05 14:30 翻译会话\n\n> 音频源: 系统音频 | 时长: 12分35秒 | 句子数: 47\n';
      const entries = [
        '14:30:15 | The bank was closed today.\n          | 银行今天关门了。\n',
      ];
      const doc = buildMarkdownDocument(header, entries);

      expect(doc).toContain(header);
      expect(doc).toContain(entries[0]);
      expect(doc).toContain('---');
    });

    it('应该处理空条目列表，仅输出头部和分隔线', () => {
      const header = '# 2026-06-05 14:30 翻译会话\n\n';
      const doc = buildMarkdownDocument(header, []);

      expect(doc).toContain(header);
      expect(doc).toContain('---');
    });

    it('应该在有摘要时追加摘要内容', () => {
      const header = '# 标题\n';
      const entries: string[] = [];
      const summary = '## 📊 摘要\n\n**主题**: 测试\n';
      const doc = buildMarkdownDocument(header, entries, summary);

      expect(doc).toContain(summary);
    });
  });
});
